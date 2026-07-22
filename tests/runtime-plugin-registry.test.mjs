import assert from "node:assert/strict";
import test from "node:test";
import {allWebPlugins,getWebPlugin,registerDynamicModule} from "../lib/runtime-plugin-registry.ts";

test("dynamic exact-source definitions replace authored fallbacks everywhere",()=>{
  const key="Fundamental/VCO",before=allWebPlugins(),authored=before.find(module=>module.key===key),dynamic={...authored,name:"Official source VCO",wasmUrl:"/dynamic-plugins/Fundamental/VCO/module.wasm",runtime:{strategy:"direct-rack-source-adapter"}};
  registerDynamicModule(dynamic);
  const after=allWebPlugins(),listed=after.filter(module=>module.key===key);
  assert.equal(after.length,before.length);assert.deepEqual(listed,[dynamic]);assert.equal(getWebPlugin(key),dynamic);
});
