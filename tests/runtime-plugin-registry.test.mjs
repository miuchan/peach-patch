import assert from "node:assert/strict";
import test from "node:test";
import {allWebPlugins,getWebPlugin,replaceRegistryModules} from "../lib/runtime-plugin-registry.ts";

test("the runtime registry contains only the latest GitHub registry snapshot",()=>{
  const remote={key:"Fundamental/VCO",plugin:"Fundamental",model:"VCO",name:"VCO",brand:"VCV",version:"2.6.6",license:"GPL-3.0-or-later",sourceUrl:"https://github.com/VCVRack/Fundamental",libraryUrl:"https://library.vcvrack.com/Fundamental/VCO",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fundamental/VCO.webp",wasmUrl:"https://raw.githubusercontent.com/miuchan/peach-patch-registry/main/packages/Fundamental/VCO/2.6.6/module.wasm",artifact:{sha256:"a".repeat(64),size:8},width:150,description:"VCO",params:[],inputs:[],outputs:[],lights:0};
  replaceRegistryModules([remote]);
  assert.deepEqual(allWebPlugins(),[remote]);
  assert.equal(getWebPlugin(remote.key),remote);

  const next={...remote,key:"Fundamental/VCF",model:"VCF",name:"VCF"};
  replaceRegistryModules([next]);
  assert.deepEqual(allWebPlugins(),[next]);
  assert.equal(getWebPlugin(remote.key),undefined,"a stale or bundled module must not survive a remote snapshot replacement");
});
