import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

test("Animatek APC40 CTRL receives channelized CC messages through its official InputQueue",()=>{
  const module=new WebAssembly.Module(fs.readFileSync(path.join(root,"public","dynamic-plugins","Animatek","Apc40Ctrl","module.wasm"))),wasm=new WebAssembly.Instance(module,{}).exports;
  wasm._initialize();
  wasm.rack_web_set_output_connected(0,1);
  wasm.rack_web_set_output_connected(21,1);
  wasm.rack_web_midi_push(3,0xb0,48,127);
  wasm.rack_web_midi_push(3,0xb2,7,64);
  wasm.rack_web_process(1,48000);
  const outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),27*16*128);
  assert.equal(outputs[0],10);
  assert.ok(Math.abs(outputs[21*128]-(64/127)*10)<1e-5);
});
