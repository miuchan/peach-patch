import assert from "node:assert/strict";
import test from "node:test";
import {
  crossfadeRackAudioEngines,
  rackAudioGraphNeedsRebuild,
} from "../lib/rack-audio-runtime-state.ts";

test("a prepared graph becomes audible before the previous graph is retired", async () => {
  const calls: string[] = [];
  await crossfadeRackAudioEngines(
    {
      activate: () => calls.push("old activate"),
      fadeOut: async () => {
        calls.push("old fade");
      },
      stop: async () => {
        calls.push("old stop");
      },
    },
    {
      activate: () => calls.push("new activate"),
      fadeOut: async () => {
        calls.push("new fade");
      },
      stop: async () => {
        calls.push("new stop");
      },
    },
  );

  assert.deepEqual(calls, ["new activate", "old fade", "old stop"]);
});

test("a stale context teardown failure does not reject a live replacement", async () => {
  let activated = false;
  await crossfadeRackAudioEngines(
    {
      activate: () => undefined,
      fadeOut: async () => undefined,
      stop: async () => {
        throw new Error("stale context already closed");
      },
    },
    {
      activate: () => {
        activated = true;
      },
      fadeOut: async () => undefined,
      stop: async () => undefined,
    },
  );

  assert.equal(activated, true);
});

test("a structure change during asynchronous startup remains pending", () => {
  assert.equal(
    rackAudioGraphNeedsRebuild({
      audioRunning: false,
      currentStructureKey: "patch-v2",
      enginePresent: false,
      loadedStructureKey: "",
      rebuildDeferred: false,
    }),
    false,
  );

  assert.equal(
    rackAudioGraphNeedsRebuild({
      audioRunning: true,
      currentStructureKey: "patch-v2",
      enginePresent: true,
      loadedStructureKey: "patch-v1",
      rebuildDeferred: false,
    }),
    true,
  );

  assert.equal(
    rackAudioGraphNeedsRebuild({
      audioRunning: true,
      currentStructureKey: "patch-v2",
      enginePresent: true,
      loadedStructureKey: "patch-v2",
      rebuildDeferred: false,
    }),
    false,
  );
});

test("direct interactions defer a stale graph without marking it current", () => {
  const state = {
    audioRunning: true,
    currentStructureKey: "patch-v2",
    enginePresent: true,
    loadedStructureKey: "patch-v1",
  };
  assert.equal(rackAudioGraphNeedsRebuild({ ...state, rebuildDeferred: true }), false);
  assert.equal(rackAudioGraphNeedsRebuild({ ...state, rebuildDeferred: false }), true);
});
