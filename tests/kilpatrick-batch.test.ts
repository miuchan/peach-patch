// @ts-nocheck
// @ts-nocheck
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const instantiate=(model)=>{const bytes=fs.readFileSync(path.join(root,"public","dynamic-plugins","Kilpatrick-Toolbox",model,"module.wasm")),wasm=new WebAssembly.Instance(new WebAssembly.Module(bytes),{}).exports;wasm._initialize();return wasm};
const pulsePackedMidi=(wasm,message)=>{wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),wasm.rack_web_input_count()*16*128)[0]=-message};

test("Kilpatrick MIDI Output converts packed CV MIDI to browser MIDI",()=>{
  const wasm=instantiate("MIDI_Output");pulsePackedMidi(wasm,0x903c64);wasm.rack_web_process(128,48000);
  assert.equal(wasm.rack_web_midi_output_available(),1);
  assert.deepEqual([...new Uint8Array(wasm.memory.buffer,wasm.rack_web_midi_output_buffer(),4)],[3,0x90,60,100]);
});

test("Kilpatrick MIDI CV converts mapped CC to smoothed bipolar CV",()=>{
  const wasm=instantiate("MIDI_CV");wasm.rack_web_set_param(2,0);pulsePackedMidi(wasm,0xb0007f);wasm.rack_web_process(128,48000);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),16*128).fill(0);for(let block=0;block<30;block++)wasm.rack_web_process(128,48000);
  const outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),3*16*128);
  for(const port of [0,1,2])assert.ok(Math.abs(outputs[port*128+127]-5)<.002);
});

test("Kilpatrick MIDI Mapper rewrites the selected CC in packed CV MIDI",()=>{
  const wasm=instantiate("MIDI_Mapper");wasm.rack_web_set_param(0,7);wasm.rack_web_set_param(6,74);pulsePackedMidi(wasm,0xb00740);wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(128,48000);
  const output=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),16*128);
  assert.equal(output[12],-0xb04a40);
});

test("Kilpatrick Quad Decoder produces six finite outputs and a five-channel bundle",()=>{
  const wasm=instantiate("Quad_Decoder");wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);for(let port=0;port<6;port++)wasm.rack_web_set_output_connected(port,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),2*16*128).fill(1,0,128);const peaks=Array(6).fill(0);for(let block=0;block<8;block++){wasm.rack_web_process(128,48000);const output=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),6*16*128);for(let port=0;port<6;port++)for(let frame=0;frame<128;frame++){const value=output[port*128+frame];assert.ok(Number.isFinite(value));peaks[port]=Math.max(peaks[port],Math.abs(value))}}
  assert.ok(peaks.every(value=>value>.1));assert.equal(wasm.rack_web_get_output_channels(5),5);
});

test("Kilpatrick MIDI Input separates browser channel messages from system output",()=>{
  const wasm=instantiate("MIDI_Input");for(let port=0;port<3;port++)wasm.rack_web_set_output_connected(port,1);wasm.rack_web_midi_push(3,0x91,60,100);wasm.rack_web_process(128,48000);const output=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),3*16*128);
  assert.equal(output[12],-0x913c64);assert.equal(output.slice(128,256).every(value=>value===0),true);assert.equal(output[256+12],-0x913c64);
});

test("Kilpatrick MIDI Merger separates packed channel and realtime messages",()=>{
  const wasm=instantiate("MIDI_Merger");for(let port=0;port<4;port++){wasm.rack_web_set_input_connected(port,1);wasm.rack_web_set_input_channels(port,1)}for(let port=0;port<3;port++)wasm.rack_web_set_output_connected(port,1);const input=new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),4*16*128);input[0]=-0x913c64;input[128]=-0xf80000;wasm.rack_web_process(128,48000);const output=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),3*16*128);
  assert.equal(output[12],-0x913c64);assert.equal(output[128+12],-0xf80000);assert.deepEqual([...output.slice(256,384)].filter(Boolean),[-0x913c64,-0xf80000]);
});

test("Kilpatrick MIDI Monitor consumes enabled packed inputs and drives exact activity lights",()=>{
  const wasm=instantiate("MIDI_Monitor");wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),4*16*128)[0]=-0x903c64;wasm.rack_web_process(128,48000);const lights=new Float32Array(wasm.memory.buffer,wasm.rack_web_light_buffer(),8);
  assert.equal(lights[0],1);assert.equal(lights[4],1);assert.deepEqual([...lights.slice(5)],[1,1,1]);
});

test("Kilpatrick MIDI Repeater suppresses duplicate CCs only in OFF mode",()=>{
  for(const [mode,repeats] of [[0,false],[1,true],[2,true]]){
    const wasm=instantiate("MIDI_Repeater");wasm.rack_web_set_param(0,mode);wasm.rack_web_set_output_connected(0,1);pulsePackedMidi(wasm,0xb00764);wasm.rack_web_process(128,48000);
    let output=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),3*16*128);assert.deepEqual([...output.slice(0,128)].filter(Boolean),[-0xb00764]);
    new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),3*16*128).fill(0);pulsePackedMidi(wasm,0xb00764);wasm.rack_web_process(128,48000);output=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),3*16*128);
    assert.deepEqual([...output.slice(0,128)].filter(Boolean),repeats?[-0xb00764]:[]);
  }
});

test("Kilpatrick MIDI CC Note converts CC number and value to note and velocity",()=>{
  const wasm=instantiate("MIDI_CC_Note");wasm.rack_web_set_output_connected(0,1);pulsePackedMidi(wasm,0xb00764);wasm.rack_web_process(128,48000);
  const output=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),16*128);
  assert.deepEqual([...output.slice(0,128)].filter(Boolean),[-0x900750]);
});

test("Kilpatrick MIDI Clock emits start, timing clock, and a 10V clock pulse",()=>{
  const wasm=instantiate("MIDI_Clock");for(let port=0;port<3;port++)wasm.rack_web_set_output_connected(port,1);wasm.rack_web_process(128,48000);wasm.rack_web_set_param(1,1);
  const midi=[],clockPeaks=[];for(let block=0;block<8;block++){wasm.rack_web_process(128,48000);const output=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),3*16*128);midi.push(...output.slice(0,128).filter(Boolean));clockPeaks.push(Math.max(...output.slice(128,256)));}
  assert.deepEqual(midi.slice(0,2),[-0xfa0000,-0xf80000]);assert.equal(Math.max(...clockPeaks),10);
});

test("Kilpatrick Multi Meter accepts 16-channel metering input without trapping",()=>{
  const wasm=instantiate("Multi_Meter");wasm.rack_web_set_input_connected(2,1);wasm.rack_web_set_input_channels(2,16);const input=new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),3*16*128);for(let channel=0;channel<16;channel++)for(let frame=0;frame<128;frame++)input[(channel*3+2)*128+frame]=Math.sin(frame/8)*(channel+1)/2;
  assert.doesNotThrow(()=>wasm.rack_web_process(128,48000));
});
