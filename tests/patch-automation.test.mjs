import assert from "node:assert/strict";
import test from "node:test";
import {
  appendAutomationEvent,
  automationClipFromPatch,
  patchWithAutomationClip,
} from "../lib/patch-automation.ts";

test("automation coalesces dense control changes and round-trips in patch data", () => {
  const events = [];
  appendAutomationEvent(events, { timeMs: 0, moduleId: "vca", paramId: 0, value: 0 });
  appendAutomationEvent(events, { timeMs: 8, moduleId: "vca", paramId: 0, value: 0.5 });
  appendAutomationEvent(events, { timeMs: 20, moduleId: "vca", paramId: 0, value: 1 });
  appendAutomationEvent(events, { timeMs: 24, moduleId: "vcf", paramId: 1, value: 0.2 });
  assert.deepEqual(events, [
    { timeMs: 20, moduleId: "vca", paramId: 0, value: 1 },
    { timeMs: 24, moduleId: "vcf", paramId: 1, value: 0.2 },
  ]);

  const patch = patchWithAutomationClip(
      { modules: [], cables: [], rack: { version: "2.6.6" } },
      { durationMs: 40, events },
    ),
    restored = automationClipFromPatch(patch);
  assert.deepEqual(restored, { durationMs: 40, events });
  assert.equal(patch.rack.version, "2.6.6");
});

test("automation reader rejects malformed events", () => {
  const clip = automationClipFromPatch({
    modules: [],
    cables: [],
    rack: {
      patchworkWebAutomation: {
        durationMs: 0,
        events: [
          { timeMs: -1, moduleId: "bad", paramId: 0, value: 1 },
          { timeMs: 2, moduleId: "ok", paramId: 3, value: 0.75 },
        ],
      },
    },
  });
  assert.deepEqual(clip, {
    durationMs: 2,
    events: [{ timeMs: 2, moduleId: "ok", paramId: 3, value: 0.75 }],
  });
});
