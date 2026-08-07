import assert from "node:assert/strict";
import test from "node:test";
import type { ModuleInstance } from "../lib/patch-types.ts";
import {
  globalPointerMatches,
  globalPointerMiddleEnabled,
  rackModifierMask,
} from "../lib/rack-global-pointer.ts";
import type { WebPluginModule } from "../lib/web-plugin-registry.ts";

const definition = {
  key: "Stoermelder-P1/Spin",
  params: [{ id: 0, name: "Param only", min: 0, max: 1, default: 1 }],
  stateKeys: [
    { key: "theme", type: "integer" },
    { key: "mods", type: "integer", default: 1 },
    { key: "mode", type: "integer", default: 1 },
  ],
} as WebPluginModule;
const module = {
  id: "spin",
  key: definition.key,
  plugin: "Stoermelder-P1",
  model: "Spin",
  x: 0,
  y: 0,
  width: 45,
  params: [1],
  state: [0, 1, 1],
  status: "ready",
} satisfies ModuleInstance;
const contract = {
  paramHoverOnlyParam: 0,
  modifiersState: 1,
  modifiersDefault: 1,
  wheel: { downAction: 1000, upAction: 1001, lockMs: 500 },
  middle: { action: 1010, modeState: 2, modeDefault: 1, disabledValue: 0 },
};

test("Rack modifier masks match Rack Shift/Ctrl/Alt/Super bits", () => {
  assert.equal(
    rackModifierMask({ shiftKey: true, ctrlKey: false, altKey: true, metaKey: true }),
    13,
  );
});

test("global pointer contracts honor exact modifiers, bypass and param hover", () => {
  assert.equal(globalPointerMatches(module, definition, contract, 1, { type: "param" }), true);
  assert.equal(globalPointerMatches(module, definition, contract, 3, { type: "param" }), false);
  assert.equal(globalPointerMatches(module, definition, contract, 1, { type: "out" }), false);
  assert.equal(
    globalPointerMatches({ ...module, params: [0] }, definition, contract, 1, null),
    true,
  );
  assert.equal(
    globalPointerMatches({ ...module, bypassed: true }, definition, contract, 1, {
      type: "param",
    }),
    false,
  );
});

test("global middle action is disabled only in the source-defined off mode", () => {
  assert.equal(globalPointerMiddleEnabled(module, definition, contract), true);
  assert.equal(
    globalPointerMiddleEnabled({ ...module, state: [0, 1, 0] }, definition, contract),
    false,
  );
});
