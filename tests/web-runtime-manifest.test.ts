// @ts-nocheck
// @ts-nocheck
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { WEB_PLUGIN_REGISTRY, WEB_RUNTIME_MANIFEST } from "../lib/web-plugin-registry.ts";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"web-runtime","modules.json"),"utf8"));

test("the Web ABI manifest and runtime registry stay in lockstep",()=>{
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.abiVersion,"0.3");assert.equal(manifest.modules.length,35);
  assert.deepEqual(manifest,WEB_RUNTIME_MANIFEST,"modules.json is generated from the browser registry");
  assert.deepEqual(manifest.modules.map(item=>item.key).sort(),WEB_PLUGIN_REGISTRY.map(item=>item.key).sort());
  assert.equal(new Set(manifest.modules.map(item=>item.entry)).size,manifest.modules.length);
  assert.equal(new Set(manifest.modules.map(item=>item.artifact)).size,manifest.modules.length);
  for(const item of manifest.modules){
    assert.ok(["ordered-translation","browser-dsp-adapter","rack-boundary"].includes(item.strategy));
    assert.equal(item.initialMemory%65536,0);
    assert.ok(fs.existsSync(path.join(root,"web-runtime","plugins",`${item.entry}.cpp`)),`${item.key} source exists`);
    const wasm=fs.readFileSync(path.join(root,"public","wasm",`${item.artifact}.wasm`));
    assert.deepEqual([...wasm.subarray(0,4)],[0,97,115,109],`${item.key} artifact has WASM magic`);
    const exports=new Set(WebAssembly.Module.exports(new WebAssembly.Module(wasm)).map(entry=>entry.name));
    for(const name of ["rack_web_asset_capacity","rack_web_asset_buffer","rack_web_commit_asset","rack_web_capture_capacity","rack_web_capture_buffer","rack_web_capture_frames","rack_web_capture_channels","rack_web_capture_active","rack_web_consume_capture","rack_web_set_capture_enabled","rack_web_midi_push","rack_web_midi_output_available","rack_web_midi_output_buffer","rack_web_consume_midi_output","rack_web_midi_packet_output_available","rack_web_midi_packet_output_buffer","rack_web_consume_midi_packet_output","rack_web_max_channels","rack_web_set_input_channels","rack_web_get_output_channels","rack_web_set_polyphony"])assert.ok(exports.has(name),`${item.key} exports ABI 0.3`);
  }
});

test("the manifest reader supports one-module builds",()=>{
  const source=fs.readFileSync(path.join(root,"scripts","build-web-runtime.sh"),"utf8");
  assert.match(source,/read-web-runtime-manifest\.ts/);assert.match(source,/"\$@"/);
});
