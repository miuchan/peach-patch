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

test("the graph worklet preserves a momentary button edge when press and release arrive before one audio quantum",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="ImpromptuModular/NoteLoop");assert.ok(definition);const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"loop",key:definition.key,wasm:dynamicWasm("ImpromptuModular","NoteLoop"),params:definition.params.map(param=>param.default),state:[],seed:42,polyphony:1,outputConnections:[true,true,true,true,true],visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});
  const rackModule=processor.modules.get("loop");processor.process([],output());assert.equal(rackModule.lights[1],0);processor.port.onmessage({data:{type:"momentary-param",moduleId:"loop",id:0,active:true}});processor.port.onmessage({data:{type:"momentary-param",moduleId:"loop",id:0,active:false}});assert.equal(rackModule.params[0],1);assert.equal(rackModule.momentaryReleases.has(0),true);
  processor.process([],output());assert.deepEqual({light:rackModule.lights[1],hostParam:rackModule.params[0],runtimeParam:rackModule.runtime.rack_web_get_param(0),releases:rackModule.momentaryReleases.size,order:processor.order},{light:1,hostParam:0,runtimeParam:1,releases:0,order:["loop"]});
});

test("Phrase-Seq-16 worklet telemetry forwards its live three-character Segment14 display",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="ImpromptuModular/Phrase-Seq-16");assert.ok(definition);const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"phrase",key:definition.key,wasm:dynamicWasm("ImpromptuModular","Phrase-Seq-16"),params:definition.params.map(param=>param.default),state:[],seed:42,polyphony:1,outputConnections:[true,true,true],visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});
  processor.process([],output());processor.visualTick=7;processor.emitVisualSignals(128);let visual=processor.messages.find(message=>message.type==="visual-signals");assert.deepEqual(visual.scopes.phrase[0],[32,32,49]);
  const rackModule=processor.modules.get("phrase");rackModule.params[3]=1;rackModule.params[4]=1/7;processor.process([],output());processor.messages.length=0;processor.visualTick=7;processor.emitVisualSignals(128);visual=processor.messages.find(message=>message.type==="visual-signals");assert.deepEqual(visual.scopes.phrase[0],[32,32,50]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"phrase",id:4,value:0}});processor.process([],output());processor.messages.length=0;processor.visualTick=7;processor.emitVisualSignals(128);visual=processor.messages.find(message=>message.type==="visual-signals");assert.deepEqual({param:rackModule.params[4],runtime:rackModule.runtime.rack_web_get_param(4),display:visual.scopes.phrase[0]},{param:0,runtime:0,display:[32,32,49]});
});

test("Phrase-Seq-32 worklet forwards its live display and exact reset ABI",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="ImpromptuModular/Phrase-Seq-32");assert.ok(definition);const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"phrase32",key:definition.key,wasm:dynamicWasm("ImpromptuModular","Phrase-Seq-32"),params:definition.params.map(param=>param.default),state:[],seed:42,polyphony:1,outputConnections:[true,true,true,true,true,true],visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});
  processor.process([],output());processor.visualTick=7;processor.emitVisualSignals(128);let visual=processor.messages.find(message=>message.type==="visual-signals");assert.deepEqual(visual.scopes.phrase32[0],[32,32,49]);
  const rackModule=processor.modules.get("phrase32");rackModule.params[3]=1;rackModule.params[4]=1/7;processor.process([],output());processor.messages.length=0;processor.visualTick=7;processor.emitVisualSignals(128);visual=processor.messages.find(message=>message.type==="visual-signals");assert.deepEqual(visual.scopes.phrase32[0],[32,32,50]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"phrase32",id:4,value:0}});processor.process([],output());processor.messages.length=0;processor.visualTick=7;processor.emitVisualSignals(128);visual=processor.messages.find(message=>message.type==="visual-signals");assert.deepEqual({param:rackModule.params[4],runtime:rackModule.runtime.rack_web_get_param(4),display:visual.scopes.phrase32[0]},{param:0,runtime:0,display:[32,32,49]});
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

test("HexNut telemetry exposes every live tile and both cursors without changing its light ABI",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="HarmonicAnomalies/HexNut");assert.ok(definition);assert.deepEqual(definition.runtime.visuals,[{kind:"hex-looper",radius:86,x:0,y:37,width:150,height:138}]);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),{id:"hex",key:definition.key,wasm:dynamicWasm("HarmonicAnomalies","HexNut"),params:definition.params.map(param=>param.default),state:[],seed:42,polyphony:1,outputConnections:[true],visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[{fromModule:"vco",fromPort:0,toModule:"hex",toPort:0,toAudio:false}]});
  for(let block=0;block<8;block++)processor.process([],output());
  const visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.hex[0];assert.equal(processor.modules.get("hex").lightCount,0);assert.equal(values.length,2+21931*3);assert.deepEqual(values.slice(0,2),[0,0]);assert.ok(Math.abs(values[2])>.01);assert.equal(values[3],1);assert.equal(values[4],1);assert.ok(values.every(Number.isFinite));
});

test("HexaGrain telemetry preserves the smaller granular grid and its live grain activity",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="HarmonicAnomalies/HexaGrain");assert.ok(definition);assert.deepEqual(definition.runtime.visuals,[{kind:"hex-looper",radius:16,x:0,y:37,width:150,height:138}]);
  const params=definition.params.map(param=>param.default);params[4]=0;
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),{id:"grain",key:definition.key,wasm:dynamicWasm("HarmonicAnomalies","HexaGrain"),params,state:[],seed:42,polyphony:1,outputConnections:[true],visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[{fromModule:"vco",fromPort:0,toModule:"grain",toPort:0,toAudio:false}]});
  for(let block=0;block<8;block++)processor.process([],output());
  const visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.grain[0];assert.equal(processor.modules.get("grain").lightCount,0);assert.equal(values.length,2+721*3);assert.deepEqual(values.slice(0,2),[0,0]);assert.ok(Math.abs(values[2])>.01);assert.ok(values[3]>0);assert.equal(values[4],1);assert.ok(values.every(Number.isFinite));
});

test("PhasorWavetable telemetry carries its live interpolated waveform without changing its light ABI",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="HetrickCVGPL/PhasorWavetable");assert.ok(definition);assert.deepEqual(definition.runtime.visuals,[{kind:"wavetable-display",x:0,y:56.102,width:105,height:86.291}]);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"wavetable",key:definition.key,wasm:dynamicWasm("HetrickCVGPL","PhasorWavetable"),params:definition.params.map(param=>param.default),state:[],seed:42,polyphony:1,outputConnections:[true],visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});
  for(let block=0;block<8;block++)processor.process([],output());
  const visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.wavetable[0];assert.equal(processor.modules.get("wavetable").lightCount,0);assert.equal(values.length,132);assert.deepEqual(values.slice(0,3),[0,0,4]);assert.ok(values.slice(3).some(value=>value>.99));assert.ok(values.slice(3).some(value=>value<-.99));assert.ok(values.every(Number.isFinite));
});

test("BouncyBalls telemetry forwards its twelve live display values and paddle lock action",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="JW-Modules/BouncyBalls");assert.ok(definition);const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"bouncy",key:definition.key,wasm:dynamicWasm("JW-Modules","BouncyBalls"),params:definition.params.map(param=>param.default),state:definition.stateKeys.map(item=>item.default??0),stateJson:JSON.stringify({paddleX:174,paddleY:346,paddleVisible:true,gatePulseLenSec:.005}),seed:42,polyphony:1,outputConnections:Array(32).fill(true),visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});
  for(let block=0;block<4;block++)processor.process([],output());processor.visualTick=7;processor.emitVisualSignals(128);let visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.bouncy[0];assert.equal(values.length,12);assert.deepEqual(values.slice(8),[174,346,1,1]);processor.port.onmessage({data:{type:"trigger-action",moduleId:"bouncy",id:1000,active:true}});processor.messages.length=0;processor.visualTick=7;processor.emitVisualSignals(128);visual=processor.messages.find(message=>message.type==="visual-signals");assert.equal(visual.scopes.bouncy[0][11],0);assert.ok(visual.scopes.bouncy[0].every(Number.isFinite));
});

test("FullScope telemetry forwards its processed 512-point X/Y display buffer",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="JW-Modules/FullScope");assert.ok(definition);const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),{id:"fullscope",key:definition.key,wasm:dynamicWasm("JW-Modules","FullScope"),params:definition.params.map(param=>param.default),state:definition.stateKeys.map(item=>item.default??0),stateJson:JSON.stringify({lissajous:1,external:0,width:255}),seed:42,polyphony:1,outputConnections:[],visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[{fromModule:"vco",fromPort:0,toModule:"fullscope",toPort:0,toAudio:false},{fromModule:"vco",fromPort:1,toModule:"fullscope",toPort:1,toAudio:false}]});
  for(let block=0;block<24;block++)processor.process([],output());processor.visualTick=7;processor.emitVisualSignals(128);const visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.fullscope[0];assert.equal(values.length,1031);assert.deepEqual(values.slice(1024,1027),[1,0,0]);assert.deepEqual(values.slice(1029),[1,1]);assert.ok(values.slice(0,1024).some(value=>Math.abs(value)>.01));assert.ok(values.every(Number.isFinite));
});

test("XYPad telemetry follows pointer-style param and action messages while recording a path",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="JW-Modules/XYPad");assert.ok(definition);const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"xypad",key:definition.key,wasm:dynamicWasm("JW-Modules","XYPad"),params:definition.params.map(param=>param.default),state:definition.stateKeys.map(item=>item.default??0),stateJson:JSON.stringify({lastRandomShape:7,curPlayMode:0,autoPlayOn:false,xPos:178,yPos:150,points:[]}),seed:42,polyphony:1,outputConnections:Array(5).fill(true),visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});
  processor.port.onmessage({data:{type:"param",moduleId:"xypad",id:0,value:80}});processor.port.onmessage({data:{type:"param",moduleId:"xypad",id:1,value:90}});processor.port.onmessage({data:{type:"trigger-action",moduleId:"xypad",id:1000,active:true}});for(let block=0;block<40;block++){processor.port.onmessage({data:{type:"param",moduleId:"xypad",id:0,value:80+block*4}});processor.port.onmessage({data:{type:"param",moduleId:"xypad",id:1,value:90+block*2}});processor.process([],output())}processor.port.onmessage({data:{type:"trigger-action",moduleId:"xypad",id:1000,active:false}});processor.messages.length=0;processor.visualTick=7;processor.emitVisualSignals(128);const visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.xypad[0];assert.ok(values.length>10);assert.deepEqual(values.slice(4,6),[356,300]);assert.equal((values.length-6)%2,0);assert.ok(values.every(Number.isFinite));
});

test("Kautenja 106 worklet telemetry forwards and edits all five wavetable banks",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="KautenjaDSP-PotatoChips/106");assert.ok(definition);const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"namco",key:definition.key,wasm:dynamicWasm("KautenjaDSP-PotatoChips","106"),params:definition.params.map(param=>param.default),state:[],seed:42,polyphony:1,outputConnections:Array(8).fill(true),visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});processor.process([],output());processor.visualTick=7;processor.emitVisualSignals(128);let visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.namco[0];assert.equal(values.length,160);assert.ok(values.every(value=>Number.isInteger(value)&&value>=0&&value<=15));const table=4,sample=31,value=14,action=1000+table*32*16+sample*16+value;processor.port.onmessage({data:{type:"trigger-action",moduleId:"namco",id:action,active:true}});processor.messages.length=0;processor.visualTick=7;processor.emitVisualSignals(128);visual=processor.messages.find(message=>message.type==="visual-signals");values=visual.scopes.namco[0];assert.equal(values[table*32+sample],value);assert.ok(values.every(Number.isFinite));
});

test("Kautenja GBS worklet telemetry forwards and edits all five wavetable banks",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="KautenjaDSP-PotatoChips/GBS");assert.ok(definition);const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"gbs",key:definition.key,wasm:dynamicWasm("KautenjaDSP-PotatoChips","GBS"),params:definition.params.map(param=>param.default),state:[],seed:42,polyphony:1,outputConnections:Array(4).fill(true),visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});processor.process([],output());processor.visualTick=7;processor.emitVisualSignals(128);let visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.gbs[0];assert.equal(values.length,160);assert.ok(values.every(value=>Number.isInteger(value)&&value>=0&&value<=15));const table=1,sample=12,value=9,action=1000+table*32*16+sample*16+value;processor.port.onmessage({data:{type:"trigger-action",moduleId:"gbs",id:action,active:true}});processor.messages.length=0;processor.visualTick=7;processor.emitVisualSignals(128);visual=processor.messages.find(message=>message.type==="visual-signals");values=visual.scopes.gbs[0];assert.equal(values[table*32+sample],value);assert.ok(values.every(Number.isFinite));
});

test("Four-View telemetry forwards its source note and chord display buffer",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="ImpromptuModular/Four-View");assert.ok(definition);assert.deepEqual(definition.runtime.visuals,[{kind:"four-view-display",modeParam:0,sharpState:3,rows:4,x:54,y:51.5,width:52,height:29,spacingY:44}]);
  const processor=new ProcessorClass();await processor.loadGraph({modules:[{id:"four",key:definition.key,wasm:dynamicWasm("ImpromptuModular","Four-View"),params:[1],state:[0,0,1,1],seed:42,polyphony:1,outputConnections:[true,true,true,true],visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});const rackModule=processor.modules.get("four"),pitches=[0,4/12,7/12];rackModule.runtime.rack_web_set_param(0,1);for(let port=0;port<3;port++){rackModule.runtime.rack_web_set_input_connected(port,1);rackModule.runtime.rack_web_set_input_channels(port,1);rackModule.inputs.fill(pitches[port],port*128,(port+1)*128)}for(let block=0;block<4;block++)rackModule.runtime.rack_web_process(128,48000);processor.visualTick=7;processor.emitVisualSignals(128);
  const visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.four[0],rows=Array.from({length:4},(_,row)=>String.fromCharCode(...values.slice(4+row*4,8+row*4).filter(value=>value>0)));assert.equal(values.length,20);assert.deepEqual(values.slice(0,4).map(value=>Number(value.toFixed(6))),[0,.333333,.583333,-100]);assert.deepEqual(rows,["C ","MAJ","",""]);assert.ok(values.every(Number.isFinite));
});

test("ML Arpeggiator telemetry forwards its complete source grid state",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="ML_modules/Arpeggiator");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"arp",key:definition.key,wasm:dynamicWasm("ML_modules","Arpeggiator"),params:definition.params.map(param=>param.default),state:definition.stateKeys.map(item=>item.default??0),seed:42,polyphony:1,outputConnections:Array(6).fill(true),visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});
  processor.process([],output());processor.visualTick=7;processor.emitVisualSignals(128);
  const visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.arp[0];
  assert.equal(values.length,49);assert.equal(values[0],1);assert.deepEqual(values.slice(1,4),[0,0,0]);assert.ok(values.every(Number.isFinite));
});

test("NoSuchDevice Corrupter telemetry forwards its complete waveform and status display",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="NoSuchDevice/Corrupter");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"corrupter",key:definition.key,wasm:dynamicWasm("NoSuchDevice","Corrupter"),params:definition.params.map(param=>param.default),state:definition.stateKeys.map(item=>item.default??0),seed:42,polyphony:1,outputConnections:[true,true],visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});
  processor.process([],output());processor.visualTick=7;processor.emitVisualSignals(128);
  const visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.corrupter[0];
  assert.equal(values.length,133);assert.deepEqual(values.slice(0,5),[0,0,0,0,0]);assert.ok(values.every(Number.isFinite));
});

test("Tapestry telemetry streams its recorded reel and routes marker editor actions",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="tapestry/Tapestry");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),
    {id:"tapestry",key:definition.key,wasm:dynamicWasm("tapestry","Tapestry"),params:definition.params.map(param=>param.default),state:definition.stateKeys.map(item=>item.default??0),seed:42,polyphony:1,outputConnections:[true,true,true,true],visuals:definition.runtime.visuals,x:0,y:0,width:definition.width},
  ],cables:[
    {fromModule:"vco",fromPort:0,toModule:"tapestry",toPort:0,toAudio:false},
    {fromModule:"vco",fromPort:0,toModule:"tapestry",toPort:1,toAudio:false},
  ]});
  const pulseRecord=()=>{processor.port.onmessage({data:{type:"momentary-param",moduleId:"tapestry",id:9,active:true}});processor.port.onmessage({data:{type:"momentary-param",moduleId:"tapestry",id:9,active:false}});processor.process([],output())};
  pulseRecord();for(let block=0;block<24;block++)processor.process([],output());pulseRecord();for(let block=0;block<4;block++)processor.process([],output());
  processor.visualTick=7;processor.emitVisualSignals(128);
  let visual=processor.messages.find(message=>message.type==="visual-signals"),values=visual.scopes.tapestry[0];
  assert.equal(values.length,395);assert.equal(values[0],1);assert.equal(values[4],1);assert.ok(values.slice(305).some(value=>value>.01));
  processor.port.onmessage({data:{type:"trigger-action",moduleId:"tapestry",id:1000+Math.round(.5*1023),active:true}});
  processor.messages.length=0;processor.visualTick=7;processor.emitVisualSignals(128);
  visual=processor.messages.find(message=>message.type==="visual-signals");values=visual.scopes.tapestry[0];
  assert.equal(values[4],2);assert.ok(Math.abs(values[6]-.5)<.01);assert.ok(values.every(Number.isFinite));
});

test("MSM TreasureVCO runs its source wave tables through the graph and honors exact reset messages",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="MSM/TreasureVCO");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"treasure",key:definition.key,wasm:dynamicWasm("MSM","TreasureVCO"),params:definition.params.map(param=>param.default),state:[0],seed:42,polyphony:1,outputConnections:[true],visuals:[],x:0,y:0,width:definition.width}],cables:[{fromModule:"treasure",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  const channels=output();for(let block=0;block<8;block++)processor.process([],channels);
  // Rack modules emit volts; the browser audio boundary normalizes +/-5V to +/-1.
  assert.ok(Math.max(...channels[0][0].map(Math.abs))>.9);
  const rackModule=processor.modules.get("treasure");
  processor.port.onmessage({data:{type:"param",moduleId:"treasure",id:5,value:13}});
  processor.process([],channels);assert.deepEqual([rackModule.params[5],rackModule.runtime.rack_web_get_param(5)],[13,13]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"treasure",id:5,value:0}});
  processor.process([],channels);assert.deepEqual([rackModule.params[5],rackModule.runtime.rack_web_get_param(5)],[0,0]);
});

test("MSM Phaser processes rack audio and honors exact double-click reset messages",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="MSM/Phaser");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),
    {id:"phaser",key:definition.key,wasm:dynamicWasm("MSM","Phaser"),params:definition.params.map(param=>param.default),state:[0],seed:42,polyphony:1,outputConnections:[true],visuals:[],x:0,y:0,width:definition.width},
  ],cables:[
    {fromModule:"vco",fromPort:0,toModule:"phaser",toPort:3,toAudio:false},
    {fromModule:"phaser",fromPort:0,toModule:"audio",toPort:0,toAudio:true},
  ]});
  const channels=output();for(let block=0;block<32;block++)processor.process([],channels);
  assert.ok(Math.max(...channels[0][0].map(Math.abs))>.001);
  const rackModule=processor.modules.get("phaser");
  processor.port.onmessage({data:{type:"param",moduleId:"phaser",id:6,value:3}});
  processor.process([],channels);assert.deepEqual([rackModule.params[6],rackModule.runtime.rack_web_get_param(6)],[3,3]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"phaser",id:6,value:0}});
  processor.process([],channels);assert.deepEqual([rackModule.params[6],rackModule.runtime.rack_web_get_param(6)],[0,0]);
});

test("MSM OSCiX reaches the audio boundary and honors its alternate-wave double-click reset",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="MSM/OSCiX");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    {id:"oscix",key:definition.key,wasm:dynamicWasm("MSM","OSCiX"),params:definition.params.map(param=>param.default),state:[0],seed:42,polyphony:1,outputConnections:[false,false,true,true,true,true,true,true],visuals:[],x:0,y:0,width:definition.width},
  ],cables:[{fromModule:"oscix",fromPort:2,toModule:"audio",toPort:0,toAudio:true}]});
  const channels=output();for(let block=0;block<16;block++)processor.process([],channels);
  assert.ok(Math.max(...channels[0][0].map(Math.abs))>1);
  const rackModule=processor.modules.get("oscix");
  processor.port.onmessage({data:{type:"param",moduleId:"oscix",id:30,value:1}});
  processor.process([],channels);assert.deepEqual([rackModule.params[30],rackModule.runtime.rack_web_get_param(30)],[1,1]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"oscix",id:30,value:0}});
  processor.process([],channels);assert.deepEqual([rackModule.params[30],rackModule.runtime.rack_web_get_param(30)],[0,0]);
});

test("MSM Rogue reaches the audio boundary and honors its VCO/LFO double-click reset",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="MSM/Rogue");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    {id:"rogue",key:definition.key,wasm:dynamicWasm("MSM","Rogue"),params:definition.params.map(param=>param.default),state:[0],seed:42,polyphony:1,outputConnections:[true,true,true,true,true,true,true],visuals:[],x:0,y:0,width:definition.width},
  ],cables:[{fromModule:"rogue",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  const channels=output();for(let block=0;block<16;block++)processor.process([],channels);
  assert.ok(Math.max(...channels[0][0].map(Math.abs))>1);
  const rackModule=processor.modules.get("rogue");
  processor.port.onmessage({data:{type:"param",moduleId:"rogue",id:6,value:0}});
  processor.process([],channels);assert.deepEqual([rackModule.params[6],rackModule.runtime.rack_web_get_param(6)],[0,0]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"rogue",id:6,value:1}});
  processor.process([],channels);assert.deepEqual([rackModule.params[6],rackModule.runtime.rack_web_get_param(6)],[1,1]);
});

test("MUS-X Oscillators reaches the audio boundary and honors its sync double-click reset",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="MUS-X/Oscillators");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    {id:"musx-osc",key:definition.key,wasm:dynamicWasm("MUS-X","Oscillators"),params:definition.params.map(param=>param.default),state:definition.stateKeys.map(item=>item.default??0),seed:42,polyphony:1,outputConnections:[true],visuals:[],x:0,y:0,width:definition.width},
  ],cables:[{fromModule:"musx-osc",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  const channels=output();for(let block=0;block<16;block++)processor.process([],channels);
  assert.ok(Math.max(...channels[0][0].map(Math.abs))>.01);
  const rackModule=processor.modules.get("musx-osc");
  processor.port.onmessage({data:{type:"param",moduleId:"musx-osc",id:7,value:1}});
  processor.process([],channels);assert.deepEqual([rackModule.params[7],rackModule.runtime.rack_web_get_param(7)],[1,1]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"musx-osc",id:7,value:0}});
  processor.process([],channels);assert.deepEqual([rackModule.params[7],rackModule.runtime.rack_web_get_param(7)],[0,0]);
});

test("MUS-X Drift reaches the audio boundary as CV and honors knob double-click reset",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="MUS-X/Drift");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    {id:"musx-drift",key:definition.key,wasm:dynamicWasm("MUS-X","Drift"),params:[1,0,0,0],state:Array.from({length:16},(_,index)=>index===0?3:0),seed:42,polyphony:1,outputConnections:[true],visuals:[],x:0,y:0,width:definition.width},
  ],cables:[{fromModule:"musx-drift",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  const channels=output();for(let block=0;block<4;block++)processor.process([],channels);
  const peak=Math.max(...channels[0][0].map(Math.abs));
  assert.ok(peak>.5,`drift graph peak ${peak}`);
  const rackModule=processor.modules.get("musx-drift");
  processor.port.onmessage({data:{type:"param",moduleId:"musx-drift",id:0,value:.25}});
  processor.process([],channels);assert.deepEqual([rackModule.params[0],rackModule.runtime.rack_web_get_param(0)],[.25,.25]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"musx-drift",id:0,value:0}});
  processor.process([],channels);assert.deepEqual([rackModule.params[0],rackModule.runtime.rack_web_get_param(0)],[0,0]);
});

test("MUS-X LFO reaches the audio boundary as CV and honors shape double-click reset",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="MUS-X/LFO");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    {id:"musx-lfo",key:definition.key,wasm:dynamicWasm("MUS-X","LFO"),params:definition.params.map(param=>param.default),state:definition.stateKeys.map(item=>item.default??0),seed:42,polyphony:1,outputConnections:[true],visuals:[],x:0,y:0,width:definition.width},
  ],cables:[{fromModule:"musx-lfo",fromPort:0,toModule:"audio",toPort:0,toAudio:true}]});
  const channels=output();for(let block=0;block<16;block++)processor.process([],channels);
  assert.ok(Math.max(...channels[0][0].map(Math.abs))>.01);
  const rackModule=processor.modules.get("musx-lfo");
  processor.port.onmessage({data:{type:"param",moduleId:"musx-lfo",id:0,value:7}});
  processor.process([],channels);assert.deepEqual([rackModule.params[0],rackModule.runtime.rack_web_get_param(0)],[7,7]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"musx-lfo",id:0,value:0}});
  processor.process([],channels);assert.deepEqual([rackModule.params[0],rackModule.runtime.rack_web_get_param(0)],[0,0]);
});

test("MUS-X Filter processes source audio and honors mode double-click reset",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="MUS-X/Filter");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),
    {id:"musx-filter",key:definition.key,wasm:dynamicWasm("MUS-X","Filter"),params:definition.params.map(param=>param.default),state:definition.stateKeys.map(item=>item.default??0),seed:42,polyphony:1,outputConnections:[true],visuals:[],x:0,y:0,width:definition.width},
  ],cables:[
    {fromModule:"vco",fromPort:0,toModule:"musx-filter",toPort:2,toAudio:false},
    {fromModule:"musx-filter",fromPort:0,toModule:"audio",toPort:0,toAudio:true},
  ]});
  const channels=output();for(let block=0;block<32;block++)processor.process([],channels);
  assert.ok(Math.max(...channels[0][0].map(Math.abs))>.01);
  const rackModule=processor.modules.get("musx-filter");
  processor.port.onmessage({data:{type:"param",moduleId:"musx-filter",id:2,value:17}});
  processor.process([],channels);assert.deepEqual([rackModule.params[2],rackModule.runtime.rack_web_get_param(2)],[17,17]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"musx-filter",id:2,value:8}});
  processor.process([],channels);assert.deepEqual([rackModule.params[2],rackModule.runtime.rack_web_get_param(2)],[8,8]);
});

test("MUS-X Synth reaches stereo audio, toggles assignment switches, and honors knob double-click reset",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="MUS-X/Synth");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),
    {id:"musx-synth",key:definition.key,wasm:dynamicWasm("MUS-X","Synth"),params:definition.params.map(param=>param.initial??param.default),state:definition.stateKeys.map(item=>item.default??0),seed:42,polyphony:1,outputConnections:[true,true,true,true,true,true,true],visuals:[],x:0,y:0,width:definition.width},
  ],cables:[
    {fromModule:"vco",fromPort:0,toModule:"musx-synth",toPort:0,toAudio:false},
    {fromModule:"vco",fromPort:1,toModule:"musx-synth",toPort:1,toAudio:false},
    {fromModule:"musx-synth",fromPort:5,toModule:"audio",toPort:0,toAudio:true},
    {fromModule:"musx-synth",fromPort:6,toModule:"audio",toPort:1,toAudio:true},
  ]});
  const channels=output();for(let block=0;block<64;block++)processor.process([],channels);
  assert.ok(Math.max(...channels[0][0].map(Math.abs))>.01);
  assert.ok(Math.max(...channels[0][1].map(Math.abs))>.01);
  const rackModule=processor.modules.get("musx-synth");
  processor.port.onmessage({data:{type:"param",moduleId:"musx-synth",id:0,value:1}});
  processor.process([],channels);assert.deepEqual([rackModule.params[0],rackModule.runtime.rack_web_get_param(0)],[1,1]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"musx-synth",id:0,value:0}});
  processor.process([],channels);assert.deepEqual([rackModule.params[0],rackModule.runtime.rack_web_get_param(0)],[0,0]);
  processor.port.onmessage({data:{type:"param",moduleId:"musx-synth",id:59,value:0}});
  processor.process([],channels);assert.deepEqual([rackModule.params[59],rackModule.runtime.rack_web_get_param(59)],[0,0]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"musx-synth",id:59,value:5}});
  processor.process([],channels);assert.deepEqual([rackModule.params[59],rackModule.runtime.rack_web_get_param(59)],[5,5]);
});

test("MindMeld EqMaster reaches audio, switches tracks, and honors gain double-click reset",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="MindMeldModular/EqMaster");assert.ok(definition);
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[
    module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),
    {id:"eq-master",key:definition.key,wasm:dynamicWasm("MindMeldModular","EqMaster"),params:definition.params.map(param=>param.default),state:[],seed:42,polyphony:16,outputConnections:[true,true,true],visuals:[],x:0,y:0,width:definition.width},
  ],cables:[
    {fromModule:"vco",fromPort:0,toModule:"eq-master",toPort:0,toAudio:false},
    {fromModule:"eq-master",fromPort:0,toModule:"audio",toPort:0,toAudio:true},
  ]});
  const channels=output();for(let block=0;block<32;block++)processor.process([],channels);
  const dry=Math.max(...channels[0][0].map(Math.abs));assert.ok(dry>.01);
  const rackModule=processor.modules.get("eq-master");
  processor.port.onmessage({data:{type:"param",moduleId:"eq-master",id:2,value:20}});
  for(let block=0;block<64;block++)processor.process([],channels);
  const boosted=Math.max(...channels[0][0].map(Math.abs));assert.ok(boosted/dry>9);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"eq-master",id:2,value:0}});
  for(let block=0;block<64;block++)processor.process([],channels);
  assert.deepEqual([rackModule.params[2],rackModule.runtime.rack_web_get_param(2)],[0,0]);
  assert.ok(Math.max(...channels[0][0].map(Math.abs))/dry<1.1);
  processor.port.onmessage({data:{type:"param",moduleId:"eq-master",id:0,value:1}});
  processor.process([],channels);assert.deepEqual([rackModule.params[0],rackModule.runtime.rack_web_get_param(0),rackModule.runtime.rack_web_get_param(2)],[1,1,0]);
});

test("spectrum visual telemetry preserves every input sample and all contracted channels",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),module("display","fundamental-vca",[1,1],1,{key:"Fixture/Spectrum",visuals:[{kind:"spectrum-analyzer",inputs:[2,5,0,1],x:0,y:0,width:75,height:100}]})],cables:[{fromModule:"vco",fromPort:0,toModule:"display",toPort:2,toAudio:false}]});
  for(let block=0;block<8;block++)processor.process([],output());
  const visual=processor.messages.find(message=>message.type==="visual-signals");
  assert.equal(visual.scopes.display.length,4);assert.ok(visual.scopes.display.every(channel=>channel.length===128));assert.ok(visual.scopes.display[0].some(value=>Math.abs(value)>.01));assert.ok(visual.scopes.display.slice(1).every(channel=>channel.every(value=>value===0)));
});

test("Cella frequency analyzer telemetry preserves both source analyzer inputs",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),module("display","fundamental-vca",[1,1],1,{key:"Cella/FrequencyAnalyzer",visuals:[{kind:"cella-frequency-analyzer",inputs:[2,5],x:0,y:26,width:496,height:320}]})],cables:[{fromModule:"vco",fromPort:0,toModule:"display",toPort:2,toAudio:false}]});
  for(let block=0;block<8;block++)processor.process([],output());
  const visual=processor.messages.find(message=>message.type==="visual-signals");
  assert.equal(visual.scopes.display.length,2);assert.ok(visual.scopes.display.every(channel=>channel.length===128));assert.ok(visual.scopes.display[0].some(value=>Math.abs(value)>.01));assert.ok(visual.scopes.display[1].every(value=>value===0));
});

test("CV note visual telemetry samples the latest input voltage",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),module("display","fundamental-vca",[1,1],1,{key:"Fixture/CvNote",visuals:[{kind:"cv-note",inputs:[2],x:25,y:154,width:85,height:60}]})],cables:[{fromModule:"vco",fromPort:0,toModule:"display",toPort:2,toAudio:false}]});
  for(let block=0;block<8;block++)processor.process([],output());
  const visual=processor.messages.find(message=>message.type==="visual-signals");
  assert.equal(visual.scopes.display.length,1);assert.equal(visual.scopes.display[0].length,1);assert.ok(Number.isFinite(visual.scopes.display[0][0]));assert.ok(Math.abs(visual.scopes.display[0][0])>.01);
});

test("note meter telemetry preserves sixteen rows and expands polyphony into consecutive displays",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0],4),module("display","fundamental-vca",[1,1],1,{key:"Fixture/NoteMeter",visuals:[{kind:"note-meter",inputs:[0,1,2,3,4,5],accidentalParam:0,modeParam:1,decimalsParam:2,styleParam:3,x:0,y:0,width:75,height:337,rowHeight:21}]})],cables:[{fromModule:"vco",fromPort:0,toModule:"display",toPort:2,toAudio:false}]});
  for(let block=0;block<8;block++)processor.process([],output());
  const visual=processor.messages.find(message=>message.type==="visual-signals");assert.ok(visual);assert.equal(visual.scopes.display.length,16);assert.ok(visual.scopes.display.slice(0,2).every(reading=>reading.length===0));assert.ok(visual.scopes.display.slice(2,6).every(reading=>reading.length===1&&Number.isFinite(reading[0])));assert.ok(visual.scopes.display.slice(6).every(reading=>reading.length===0));
});

test("multichannel meter telemetry combines its discrete stereo and 16-channel inputs",async()=>{
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[module("vco","fundamental-vco",[0,1,0,0,0,.5,0,0]),module("meter","fundamental-vca",[1,1],1,{key:"Fixture/MultiMeter",visuals:[{kind:"multi-meter",inputs:[2,5,0],modeParam:0,channelsParam:1,x:0,y:0,width:75,height:100}]})],cables:[{fromModule:"vco",fromPort:0,toModule:"meter",toPort:2,toAudio:false},{fromModule:"vco",fromPort:0,toModule:"meter",toPort:0,toAudio:false}]});
  for(let block=0;block<8;block++)processor.process([],output());const visual=processor.messages.find(message=>message.type==="visual-signals");
  assert.equal(visual.scopes.meter.length,16);assert.ok(visual.scopes.meter[0].some(value=>Math.abs(value)>.01));assert.ok(visual.scopes.meter.slice(1).every(channel=>channel.every(value=>value===0)));assert.ok(visual.scopes.meter.flat().every(value=>Number.isFinite(value)&&value>=-1&&value<=1));
});

test("Undular converts CV into rack viewport and cable host controls",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="AriaSalvatrice/Undular");assert.ok(definition);assert.equal(definition.runtime?.hostControl,"rack-view");
  const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"undular",key:definition.key,wasm:dynamicWasm("AriaSalvatrice","Undular"),params:definition.params.map(param=>param.default),state:[],seed:42,polyphony:1,outputConnections:[false],hostControl:"rack-view",x:0,y:0,width:definition.width}],cables:[]});
  const rackModule=processor.modules.get("undular"),frame=127;
  rackModule.inputChannels[2]=1;rackModule.inputChannels[4]=1;rackModule.inputChannels[7]=1;
  rackModule.inputs[2*128+frame]=10;rackModule.inputs[4*128+frame]=2;rackModule.inputs[7*128+frame]=5;
  const first=processor.rackViewHostControl(128);assert.equal(first.jumpLeft,true);assert.equal(first.x,undefined);assert.equal(first.opacity,undefined);assert.equal(first.xStep,32);
  rackModule.inputs[4*128+frame]=8;rackModule.inputs[7*128+frame]=2;
  const changed=processor.rackViewHostControl(128);assert.equal(changed.jumpLeft,false);assert.equal(changed.x,.8);assert.equal(changed.opacity,.2);
  rackModule.inputs[2*128+frame]=0;processor.rackViewHostControl(128);rackModule.inputs[2*128+frame]=10;
  assert.equal(processor.rackViewHostControl(128).jumpLeft,true);
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

test("the graph worklet drives a contiguous Lyrae Sheliak and Beta pair and resets both knobs exactly",async()=>{
  const definitions=Object.fromEntries(["ChemicalElements/Lead","LyraeModules/Sheliak","LyraeModules/Beta"].map(key=>[key,dynamicCatalog.find(item=>item.key===key)]));
  for(const definition of Object.values(definitions))assert.ok(definition);
  const dynamicModule=(id,key,x,params=definitions[key].params.map(param=>param.default))=>({
    id,key,wasm:dynamicWasm(...key.split("/")),params,state:[],seed:42,polyphony:1,
    outputConnections:definitions[key].outputs.map(()=>true),snapParams:definitions[key].params.map(param=>Boolean(param.snap)),
    expander:definitions[key].runtime?.expander,x,y:0,width:definitions[key].width,
  });
  const lead=dynamicModule("lead","ChemicalElements/Lead",0,[0,10]),
    sheliak=dynamicModule("sheliak","LyraeModules/Sheliak",45,[10]),
    beta=dynamicModule("beta","LyraeModules/Beta",165,Array(11).fill(.5)),
    processor=new ProcessorClass();
  await processor.loadGraph({
    modules:[lead,sheliak,beta],
    cables:[
      {fromModule:"lead",fromPort:0,toModule:"sheliak",toPort:0,toAudio:false},
      {fromModule:"lead",fromPort:1,toModule:"sheliak",toPort:2,toAudio:false},
    ],
  });
  assert.deepEqual(processor.order,["lead","sheliak"]);
  assert.deepEqual(processor.messageGroups.get("sheliak").map(module=>module.id),["sheliak","beta"]);
  processor.port.onmessage({data:{type:"reset-param",moduleId:"sheliak",id:0,value:0}});
  for(const param of definitions["LyraeModules/Beta"].params)
    processor.port.onmessage({data:{type:"reset-param",moduleId:"beta",id:param.id,value:param.default}});
  assert.equal(processor.modules.get("sheliak").params[0],0);
  for(const value of processor.modules.get("beta").params)assert.ok(Math.abs(value-1/12)<1e-8);
  for(let pulse=0;pulse<4;pulse++){
    processor.modules.get("lead").params[0]=10;processor.process([],output());
    processor.modules.get("lead").params[0]=0;processor.process([],output());
  }
  const betaModule=processor.modules.get("beta"),expected=[1/12,1/12,7/12,2,-1+1/12,-2+1+1/12,2/12,1/12];
  assert.deepEqual(Array.from(betaModule.currentChannels),Array(8).fill(1));
  for(const [port,value] of expected.entries())
    assert.ok(Math.abs(betaModule.outputs[port*128]-value)<1e-5,`port ${port}: ${betaModule.outputs[port*128]} != ${value}`);
  assert.ok(betaModule.lights.every(Number.isFinite));
  assert.ok(Math.max(...betaModule.lights)>0);
  assert.equal(processor.messages.find(message=>message.type==="error"),undefined);
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

test("MIDIRecorder capture messages preserve raw MIDI bytes and flush the final file on stop",async()=>{
  const definition=dynamicCatalog.find(item=>item.key==="Chinenual-VCV/MIDIRecorder");assert.ok(definition);const processor=new ProcessorClass();
  await processor.loadGraph({modules:[{id:"midi-recorder",key:definition.key,wasm:dynamicWasm("Chinenual-VCV","MIDIRecorder"),params:definition.params.map(param=>param.default),state:definition.stateKeys.map(item=>item.default??0),seed:42,polyphony:1,outputConnections:[true],capture:definition.runtime.capture,visuals:definition.runtime.visuals,x:0,y:0,width:definition.width}],cables:[]});
  const rackModule=processor.modules.get("midi-recorder"),runtime=rackModule.runtime,inputs=rackModule.inputs;runtime.rack_web_set_input_connected(2,1);runtime.rack_web_set_input_channels(2,1);runtime.rack_web_set_input_connected(3,1);runtime.rack_web_set_input_channels(3,1);processor.port.onmessage({data:{type:"capture-enable",moduleId:"midi-recorder",enabled:true}});runtime.rack_web_process(1,sampleRate);processor.drainCaptures();inputs.fill(10,3*128,3*128+16);runtime.rack_web_process(16,sampleRate);inputs.fill(0,3*128,3*128+16);runtime.rack_web_process(16,sampleRate);processor.port.onmessage({data:{type:"capture-enable",moduleId:"midi-recorder",enabled:false}});processor.drainCaptures();processor.drainCaptures();
  const start=processor.messages.find(message=>message.type==="capture-start"),stop=processor.messages.find(message=>message.type==="capture-stop"),chunks=processor.messages.filter(message=>message.type==="capture-data"),bytes=Uint8Array.from(chunks.flatMap(chunk=>Array.from(chunk.samples,value=>Math.round(value))));assert.equal(start.format,"midi");assert.equal(stop.format,"midi");assert.ok(chunks.every(chunk=>chunk.format==="midi"&&chunk.channels===1));assert.equal(new TextDecoder().decode(bytes.slice(0,4)),"MThd");assert.ok(new TextDecoder().decode(bytes).includes("MTrk"));assert.ok(bytes.includes(0x90));assert.equal(processor.messages.find(message=>message.type==="error"),undefined);
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
