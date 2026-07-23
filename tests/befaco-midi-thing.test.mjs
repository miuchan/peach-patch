import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),bytes=fs.readFileSync(path.join(root,"public","dynamic-plugins","Befaco","MidiThingV2","module.wasm"));
const instantiate=()=>{const wasm=new WebAssembly.Instance(new WebAssembly.Module(bytes),{}).exports;wasm._initialize();return wasm};
const packetMessages=(wasm)=>{const length=wasm.rack_web_midi_packet_output_available(),wire=new Uint8Array(wasm.memory.buffer,wasm.rack_web_midi_packet_output_buffer(),length),messages=[];for(let offset=0;offset+1<wire.length;){const size=wire[offset]|wire[offset+1]<<8,end=offset+2+size;assert.ok(size>0&&end<=wire.length);messages.push([...wire.slice(offset+2,end)]);offset=end}return messages};

test("Befaco MidiThingV2 emits exact pitch bend and complete hardware SysEx messages",()=>{
  const wasm=instantiate();
  wasm.rack_web_set_input_connected(0,1);
  wasm.rack_web_set_input_channels(0,1);
  new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),12*16*128).fill(5,0,128);
  wasm.rack_web_process(64,48000);
  const count=wasm.rack_web_midi_output_available(),records=new Uint8Array(wasm.memory.buffer,wasm.rack_web_midi_output_buffer(),count*4);
  assert.ok(count>=1);
  assert.deepEqual([...records.slice(0,4)],[3,0xe0,0x7f,0x3f]);

  wasm.rack_web_set_param(0,1);
  wasm.rack_web_process(1,48000);
  const messages=packetMessages(wasm);
  assert.equal(messages.length,14);
  assert.deepEqual(messages[0],[0xf0,0x7d,0x17,0,0,2,0,3,0xf7]);
  assert.deepEqual(messages[1],[0xf0,0x7d,0x19,0,5,2,0,0,0xf7]);
  assert.deepEqual(messages.at(-1),[0xf0,0x7d,0x17,43,2,2,0,1,0xf7]);
  assert.ok(messages.every(message=>message.length===9&&message[0]===0xf0&&message.at(-1)===0xf7));
});
