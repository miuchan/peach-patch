// @ts-nocheck
// @ts-nocheck
import test from "node:test";
import assert from "node:assert/strict";
import {
  findOpenPosition,
  moduleFromDefinition,
  polyphonyFromData,
  repairDuplicateModuleIds,
  sampleAssetFromData,
} from "../lib/rack-studio-helpers.ts";
import { cableSignalLevels, layoutPatchCables } from "../lib/rack-cable-layout.ts";
import { loadBrowserAsset } from "../lib/browser-asset-loader.ts";
import { importVcvPatch } from "../lib/vcv-patch-import.ts";
import {
  applyAudioParam,
  applyAudioStateSnapshot,
  syncRackAudioModules,
} from "../lib/rack-audio-patch-sync.ts";
import { applyRackHostViewportControl } from "../lib/rack-viewport-control.ts";
import {
  normalizeRestoredPatch,
  parseAutosavedPatch,
  serializeAutosavePatch,
} from "../lib/patch-autosave.ts";

const definition = {
  key: "Example/Test",
  plugin: "Example",
  model: "Test",
  width: 30,
  params: [
    { id: 0, name: "Initial", min: 0, max: 10, default: 2, initial: 4 },
  ],
  stateKeys: [{ key: "enabled", type: "boolean", default: 1 }],
  polyphonic: true,
};

test("module factory preserves initial controls and typed state defaults", () => {
  const module = moduleFromDefinition(definition, 15, 380);
  assert.equal(module.params[0], 4);
  assert.deepEqual(module.state, [1]);
  assert.equal(module.polyphony, 1);
  assert.equal(module.status, "ready");
});

test("audio patch sync keeps host metadata and ignores invalid parameter targets", () => {
  const patch = {
    modules: [
      {
        id: "voice",
        key: "Example/Test",
        params: [0.1],
        state: [0],
        rack: { data: { patchworkWebPolyphony: 4, enabled: false } },
      },
    ],
    cables: [],
  };
  const unchanged = applyAudioParam(patch, "voice", 4, 1);
  assert.deepEqual(unchanged, patch);
  const changed = applyAudioParam(patch, "voice", 0, 0.8);
  const snapshot = applyAudioStateSnapshot(
    changed,
    "voice",
    { enabled: true },
    [{ key: "enabled", type: "boolean", default: 0 }],
  );
  assert.equal(snapshot.modules[0].params[0], 0.8);
  assert.equal(snapshot.modules[0].rack.data.patchworkWebPolyphony, 4);
  assert.deepEqual(snapshot.modules[0].state, [1]);
});

test("viewport host controls preserve locked coordinates while disconnected", () => {
  const control = {
    moduleId: "undular",
    jumpUp: false,
    jumpDown: false,
    jumpLeft: false,
    jumpRight: true,
    x: undefined,
    y: undefined,
    zoom: 1,
    opacity: undefined,
    tension: undefined,
    padding: 1,
    xStep: 1,
    yStep: 1,
    lockX: true,
    lockY: false,
    xConnected: false,
    yConnected: false,
    leftConnected: false,
    rightConnected: false,
    upConnected: false,
    downConnected: false,
  };
  const first = applyRackHostViewportControl(control, {
    pan: { x: 0, y: 0 }, zoom: 1, lockX: null, lockY: null,
  }, { modules: [{ x: 0, y: 0, width: 90 }], width: 600, height: 400 });
  const second = applyRackHostViewportControl(control, first, {
    modules: [{ x: 0, y: 0, width: 90 }], width: 600, height: 400,
  });
  assert.equal(first.lockX, -first.pan.x);
  assert.equal(second.pan.x, first.pan.x);
});

test("audio module synchronization only sends changed controls and removes stale modules", () => {
  const calls = [];
  const engine = {
    setStateJson: (...args) => calls.push(["data", ...args]),
    setParam: (...args) => calls.push(["param", ...args]),
    setState: (...args) => calls.push(["state", ...args]),
    setBypassed: (...args) => calls.push(["bypass", ...args]),
  };
  const module = { id: "voice", key: "Example/Test", params: [0.25], state: [1], status: "ready" };
  const cache = new Map();
  syncRackAudioModules(engine, [module], cache);
  assert.equal(calls.filter(([kind]) => kind === "param").length, 1);
  const firstCallCount = calls.length;
  syncRackAudioModules(engine, [module], cache);
  assert.equal(calls.length, firstCallCount);
  syncRackAudioModules(engine, [], cache);
  assert.equal(cache.size, 0);
});

test("autosave boundaries validate, repair, and normalize restored patches", () => {
  assert.equal(parseAutosavedPatch("not-json"), null);
  const raw = serializeAutosavePatch({
    modules: [
      { id: "same", key: "Example/Test", width: 30, params: [], status: "ready" },
      { id: "same", key: "Core/Blank", width: 90, params: [], status: "ready" },
    ],
    cables: [],
  });
  const parsed = parseAutosavedPatch(raw);
  assert.equal(parsed.repaired, 1);
  const normalized = normalizeRestoredPatch(parsed.patch, () => ({ ...definition, width: 45 }));
  assert.equal(normalized.modules[0].width, 45);
  assert.equal(normalized.modules[1].width, 90);
});

test("open position snaps to the rack grid and skips occupied cells", () => {
  const first = { id: "a", x: 0, y: 0, width: 30 };
  assert.deepEqual(findOpenPosition([first], 30, { x: 0, y: 0 }), { x: 30, y: 0 });
});

test("duplicate module IDs are repaired without changing unique modules", () => {
  const result = repairDuplicateModuleIds({
    modules: [
      { id: "same", key: "a" },
      { id: "same", key: "b" },
    ],
    cables: [],
  });
  assert.equal(result.repaired, 1);
  assert.equal(result.patch.modules[0].id, "same");
  assert.notEqual(result.patch.modules[1].id, "same");
});

test("browser-owned sample metadata and polyphony are validated at the boundary", () => {
  const asset = { storageKey: "sample-1", name: "kick.wav", sampleRate: 48000, channels: 2, frames: 128 };
  assert.deepEqual(sampleAssetFromData({ patchworkWebAsset: asset }), asset);
  assert.equal(sampleAssetFromData({ patchworkWebAsset: { ...asset, frames: "128" } }), undefined);
  assert.equal(polyphonyFromData({ patchworkWebPolyphony: 8 }), 8);
  assert.equal(polyphonyFromData({ patchworkWebPolyphony: 3 }), undefined);
});

test("cable layout owns plug ordering, geometry, and signal fan-out", () => {
  const patch = {
    modules: [
      { id: "source", key: "source", x: 0, y: 0, width: 90 },
      { id: "target", key: "target", x: 300, y: 0, width: 90 },
    ],
    cables: [
      { id: "cable", fromModule: "source", fromPort: 0, toModule: "target", toPort: 0, color: "#fff" },
    ],
  };
  const definition = { key: "source", width: 90, inputs: [], outputs: [{ id: 0, name: "out", kind: "audio" }] };
  const targetDefinition = { key: "target", width: 90, inputs: [{ id: 0, name: "in", kind: "audio" }], outputs: [] };
  const [layout] = layoutPatchCables(patch, [definition, targetDefinition], 0.5);
  assert.match(layout.d, /^M-?\d/);
  assert.equal(layout.topOutputPlug, true);
  assert.equal(layout.topInputPlug, true);
  const levels = cableSignalLevels(patch.cables, { cable: 0.75 });
  assert.equal(levels.get("source:out:0"), 0.75);
  assert.equal(levels.get("target:in:0"), 0.75);
});

test("cable drag preview moves only the grabbed endpoint", () => {
  const patch = {
    modules: [
      { id: "source", key: "source", x: 0, y: 0, width: 90 },
      { id: "target", key: "target", x: 300, y: 0, width: 90 },
    ],
    cables: [
      { id: "cable", fromModule: "source", fromPort: 0, toModule: "target", toPort: 0, color: "#fff" },
    ],
  };
  const definitions = [
    { key: "source", width: 90, inputs: [], outputs: [{ id: 0, name: "out", kind: "audio" }] },
    { key: "target", width: 90, inputs: [{ id: 0, name: "in", kind: "audio" }], outputs: [] },
  ];
  const [base] = layoutPatchCables(patch, definitions, 0.5);
  const [preview] = layoutPatchCables(patch, definitions, 0.5, {
    cableId: "cable",
    side: "input",
    x: 180,
    y: 240,
  });
  assert.deepEqual([preview.x1, preview.y1], [base.x1, base.y1]);
  assert.deepEqual([preview.x2, preview.y2], [180, 240]);
  assert.notEqual(preview.d, base.d);
});

test("browser asset loader validates and normalizes byte-backed module assets", async () => {
  const rom = new Uint8Array(16);
  rom.set([0x4e, 0x45, 0x53, 0x1a]);
  const loaded = await loadBrowserAsset(
    new File([rom], "demo.nes"),
    { type: "binary", maxSamples: 32, maxSeconds: 0, channels: 1 },
  );
  assert.equal(loaded.ref.frames, 16);
  assert.equal(loaded.samples[0], 0x4e);
  await assert.rejects(
    loadBrowserAsset(
      new File([new Uint8Array(16)], "bad.nes"),
      { type: "binary", maxSamples: 32, maxSeconds: 0, channels: 1 },
    ),
    /iNES/,
  );
});

test("VCV import keeps source coordinates, state, and unresolved module boundaries", () => {
  const raw = {
    version: "2.6",
    modules: [{ id: 7, plugin: "Demo", model: "Osc", pos: [2, 3], params: [{ id: 0, value: 0.5 }], data: { mode: "sine" } }],
    cables: [],
  };
  const imported = importVcvPatch(raw, () => undefined, ["#abc"]);
  assert.equal(imported.modules[0].id, "vcv-7");
  assert.deepEqual([imported.modules[0].x, imported.modules[0].y], [0, 0]);
  assert.equal(imported.modules[0].status, "resolving");
  assert.deepEqual(imported.rackOrigin, [2, 3]);
  assert.equal(imported.unresolved.length, 1);
});
