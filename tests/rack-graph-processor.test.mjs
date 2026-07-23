import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {dataFromState,stateFromData} from "../lib/patch-state.ts";
import {parseVcvArchive} from "../lib/vcv-patch.ts";
import {WEB_PLUGIN_BY_KEY} from "../lib/web-plugin-registry.ts";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),fixtureSource=path.join(root,"tests","fixtures","scaffold-plugin");
const dynamicCatalog=JSON.parse(fs.readFileSync(path.join(root,"public","dynamic-plugins","catalog.json"),"utf8"));

let registeredName,ProcessorClass;
globalThis.sampleRate=48000;
globalThis.AudioWorkletProcessor=class{constructor(){this.messages=[];this.port={onmessage:null,postMessage:(message)=>this.messages.push(message)}}};
globalThis.registerProcessor=(name,constructor)=>{registeredName=name;ProcessorClass=constructor};
await import(new URL("../public/audio/rack-graph-processor.js",import.meta.url));

function wasm(name){const bytes=fs.readFileSync(new URL(`../public/wasm/${name}.wasm`,import.meta.url));return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}
function dynamicWasm(plugin,model){const bytes=fs.readFileSync(new URL(`../public/dynamic-plugins/${plugin}/${model}/module.wasm`,import.meta.url));return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}
function module(id,name,params,polyphony=1,extra={}){return {id,wasm:wasm(name),params,state:[],seed:42,polyphony,outputConnections:[true,true,true,true],...extra}}
function output(){return [[new Float32Array(128),new Float32Array(128)]]}

function mattixGraph(){
  const patch=parseVcvArchive(fs.readFileSync(path.join(root,"tests","fixtures","Mattix.vcv"))),definitions=new Map([...Object.values(WEB_PLUGIN_BY_KEY),...dynamicCatalog].map(definition=>[definition.key,definition])),moduleByRackId=new Map(patch.modules.map(item=>[item.id,item])),outgoing=new Set(patch.cables.map(cable=>`${cable.outputModuleId}:${cable.outputId}`)),wasmByUrl=new Map();
  const definitionFor=(item)=>definitions.get(`${item.plugin}/${item.model}`),active=patch.modules.filter(item=>{const definition=definitionFor(item);return definition&&!definition.runtime?.audio&&(definition.outputs.length>0||definition.runtime?.expander||definition.runtime?.capture||definition.runtime?.midi?.input||definition.runtime?.midi?.output||definition.runtime?.visuals?.length)}),activeIds=new Set(active.map(item=>item.id)),artifact=(url)=>{let bytes=wasmByUrl.get(url);if(!bytes){const source=fs.readFileSync(path.join(root,"public",url.replace(/^\/+/,"")));bytes=source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength);wasmByUrl.set(url,bytes)}return bytes};
  const modules=active.map(item=>{const definition=definitionFor(item),params=definition.params.map(param=>param.default),state=stateFromData(definition.key,item.data,definition.stateKeys);for(const param of item.params??[])params[param.id]=param.value;return {id:`vcv-${item.id}`,key:definition.key,wasm:artifact(definition.wasmUrl),params,state,stateJson:JSON.stringify(dataFromState(definition.key,item.data,state,definition.stateKeys)??{}),seed:item.id>>>0,polyphony:1,bypassed:item.bypass===true||item.disabled===true,bypassRoutes:definition.bypassRoutes??[],x:item.pos[0]*15,y:item.pos[1]*400,width:definition.width,rackId:item.id,snapParams:definition.params.map(param=>Boolean(param.snap)),expander:definition.runtime?.expander,visuals:definition.runtime?.visuals??[],outputConnections:definition.outputs.map(port=>outgoing.has(`${item.id}:${port.id}`))}}),audioBoundaries=patch.modules.flatMap(item=>{const definition=definitionFor(item);return definition?.runtime?.audio?[{id:`vcv-${item.id}`,key:definition.key,params:(item.params??[]).reduce((values,param)=>(values[param.id]=param.value,values),definition.params.map(param=>param.default))}]:[]}),cables=patch.cables.flatMap(cable=>{if(!activeIds.has(cable.outputModuleId))return[];const target=moduleByRackId.get(cable.inputModuleId),definition=target?definitionFor(target):undefined;if(definition?.runtime?.audio)return cable.inputId<2?[{fromModule:`vcv-${cable.outputModuleId}`,fromPort:cable.outputId,toModule:`vcv-${cable.inputModuleId}`,toPort:cable.inputId,toAudio:true,audioModuleId:`vcv-${cable.inputModuleId}`}]:[];return activeIds.has(cable.inputModuleId)?[{fromModule:`vcv-${cable.outputModuleId}`,fromPort:cable.outputId,toModule:`vcv-${cable.inputModuleId}`,toPort:cable.inputId,toAudio:false}]:[]});
  return {modules,audioBoundaries,cables};
}

test("the graph worklet topologically processes a four-voice VCO through a VCA",async()=>{
  assert.equal(registeredName,"rack-graph-processor");
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0],4),module("vca","fundamental-vca",[1,1],4)],cables:[{fromModule:"vco",fromPort:0,toModule:"vca",toPort:2,toAudio:false},{fromModule:"vca",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  const channels=output();assert.equal(processor.process([],channels),true);
  assert.deepEqual(processor.order,["vco","vca"]);assert.equal(processor.modules.get("vca").currentChannels[0],4);
  assert.ok(Math.max(...channels[0][0].map(Math.abs))>0);assert.equal(processor.messages.at(-1).feedbackEdges,0);
});

test("the graph worklet applies patch automation at the exact audio sample",async()=>{
  const processor=new ProcessorClass();await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),module("target","fundamental-vca",[0,1],1,{key:"Fundamental/VCA",snapParams:[false,false]})],cables:[{fromModule:"vco",fromPort:0,toModule:"target",toPort:2,toAudio:false},{fromModule:"target",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  processor.port.onmessage({data:{type:"automation-start",durationMs:1,events:[{timeMs:.5,moduleId:"target",paramId:0,value:1}]}});const channels=output();processor.process([],channels);
  const transitionFrame=24,silentPeak=Math.max(...channels[0][0].slice(0,transitionFrame).map(Math.abs)),audiblePeak=Math.max(...channels[0][0].slice(transitionFrame).map(Math.abs));
  assert.ok(silentPeak<1e-7);assert.ok(audiblePeak>.01);assert.equal(processor.modules.get("target").params[0],1);assert.deepEqual(processor.messages.find(message=>message.type==="automation-param"),{type:"automation-param",moduleId:"target",id:0,value:1});assert.ok(processor.messages.some(message=>message.type==="automation-complete"));
});

test("the graph worklet streams bounded live port peaks for one monitored module",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0],4),module("vca","fundamental-vca",[1,1],4)],cables:[{fromModule:"vco",fromPort:0,toModule:"vca",toPort:2,toAudio:false}]});
  processor.port.onmessage({data:{type:"monitor-module",moduleId:"vca"}});
  for(let block=0;block<16;block++)processor.process([],output());
  const peaks=processor.messages.find(message=>message.type==="port-peaks");
  assert.equal(peaks.moduleId,"vca");assert.equal(peaks.inputs.length,6);assert.equal(peaks.outputs.length,2);assert.ok(peaks.inputs[2]>0);assert.ok(peaks.outputs[0]>0);assert.ok(peaks.inputs.every(value=>Number.isFinite(value)&&value>=0));assert.equal(peaks.inputScopes.length,6);assert.equal(peaks.outputScopes.length,2);assert.ok(peaks.inputScopes.every(scope=>scope.length===32&&scope.every(Number.isFinite)));assert.ok(peaks.outputScopes[0].some(value=>Math.abs(value)>.01));
});

test("dynamic display telemetry follows the module visual contract instead of a module key",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),module("display","fundamental-vca",[1,1],1,{key:"Fixture/Display",visuals:[{kind:"scope",inputs:[2,5],x:0,y:0,width:75,height:100}]})],cables:[{id:"signal",fromModule:"vco",fromPort:0,toModule:"display",toPort:2,toAudio:false}]});
  for(let block=0;block<8;block++)processor.process([],output());
  const visual=processor.messages.find(message=>message.type==="visual-signals");
  assert.ok(visual);assert.equal(visual.scopes.display.length,2);assert.ok(visual.scopes.display[0].some(value=>Math.abs(value)>.01));assert.ok(visual.scopes.display[1].every(value=>value===0));assert.equal(visual.plugs.signal.channels,1);assert.ok(Number.isFinite(visual.plugs.signal.voltage));assert.ok(visual.plugs.signal.rms>.01);assert.equal(visual.plugs.signal.rgb.length,3);assert.ok(visual.plugs.signal.rgb.some(value=>value>.01));assert.equal(visual.lights.vco.length,5);assert.ok(visual.lights.vco.every(Number.isFinite));
});

test("multichannel meter telemetry combines its discrete stereo and 16-channel inputs",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),module("meter","fundamental-vca",[1,1],1,{key:"Fixture/MultiMeter",visuals:[{kind:"multi-meter",inputs:[2,5,0],modeParam:0,channelsParam:1,x:0,y:0,width:75,height:100}]})],cables:[{fromModule:"vco",fromPort:0,toModule:"meter",toPort:2,toAudio:false},{fromModule:"vco",fromPort:0,toModule:"meter",toPort:0,toAudio:false}]});
  for(let block=0;block<8;block++)processor.process([],output());const visual=processor.messages.find(message=>message.type==="visual-signals");
  assert.equal(visual.scopes.meter.length,16);assert.ok(visual.scopes.meter[0].some(value=>Math.abs(value)>.01));assert.ok(visual.scopes.meter.slice(1).every(channel=>channel.every(value=>value===0)));assert.ok(visual.scopes.meter.flat().every(value=>Number.isFinite(value)&&value>=-1&&value<=1));
});

test("the graph worklet supplies the browser WASI clock used by HetrickCV chaos DSP",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="HetrickCV/Chaos1Op");assert.ok(definition);const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"chaos",key:definition.key,wasm:dynamicWasm("HetrickCV","Chaos1Op"),params:definition.params.map(param=>param.default),state:[],seed:42,polyphony:1,outputConnections:[true,true],x:0,y:0,width:definition.width}],cables:[{fromModule:"chaos",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  const channels=output();let peak=0;for(let block=0;block<16;block++){assert.equal(processor.process([],channels),true);peak=Math.max(peak,...channels[0][0].map(Math.abs))}assert.ok(peak>.1);assert.equal(processor.messages.find(message=>message.type==="error"),undefined);
});

test("the graph worklet commits every OAI browser sample slot before polyphonic playback",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="Bidoo/OAI");assert.ok(definition);const processor=new ProcessorClass(),frames=512,first=new Float32Array(frames).fill(.2),second=new Float32Array(frames).fill(-.4);
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0],2),{id:"oai",key:definition.key,wasm:dynamicWasm("Bidoo","OAI"),params:definition.params.map(param=>param.default),state:[],seed:42,polyphony:2,outputConnections:[true],assets:[{name:"one.wav",sampleRate:48000,channels:1,frames,samples:first}, {name:"two.wav",sampleRate:48000,channels:1,frames,samples:second}],x:100,y:0,width:definition.width}],cables:[{fromModule:"vco",fromPort:0,toModule:"oai",toPort:0,toAudio:false},{fromModule:"oai",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  const oai=processor.modules.get("oai");assert.equal(oai.runtime.rack_web_asset_slot_count(),16);let positive=0,negative=0;for(let block=0;block<8;block++){processor.process([],output());positive=Math.max(positive,...oai.outputs.slice(0,128));negative=Math.min(negative,...oai.outputs.slice(128,256))}assert.ok(positive>.99);assert.ok(negative<-1.99);assert.equal(processor.messages.find(message=>message.type==="error"),undefined)
});

test("Core Audio-2 boundary applies its live Rack level before browser output",async()=>{
  const processor=new ProcessorClass();await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0])],audioBoundaries:[{id:"audio2",key:"Core/AudioInterface2",params:[.25]}],cables:[{fromModule:"vco",fromPort:0,toModule:"audio2",toPort:0,toAudio:true,audioModuleId:"audio2"}]});const quarter=output();processor.process([],quarter);const quarterPeak=Math.max(...quarter[0][0].map(Math.abs));processor.port.onmessage({data:{type:"param",moduleId:"audio2",id:0,value:1}});const unity=output();processor.process([],unity);const unityPeak=Math.max(...unity[0][0].map(Math.abs));assert.ok(quarterPeak>0);assert.ok(unityPeak>quarterPeak*3.5);
});

test("Core Audio-2 automation changes browser gain at the exact audio sample",async()=>{
  const processor=new ProcessorClass();await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0])],audioBoundaries:[{id:"audio2",key:"Core/AudioInterface2",params:[0]}],cables:[{fromModule:"vco",fromPort:0,toModule:"audio2",toPort:0,toAudio:true,audioModuleId:"audio2"}]});
  processor.port.onmessage({data:{type:"automation-start",durationMs:1,events:[{timeMs:.5,moduleId:"audio2",paramId:0,value:1}]}});const channels=output();processor.process([],channels);const transitionFrame=24;
  assert.ok(Math.max(...channels[0][0].slice(0,transitionFrame).map(Math.abs))<1e-7);assert.ok(Math.max(...channels[0][0].slice(transitionFrame).map(Math.abs))>.01);assert.equal(processor.audioBoundaries.get("audio2").params[0],1);
});

test("Mattix loads its entire 80-module, 142-cable execution graph and produces finite audio",async()=>{
  const graph=mattixGraph(),processor=new ProcessorClass();
  assert.equal(graph.modules.length,80);assert.equal(graph.audioBoundaries.length,1);assert.equal(graph.cables.length,142);
  await processor.loadGraph(graph);
  const ready=processor.messages.find(message=>message.type==="ready");assert.equal(ready.modules,80);assert.equal(ready.cables,142);assert.equal(processor.modules.size,80);assert.equal(processor.cables.length+processor.deviceCables.length,142);assert.equal(processor.messages.find(message=>message.type==="error"),undefined);
  const channels=output();let peak=0;for(let block=0;block<4;block++){assert.equal(processor.process([],channels),true);for(const channel of channels[0]){assert.ok(channel.every(Number.isFinite));peak=Math.max(peak,...channel.map(Math.abs))}}
  assert.ok(peak>.001);for(const rackModule of processor.modules.values())assert.ok(rackModule.outputs.every(Number.isFinite),`${rackModule.key} emits finite samples`);
  const target=graph.modules.find(item=>item.params.length);assert.ok(target);processor.port.onmessage({data:{type:"automation-start",durationMs:1,events:[{timeMs:.5,moduleId:target.id,paramId:0,value:target.params[0]}]}});assert.equal(processor.process([],channels),true);for(const channel of channels[0])assert.ok(channel.every(Number.isFinite));assert.equal(processor.messages.find(message=>message.type==="error"),undefined);
});

test("VCV Recorder streams bounded stereo PCM chunks and flushes on stop",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),
    module("recorder","vcv-recorder",[1,0],1,{key:"VCV-Recorder/Recorder",outputConnections:[]}),
  ],cables:[
    {fromModule:"vco",fromPort:0,toModule:"recorder",toPort:2,toAudio:false},
    {fromModule:"vco",fromPort:2,toModule:"recorder",toPort:3,toAudio:false},
  ]});
  processor.port.onmessage({data:{type:"capture-enable",moduleId:"recorder",enabled:true}});
  for(let block=0;block<20;block++)processor.process([],output());
  processor.port.onmessage({data:{type:"capture-enable",moduleId:"recorder",enabled:false}});
  processor.process([],output());
  const start=processor.messages.find(message=>message.type==="capture-start"),stop=processor.messages.find(message=>message.type==="capture-stop"),chunks=processor.messages.filter(message=>message.type==="capture-data");
  assert.equal(start.moduleId,"recorder");assert.equal(start.channels,2);assert.equal(stop.moduleId,"recorder");assert.equal(chunks.reduce((sum,chunk)=>sum+chunk.frames,0),20*128);assert.ok(chunks.length>=2);assert.ok(chunks.every(chunk=>chunk.samples.length===chunk.frames*2));assert.ok(chunks.some(chunk=>Math.max(...chunk.samples.map(Math.abs))>.01));
});

test("Stoermelder Stroke turns a browser-host action into an exact-source CV trigger",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="Stoermelder-P1/Stroke");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"d02f0b6d79e792416c5876e369adf2e69f5513bc");assert.equal(definition.stateKeys.length,51);
  const state=[0,...Array.from({length:10},(_,slot)=>[-1,slot===0?65:-1,0,1,0]).flat()],processor=new ProcessorClass();await processor.loadGraph({modules:[{id:"stroke",key:definition.key,wasm:dynamicWasm("Stoermelder-P1","Stroke"),params:[],state,seed:42,polyphony:1,outputConnections:Array(10).fill(true),x:0,y:0,width:definition.width}],cables:[{fromModule:"stroke",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  processor.port.onmessage({data:{type:"trigger-action",moduleId:"stroke",id:0,active:true}});const channels=output();processor.process([],channels);assert.equal(Math.max(...processor.modules.get("stroke").outputs.slice(0,128)),10);assert.equal(Math.max(...channels[0][0]),2);processor.port.onmessage({data:{type:"trigger-action",moduleId:"stroke",id:0,active:false}});for(let block=0;block<4;block++)processor.process([],channels);assert.equal(Math.max(...channels[0][0]),0);
});

test("the graph worklet restores nested VCV module JSON before audio starts",async()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-json-graph-test-"));
  try{
    execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/HostMixed","--manifest-file",path.join(fixtureSource,"plugin.json"),"--source-dir",fixtureSource,"--output",temporary,"--compile"],{stdio:"pipe"});
    const bytes=fs.readFileSync(path.join(temporary,"module.wasm")),processor=new ProcessorClass();
    await processor.loadGraph({modules:[{id:"json",key:"FixturePlugin/HostMixed",wasm:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),params:[2,0,0],state:[],stateJson:JSON.stringify({bank:{name:"音序",slots:[null,{voltage:2.25}]}}),seed:42,polyphony:1,outputConnections:[true],x:0,y:0,width:75}],cables:[{fromModule:"json",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
    const channels=output();processor.process([],channels);assert.equal(channels[0][0][0],2.25);processor.port.onmessage({data:{type:"snapshot-state",moduleId:"json"}});const snapshot=processor.messages.find(message=>message.type==="state-json");assert.equal(snapshot.moduleId,"json");assert.deepEqual(JSON.parse(new TextDecoder().decode(snapshot.bytes)),{"bank-2":2.25});processor.port.onmessage({data:{type:"load-state-json",moduleId:"json",stateJson:JSON.stringify({bank:{slots:[null,{voltage:4.5}]}})}});processor.process([],channels);assert.ok(Math.abs(channels[0][0][0]-2.7)<1e-6);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("the graph worklet routes Web MIDI into Core CV and drains Core MIDI output",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    module("midi-in","core-midi-cv",[],1,{key:"Core/MIDIToCVInterface",stateJson:JSON.stringify({channels:1,pwRange:2,midi:{channel:-1}}),outputConnections:Array(12).fill(true)}),
    module("midi-out","core-cv-midi",[],1,{key:"Core/CV-MIDI",stateJson:JSON.stringify({midi:{channel:0}}),outputConnections:[]}),
  ],cables:[{fromModule:"midi-in",fromPort:0,toModule:"midi-out",toPort:0,toAudio:false},{fromModule:"midi-in",fromPort:1,toModule:"midi-out",toPort:1,toAudio:false}]});
  processor.port.onmessage({data:{type:"midi-input",moduleIds:["midi-in"],bytes:[0x90,72,110]}});processor.process([],output());
  const outbound=processor.messages.find(message=>message.type==="midi-output"&&message.moduleId==="midi-out");assert.ok(outbound);const records=[...outbound.records];assert.ok(Array.from({length:records.length/4},(_,index)=>records.slice(index*4,index*4+4)).some(record=>record[1]===0x90&&record[2]===72&&record[3]===100));
  assert.equal(processor.modules.get("midi-in").outputs[0],1);assert.equal(processor.modules.get("midi-in").outputs[128],10);
});

test("the graph worklet drains complete variable-length SysEx packets",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="Befaco/MidiThingV2");assert.ok(definition);const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),{id:"midi-thing",key:definition.key,wasm:dynamicWasm("Befaco","MidiThingV2"),params:[0],state:[],seed:42,polyphony:1,outputConnections:[],x:0,y:0,width:definition.width}],cables:[{fromModule:"vco",fromPort:0,toModule:"midi-thing",toPort:0,toAudio:false}]});
  processor.process([],output());processor.port.onmessage({data:{type:"param",moduleId:"midi-thing",id:0,value:1}});processor.process([],output());
  const outbound=processor.messages.find(message=>message.type==="midi-output"&&message.moduleId==="midi-thing"&&message.packets.length);assert.ok(outbound);const packets=[...outbound.packets];assert.deepEqual(packets.slice(0,11),[9,0,0xf0,0x7d,0x17,0,0,2,0,3,0xf7]);assert.equal(packets.length,154);
});

test("Rack Core MIDI-Map controls a target WASM parameter by original Rack module id",async()=>{
  const processor=new ProcessorClass(),mapState={maps:[{cc:74,moduleId:77,paramId:0}],smooth:false,midi:{channel:-1}};
  await processor.loadGraph({modules:[
    module("map","core-midi-map",[],1,{key:"Core/MIDI-Map",rackId:12,stateJson:JSON.stringify(mapState),outputConnections:[]}),
    module("target","fundamental-vca",[0,1],1,{key:"Fundamental/VCA",rackId:77,snapParams:[false,false]}),
  ],cables:[]});
  processor.port.onmessage({data:{type:"midi-input",moduleIds:["map"],bytes:[0xb0,74,127]}});processor.process([],output());assert.equal(processor.modules.get("target").params[0],1);assert.deepEqual(processor.messages.find(message=>message.type==="midi-param"),{type:"midi-param",moduleId:"target",id:0,value:1});
  processor.port.onmessage({data:{type:"load-state-json",moduleId:"map",stateJson:JSON.stringify({maps:[{cc:75,moduleId:-1,patchworkModuleId:"target",paramId:1}],smooth:false})}});processor.port.onmessage({data:{type:"midi-input",moduleIds:["map"],bytes:[0xb0,75,0]}});processor.process([],output());assert.equal(processor.modules.get("target").params[1],0);
  processor.port.onmessage({data:{type:"snapshot-state",moduleId:"map"}});const snapshot=processor.messages.find(message=>message.type==="state-json"&&message.moduleId==="map");assert.deepEqual(JSON.parse(new TextDecoder().decode(snapshot.bytes)),{maps:[{cc:75,moduleId:-1,patchworkModuleId:"target",paramId:1}],smooth:false});
});

test("the graph worklet reports module-load failures instead of silently timing out",async()=>{
  const processor=new ProcessorClass();processor.port.onmessage({data:{type:"load-graph",modules:[{id:"broken",wasm:new ArrayBuffer(8)}],cables:[]}});await new Promise(resolve=>setTimeout(resolve,0));const failure=processor.messages.find(message=>message.type==="error");assert.equal(typeof failure?.message,"string");assert.ok(failure.message.length>0);
});

test("the graph worklet delays only cycle-closing edges, not their downstream graph",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("a","fundamental-vca",[1,1]),module("b","fundamental-vca",[1,1]),module("downstream","fundamental-vca",[1,1])],cables:[{fromModule:"a",fromPort:0,toModule:"b",toPort:2,toAudio:false},{fromModule:"b",fromPort:0,toModule:"a",toPort:2,toAudio:false},{fromModule:"b",fromPort:0,toModule:"downstream",toPort:2,toAudio:false},{fromModule:"downstream",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  assert.equal(processor.messages.at(-1).feedbackEdges,1);assert.deepEqual(processor.order,["a","b","downstream"]);assert.equal(processor.cables.find(cable=>cable.toModule==="downstream").feedback,false);assert.doesNotThrow(()=>processor.process([],output()));assert.doesNotThrow(()=>processor.process([],output()));
});

test("bypassed modules copy declared polyphonic routes without running DSP",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0],4),module("vca","fundamental-vca",[0,1],4,{bypassed:true,bypassRoutes:[[2,0],[5,1]]})],cables:[{fromModule:"vco",fromPort:0,toModule:"vca",toPort:2,toAudio:false},{fromModule:"vca",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  const channels=output();processor.process([],channels);assert.equal(processor.modules.get("vca").currentChannels[0],4);assert.ok(Math.max(...channels[0][0].map(Math.abs))>0);
  processor.port.onmessage({data:{type:"bypass",moduleId:"vca",bypassed:false}});processor.process([],channels);assert.equal(Math.max(...channels[0][0].map(Math.abs)),0);
});

test("physically adjacent object expanders alter their mixer base without a patch cable",async()=>{
  const contract={family:"Venom::MixModule",direction:"right",transport:"object-snapshot",maxMembers:16};
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),
    {id:"mix",wasm:dynamicWasm("Venom","Mix4"),params:[1,1,1,1,1,0,0,0],state:[],seed:42,polyphony:1,outputConnections:[true],x:0,y:0,width:45,expander:{...contract,role:"base",type:0}},
    {id:"mute",wasm:dynamicWasm("Venom","MixMute"),params:[0,0,0,0,0],state:[],seed:42,polyphony:1,outputConnections:[],x:45,y:0,width:45,expander:{...contract,role:"member",type:6}},
  ],cables:[{fromModule:"vco",fromPort:0,toModule:"mix",toPort:0,toAudio:false},{fromModule:"mix",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  assert.deepEqual(processor.order,["vco","mix"]);
  assert.equal(processor.expanderOwners.get("mute"),"mix");
  const channels=output();
  for(let index=0;index<12;index++)processor.process([],channels);
  const openPeak=Math.max(...channels[0][0].map(Math.abs));
  processor.port.onmessage({data:{type:"param",moduleId:"mute",id:0,value:1}});
  for(let index=0;index<20;index++)processor.process([],channels);
  const mutedPeak=Math.max(...channels[0][0].map(Math.abs));
  assert.ok(openPeak>.1);
  assert.ok(mutedPeak<openPeak*.1,`expected ${mutedPeak} to be far below ${openPeak}`);
});

test("physically adjacent WASM modules exchange Rack producer and consumer messages per sample",async()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-message-graph-test-"));
  try{
    const build=(model)=>{const outputDir=path.join(temporary,model);execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),`https://library.vcvrack.com/FixturePlugin/${model}`,"--manifest-file",path.join(fixtureSource,"plugin.json"),"--source-dir",fixtureSource,"--output",outputDir,"--compile"],{stdio:"pipe"});const bytes=fs.readFileSync(path.join(outputDir,"module.wasm")),runtime=JSON.parse(fs.readFileSync(path.join(outputDir,"runtime.json"),"utf8"));return {wasm:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),runtime}};
    const modern=build("Modern"),expander=build("ExpanderOnly"),processor=new ProcessorClass();
    await processor.loadGraph({modules:[
      {id:"modern",key:"FixturePlugin/Modern",wasm:modern.wasm,params:[-3],state:[],seed:42,polyphony:1,outputConnections:[true],x:0,y:0,width:75,expander:modern.runtime.runtime.expander},
      {id:"expander",key:"FixturePlugin/ExpanderOnly",wasm:expander.wasm,params:[1],state:[],seed:42,polyphony:1,outputConnections:[],x:75,y:0,width:75,expander:expander.runtime.runtime.expander},
    ],cables:[{fromModule:"modern",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
    assert.deepEqual(processor.order,["modern"]);assert.equal(processor.messageOwners.get("expander"),"modern");assert.equal(processor.messageLinks.length,1);
    const channels=output();processor.process([],channels);
    assert.equal(channels[0][0][0],0);assert.equal(channels[0][0][1],8);assert.equal(processor.modules.get("expander").runtime.rack_web_message_flip_requested(0,0),0);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("physically adjacent Surge Unison modules share live polyphonic routing state",async()=>{
  const helper=dynamicCatalog.find(module=>module.key==="SurgeXTRack/SurgeXTUnisonHelper"),expander=dynamicCatalog.find(module=>module.key==="SurgeXTRack/SurgeXTUnisonHelperCVExpander"),processor=new ProcessorClass();
  assert.ok(helper&&expander);
  const helperParams=helper.params.map(param=>param.id===4?3:param.default);
  await processor.loadGraph({modules:[
    {id:"poly",key:"Bogaudio/Bogaudio-PolyCon",wasm:dynamicWasm("Bogaudio","Bogaudio-PolyCon"),params:[2,.2,.7,...Array(14).fill(0)],state:[],seed:41,polyphony:2,outputConnections:[true],x:500,y:500,width:180},
    {id:"helper",key:helper.key,wasm:dynamicWasm("SurgeXTRack","SurgeXTUnisonHelper"),params:helperParams,state:[],seed:42,polyphony:2,outputConnections:Array(helper.outputs.length).fill(false),x:0,y:0,width:helper.width,expander:helper.runtime.expander},
    {id:"cv",key:expander.key,wasm:dynamicWasm("SurgeXTRack","SurgeXTUnisonHelperCVExpander"),params:[],state:[],seed:43,polyphony:2,outputConnections:[true,false,false,false,false,false,false,false],x:helper.width,y:0,width:expander.width,expander:expander.runtime.expander},
  ],cables:[
    {fromModule:"poly",fromPort:0,toModule:"helper",toPort:0,toAudio:false},
    {fromModule:"poly",fromPort:0,toModule:"cv",toPort:0,toAudio:false},
    {fromModule:"cv",fromPort:0,toModule:"audio",toPort:0,toAudio:true},
  ]});
  const channels=output();processor.process([],channels);
  const routed=processor.modules.get("cv");
  assert.equal(processor.messageOwners.get("cv"),"helper");
  assert.equal(routed.currentChannels[0],6);
  const channelOffset=8*128;
  for(let frame=0;frame<128;frame++){
    assert.equal(routed.outputs[frame],routed.outputs[channelOffset+frame]);
    assert.equal(routed.outputs[frame],routed.outputs[2*channelOffset+frame]);
    assert.equal(routed.outputs[3*channelOffset+frame],routed.outputs[4*channelOffset+frame]);
    assert.equal(routed.outputs[3*channelOffset+frame],routed.outputs[5*channelOffset+frame]);
  }
  assert.ok(Math.max(...routed.outputs.slice(0,128).map(Math.abs))>.1);
  assert.ok(routed.outputs.slice(0,128).some((value,frame)=>Math.abs(value-routed.outputs[3*channelOffset+frame])>.01));
});

test("Venom LinearBeats reads live parameters from its adjacent exact-source expander",async()=>{
  const base=dynamicCatalog.find(module=>module.key==="Venom/LinearBeats"),expander=dynamicCatalog.find(module=>module.key==="Venom/LinearBeatsExpander"),processor=new ProcessorClass();
  assert.ok(base&&expander);await processor.loadGraph({modules:[
    module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0],1,{key:"Fundamental/VCO",x:500,y:500,width:135}),
    {id:"beats",key:base.key,wasm:dynamicWasm("Venom","LinearBeats"),params:base.params.map(param=>param.default),state:[],seed:42,polyphony:1,outputConnections:[true],x:0,y:0,width:base.width,expander:base.runtime.expander},
    {id:"mute",key:expander.key,wasm:dynamicWasm("Venom","LinearBeatsExpander"),params:expander.params.map(param=>param.default),state:[],seed:42,polyphony:1,outputConnections:[],x:base.width,y:0,width:expander.width,expander:expander.runtime.expander},
  ],cables:[{fromModule:"vco",fromPort:0,toModule:"beats",toPort:0,toAudio:false},{fromModule:"beats",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  assert.deepEqual(processor.order,["vco","beats"]);assert.equal(processor.messageOwners.get("mute"),"beats");const channels=output();processor.process([],channels);const openPeak=Math.max(...channels[0][0].map(Math.abs)),lights=new Float32Array(processor.modules.get("mute").runtime.memory.buffer,processor.modules.get("mute").runtime.rack_web_light_buffer(),expander.lights);assert.ok(openPeak>.1);assert.equal(lights[9],1);
  processor.port.onmessage({data:{type:"param",moduleId:"mute",id:0,value:1}});processor.process([],channels);assert.equal(Math.max(...channels[0][0].map(Math.abs)),0);
});

test("Venom BernoulliSwitchExpander recognizes its adjacent official model identity",async()=>{
  const base=dynamicCatalog.find(module=>module.key==="Venom/BernoulliSwitch"),expander=dynamicCatalog.find(module=>module.key==="Venom/BernoulliSwitchExpander"),processor=new ProcessorClass();assert.ok(base&&expander);
  await processor.loadGraph({modules:[
    {id:"switch",key:base.key,wasm:dynamicWasm("Venom","BernoulliSwitch"),params:base.params.map(param=>param.default),state:[],seed:7,polyphony:1,outputConnections:[true,true],x:0,y:0,width:base.width,expander:base.runtime.expander},
    {id:"controls",key:expander.key,wasm:dynamicWasm("Venom","BernoulliSwitchExpander"),params:expander.params.map(param=>param.default),state:[],seed:8,polyphony:1,outputConnections:[],x:base.width,y:0,width:expander.width,expander:expander.runtime.expander},
  ],cables:[]});processor.process([],output());const lights=new Float32Array(processor.modules.get("controls").runtime.memory.buffer,processor.modules.get("controls").runtime.rack_web_light_buffer(),expander.lights);assert.equal(processor.messageOwners.get("controls"),"switch");assert.equal(lights[0],1);
});

test("Venom Benjolin runs its exact-source oscillator through a two-expander chain",async()=>{
  const base=dynamicCatalog.find(module=>module.key==="Venom/BenjolinOsc"),gates=dynamicCatalog.find(module=>module.key==="Venom/BenjolinGatesExpander"),volts=dynamicCatalog.find(module=>module.key==="Venom/BenjolinVoltsExpander"),processor=new ProcessorClass();assert.ok(base&&gates&&volts);
  await processor.loadGraph({modules:[
    {id:"benjolin",key:base.key,wasm:dynamicWasm("Venom","BenjolinOsc"),params:base.params.map(param=>param.id===1||param.id===2?9:param.default),state:[],seed:17,polyphony:1,outputConnections:[true,true,true,true,true,true,true],x:0,y:0,width:base.width,expander:base.runtime.expander},
    {id:"gates",key:gates.key,wasm:dynamicWasm("Venom","BenjolinGatesExpander"),params:gates.params.map(param=>param.default),state:[],seed:18,polyphony:1,outputConnections:[true],x:base.width,y:0,width:gates.width,expander:gates.runtime.expander},
    {id:"volts",key:volts.key,wasm:dynamicWasm("Venom","BenjolinVoltsExpander"),params:volts.params.map(param=>param.id>=1&&param.id<=8?1:param.default),state:[],seed:19,polyphony:1,outputConnections:[true],x:base.width+gates.width,y:0,width:volts.width,expander:volts.runtime.expander},
  ],cables:[{fromModule:"gates",fromPort:0,toModule:"audio",toPort:0,toAudio:true},{fromModule:"volts",fromPort:0,toModule:"audio",toPort:1,toAudio:true}]});
  assert.equal(processor.messageOwners.get("gates"),"benjolin");assert.equal(processor.messageOwners.get("volts"),"benjolin");const channels=output();let gatePeak=0,voltsPeak=0;for(let block=0;block<24;block++){assert.doesNotThrow(()=>processor.process([],channels));gatePeak=Math.max(gatePeak,...channels[0][0].map(Math.abs));voltsPeak=Math.max(voltsPeak,...channels[0][1].map(Math.abs))}assert.ok(Number.isFinite(gatePeak)&&Number.isFinite(voltsPeak));assert.ok(gatePeak>1);assert.ok(voltsPeak>.1);
});
