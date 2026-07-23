import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

test("Ahornberg MIDI Poly Expression receives browser MIDI through its official InputQueue",()=>{
  const module=new WebAssembly.Module(fs.readFileSync(path.join(root,"public","dynamic-plugins","Ahornberg","MIDIPolyExpression","module.wasm"))),wasm=new WebAssembly.Instance(module,{}).exports;
  wasm._initialize();
  wasm.rack_web_set_output_connected(0,1);
  wasm.rack_web_midi_push(3,0x90,60,100);
  wasm.rack_web_process(1,48000);
  const outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),6*16*128);
  assert.equal(wasm.rack_web_get_output_channels(0),16);
  assert.equal(outputs[0],10);
});
