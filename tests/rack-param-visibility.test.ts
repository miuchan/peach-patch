import assert from "node:assert/strict";
import test from "node:test";

import { rackParamIsVisible } from "../lib/rack-param-visibility.ts";
import type { ParamSpec, StateSpec } from "../lib/web-plugin-registry.ts";

const morph: ParamSpec = {
  id: 11,
  name: "Morph",
  min: -1,
  max: 1,
  default: 0,
  visibleWhenInputConnection: {
    ids: [5, 6],
    mode: "all",
    connected: false,
  },
};
const attenuverter: ParamSpec = {
  id: 12,
  name: "Morph CV Triple Ampliverter",
  min: -3,
  max: 3,
  default: 0,
  visibleWhenInputConnection: {
    ids: [5, 6],
    mode: "any",
    connected: true,
  },
};

test("overlapping Algomorph Small knobs follow actual cable connectivity", () => {
  assert.equal(rackParamIsVisible(morph, [], [], new Set()), true);
  assert.equal(rackParamIsVisible(attenuverter, [], [], new Set()), false);

  for (const connected of [new Set([5]), new Set([6]), new Set([5, 6])]) {
    assert.equal(rackParamIsVisible(morph, [], [], connected), false);
    assert.equal(rackParamIsVisible(attenuverter, [], [], connected), true);
  }
});

test("state and input visibility conditions compose", () => {
  const conditional = {
    ...attenuverter,
    visibleWhenState: { key: "Mode", equals: 2 },
  };
  const stateKeys: StateSpec[] = [{ key: "Mode", type: "integer", default: 1 }];

  assert.equal(rackParamIsVisible(conditional, stateKeys, [2], new Set([5])), true);
  assert.equal(rackParamIsVisible(conditional, stateKeys, [1], new Set([5])), false);
  assert.equal(rackParamIsVisible(conditional, stateKeys, [2], new Set()), false);
});
