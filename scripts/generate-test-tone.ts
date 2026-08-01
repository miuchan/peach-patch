// @ts-nocheck
// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate=48000,frames=sampleRate/2,channels=1,bits=16,dataBytes=frames*channels*2;
const wav=Buffer.alloc(44+dataBytes);
wav.write("RIFF",0);wav.writeUInt32LE(36+dataBytes,4);wav.write("WAVE",8);wav.write("fmt ",12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(channels,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*channels*bits/8,28);wav.writeUInt16LE(channels*bits/8,32);wav.writeUInt16LE(bits,34);wav.write("data",36);wav.writeUInt32LE(dataBytes,40);
for(let frame=0;frame<frames;frame++){const envelope=Math.min(1,frame/500)*Math.exp(-frame/(sampleRate*.35)),sample=Math.sin(2*Math.PI*220*frame/sampleRate)*envelope;wav.writeInt16LE(Math.round(sample*32767),44+frame*2)}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const target=path.join(root,"tests","fixtures","test-tone.wav");fs.writeFileSync(target,wav);console.log(target);
