import assert from "node:assert/strict";
import test from "node:test";
import { rackAudioGraphNeedsRebuild } from "../lib/rack-audio-runtime-state.ts";

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
