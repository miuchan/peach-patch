#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const queuePath = path.join(projectDir, ".rack-web-cache", "open-source-modules.json");
const statePath = path.join(projectDir, ".rack-web-cache", "open-source-build-state.json");
const catalogPath = path.join(projectDir, "public", "dynamic-plugins", "catalog.json");
const outputRoot = path.join(projectDir, ".rack-web-cache", "open-source-builds");
const sourceCacheDir = path.join(projectDir, ".rack-web-cache", "sources");
const sourceLicenseExclusions = new Map([
  ["STS", "The source owner stated that the repository was unintentionally public and that its code and ports must not be redistributed: https://community.vcvrack.com/t/sts-odyssey/18614/7"],
]);
const value = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const limit = value("--limit") ? Number(value("--limit")) : Number.POSITIVE_INFINITY;
const pluginFilter = value("--plugin");
const modelFilter = value("--model");
const retry = process.argv.includes("--retry");
const force = process.argv.includes("--force");
const keepSource = process.argv.includes("--keep-source");
const keepBuild = process.argv.includes("--keep-build");
const concurrency = Math.max(1, Math.min(8, Number(value("--concurrency") || Math.min(4, os.availableParallelism()))));

if (!fs.existsSync(queuePath)) throw new Error("Run npm run registry:discover first");
const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const definitions = new Map(catalog.map((item) => [item.key, item]));
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { schemaVersion: 1, modules: {} };

function persist() {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  fs.writeFileSync(catalogPath, `${JSON.stringify([...definitions.values()].sort((a, b) => a.key.localeCompare(b.key)), null, 2)}\n`);
}

for (const item of queue.moduleRecords) {
  const exclusion = sourceLicenseExclusions.get(item.plugin);
  if (!exclusion || definitions.has(item.key)) continue;
  state.modules[item.key] = {
    status: "failed",
    finishedAt: new Date().toISOString(),
    error: `Excluded from the open-source registry. ${exclusion}`,
    assessment: {
      strategy: "excluded-source-license",
      compileEligible: false,
      requiresReview: false,
      blockers: ["source-license"],
    },
  };
}
persist();

const candidates = queue.moduleRecords.filter((item) =>
  !sourceLicenseExclusions.has(item.plugin) &&
  (!pluginFilter || item.plugin === pluginFilter) &&
  (!modelFilter || item.model === modelFilter) &&
  (force || !definitions.has(item.key)) &&
  (retry || state.modules[item.key]?.status !== "failed"),
).slice(0, limit);
let succeeded = 0;
let failed = 0;
let started = 0;
let removedSourceRepositories = 0;

function removePluginSource(plugin) {
  if (keepSource) return;
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(plugin))
    throw new Error(`Unsafe plugin cache key ${plugin}`);
  const target = path.join(sourceCacheDir, plugin);
  if (fs.existsSync(target)) removedSourceRepositories += 1;
  fs.rmSync(target, { recursive: true, force: true });
}

const groups = new Map();
for (const item of candidates) {
  const group = groups.get(item.plugin) || [];
  group.push(item);
  groups.set(item.plugin, group);
}

async function processItem(item) {
  const buildDir = path.join(outputRoot, item.plugin, item.model);
  fs.mkdirSync(buildDir, { recursive: true });
  const previousState = state.modules[item.key];
  state.modules[item.key] = { status: "building", startedAt: new Date().toISOString() };
  persist();
  started += 1;
  process.stderr.write(`[${started}/${candidates.length}] ${item.key}\n`);
  try {
    const { stdout } = await execute(process.execPath, [
      path.join(projectDir, "scripts", "scaffold-library-module.mjs"),
      item.libraryUrl,
      "--source-cache-dir", sourceCacheDir,
      "--output", buildDir,
      "--compile",
    ], { cwd: projectDir, timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    const result = JSON.parse(stdout);
    const runtime = JSON.parse(fs.readFileSync(path.join(buildDir, "runtime.json"), "utf8"));
    const destination = path.join(projectDir, "public", "dynamic-plugins", item.plugin, item.model);
    fs.mkdirSync(destination, { recursive: true });
    fs.copyFileSync(result.artifact, path.join(destination, "module.wasm"));
    runtime.wasmUrl = `/dynamic-plugins/${item.plugin}/${item.model}/module.wasm`;
    runtime.runtime = { ...(runtime.runtime || {}), strategy: "direct-rack-source-adapter" };
    runtime.localBuild = {
      builtAt: new Date().toISOString(),
      sourceCommit: result.source?.commit || null,
      batch: true,
    };
    definitions.set(item.key, runtime);
    state.modules[item.key] = { status: "compiled", finishedAt: new Date().toISOString(), sourceCommit: result.source?.commit || null };
    succeeded += 1;
  } catch (error) {
    const assessmentFile = path.join(buildDir, "adapter.json");
    let assessment = previousState?.assessment;
    try { assessment = JSON.parse(fs.readFileSync(assessmentFile, "utf8")).assessment; } catch {}
    state.modules[item.key] = {
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: [
        error instanceof Error ? error.message : String(error),
        typeof error?.stderr === "string" ? error.stderr : "",
      ].filter(Boolean).join("\n").slice(-16000),
      assessment,
    };
    failed += 1;
  }
  persist();
  if (!keepBuild) fs.rmSync(buildDir, { recursive: true, force: true });
}

for (const [plugin, items] of groups) {
  try {
    const [first, ...rest] = items;
    if (first) await processItem(first);
    const pluginCheckoutReady = fs.existsSync(path.join(sourceCacheDir, plugin));
    if (!pluginCheckoutReady || concurrency === 1) {
      for (const item of rest) await processItem(item);
      continue;
    }
    let cursor = 0;
    await Promise.all(Array.from(
      { length: Math.min(concurrency, rest.length) },
      async () => {
        while (cursor < rest.length) {
          const item = rest[cursor];
          cursor += 1;
          await processItem(item);
        }
      },
    ));
  } finally {
    removePluginSource(plugin);
  }
}

console.log(JSON.stringify({ attempted: candidates.length, succeeded, failed, concurrency, catalogModules: definitions.size, removedSourceRepositories, statePath }, null, 2));
if (failed) process.exitCode = 2;
