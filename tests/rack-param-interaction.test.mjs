import assert from "node:assert/strict";
import test from "node:test";

import {
  RACK_DOUBLE_CLICK_DURATION_MS,
  registerRackParamPress,
} from "../lib/rack-param-interaction.ts";

test("Rack parameter double-click resets on the second press within 300ms", () => {
  const first = registerRackParamPress(null, 4, "mouse", 1_000);
  assert.equal(first.doubleClick, false);

  const second = registerRackParamPress(first.next, 4, "mouse", 1_300);
  assert.equal(RACK_DOUBLE_CLICK_DURATION_MS, 300);
  assert.equal(second.doubleClick, true);
  assert.equal(second.next, null);
});

test("Rack parameter double-click requires the same control and pointer type", () => {
  const first = registerRackParamPress(null, 4, "mouse", 1_000);
  assert.equal(
    registerRackParamPress(first.next, 5, "mouse", 1_100).doubleClick,
    false,
  );
  assert.equal(
    registerRackParamPress(first.next, 4, "touch", 1_100).doubleClick,
    false,
  );
  assert.equal(
    registerRackParamPress(first.next, 4, "mouse", 1_301).doubleClick,
    false,
  );
});

test("a completed double-click does not make a triple-click reset twice", () => {
  const first = registerRackParamPress(null, 2, "mouse", 0);
  const second = registerRackParamPress(first.next, 2, "mouse", 100);
  const third = registerRackParamPress(second.next, 2, "mouse", 200);

  assert.equal(second.doubleClick, true);
  assert.equal(third.doubleClick, false);
});
