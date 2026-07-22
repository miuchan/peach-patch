import assert from "node:assert/strict";
import test from "node:test";
import {createWavBlob,floatPcm16Part,wavHeader} from "../lib/wav-encoder.ts";

test("WAV encoder writes a standards-compliant stereo PCM header",async()=>{
  const pcm=floatPcm16Part(new Float32Array([-2,-1,-.5,0,.5,1,2,0]));
  const blob=createWavBlob([pcm],4,2,48000),bytes=await blob.arrayBuffer(),view=new DataView(bytes),text=(offset,length)=>String.fromCharCode(...new Uint8Array(bytes,offset,length));
  assert.equal(blob.type,"audio/wav");assert.equal(blob.size,60);assert.equal(text(0,4),"RIFF");assert.equal(view.getUint32(4,true),52);assert.equal(text(8,4),"WAVE");assert.equal(view.getUint16(20,true),1);assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),48000);assert.equal(view.getUint32(28,true),192000);assert.equal(view.getUint16(34,true),16);assert.equal(text(36,4),"data");assert.equal(view.getUint32(40,true),16);assert.equal(view.getInt16(44,true),-32768);assert.equal(view.getInt16(54,true),32767);
});

test("WAV header normalizes invalid dimensions",()=>{
  const view=new DataView(wavHeader(-4,9,0));
  assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),1);assert.equal(view.getUint32(40,true),0);
});
