#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WEB_PLUGIN_REGISTRY } from "../lib/web-plugin-registry.ts";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const outputDir = path.resolve(argument("--output", path.join(projectDir, "..", "peach-patch-registry")));
const targetKey = argument("--key", null);
const marker = path.join(outputDir, ".peach-registry");
const packagesDir = path.join(outputDir, "packages");
const dynamicCatalogPath = path.join(projectDir, "public", "dynamic-plugins", "catalog.json");
const discoveryPath = path.join(projectDir, ".rack-web-cache", "open-source-modules.json");
const buildStatePath = path.join(projectDir, ".rack-web-cache", "open-source-build-state.json");

function safeSegment(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value))
    throw new Error(`Unsafe ${label}: ${value}`);
  return value;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

if (fs.existsSync(outputDir) && !fs.existsSync(marker)) {
  const entries = fs.readdirSync(outputDir);
  if (entries.length) throw new Error(`Refusing to replace non-registry directory ${outputDir}`);
}
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(marker, "Peach Patch registry generated directory\n");
if (!targetKey) fs.rmSync(packagesDir, { recursive: true, force: true });

const dynamic = JSON.parse(fs.readFileSync(dynamicCatalogPath, "utf8"));
const allModules = [
  ...new Map([...WEB_PLUGIN_REGISTRY, ...dynamic].map((item) => [item.key, item])).values(),
].sort((a, b) => a.key.localeCompare(b.key));
const modules = targetKey
  ? allModules.filter((item) => item.key === targetKey)
  : allModules;
if (targetKey && modules.length !== 1) throw new Error(`Unknown registry key ${targetKey}`);
const existingIndexPath = path.join(outputDir, "index.json");
const existingPackages = targetKey && fs.existsSync(existingIndexPath)
  ? JSON.parse(fs.readFileSync(existingIndexPath, "utf8")).packages
  : [];
const packages = existingPackages.filter((item) => item.key !== targetKey);
let totalBytes = packages.reduce((sum, item) => sum + item.artifact.size, 0);

for (const source of modules) {
  const plugin = safeSegment(source.plugin, "plugin slug");
  const model = safeSegment(source.model, "model slug");
  const version = safeSegment(source.version || "0.0.0", "version");
  const sourceArtifact = path.join(projectDir, "public", source.wasmUrl.replace(/^\//, ""));
  if (!fs.existsSync(sourceArtifact)) throw new Error(`Missing WASM for ${source.key}: ${sourceArtifact}`);
  const packageDir = path.join(packagesDir, plugin, model, version);
  const artifactPath = path.join(packageDir, "module.wasm");
  fs.mkdirSync(packageDir, { recursive: true });
  fs.copyFileSync(sourceArtifact, artifactPath);
  const size = fs.statSync(artifactPath).size;
  const digest = sha256(artifactPath);
  totalBytes += size;
  const relativeArtifact = `packages/${plugin}/${model}/${version}/module.wasm`;
  const relativeManifest = `packages/${plugin}/${model}/${version}/manifest.json`;
  const module = {
    ...source,
    wasmUrl: relativeArtifact,
    manifestUrl: relativeManifest,
    ...(source.localBuild?.sourceCommit ? { sourceCommit: source.localBuild.sourceCommit } : {}),
    artifact: { sha256: digest, size },
  };
  delete module.localBuild;
  const manifest = {
    schemaVersion: 1,
    abiVersion: "0.3",
    module,
    source: {
      url: source.sourceUrl,
      commit: source.localBuild?.sourceCommit ?? null,
    },
    build: {
      strategy: source.runtime?.strategy ?? "ordered-translation",
      fingerprint: source.localBuild?.fingerprint ?? null,
      builtAt: source.localBuild?.builtAt ?? null,
    },
  };
  writeJson(path.join(outputDir, relativeManifest), manifest);
  packages.push(module);
}
packages.sort((a, b) => a.key.localeCompare(b.key));

const index = {
  schemaVersion: 1,
  abiVersion: "0.3",
  generatedAt: new Date().toISOString(),
  packageCount: packages.length,
  totalBytes,
  packages,
};
writeJson(path.join(outputDir, "index.json"), index);
const discovery = fs.existsSync(discoveryPath)
  ? JSON.parse(fs.readFileSync(discoveryPath, "utf8"))
  : null;
const buildState = fs.existsSync(buildStatePath)
  ? JSON.parse(fs.readFileSync(buildStatePath, "utf8"))
  : { modules: {} };
const packageKeys = new Set(packages.map((item) => item.key));
const buildRecords = discovery?.moduleRecords?.map((item) => {
  const state = buildState.modules?.[item.key];
  const status = packageKeys.has(item.key)
    ? "compiled"
    : state?.status === "failed"
      ? "failed"
      : "pending";
  return {
    key: item.key,
    plugin: item.plugin,
    model: item.model,
    name: item.name,
    version: item.version,
    license: item.license,
    sourceUrl: item.sourceUrl,
    libraryUrl: item.libraryUrl,
    status,
    ...(state?.sourceCommit ? { sourceCommit: state.sourceCommit } : {}),
    ...(status === "failed" && state?.assessment
      ? { assessment: state.assessment }
      : {}),
  };
}) ?? [];
const statusCounts = Object.fromEntries(
  Object.entries(Object.groupBy(buildRecords, (item) => item.status))
    .map(([key, values]) => [key, values.length]),
);
writeJson(path.join(outputDir, "build-status.json"), {
  schemaVersion: 1,
  generatedAt: index.generatedAt,
  sourceRevision: discovery?.sourceRevision ?? null,
  packages: discovery?.packages ?? null,
  modules: buildRecords.length,
  status: statusCounts,
  records: buildRecords,
});
writeJson(path.join(outputDir, "coverage.json"), {
  schemaVersion: 1,
  generatedAt: index.generatedAt,
  compiledModules: packages.length,
  plugins: [...new Set(packages.map((item) => item.plugin))].length,
  openSourceCandidates: buildRecords.length,
  openSourceStatus: statusCounts,
  strategies: Object.fromEntries(
    Object.entries(Object.groupBy(packages, (item) => item.runtime?.strategy ?? "ordered-translation"))
      .map(([key, values]) => [key, values.length]),
  ),
  bytes: totalBytes,
});

const packageJson = {
  name: "peach-patch-registry",
  version: "1.0.0",
  private: true,
  type: "module",
  bin: { peach: "bin/peach.mjs" },
  scripts: { test: "node scripts/verify-registry.mjs" },
};
writeJson(path.join(outputDir, "package.json"), packageJson);
fs.mkdirSync(path.join(outputDir, "bin"), { recursive: true });
fs.mkdirSync(path.join(outputDir, "scripts"), { recursive: true });
fs.mkdirSync(path.join(outputDir, ".github", "workflows"), { recursive: true });
fs.copyFileSync(path.join(projectDir, "scripts", "registry", "peach.mjs"), path.join(outputDir, "bin", "peach.mjs"));
fs.copyFileSync(path.join(projectDir, "scripts", "registry", "verify-registry.mjs"), path.join(outputDir, "scripts", "verify-registry.mjs"));
fs.copyFileSync(path.join(projectDir, "scripts", "registry", "README.md"), path.join(outputDir, "README.md"));
fs.copyFileSync(path.join(projectDir, "scripts", "registry", "verify.yml"), path.join(outputDir, ".github", "workflows", "verify.yml"));
fs.writeFileSync(path.join(outputDir, ".gitignore"), ".DS_Store\n");
console.log(JSON.stringify({ outputDir, modules: packages.length, totalBytes }, null, 2));
