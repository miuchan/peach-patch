import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  fetchVerifiedWasm,
  modulesFromRegistryIndex,
} from "../lib/peach-registry-client.ts";

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
