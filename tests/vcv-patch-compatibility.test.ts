import assert from "node:assert/strict";
import test from "node:test";
import {
  assertVcvPatchModulesLoadable,
  blockedVcvPatchModules,
  BlockedVcvPatchError,
} from "../lib/vcv-patch-compatibility.ts";

const patch = {
  version: "2.6.6",
  modules: [
    { id: 1, plugin: "Open", model: "Ready", pos: [0, 0] as [number, number] },
    { id: 2, plugin: "Paid", model: "Voice", pos: [1, 0] as [number, number] },
    { id: 3, plugin: "Missing", model: "Effect", pos: [2, 0] as [number, number] },
    { id: 4, plugin: "Missing", model: "Effect", pos: [3, 0] as [number, number] },
  ],
  cables: [],
};

const resolve = (key: string) => {
  if (key === "Open/Ready") return { license: "GPL-3.0-or-later" };
  if (key === "Paid/Voice") return { license: "Proprietary commercial EULA" };
  return undefined;
};

test("patch compatibility groups commercial and unavailable module instances", () => {
  assert.deepEqual(blockedVcvPatchModules(patch, resolve), [
    {
      key: "Paid/Voice",
      count: 1,
      reason: "commercial-license",
      license: "Proprietary commercial EULA",
    },
    {
      key: "Missing/Effect",
      count: 2,
      reason: "unavailable",
    },
  ]);
});

test("patch compatibility rejects before import and reports the total instance count", () => {
  assert.throws(
    () => assertVcvPatchModulesLoadable(patch, resolve),
    (error) =>
      error instanceof BlockedVcvPatchError &&
      error.instanceCount === 3 &&
      error.message === "Patch not loaded · 3 commercial or unavailable modules",
  );
});

test("patch compatibility accepts a patch whose modules are all open and available", () => {
  assert.doesNotThrow(() =>
    assertVcvPatchModulesLoadable(
      { ...patch, modules: patch.modules.slice(0, 1) },
      resolve,
    ),
  );
});
