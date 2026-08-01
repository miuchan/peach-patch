import assert from "node:assert/strict";
import test from "node:test";
import { parseAutosavedPatch } from "../lib/patch-autosave.ts";
import { parseVcvArchive } from "../lib/vcv-patch.ts";
import { modulesFromRegistryIndex } from "../lib/peach-registry-client.ts";

test("autosave parser rejects structurally invalid JSON instead of trusting a cast", () => {
  assert.equal(parseAutosavedPatch(JSON.stringify({ modules: [{}], cables: [] })), null);
  assert.equal(parseAutosavedPatch(JSON.stringify({ modules: [], cables: [{}] })), null);
  assert.equal(parseAutosavedPatch("not json"), null);
});

test("VCV parser rejects JSON that does not contain a valid module graph", () => {
  assert.throws(
    () => parseVcvArchive(new TextEncoder().encode(JSON.stringify({ modules: [{}], cables: [] }))),
    /no module graph/,
  );
});

test("registry parser rejects incomplete remote packages", () => {
  assert.throws(
    () => modulesFromRegistryIndex({ schemaVersion: 1, packages: [{ key: "Missing/Fields" }] }, "https://example.com/index.json"),
    /invalid package/,
  );
});
