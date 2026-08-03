// @ts-nocheck -- Boundary fixtures stay incomplete until parsers fill trusted fields.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hydrateModuleWithDefinition,
  hydrateModulesWithDefinitions,
} from "../lib/patch-hydrate.ts";
import { dataFromState, stateFromData } from "../lib/patch-state.ts";
import { findRackModule } from "../lib/rack-audio-patch-sync.ts";
import {
  findOpenPosition,
  moduleFromDefinition,
  rackKeyFromKeyboard,
  rackModifiersFromKeyboard,
  runWithConcurrency,
  sampleAssetsFromData,
  strokeBindings,
  withoutRackId,
} from "../lib/rack-studio-helpers.ts";
import { applyRackHostViewportControl } from "../lib/rack-viewport-control.ts";
import {
  isFiniteNumber,
  isNonNegativeInteger,
  isNumberArray,
  isRecord,
  isStringArray,
} from "../lib/runtime-type-guards.ts";
import { parseVcvArchive } from "../lib/vcv-patch.ts";

const definition = {
  key: "Example/Test",
  plugin: "Example",
  model: "Test",
  name: "Test",
  brand: "Example",
  version: "2.0.0",
  license: "MIT",
  sourceUrl: "https://example.com/source",
  libraryUrl: "https://example.com/library",
  screenshotUrl: "https://example.com/panel.webp",
  wasmUrl: "https://example.com/module.wasm",
  width: 45,
  description: "definition description",
  params: [{ id: 0, name: "Gain", min: 0, max: 1, default: 0.25 }],
  stateKeys: [{ key: "enabled", type: "boolean", default: 1 }],
  inputs: [],
  outputs: [],
  lights: 0,
};

test("module hydration rejects malformed saved controls and applies trusted metadata", () => {
  const module = {
    id: "module",
    key: definition.key,
    x: 0,
    y: 0,
    width: 90,
    params: [],
    status: "resolving",
    rack: {
      params: [
        null,
        "bad",
        { id: -1, value: 1 },
        { id: 1, value: 1 },
        { id: 0, value: Number.NaN },
        { id: 0, value: 0.75 },
      ],
      data: { enabled: false },
      patchworkWebLegacyUi: { width: 60, hidePanelArtwork: true },
    },
  };
  const hydrated = hydrateModuleWithDefinition(module, definition, {
    description: "registry description",
    screenshotUrl: "https://example.com/registry.webp",
    sourceUrl: "https://example.com/registry-source",
    license: "Apache-2.0",
    version: "1.0.0",
  });
  assert.equal(hydrated.version, "2.0.0");
  assert.equal(hydrated.description, "registry description");
  assert.equal(hydrated.screenshotUrl, undefined);
  assert.equal(hydrated.sourceUrl, "https://example.com/registry-source");
  assert.equal(hydrated.license, "Apache-2.0");
  assert.equal(hydrated.width, 60);
  assert.deepEqual(hydrated.params, [0.75]);
  assert.deepEqual(hydrated.state, [0]);
});

test("module hydration preserves matching modules and ignores blanks or unknown definitions", () => {
  const matching = {
    id: "matching",
    key: definition.key,
    x: 0,
    y: 0,
    width: definition.width,
    params: [0.25],
    state: [1],
    stateKeys: definition.stateKeys,
    status: "ready",
  };
  const blank = {
    id: "blank",
    key: "Core/Blank",
    x: 45,
    y: 0,
    width: 45,
    params: [],
    status: "ready",
  };
  const unknown = {
    id: "unknown",
    key: "Other/Unknown",
    x: 90,
    y: 0,
    width: 45,
    params: [],
    status: "resolving",
  };
  const modules = [matching, blank, unknown];
  assert.equal(hydrateModulesWithDefinitions(modules, [definition]), modules);

  const changed = hydrateModulesWithDefinitions([{ ...matching, width: 90 }], [definition]);
  assert.notEqual(changed[0], matching);
  assert.equal(changed[0].width, definition.width);
});

test("Rack state adapters preserve typed nested state and legacy module data", () => {
  const keys = [
    { key: "settings", type: "boolean", path: ["nested", 0], default: 0 },
    { key: "mode", type: "string-enum", values: ["a", "b", "c"], default: 0 },
    { key: "count", type: "integer", index: 1, default: 2 },
    { key: "gain", type: "real", default: 0.5 },
  ];
  const data = { settings: { nested: [true] }, mode: "c", count: [0, 3.8], gain: "1.25" };
  assert.deepEqual(stateFromData("Example/Test", data, keys), [1, 2, 3.8, 1.25]);
  assert.deepEqual(stateFromData("Example/Test", undefined, keys), [0, 0, 2, 0.5]);

  const serialized = dataFromState("Example/Test", {}, [0, 99, 4.9, 0.75], keys);
  assert.deepEqual(serialized.settings, { nested: [false] });
  assert.equal(serialized.mode, "c");
  assert.equal(serialized.count.length, 2);
  assert.equal(serialized.count[1], 4);
  assert.equal(serialized.gain, 0.75);
  assert.equal(dataFromState("Example/Test", undefined, undefined, keys), undefined);

  assert.deepEqual(
    stateFromData("Fundamental/SEQ3", { running: true, clockPassthrough: false, gates: [1, 0] }),
    [1, 0, 1, 0],
  );
  assert.deepEqual(stateFromData("AudibleInstruments/Branches", { modes: [0, 1] }), [0, 1]);
  assert.deepEqual(stateFromData("AudibleInstruments/Tides", { sheep: true }), [1, 1, 1]);
  assert.deepEqual(
    stateFromData("AudibleInstruments/Rings", { polyphony: 2, model: 3, easterEgg: true }),
    [2, 3, 1],
  );
  assert.deepEqual(dataFromState("Fundamental/SEQ3", {}, [1, 0, 1, 0]), {
    running: true,
    clockPassthrough: false,
    gates: [true, false],
  });
  assert.deepEqual(dataFromState("AudibleInstruments/Branches", {}, [1, 0]), {
    modes: [true, false],
  });
  assert.deepEqual(dataFromState("AudibleInstruments/Tides", {}, [2, 3, 1]), {
    mode: 2,
    range: 3,
    sheep: true,
  });
  assert.deepEqual(dataFromState("AudibleInstruments/Rings", {}, [2, 3, 1]), {
    polyphony: 2,
    model: 3,
    easterEgg: true,
  });
});

test("studio helpers cover bounded concurrency, keyboard translation, and host metadata", async () => {
  const active: number[] = [];
  let maximumActive = 0;
  const completed: number[] = [];
  await runWithConcurrency([1, 2, 3, 4], 2, async (item) => {
    active.push(item);
    maximumActive = Math.max(maximumActive, active.length);
    await Promise.resolve();
    active.splice(active.indexOf(item), 1);
    completed.push(item);
  });
  assert.equal(maximumActive, 2);
  assert.deepEqual(completed.sort(), [1, 2, 3, 4]);
  await runWithConcurrency([], 0, async () => assert.fail("empty work should not run"));

  assert.deepEqual(withoutRackId({ id: 7, data: { value: 1 } }), { data: { value: 1 } });
  assert.equal(withoutRackId(undefined), undefined);
  assert.equal(sampleAssetsFromData(undefined), undefined);
  assert.equal(sampleAssetsFromData({ patchworkWebAssets: "invalid" }), undefined);
  assert.equal(sampleAssetsFromData({ patchworkWebAssets: [null, "invalid"] }), undefined);
  assert.deepEqual(
    sampleAssetsFromData({
      patchworkWebAssets: [
        null,
        {
          storageKey: "asset",
          name: "kick.wav",
          sampleRate: 48_000,
          channels: 1,
          frames: 12,
        },
      ],
    }),
    [
      undefined,
      { storageKey: "asset", name: "kick.wav", sampleRate: 48_000, channels: 1, frames: 12 },
    ],
  );

  const keyboard = (key: string, code = key, modifiers = {}) => ({ key, code, ...modifiers });
  assert.equal(rackKeyFromKeyboard(keyboard("a")), 65);
  assert.equal(rackKeyFromKeyboard(keyboard("Shift", "ShiftLeft")), 340);
  assert.equal(rackKeyFromKeyboard(keyboard("Escape")), 256);
  assert.equal(rackKeyFromKeyboard(keyboard("F25")), 314);
  assert.equal(rackKeyFromKeyboard(keyboard("Unknown")), -1);
  assert.equal(
    rackModifiersFromKeyboard(
      keyboard("a", "KeyA", { shiftKey: true, ctrlKey: true, altKey: true, metaKey: true }),
    ),
    15,
  );

  const definitionModule = moduleFromDefinition(
    { ...definition, key: "Stoermelder-P1/Stroke" },
    0,
    0,
  );
  assert.equal(definitionModule.state.length, 51);
  const bindings = strokeBindings({
    ...definitionModule,
    state: undefined,
    stateKeys: [
      { key: "unused", type: "integer", default: 0 },
      { key: "button", type: "integer", default: 2 },
    ],
    rack: { data: { button: 2, keys: [{ data: "command" }] } },
  });
  assert.equal(bindings[0].button, 2);
  assert.equal(bindings[0].data, "command");
});

test("open-position fallback and viewport locks stay deterministic at their limits", () => {
  const occupiedRows = Array.from({ length: 24 }, (_, row) => ({
    id: `row-${row}`,
    key: "Core/Blank",
    x: 0,
    y: row * 380,
    width: 4_000,
    params: [],
    status: "ready",
  }));
  assert.deepEqual(findOpenPosition(occupiedRows, 15, { x: 0, y: 0 }), { x: 0, y: 24 * 380 });

  const control = {
    jumpUp: false,
    jumpDown: false,
    jumpLeft: false,
    jumpRight: false,
    x: undefined,
    y: undefined,
    zoom: Number.NaN,
    opacity: undefined,
    tension: undefined,
    padding: 0,
    xStep: 1,
    yStep: 1,
    lockX: false,
    lockY: true,
    xConnected: false,
    yConnected: false,
    leftConnected: false,
    rightConnected: false,
    upConnected: false,
    downConnected: false,
  };
  const first = applyRackHostViewportControl(
    control,
    {
      pan: { x: 0, y: -80 },
      zoom: 1,
      lockX: 12,
      lockY: null,
    },
    { modules: [], width: 0, height: 0 },
  );
  const second = applyRackHostViewportControl(control, first, { modules: [], width: 0, height: 0 });
  assert.equal(first.lockX, null);
  assert.equal(first.lockY, 80);
  assert.equal(second.pan.y, -80);
});

test("runtime guards and Rack module lookup reject invalid boundary values", () => {
  assert.equal(isRecord({}), true);
  assert.equal(isRecord([]), false);
  assert.equal(isFiniteNumber(1), true);
  assert.equal(isFiniteNumber(Number.NaN), false);
  assert.equal(isNonNegativeInteger(0), true);
  assert.equal(isNonNegativeInteger(-1), false);
  assert.equal(isNonNegativeInteger(1.5), false);
  assert.equal(isStringArray(["a", "b"]), true);
  assert.equal(isStringArray(["a", 1]), false);
  assert.equal(isNumberArray([1, 2]), true);
  assert.equal(isNumberArray([1, Number.POSITIVE_INFINITY]), false);
  assert.equal(findRackModule({ modules: [{ id: "one" }], cables: [] }, "missing"), undefined);
});

test("compressed VCV archives load their patch.json entry", async () => {
  const fixture = await readFile(new URL("./fixtures/Mattix.vcv", import.meta.url));
  const patch = parseVcvArchive(fixture);
  assert.ok(patch.modules.length > 0);
  assert.ok(Array.isArray(patch.cables));
});
