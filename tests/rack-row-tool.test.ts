import assert from "node:assert/strict";
import test from "node:test";
import type { ModuleInstance } from "../lib/patch-types.ts";
import { rackRowToolAction, rackRowToolDragIds } from "../lib/rack-row-tool.ts";

function module(id: string, x: number, y: number, width = 15, state?: number[]): ModuleInstance {
  return {
    id,
    key: id,
    plugin: "test",
    model: id,
    x,
    y,
    width,
    params: [],
    state,
    status: "ready",
  };
}

test("Room inserts rows above and below with source inclusive semantics", () => {
  const input = [
    module("above", 0, -380),
    module("room", 0, 0, 45),
    module("peer", 45, 0),
    module("below", 0, 380),
  ];
  assert.deepEqual(
    rackRowToolAction(input, "room", 0).map(({ id, y }) => [id, y]),
    [
      ["above", -760],
      ["room", 0],
      ["peer", 0],
      ["below", 380],
    ],
  );
  input[1].state = [1, 0];
  assert.deepEqual(
    rackRowToolAction(input, "room", 4).map(({ id, y }) => [id, y]),
    [
      ["above", -380],
      ["room", 0],
      ["peer", 380],
      ["below", 760],
    ],
  );
});

test("Room rotates outer rows and selects either a whole row or contiguous strip", () => {
  const input = [
    module("top", 0, -760),
    module("near", 0, -380),
    module("left", -15, 0),
    module("room", 0, 0, 45),
    module("right", 45, 0),
    module("gap", 90, 0),
  ];
  assert.deepEqual(
    rackRowToolAction(input, "room", 1).map(({ id, y }) => [id, y]),
    [
      ["top", -380],
      ["near", -760],
      ["left", 0],
      ["room", 0],
      ["right", 0],
      ["gap", 0],
    ],
  );
  assert.deepEqual(rackRowToolDragIds(input, "room", false), ["left", "room", "right", "gap"]);
  assert.deepEqual(rackRowToolDragIds(input, "room", true), ["left", "room", "right"]);
});
