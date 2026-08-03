import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LEGACY_VCV_MIGRATIONS } from "../lib/vcv-legacy-migrations.ts";
import { parseVcvArchive, type VcvModule } from "../lib/vcv-patch.ts";
import { rackLegacyUi } from "../lib/rack-module-compatibility.ts";
import { importVcvPatch } from "../lib/vcv-patch-import.ts";
import { hydrateModulesWithDefinitions } from "../lib/patch-hydrate.ts";
import type { WebPluginModule } from "../lib/web-plugin-registry.ts";

function parseLegacy(modules: unknown[], wires: unknown[] = [], version = "0.3.1") {
  return parseVcvArchive(new TextEncoder().encode(JSON.stringify({ version, modules, wires })));
}

function moduleParams(module: VcvModule): Map<number, number> {
  return new Map(module.params?.map((param) => [param.id, param.value]));
}

function legacyModule(
  plugin: string,
  model: string,
  params: number[],
  data?: Record<string, unknown>,
) {
  return { plugin, model, pos: [0, 0], params, ...(data ? { data } : {}) };
}

function webDefinition(key: string, width: number): WebPluginModule {
  const [plugin, model] = key.split("/");
  return {
    key,
    plugin,
    model,
    name: model,
    brand: plugin,
    version: "2.6.4",
    license: "GPL-3.0-or-later",
    sourceUrl: "https://example.com/source",
    libraryUrl: "https://example.com/library",
    screenshotUrl: `https://example.com/${model}.webp`,
    wasmUrl: `https://example.com/${model}.wasm`,
    width,
    description: "",
    params: [],
    inputs: [],
    outputs: [],
    lights: 0,
  };
}

test("Rack 0.3 migration table covers the compatibility-sensitive modules", () => {
  const migration = LEGACY_VCV_MIGRATIONS.find((item) => item.matches("0.3.1"));
  assert.ok(migration);
  assert.deepEqual(Object.keys(migration.modules).sort(), [
    "AudibleInstruments/Braids",
    "AudibleInstruments/Branches",
    "Fundamental/SEQ3",
    "Fundamental/Scope",
    "Fundamental/VCF",
    "Fundamental/VCO",
  ]);
  assert.equal(
    LEGACY_VCV_MIGRATIONS.some((item) => item.matches("0.4.0")),
    false,
  );
});

test("legacy panel width overrides keep control visuals on source geometry", async () => {
  const panel = await readFile(
    new URL("../app/components/module-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(panel.match(/sourceWidth=\{definition\.width\}/g)?.length, 2);
  assert.doesNotMatch(panel, /sourceWidth=\{module\.width\}/);
});

test("Rack 0.3 Braids widget order becomes Rack 2 parameter IDs", () => {
  const patch = parseLegacy([
    legacyModule("AudibleInstruments", "Braids", [23, 0.1, -0.25, 0.2, 0.3, -0.4, 0.8]),
  ]);
  const params = moduleParams(patch.modules[0]);
  assert.deepEqual(
    [...params.entries()],
    [
      [0, 0.1],
      [1, -0.25],
      [2, 0.2],
      [3, 0.3],
      [4, -0.4],
      [5, 0.8],
      [6, 0.5],
    ],
  );
});

test("Rack 0.3 VCO and SEQ3 widget orders become Rack 2 parameter IDs", () => {
  const seqParams = [1, 2, 3, 8];
  for (let step = 0; step < 8; step += 1) {
    seqParams.push(10 + step * 10, 11 + step * 10, 12 + step * 10, 13 + step * 10);
  }
  const patch = parseLegacy([
    legacyModule("Fundamental", "VCO", [0, 1, -26, 0.1, 0.42, -0.3, 0.65]),
    legacyModule("Fundamental", "SEQ3", seqParams, { gates: [1, 0, 1, 0, 1, 0, 1, 0] }),
  ]);
  assert.deepEqual(
    [...moduleParams(patch.modules[0]).entries()],
    [
      [0, 0],
      [1, 1],
      [2, -26],
      [3, 0.1],
      [5, 0.42],
      [4, -0.3],
      [6, 0.65],
    ],
  );
  assert.equal(rackLegacyUi({ rack: patch.modules[0] }).width, undefined);
  assert.equal(rackLegacyUi({ rack: patch.modules[0] }).legacyWidth, 150);
  const seq = moduleParams(patch.modules[1]);
  assert.equal(seq.get(4), 10);
  assert.equal(seq.get(5), 20);
  assert.equal(seq.get(12), 11);
  assert.equal(seq.get(20), 12);
  assert.equal(seq.get(28), 13);
  assert.equal(seq.get(35), 83);
});

test("Rack 0.3 Scope migrates time and durable button state", () => {
  const patch = parseLegacy([
    legacyModule("Fundamental", "Scope", [2, 0.006, 1, 0, -16, 0, 0.25, 0], {
      sum: 1,
      ext: 1,
    }),
  ]);
  const params = moduleParams(patch.modules[0]);
  assert.equal(params.get(4), 7);
  assert.equal(params.get(5), 1);
  assert.equal(params.get(6), 0.25);
  assert.equal(params.get(7), 1);
  assert.deepEqual(patch.modules[0].data, {
    sum: 1,
    ext: 1,
    lissajous: 1,
    external: 1,
  });
});

test("Rack 0.3 Branches ports follow the legacy panel order", () => {
  const patch = parseLegacy(
    [
      legacyModule("AudibleInstruments", "Branches", [0.2, 0.8]),
      legacyModule("AudibleInstruments", "Branches", [0.4, 0.6]),
    ],
    [{ outputModuleId: 0, outputId: 1, inputModuleId: 1, inputId: 1 }],
  );
  assert.deepEqual(patch.modules[0].params, [
    { id: 0, value: 0.2 },
    { id: 1, value: 0.8 },
  ]);
  assert.deepEqual(rackLegacyUi({ rack: patch.modules[0] }), {
    width: undefined,
    legacyWidth: undefined,
    hidePanelArtwork: false,
    hiddenParamIds: [2, 3],
    hiddenStateIds: [0, 1],
  });
  assert.equal(patch.cables[0].outputId, 2);
  assert.equal(patch.cables[0].inputId, 2);
});

test("Rack 0.3 Branches imports at its original width with the real panel artwork", () => {
  const patch = parseLegacy([legacyModule("AudibleInstruments", "Branches", [0.2, 0.8])]);
  const definition: WebPluginModule = {
    key: "AudibleInstruments/Branches",
    plugin: "AudibleInstruments",
    model: "Branches",
    name: "Bernoulli gate",
    brand: "Audible Instruments",
    version: "2.0.0",
    license: "GPL-3.0-or-later",
    sourceUrl: "https://example.com/source",
    libraryUrl: "https://example.com/library",
    screenshotUrl: "https://example.com/current-panel.webp",
    wasmUrl: "https://example.com/module.wasm",
    width: 90,
    description: "",
    params: [0, 1, 2, 3].map((id) => ({
      id,
      name: `Param ${id}`,
      min: 0,
      max: 1,
      default: id < 2 ? 0.5 : 0,
    })),
    inputs: [0, 1, 2, 3].map((id) => ({ id, name: `Input ${id}`, kind: "gate" })),
    outputs: [0, 1, 2, 3].map((id) => ({ id, name: `Output ${id}`, kind: "gate" })),
    lights: 4,
  };
  const imported = importVcvPatch(patch, () => definition, ["#abc"]);
  assert.equal(imported.modules[0].width, 90);
  assert.equal(imported.modules[0].screenshotUrl, definition.screenshotUrl);
  assert.deepEqual(imported.modules[0].params, [0.2, 0.8, 0, 0]);
});

test("Rack 0.3 migration records provenance and emits a current patch version", () => {
  const patch = parseLegacy([legacyModule("Fundamental", "VCF", [0.3, 0.5, 0.7, -0.2, 0.4])]);
  assert.equal(patch.version, "2.6.6");
  assert.equal(patch.patchworkWebSourceVersion, "0.3.1");
  assert.deepEqual(patch.patchworkWebMigrations, ["rack-0.3.x-widget-order-to-v2"]);
  assert.deepEqual(patch.modules[0].params, [
    { id: 0, value: 0.3 },
    { id: 1, value: 0.5 },
    { id: 2, value: 0.7 },
    { id: 3, value: -0.2 },
    { id: 4, value: 0.4 },
  ]);
  assert.equal(rackLegacyUi({ rack: patch.modules[0] }).width, undefined);
  assert.equal(rackLegacyUi({ rack: patch.modules[0] }).legacyWidth, 120);
});

test("Rack 0.3 VCO and VCF use current panel widths and compact their row", () => {
  const patch = parseLegacy([
    { ...legacyModule("Fundamental", "VCO", [0, 1, -26, 0.1, 0.42, -0.3, 0.65]), pos: [0, 0] },
    { ...legacyModule("Fundamental", "VCF", [0.3, 0.5, 0.7, -0.2, 0.4]), pos: [150, 0] },
    { ...legacyModule("Core", "AudioInterface", []), pos: [270, 0] },
  ]);
  const definitions = new Map<string, WebPluginModule>([
    ["Fundamental/VCO", webDefinition("Fundamental/VCO", 135)],
    ["Fundamental/VCF", webDefinition("Fundamental/VCF", 105)],
    ["Core/AudioInterface", webDefinition("Core/AudioInterface", 120)],
  ]);
  const imported = importVcvPatch(patch, (key) => definitions.get(key), ["#abc"]);
  assert.deepEqual(
    imported.modules.map(({ x, width }) => ({ x, width })),
    [
      { x: 0, width: 135 },
      { x: 135, width: 105 },
      { x: 240, width: 120 },
    ],
  );
});

test("saved legacy width overrides upgrade once without leaving panel gaps", () => {
  const definitions = [
    webDefinition("Fundamental/VCO", 135),
    webDefinition("Fundamental/VCF", 105),
    webDefinition("Core/AudioInterface", 120),
  ];
  const modules = [
    {
      id: "vco",
      key: "Fundamental/VCO",
      plugin: "Fundamental",
      model: "VCO",
      x: 0,
      y: 0,
      width: 150,
      params: [],
      status: "ready" as const,
      rack: { plugin: "Fundamental", model: "VCO", patchworkWebLegacyUi: { width: 150 } },
    },
    {
      id: "vcf",
      key: "Fundamental/VCF",
      plugin: "Fundamental",
      model: "VCF",
      x: 150,
      y: 0,
      width: 120,
      params: [],
      status: "ready" as const,
      rack: { plugin: "Fundamental", model: "VCF", patchworkWebLegacyUi: { width: 120 } },
    },
    {
      id: "audio",
      key: "Core/AudioInterface",
      plugin: "Core",
      model: "AudioInterface",
      x: 270,
      y: 0,
      width: 120,
      params: [],
      status: "ready" as const,
    },
  ];
  const hydrated = hydrateModulesWithDefinitions(modules, definitions);
  assert.deepEqual(
    hydrated.map(({ x, width }) => ({ x, width })),
    [
      { x: 0, width: 135 },
      { x: 135, width: 105 },
      { x: 240, width: 120 },
    ],
  );
  assert.deepEqual(
    hydrated.slice(0, 2).map((module) => module.rack?.patchworkWebLegacyUi),
    [{ legacyWidth: 150 }, { legacyWidth: 120 }],
  );
  assert.equal(hydrateModulesWithDefinitions(hydrated, definitions), hydrated);
});

test("legacy formats outside 0.3 keep their existing positional behavior", () => {
  const patch = parseLegacy(
    [legacyModule("AudibleInstruments", "Braids", [23, 0.1, -0.25, 0.2, 0.3, -0.4, 0.8])],
    [],
    "0.4.0",
  );
  assert.equal(patch.version, "0.4.0");
  assert.equal(patch.patchworkWebSourceVersion, undefined);
  assert.deepEqual(patch.modules[0].params?.slice(0, 2), [
    { id: 0, value: 23 },
    { id: 1, value: 0.1 },
  ]);
});
