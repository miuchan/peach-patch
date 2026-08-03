import assert from "node:assert/strict";
import test from "node:test";

import {
  RACK_DOUBLE_CLICK_DURATION_MS,
  rackParamResetValue,
  registerRackParamPress,
} from "../lib/rack-param-interaction.ts";

test("Rack parameter double-click resets on the second press within the accessible desktop interval", () => {
  const first = registerRackParamPress(null, 4, "mouse", 1_000);
  assert.equal(first.doubleClick, false);

  const second = registerRackParamPress(first.next, 4, "mouse", 2_000);
  assert.equal(RACK_DOUBLE_CLICK_DURATION_MS, 1_000);
  assert.equal(second.doubleClick, true);
  assert.equal(second.next, null);
});

test("Rack parameter double-click requires the same control and pointer type", () => {
  const first = registerRackParamPress(null, 4, "mouse", 1_000);
  assert.equal(registerRackParamPress(first.next, 5, "mouse", 1_100).doubleClick, false);
  assert.equal(registerRackParamPress(first.next, 4, "touch", 1_100).doubleClick, false);
  assert.equal(registerRackParamPress(first.next, 4, "mouse", 2_001).doubleClick, false);
});

test("a completed double-click does not make a triple-click reset twice", () => {
  const first = registerRackParamPress(null, 2, "mouse", 0);
  const second = registerRackParamPress(first.next, 2, "mouse", 100);
  const third = registerRackParamPress(second.next, 2, "mouse", 200);

  assert.equal(second.doubleClick, true);
  assert.equal(third.doubleClick, false);
});

test("double-click reset can follow native dynamic default quantities", () => {
  const values = [0, 0.35, 0.8];
  assert.equal(
    rackParamResetValue(
      {
        id: 2,
        name: "Follower",
        min: 1,
        max: 0,
        default: 0.5,
        resetFrom: { paramId: 1, scale: 1, offset: 0 },
      },
      values,
    ),
    0.35,
  );
  assert.equal(
    rackParamResetValue(
      {
        id: 3,
        name: "Curve",
        min: 0,
        max: 1.3,
        default: 0.75,
        resetFrom: { paramId: 2, scale: 0.5, offset: 0.5 },
      },
      values,
    ),
    0.9,
  );
});
