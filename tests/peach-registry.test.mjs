import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import {
  DEFAULT_PEACH_REGISTRY_URL,
  fetchVerifiedWasm,
  loadPeachRegistry,
  modulesFromRegistryIndex,
} from "../lib/peach-registry-client.ts";

test("the website default is the GitHub registry",()=>{
  assert.equal(DEFAULT_PEACH_REGISTRY_URL,"https://raw.githubusercontent.com/miuchan/peach-patch-registry/main/index.json");
});

test("the website has no bundled catalog or local compiler plugin fallback",()=>{
  const studio=fs.readFileSync(new URL("../app/rack-web-studio.tsx",import.meta.url),"utf8"),
    runtimeRegistry=fs.readFileSync(new URL("../lib/runtime-plugin-registry.ts",import.meta.url),"utf8"),
    resolver=fs.readFileSync(new URL("../server/api/library-resolve.ts",import.meta.url),"utf8"),
    packageJson=JSON.parse(fs.readFileSync(new URL("../package.json",import.meta.url),"utf8"));
  assert.match(studio,/loadPeachRegistry\(undefined,controller\.signal\)/);
  assert.doesNotMatch(studio,/\/dynamic-plugins\/catalog|LOCAL_PLUGIN_BUILDER|127\.0\.0\.1:4179|\/compile\b/);
  assert.doesNotMatch(runtimeRegistry,/WEB_PLUGIN_(?:BY_KEY|REGISTRY)|registerDynamicModule/);
  assert.doesNotMatch(resolver,/WEB_PLUGIN_(?:BY_KEY|REGISTRY)|dynamic-plugins/);
  assert.equal(packageJson.scripts.dev,"vite");
  assert.equal(packageJson.dependencies["react-router"],"^7.18.2");
  assert.equal(packageJson.dependencies.next,undefined);
  assert.equal(packageJson.devDependencies.vinext,undefined);
});

const moduleRecord = {
  key: "Test/Osc",
  plugin: "Test",
  model: "Osc",
  name: "Osc",
  brand: "Test",
  version: "1.0.0",
  license: "MIT",
  sourceUrl: "https://example.com/source",
  libraryUrl: "https://example.com/library",
  screenshotUrl: "https://example.com/screenshot.webp",
  wasmUrl: "packages/Test/Osc/1.0.0/module.wasm",
  manifestUrl: "packages/Test/Osc/1.0.0/manifest.json",
  artifact: { sha256: "a".repeat(64), size: 8 },
  width: 45,
  description: "test",
  params: [],
  inputs: [],
  outputs: [],
  lights: 0,
};

test("registry index resolves immutable artifact URLs", () => {
  const [module] = modulesFromRegistryIndex(
    { schemaVersion: 1, abiVersion: "0.3", packages: [moduleRecord] },
    "https://raw.example/registry/index.json",
  );
  assert.equal(
    module.wasmUrl,
    "https://raw.example/registry/packages/Test/Osc/1.0.0/module.wasm",
  );
  assert.equal(
    module.manifestUrl,
    "https://raw.example/registry/packages/Test/Osc/1.0.0/manifest.json",
  );
});

test("registry geometry repairs panels whose declared width clips their controls", () => {
  const [module] = modulesFromRegistryIndex(
    {
      schemaVersion: 1,
      packages: [{
        ...moduleRecord,
        width: 5,
        params: [{
          id: 0,
          name: "Program",
          min: 0,
          max: 127,
          default: 0,
          position: { x: 31, y: 208, widget: "KnobDark26" },
        }],
        inputs: [{ id: 0, name: "CV", kind: "cv", position: { x: 34, y: 212 } }],
      }],
    },
    "https://raw.example/registry/index.json",
  );
  assert.equal(module.width, 75);
});

test("registry geometry brings clipped positions back into the fixed Rack panel", () => {
  const [module] = modulesFromRegistryIndex(
    {
      schemaVersion: 1,
      packages: [{
        ...moduleRecord,
        params: [{
          id: 0,
          name: "Edge",
          min: 0,
          max: 1,
          default: 0,
          position: { x: -5, y: -10, centered: true },
        }],
        inputs: [{ id: 0, name: "Late", kind: "cv", position: { x: 20, y: 500 } }],
      }],
    },
    "https://raw.example/registry/index.json",
  );
  assert.equal(module.params[0].position?.x, 15);
  assert.equal(module.params[0].position?.y, 36);
  assert.equal(module.inputs[0].position?.y, 344);
});

test("registry index requests revalidate the mutable main index", async () => {
  const previousFetch=globalThis.fetch;
  let options;
  globalThis.fetch=async (_url,nextOptions)=>{options=nextOptions;return new Response(JSON.stringify({schemaVersion:1,abiVersion:"0.3",packages:[moduleRecord]}),{headers:{"content-type":"application/json"}})};
  try{await loadPeachRegistry("https://raw.example/registry/index.json");assert.equal(options.cache,"no-cache");}
  finally{globalThis.fetch=previousFetch;}
});

test("local registry and WASM URLs are rejected",async()=>{
  await assert.rejects(loadPeachRegistry("http://localhost:4179/catalog"),/must use HTTPS/);
  await assert.rejects(fetchVerifiedWasm({key:"Test/Osc",wasmUrl:"/dynamic-plugins/Test/Osc/module.wasm",artifact:{sha256:"0".repeat(64),size:8}}),/must use HTTPS|Invalid URL/);
});

test("registry index rejects duplicate module keys", () => {
  assert.throws(
    () => modulesFromRegistryIndex(
      { schemaVersion: 1, packages: [moduleRecord, moduleRecord] },
      "https://raw.example/registry/index.json",
    ),
    /Duplicate registry key/,
  );
});

test("WASM download is checked before execution", async () => {
  const previousFetch = globalThis.fetch;
  const bytes = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0]);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  globalThis.fetch = async () => new Response(bytes);
  try {
    const result = await fetchVerifiedWasm({
      key: "Test/Osc",
      wasmUrl: "https://raw.example/module.wasm",
      artifact: { sha256, size: bytes.byteLength },
    });
    assert.deepEqual(new Uint8Array(result), bytes);
    await assert.rejects(
      fetchVerifiedWasm({
        key: "Test/Osc",
        wasmUrl: "https://raw.example/module.wasm",
        artifact: { sha256: "0".repeat(64), size: bytes.byteLength },
      }),
      /integrity check failed/,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
