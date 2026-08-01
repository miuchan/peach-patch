// @ts-nocheck
// @ts-nocheck
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),bytes=fs.readFileSync(path.join(root,"public","dynamic-plugins","Kilpatrick-Toolbox","MIDI_Channel","module.wasm"));
const route=(params,message)=>{const wasm=new WebAssembly.Instance(new WebAssembly.Module(bytes),{}).exports;wasm._initialize();for(const [id,value] of params)wasm.rack_web_set_param(id,value);wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);wasm.rack_web_set_output_connected(1,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),16*128)[0]=-message;wasm.rack_web_process(128,48000);return new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),2*16*128)};

test("Kilpatrick MIDI Channel routes, splits, remaps, and transposes packed CV MIDI",()=>{
  const ordinary=route([],0x903c64);
  assert.equal(ordinary.slice(0,128).every(value=>value===0),true);
  assert.equal(ordinary[128+12],-0x903c64);

  const split=route([[1,2],[2,60],[3,1],[4,12]],0x903264);
  assert.equal(split[12],-0x923e64);
  assert.equal(split.slice(128,256).every(value=>value===0),true);
});
