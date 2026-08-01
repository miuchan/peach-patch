// @ts-nocheck
// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  isStrokeCvMode,
  STROKE_REPEATABLE_MODES,
  STROKE_SPECIAL_MODES,
  strokeSpecialModeLabel,
} from "../lib/stroke-host.ts";

test("Stroke exposes named browser equivalents without conflating CV modes", () => {
  assert.deepEqual([1, 2, 3].map(isStrokeCvMode), [true, true, true]);
  assert.equal(isStrokeCvMode(23), false);
  assert.equal(strokeSpecialModeLabel(23), "Toggle cable visibility");
  assert.equal(strokeSpecialModeLabel(44), undefined);
  assert.ok(STROKE_SPECIAL_MODES.length >= 19);
  assert.deepEqual([...STROKE_REPEATABLE_MODES], [40, 41, 42, 43]);
});
