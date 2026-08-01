// @ts-nocheck
// @ts-nocheck
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),bytes=fs.readFileSync(path.join(root,"public","dynamic-plugins","23volts","MidiPC","module.wasm"));
const instantiate=()=>{const wasm=new WebAssembly.Instance(new WebAssembly.Module(bytes),{}).exports;wasm._initialize();return wasm};

test("23volts MidiPC receives and emits Program Change through the browser MIDI host",()=>{
  const receiver=instantiate();
  receiver.rack_web_set_output_connected(0,1);
  receiver.rack_web_midi_push(2,0xc0,37,0);
  receiver.rack_web_process(32,48000);
  const received=new Float32Array(receiver.memory.buffer,receiver.rack_web_output_buffer(),2*16*128);
  assert.ok(Math.abs(received[31]-(37/127)*10)<1e-5);

  const sender=instantiate();
  sender.rack_web_set_param(0,52);
  sender.rack_web_set_input_connected(1,1);
  sender.rack_web_set_input_channels(1,1);
  new Float32Array(sender.memory.buffer,sender.rack_web_input_buffer(),2*16*128)[128]=10;
  sender.rack_web_process(1,48000);
  assert.equal(sender.rack_web_midi_output_available(),1);
  assert.deepEqual([...new Uint8Array(sender.memory.buffer,sender.rack_web_midi_output_buffer(),4)],[3,0xc0,52,0]);
});
