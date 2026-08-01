// @ts-nocheck
// @ts-nocheck
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

test("8Mode softSN runs its SN76477 oscillator in WASM",()=>{
  const catalog=JSON.parse(fs.readFileSync(path.join(root,"public","dynamic-plugins","catalog.json"),"utf8")),definition=catalog.find(item=>item.key==="8Mode/softSN");
  assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"fe5a642ee0a455e882e105f422cf85f7e83fd31f");
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(root,"public",definition.wasmUrl))),{}).exports;wasm._initialize();assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_input_count(),wasm.rack_web_output_count(),wasm.rack_web_light_count()],[16,9,4,1]);
  for(let output=0;output<4;output++)wasm.rack_web_set_output_connected(output,1);
  const samples=[];for(let block=0;block<100;block++){wasm.rack_web_process(128,48000);samples.push(...new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128))}
  assert.ok(samples.every(Number.isFinite));assert.ok(Math.min(...samples)<-5);assert.ok(Math.max(...samples)>4);assert.ok(new Set(samples.map(value=>value.toFixed(6))).size>=3);assert.deepEqual([0,1,2,3].map(wasm.rack_web_get_output_channels),[1,1,1,1]);
});
