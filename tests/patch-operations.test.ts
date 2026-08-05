// @ts-nocheck -- Domain fixtures omit ModuleInstance fields irrelevant to each operation.
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRackModulePreset,
  anchoredViewportPan,
  connectPatchCable,
  reconnectPatchCableEndpoint,
  disconnectModuleCables,
  duplicatePatchModules,
  fittedPatchViewport,
  moveRackModulesWithoutOverlap,
  modulesIntersectingViewportRect,
  modulePortPosition,
  resolvedModulePortPosition,
  randomizeModuleControls,
  rackSurfaceBounds,
  removeModuleAndHealCable,
  replaceModuleKeepingCompatibleCables,
  resetModuleControls,
  snapRackPosition,
  spliceModuleIntoCable,
  mergeModuleData,
  updateModuleParam,
  updateModuleState,
} from "../lib/patch-operations.ts";

const source = { id: "source", x: 0, y: 0, width: 90 };
const target = { id: "target", x: 300, y: 0, width: 90 };
const inserted = { id: "inserted", x: 150, y: 0, width: 90 };

test("patch field updates stay immutable and target only the requested module", () => {
  const patch = {
    modules: [
      { ...source, params: [1, 2], state: [0], rack: { data: { mode: "old", keep: true } } },
      { ...target, params: [3], state: [1] },
    ],
    cables: [],
  };
  const withParam = updateModuleParam(patch, "source", 1, 9);
  const withState = updateModuleState(withParam, "source", [
    [0, 1],
    [2, 4],
  ]);
  const merged = mergeModuleData(withState, "source", { mode: "new" });
  assert.deepEqual(merged.patch.modules[0].params, [1, 9]);
  assert.equal(merged.patch.modules[0].state[0], 1);
  assert.equal(merged.patch.modules[0].state[1], undefined);
  assert.equal(merged.patch.modules[0].state[2], 4);
  assert.deepEqual(merged.data, { mode: "new", keep: true });
  assert.deepEqual(patch.modules[0].params, [1, 2]);
  assert.deepEqual(patch.modules[1].state, [1]);
});

test("inserting a module on a cable preserves both endpoints and color", () => {
  const patch = {
    modules: [source, target],
    cables: [
      {
        id: "original",
        fromModule: "source",
        fromPort: 3,
        toModule: "target",
        toPort: 4,
        color: "#55cf91",
        rack: { id: 18, inputPlugOrder: 2 },
      },
    ],
  };
  const next = spliceModuleIntoCable(patch, "original", inserted, "incoming", "outgoing");

  assert.ok(next);
  assert.deepEqual(next.modules, [source, target, inserted]);
  assert.deepEqual(next.cables, [
    {
      id: "incoming",
      fromModule: "source",
      fromPort: 3,
      toModule: "inserted",
      toPort: 0,
      color: "#55cf91",
    },
    {
      id: "outgoing",
      fromModule: "inserted",
      fromPort: 0,
      toModule: "target",
      toPort: 4,
      color: "#55cf91",
    },
  ]);
  assert.deepEqual(patch.cables[0].rack, { id: 18, inputPlugOrder: 2 });
});

test("fit viewport centers a tall patch and keeps the supported zoom range", () => {
  const modules = [
    { id: "a", x: 100, y: 200, width: 90 },
    { id: "b", x: 400, y: 1800, width: 180 },
  ];
  const fitted = fittedPatchViewport(modules, 1300, 660);
  assert.ok(fitted);
  assert.ok(fitted.zoom >= 0.08 && fitted.zoom <= 1.25);
  const minX = 100 * fitted.zoom + fitted.pan.x,
    maxX = 580 * fitted.zoom + fitted.pan.x,
    minY = 200 * fitted.zoom + fitted.pan.y,
    maxY = 2180 * fitted.zoom + fitted.pan.y;
  assert.ok(Math.abs((minX + maxX) / 2 - 650) < 1e-9);
  assert.ok(Math.abs((minY + maxY) / 2 - 330) < 1e-9);
});

test("fit viewport ignores an empty patch", () => {
  assert.equal(fittedPatchViewport([], 1300, 660), null);
});

test("Rack surface stays bounded to the viewport and a gesture margin", () => {
  const bounds = rackSurfaceBounds(1200, 680, { x: 30, y: 40 }, 1);
  assert.deepEqual(bounds, {
    x: -190,
    y: -200,
    width: 1520,
    height: 1000,
    right: 1330,
    bottom: 800,
  });
  const magnified = rackSurfaceBounds(1200, 680, { x: 30, y: 40 }, 1.5);
  assert.ok(magnified.width * 1.5 <= 1200 + 322);
  assert.ok(magnified.height * 1.5 <= 680 + 322);
});

test("Rack surface follows a viewport panned far from the patch without spanning the gap", () => {
  const bounds = rackSurfaceBounds(1000, 600, { x: 4000, y: 2400 }, 1);
  assert.equal(bounds.x, -4160);
  assert.equal(bounds.y, -2560);
  assert.equal(bounds.right, -2840);
  assert.equal(bounds.bottom, -1640);
  assert.ok(bounds.right < 0);
});

test("module replacement keeps valid cable ports and reports dropped ones", () => {
  const replacement = { id: "temporary", x: 160, y: 20, width: 120 };
  const patch = {
    modules: [source, inserted, target],
    cables: [
      { id: "in-ok", fromModule: "source", fromPort: 0, toModule: "inserted", toPort: 2 },
      { id: "in-drop", fromModule: "source", fromPort: 1, toModule: "inserted", toPort: 3 },
      { id: "out-ok", fromModule: "inserted", fromPort: 4, toModule: "target", toPort: 0 },
      { id: "out-drop", fromModule: "inserted", fromPort: 5, toModule: "target", toPort: 1 },
    ],
  };
  const result = replaceModuleKeepingCompatibleCables(
    patch,
    "inserted",
    replacement,
    new Set([2]),
    new Set([4]),
  );
  assert.ok(result);
  assert.equal(result.droppedCables, 2);
  assert.equal(result.patch.modules[1].id, "inserted");
  assert.deepEqual(
    result.patch.cables.map((cable) => cable.id),
    ["in-ok", "out-ok"],
  );
});

test("inserting on a stale cable leaves the patch untouched", () => {
  const patch = { modules: [source, target], cables: [] };
  assert.equal(spliceModuleIntoCable(patch, "missing", inserted, "a", "b"), null);
});

test("heal delete removes a serial module and reconnects its neighbors", () => {
  const patch = {
    modules: [source, inserted, target],
    cables: [
      {
        id: "in",
        fromModule: "source",
        fromPort: 2,
        toModule: "inserted",
        toPort: 0,
        color: "#ef5265",
      },
      {
        id: "out",
        fromModule: "inserted",
        fromPort: 0,
        toModule: "target",
        toPort: 5,
        color: "#43b5df",
      },
    ],
  };
  const next = removeModuleAndHealCable(patch, "inserted", "healed");

  assert.ok(next);
  assert.deepEqual(next.modules, [source, target]);
  assert.deepEqual(next.cables, [
    {
      id: "healed",
      fromModule: "source",
      fromPort: 2,
      toModule: "target",
      toPort: 5,
      color: "#ef5265",
    },
  ]);
});

test("heal delete refuses ambiguous fan-in or fan-out", () => {
  const patch = {
    modules: [source, inserted, target],
    cables: [
      {
        id: "a",
        fromModule: "source",
        fromPort: 0,
        toModule: "inserted",
        toPort: 0,
      },
      {
        id: "b",
        fromModule: "source",
        fromPort: 1,
        toModule: "inserted",
        toPort: 1,
      },
      {
        id: "c",
        fromModule: "inserted",
        fromPort: 0,
        toModule: "target",
        toPort: 0,
      },
    ],
  };
  assert.equal(removeModuleAndHealCable(patch, "inserted", "healed"), null);
});

test("duplicate copies selected modules and only their internal cables", () => {
  const patch = {
    modules: [
      { ...source, params: [0.25], rack: { id: 11, data: { mode: 2 } } },
      { ...inserted, params: [0.5] },
      target,
    ],
    cables: [
      {
        id: "internal",
        fromModule: "source",
        fromPort: 0,
        toModule: "inserted",
        toPort: 0,
        rack: { id: 21 },
      },
      { id: "external", fromModule: "inserted", fromPort: 0, toModule: "target", toPort: 0 },
    ],
  };
  const result = duplicatePatchModules(
    patch,
    new Set(["source", "inserted"]),
    (id) => `copy-${id}`,
    (id) => `copy-${id}`,
  );

  assert.ok(result);
  assert.deepEqual(result.moduleIds, ["copy-source", "copy-inserted"]);
  assert.equal(result.cableCount, 1);
  assert.equal(result.patch.modules[3].x, 30);
  assert.equal(result.patch.modules[3].y, 40);
  assert.deepEqual(result.patch.modules[3].rack, { data: { mode: 2 } });
  assert.deepEqual(result.patch.cables.at(-1), {
    id: "copy-internal",
    fromModule: "copy-source",
    fromPort: 0,
    toModule: "copy-inserted",
    toPort: 0,
    rack: {},
  });
});

test("reset and randomize controls honor defaults, ranges, and snapped params", () => {
  const params = [
      { id: 0, name: "Fine", min: -1, max: 1, default: 0 },
      { id: 1, name: "Mode", min: 1, max: 4, default: 2, snap: true },
    ],
    patch = {
      modules: [{ ...source, params: [0.8, 4] }],
      cables: [],
    },
    reset = resetModuleControls(patch, "source", params),
    randomized = randomizeModuleControls(patch, "source", params, () => 0.5);

  assert.deepEqual(reset.modules[0].params, [0, 2]);
  assert.deepEqual(randomized.modules[0].params, [0, 3]);
});

test("disconnect removes every cable touching one module", () => {
  const patch = {
    modules: [source, inserted, target],
    cables: [
      { id: "in", fromModule: "source", toModule: "inserted" },
      { id: "out", fromModule: "inserted", toModule: "target" },
      { id: "keep", fromModule: "source", toModule: "target" },
    ],
  };
  const result = disconnectModuleCables(patch, "inserted");

  assert.ok(result);
  assert.equal(result.removedCables, 2);
  assert.deepEqual(
    result.patch.cables.map((cable) => cable.id),
    ["keep"],
  );
});

test("connecting ports preserves input stacks and rejects an exact duplicate", () => {
  const patch = {
    modules: [source, inserted, target],
    cables: [
      { id: "old", fromModule: "source", fromPort: 0, toModule: "target", toPort: 2, color: "red" },
      {
        id: "keep",
        fromModule: "source",
        fromPort: 1,
        toModule: "target",
        toPort: 3,
        color: "blue",
      },
    ],
  };
  const next = connectPatchCable(
    patch,
    { moduleId: "inserted", portId: 4 },
    { moduleId: "target", portId: 2 },
    "new",
    "green",
  );

  assert.ok(next);
  assert.deepEqual(
    next.cables.map((cable) => cable.id),
    ["old", "keep", "new"],
  );
  assert.deepEqual(next.cables[2], {
    id: "new",
    fromModule: "inserted",
    fromPort: 4,
    toModule: "target",
    toPort: 2,
    color: "green",
  });
  assert.equal(
    connectPatchCable(
      next,
      { moduleId: "inserted", portId: 4 },
      { moduleId: "target", portId: 2 },
      "duplicate",
      "purple",
    ),
    null,
  );
});

test("reconnecting a cable endpoint preserves its color and every existing port stack", () => {
  const patch = {
    modules: [source, target, { ...target, id: "other" }],
    cables: [
      {
        id: "move",
        fromModule: "source",
        fromPort: 0,
        toModule: "target",
        toPort: 2,
        color: "red",
      },
      { id: "old", fromModule: "source", fromPort: 1, toModule: "other", toPort: 4, color: "blue" },
    ],
  };
  assert.deepEqual(
    reconnectPatchCableEndpoint(patch, "move", "input", { moduleId: "other", portId: 4 }).cables,
    [
      { id: "move", fromModule: "source", fromPort: 0, toModule: "other", toPort: 4, color: "red" },
      { id: "old", fromModule: "source", fromPort: 1, toModule: "other", toPort: 4, color: "blue" },
    ],
  );
  assert.deepEqual(
    reconnectPatchCableEndpoint(patch, "move", "output", {
      moduleId: "other",
      portId: 1,
    }).cables.find((cable) => cable.id === "move"),
    {
      id: "move",
      fromModule: "other",
      fromPort: 1,
      toModule: "target",
      toPort: 2,
      color: "red",
    },
  );
  const duplicate = {
    ...patch,
    cables: [
      ...patch.cables,
      {
        id: "same",
        fromModule: "source",
        fromPort: 0,
        toModule: "other",
        toPort: 4,
        color: "green",
      },
    ],
  };
  assert.equal(
    reconnectPatchCableEndpoint(duplicate, "move", "input", { moduleId: "other", portId: 4 }),
    null,
  );
});

test("Rack module presets restore matching controls and typed data only", () => {
  const patch = {
      modules: [
        {
          ...source,
          key: "Example/Module",
          plugin: "Example",
          model: "Module",
          params: [0, 2],
          stateKeys: [{ key: "mode", type: "integer" }],
          rack: { id: 7, data: { mode: 1 } },
        },
      ],
      cables: [],
    },
    definition = {
      params: [
        { id: 0, name: "Gain", min: 0, max: 1, default: 0.5 },
        { id: 1, name: "Mode", min: 0, max: 4, default: 0 },
      ],
    },
    restored = applyRackModulePreset(
      patch,
      "source",
      {
        plugin: "Example",
        model: "Module",
        bypass: true,
        params: [
          { id: 0, value: 4 },
          { id: 1, value: 3 },
        ],
        data: { mode: 4 },
      },
      definition,
    );

  assert.ok(restored);
  assert.deepEqual(restored.modules[0].params, [1, 3]);
  assert.deepEqual(restored.modules[0].state, [4]);
  assert.equal(restored.modules[0].bypassed, true);
  assert.deepEqual(restored.modules[0].rack, { id: 7, data: { mode: 4 } });
  assert.equal(
    applyRackModulePreset(patch, "source", { plugin: "Other", model: "Module" }, definition),
    null,
  );
});

test("anchored zoom preserves the world point beneath the pointer", () => {
  const pan = { x: -120, y: 80 },
    anchor = { x: 640, y: 320 },
    currentZoom = 0.5,
    nextZoom = 1.1,
    world = {
      x: (anchor.x - pan.x) / currentZoom,
      y: (anchor.y - pan.y) / currentZoom,
    },
    nextPan = anchoredViewportPan(pan, currentZoom, nextZoom, anchor);
  assert.ok(Math.abs(world.x * nextZoom + nextPan.x - anchor.x) < 1e-9);
  assert.ok(Math.abs(world.y * nextZoom + nextPan.y - anchor.y) < 1e-9);
});

test("viewport marquee finds modules after pan and zoom", () => {
  const modules = [
    { id: "inside", x: 100, y: 100, width: 90 },
    { id: "edge", x: 300, y: 100, width: 90 },
    { id: "outside", x: 600, y: 100, width: 90 },
  ];
  assert.deepEqual(
    modulesIntersectingViewportRect(modules, { x: 20, y: -10 }, 0.5, {
      left: 60,
      top: 35,
      right: 185,
      bottom: 100,
    }),
    ["inside", "edge"],
  );
});

test("compact multi-column module ports stay aligned with their panel jacks", () => {
  const rackModule = { id: "midi", x: 100, y: 200, width: 180 },
    input0 = modulePortPosition(rackModule, "in", 0, 16),
    input1 = modulePortPosition(rackModule, "in", 1, 16),
    input2 = modulePortPosition(rackModule, "in", 2, 16),
    output15 = modulePortPosition(rackModule, "out", 15, 16);
  assert.equal(input0.y, input1.y);
  assert.ok(input1.x > input0.x);
  assert.ok(input2.y > input0.y);
  assert.ok(output15.x > rackModule.x + rackModule.width / 2);
  assert.ok(output15.y < rackModule.y + 380);
});

test("source-derived Rack jack coordinates drive cable endpoints", () => {
  const rackModule = { id: "delay", x: 100, y: 200, width: 135 },
    centered = modulePortPosition(rackModule, "in", 4, 6, { x: 19.5, y: 334, centered: true }, 135),
    topLeft = modulePortPosition(rackModule, "out", 0, 2, { x: 7, y: 324 }, 60);
  assert.deepEqual(centered, { x: 119.5, y: 534 });
  assert.deepEqual(topLeft, { x: 100 + (19 * 135) / 60, y: 536 });
});

test("jack hit targets and cable plugs resolve one authoritative center", () => {
  const rackModule = { id: "sparse", x: 45, y: 380, width: 180 },
    ports = [
      { id: 3, name: "first", kind: "cv" },
      { id: 9, name: "source", kind: "cv", position: { x: 42, y: 310, centered: true } },
    ];
  assert.deepEqual(
    resolvedModulePortPosition(rackModule, "in", 3, ports, 180),
    modulePortPosition(rackModule, "in", 0, 2),
  );
  assert.deepEqual(resolvedModulePortPosition(rackModule, "in", 9, ports, 180), { x: 87, y: 690 });
});

test("Rack movement snaps to 15 HP pixels and whole 380 pixel rows", () => {
  assert.deepEqual(snapRackPosition({ x: 23, y: 219 }), { x: 30, y: 380 });
  assert.deepEqual(snapRackPosition({ x: 7, y: -200 }), { x: 0, y: -380 });
});

test("dragging rejects a snapped placement that overlaps a stationary module", () => {
  const modules = [
      { id: "moving", x: 0, y: 0, width: 90 },
      { id: "occupied", x: 90, y: 0, width: 120 },
    ],
    origins = new Map([["moving", { x: 0, y: 0 }]]);
  assert.equal(moveRackModulesWithoutOverlap(modules, origins, { x: 100, y: 0 }), modules);
  assert.deepEqual(moveRackModulesWithoutOverlap(modules, origins, { x: 20, y: 400 })[0], {
    id: "moving",
    x: 15,
    y: 380,
    width: 90,
  });
});
