import assert from "node:assert/strict";
import test from "node:test";
import {
  allWebPlugins,
  discoverableRegistryModules,
  getWebPlugin,
  isRegistryModuleDiscoverable,
  replaceRegistryModules,
} from "../lib/runtime-plugin-registry.ts";

test("the runtime registry contains only the latest GitHub registry snapshot", () => {
  const remote = {
    key: "Fundamental/VCO",
    plugin: "Fundamental",
    model: "VCO",
    name: "VCO",
    brand: "VCV",
    version: "2.6.6",
    license: "GPL-3.0-or-later",
    sourceUrl: "https://github.com/VCVRack/Fundamental",
    libraryUrl: "https://library.vcvrack.com/Fundamental/VCO",
    screenshotUrl: "https://library.vcvrack.com/screenshots/400/Fundamental/VCO.webp",
    wasmUrl:
      "https://raw.githubusercontent.com/miuchan/peach-patch-registry/main/packages/Fundamental/VCO/2.6.6/module.wasm",
    artifact: { sha256: "a".repeat(64), size: 8 },
    width: 150,
    description: "VCO",
    params: [],
    inputs: [],
    outputs: [],
    lights: 0,
  };
  replaceRegistryModules([remote]);
  assert.deepEqual(allWebPlugins(), [remote]);
  assert.equal(getWebPlugin(remote.key), remote);

  const next = { ...remote, key: "Fundamental/VCF", model: "VCF", name: "VCF" };
  replaceRegistryModules([next]);
  assert.deepEqual(allWebPlugins(), [next]);
  assert.equal(
    getWebPlugin(remote.key),
    undefined,
    "a stale or bundled module must not survive a remote snapshot replacement",
  );
});

test("hidden modules remain exactly loadable but are excluded from discovery", () => {
  const visible = {
      key: "Fixture/Visible",
      plugin: "Fixture",
      model: "Visible",
      name: "Visible",
      brand: "Fixture",
      version: "1.0.0",
      license: "MIT",
      sourceUrl: "https://example.com/source",
      libraryUrl: "https://example.com/library/visible",
      screenshotUrl: "https://example.com/visible.webp",
      wasmUrl: "https://example.com/visible.wasm",
      width: 45,
      description: "Visible module",
      params: [],
      inputs: [],
      outputs: [],
      lights: 0,
    },
    hidden = {
      ...visible,
      key: "Fixture/Hidden",
      model: "Hidden",
      name: "Hidden",
      hidden: true,
    };

  replaceRegistryModules([visible, hidden]);
  assert.deepEqual(discoverableRegistryModules(allWebPlugins()), [visible]);
  assert.equal(isRegistryModuleDiscoverable(visible), true);
  assert.equal(isRegistryModuleDiscoverable(hidden), false);
  assert.equal(getWebPlugin(hidden.key), hidden);
});
