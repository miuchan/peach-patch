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
    /module graph format is unsupported or invalid/,
  );
  assert.throws(
    () =>
      parseVcvArchive(
        new TextEncoder().encode(
          JSON.stringify({
            version: "0.6.0",
            modules: [
              {
                plugin: "Legacy",
                model: "Oscillator",
                pos: [0, 0],
                params: [{ paramId: 0, value: 0.5 }],
              },
            ],
            wires: [],
          }),
        ),
      ),
    /VCV Rack 0\.6\.0 patch could not be loaded because its module graph format is unsupported or invalid/,
  );
});

test("VCV parser normalizes Rack 0.x modules, wires, parameters, and pixel coordinates", () => {
  const patch = parseVcvArchive(
    new TextEncoder().encode(
      JSON.stringify({
        version: "0.3.1",
        modules: [
          { plugin: "Fundamental", model: "VCO", pos: [30, 380], params: [0.25, 1] },
          {
            plugin: "Core",
            model: "AudioInterface",
            pos: [180, 380],
            params: [],
            data: { audio: 0 },
          },
        ],
        wires: [{ outputModuleId: 0, outputId: 0, inputModuleId: 1, inputId: 0 }],
      }),
    ),
  );
  assert.equal(patch.version, "2.6.6");
  assert.equal(patch.patchworkWebSourceVersion, "0.3.1");
  assert.deepEqual(patch.patchworkWebMigrations, ["rack-0.3.x-widget-order-to-v2"]);
  assert.deepEqual(patch.modules[0], {
    plugin: "Fundamental",
    model: "VCO",
    id: 0,
    pos: [2, 1],
    params: [
      { id: 0, value: 0.25 },
      { id: 1, value: 1 },
    ],
    patchworkWebLegacyUi: { legacyWidth: 150 },
  });
  assert.deepEqual(patch.cables[0], {
    id: 0,
    outputModuleId: 0,
    outputId: 0,
    inputModuleId: 1,
    inputId: 0,
  });
  assert.equal("wires" in patch, false);
});

test("registry parser rejects incomplete remote packages", () => {
  assert.throws(
    () =>
      modulesFromRegistryIndex(
        { schemaVersion: 1, packages: [{ key: "Missing/Fields" }] },
        "https://example.com/index.json",
      ),
    /invalid package/,
  );
});
