import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseVcvArchive } from "../lib/vcv-patch.ts";
import { WEB_PLUGIN_BY_KEY } from "../lib/web-plugin-registry.ts";
import { dataFromState, stateFromData } from "../lib/patch-state.ts";
import {
  hydrateModuleWithDefinition,
  hydrateModulesWithDefinitions,
} from "../lib/patch-hydrate.ts";
import { serializeVcvPatch } from "../lib/vcv-patch-serialize.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

test("Mattix.vcv preserves its complete module graph", () => {
  const patch = parseVcvArchive(fs.readFileSync(path.join(here, "fixtures", "Mattix.vcv")));
  const models = new Set(patch.modules.map((module) => `${module.plugin}/${module.model}`));

  assert.equal(patch.version, "2.6.6");
  assert.equal(patch.modules.length, 87);
  assert.equal(patch.cables.length, 142);
  assert.equal(models.size, 19);
  assert.equal(patch.modules.filter((module) => WEB_PLUGIN_BY_KEY[`${module.plugin}/${module.model}`]).length, 87);
  assert.deepEqual([...models].sort(), [
    "AudibleInstruments/Braids", "AudibleInstruments/Branches", "AudibleInstruments/Elements",
    "AudibleInstruments/Kinks", "AudibleInstruments/Links", "AudibleInstruments/Rings",
    "AudibleInstruments/Shades", "AudibleInstruments/Tides", "Befaco/Mixer", "Befaco/SpringReverb",
    "Core/AudioInterface", "Core/Blank", "Fundamental/ADSR", "Fundamental/Delay", "Fundamental/Scope",
    "Fundamental/SEQ3", "Fundamental/VCA", "Fundamental/VCF", "Fundamental/VCO",
  ].sort());

  const moduleIds = new Set(patch.modules.map((module) => module.id));
  const firstSeq = patch.modules.find((module) => module.plugin === "Fundamental" && module.model === "SEQ3");
  assert.deepEqual(stateFromData("Fundamental/SEQ3", firstSeq.data), [1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
  const modelTwoRings = patch.modules.find((module) => module.plugin === "AudibleInstruments" && module.model === "Rings" && module.data?.model === 2);
  assert.deepEqual(stateFromData("AudibleInstruments/Rings", modelTwoRings.data), [0, 2, 0]);
  for (const cable of patch.cables) {
    assert.ok(moduleIds.has(cable.outputModuleId), `cable ${cable.id} output exists`);
    assert.ok(moduleIds.has(cable.inputModuleId), `cable ${cable.id} input exists`);
  }
});

test("every portable Mattix DSP model has an exact-source artifact",()=>{
  const catalog=JSON.parse(fs.readFileSync(path.join(here,"..","public","dynamic-plugins","catalog.json"),"utf8")),byKey=new Map(catalog.map(module=>[module.key,module])),exactKeys=[
    "AudibleInstruments/Braids","AudibleInstruments/Branches","AudibleInstruments/Elements","AudibleInstruments/Kinks","AudibleInstruments/Links","AudibleInstruments/Rings","AudibleInstruments/Shades","AudibleInstruments/Tides","Befaco/Mixer","Fundamental/ADSR","Fundamental/Delay","Fundamental/SEQ3","Fundamental/Scope","Fundamental/VCA","Fundamental/VCF","Fundamental/VCO",
  ];
  for(const key of exactKeys){const definition=byKey.get(key);assert.equal(definition?.runtime?.strategy,"direct-rack-source-adapter",`${key} uses official-source WASM`);assert.ok(fs.existsSync(path.join(here,"..","public",definition.wasmUrl)),`${key} artifact exists`);const visibleWidgets=[...definition.params.filter(param=>!param.hidden),...definition.inputs,...definition.outputs];assert.ok(visibleWidgets.length&&visibleWidgets.every(widget=>widget.position),`${key} carries its official widget coordinates`)}
  const exactParams=exactKeys.flatMap(key=>byKey.get(key).params.filter(param=>!param.hidden));
  assert.ok(exactParams.every(param=>param.position?.widget),"every interactive Mattix parameter carries its original Rack widget type");
  const widgetTypes=new Set(exactParams.map(param=>param.position.widget));
  for(const family of ["RoundBlackKnob","Rogan1PSRed","VCVLightButton<MediumSimpleLight<WhiteLight>>","VCVLightSlider<YellowLight>","VCVLightLatch<MediumSimpleLight<WhiteLight>>","CKD6","CKSS","TL1105"]){assert.ok(widgetTypes.has(family),`${family} remains available to the exact control renderer`)}
  const branches=byKey.get("AudibleInstruments/Branches"),branchesWidgets=[...branches.params.filter(param=>!param.hidden),...branches.inputs,...branches.outputs];assert.equal(branches.width,90);assert.ok(branchesWidgets.every(widget=>widget.position.x>=0&&widget.position.x<=branches.width),"Branches source widgets fit its 6 HP panel");
  for(const [key,width] of [["AudibleInstruments/Braids",240],["AudibleInstruments/Elements",510],["Fundamental/SEQ3",330],["Fundamental/VCA",75]]){assert.equal(byKey.get(key)?.width,width,`${key} keeps its source SVG width`);assert.equal(WEB_PLUGIN_BY_KEY[key].width,width,`${key} static fallback matches the source SVG width`)}
  assert.deepEqual([WEB_PLUGIN_BY_KEY["Core/AudioInterface"].runtime.strategy,WEB_PLUGIN_BY_KEY["Core/Blank"].runtime.strategy,WEB_PLUGIN_BY_KEY["Befaco/SpringReverb"].runtime.strategy],["rack-boundary","rack-boundary","browser-dsp-adapter"]);
  for(const key of ["Core/AudioInterface","Befaco/SpringReverb"]){const definition=WEB_PLUGIN_BY_KEY[key],visibleWidgets=[...definition.params,...definition.inputs,...definition.outputs];assert.ok(visibleWidgets.length&&visibleWidgets.every(widget=>widget.position),`${key} retains its official host-panel coordinates`)}
});

test("Rack Core browser boundaries keep their source jack geometry",()=>{
  for(const key of ["Core/MIDIToCVInterface","Core/MIDICCToCVInterface","Core/MIDITriggerToCVInterface","Core/CV-MIDI","Core/CV-CC","Core/CV-Gate","Core/AudioInterface2","Core/AudioInterface","Core/AudioInterface16"]){const definition=WEB_PLUGIN_BY_KEY[key],ports=[...definition.inputs,...definition.outputs];assert.ok(ports.length&&ports.every(port=>port.position),`${key} has source jack positions`)}
  assert.ok(WEB_PLUGIN_BY_KEY["Core/MIDIToCVInterface"].outputs[6].position.x>WEB_PLUGIN_BY_KEY["Core/MIDIToCVInterface"].outputs[7].position.x);
  const audio2=WEB_PLUGIN_BY_KEY["Core/AudioInterface2"],audio8=WEB_PLUGIN_BY_KEY["Core/AudioInterface"],audio16=WEB_PLUGIN_BY_KEY["Core/AudioInterface16"];
  assert.deepEqual([audio2.width,audio8.width,audio16.width],[75,150,285]);
  assert.deepEqual([audio2.runtime.visuals[0].channels,audio8.runtime.visuals[0].channels,audio16.runtime.visuals[0].channels],[2,8,16]);
  assert.deepEqual(audio2.lightWidgets.map(light=>light.id).sort((a,b)=>a-b),Array.from({length:12},(_,id)=>id));
  assert.deepEqual(audio8.lightWidgets.map(light=>light.id),[0,2,4,6,8,10,12,14]);
  assert.deepEqual(audio16.lightWidgets.map(light=>light.id),[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30]);
});

test("the new runtime imports .vcv files and resolves missing models", () => {
  const source = fs.readFileSync(path.join(here, "..", "app", "rack-web-studio.tsx"), "utf8");
  const library = fs.readFileSync(path.join(here, "..", "app", "components", "rack-studio-library.tsx"), "utf8");
  const contextMenus = fs.readFileSync(path.join(here, "..", "app", "components", "rack-studio-context-menus.tsx"), "utf8");
  const quickAdd = fs.readFileSync(path.join(here, "..", "app", "components", "rack-studio-quick-add.tsx"), "utf8");
  assert.match(source, /parseVcvArchive/);
  assert.match(source, /hydrateMissing/);
  assert.match(source, /accept="\.vcv"/);
  assert.doesNotMatch(source, /Find module in patch/);
  assert.doesNotMatch(source, /Trace cables/);
  assert.match(source, /fittedPatchViewport/);
  assert.match(contextMenus, /Replace from Library/);
  assert.match(quickAdd, /Quick add module/);
  assert.match(source, /touchPointsRef/);
  assert.match(library, /application\/x-patchwork-module/);
  assert.match(source, /setLibraryOpen\(restoredPatch\.modules\.length < 12\)/);
});

test("Mattix round-trips through a Rack-compatible legacy JSON .vcv", () => {
  const source=parseVcvArchive(fs.readFileSync(path.join(here,"fixtures","Mattix.vcv")));
  const minX=Math.min(...source.modules.map(module=>module.pos[0])),minY=Math.min(...source.modules.map(module=>module.pos[1]));
  const rack=Object.fromEntries(Object.entries(source).filter(([key])=>key!=="modules"&&key!=="cables"));
  const document={rack,rackOrigin:[minX,minY],modules:source.modules.map(module=>{
    const params=Array.from({length:Math.max(0,...(module.params??[]).map(param=>param.id+1))},()=>0);for(const param of module.params??[])params[param.id]=param.value;
    return {id:`vcv-${module.id}`,key:`${module.plugin}/${module.model}`,plugin:module.plugin,model:module.model,x:(module.pos[0]-minX)*15+20,y:(module.pos[1]-minY)*400+20,width:module.model==="Blank"?Number(module.data?.width??10)*15:90,params,state:stateFromData(`${module.plugin}/${module.model}`,module.data),rack:{...module},status:"ready"};
  }),cables:source.cables.map(cable=>({id:`vcv-cable-${cable.id}`,fromModule:`vcv-${cable.outputModuleId}`,fromPort:cable.outputId,toModule:`vcv-${cable.inputModuleId}`,toPort:cable.inputId,color:cable.color,rack:{...cable}}))};
  const serialized=serializeVcvPatch(document),roundTrip=parseVcvArchive(new TextEncoder().encode(serialized));
  assert.equal(roundTrip.modules.length,87);assert.equal(roundTrip.cables.length,142);assert.equal(roundTrip.masterModuleId,6);
  assert.deepEqual(roundTrip.modules.map(module=>module.pos),source.modules.map(module=>module.pos));
  assert.deepEqual(roundTrip.modules.find(module=>module.id===1).data.gates,[true,false,false,false,false,false,false,false]);
  assert.equal(roundTrip.cables[0].inputPlugOrder,source.cables[0].inputPlugOrder);
});

test("Rack bypass state is emitted and cleared without retaining legacy disabled flags",()=>{
  const base={id:"module-1",key:"Fundamental/VCA",plugin:"Fundamental",model:"VCA",x:20,y:20,width:75,params:[1,1],status:"ready",rack:{id:7,disabled:true}};
  const enabled=JSON.parse(serializeVcvPatch({modules:[{...base,bypassed:false}],cables:[]}));assert.equal("bypass" in enabled.modules[0],false);assert.equal("disabled" in enabled.modules[0],false);
  const bypassed=JSON.parse(serializeVcvPatch({modules:[{...base,bypassed:true}],cables:[]}));assert.equal(bypassed.modules[0].bypass,true);assert.equal("disabled" in bypassed.modules[0],false);
});

test("multi-slot browser samples remain addressable in exported VCV patch data",()=>{
  const asset=(storageKey,name)=>({storageKey,name,sampleRate:48000,channels:1,frames:512}),document={modules:[{id:"oai",key:"Bidoo/OAI",plugin:"Bidoo",model:"OAI",x:0,y:0,width:120,params:Array(10).fill(0),status:"ready",assets:[asset("slot-1","kick.wav"),undefined,asset("slot-3","snare.wav")]}],cables:[]},exported=JSON.parse(serializeVcvPatch(document)),assets=exported.modules[0].data.patchworkWebAssets;assert.equal(assets.length,3);assert.equal(assets[0].storageKey,"slot-1");assert.equal(assets[1],null);assert.equal(assets[2].name,"snare.wav")
});

test("dynamic adapter state keys preserve Rack JSON types",()=>{
  const keys=[{key:"channels",type:"integer"},{key:"enabled",type:"boolean"},{key:"gain",type:"real"},{key:"steps",type:"boolean",index:0},{key:"steps",type:"boolean",index:1},{key:"matrix",type:"real",path:[1,0]},{key:"bindings",type:"integer",path:[0,"key"]},{key:"bindings",type:"boolean",path:[0,"high"]},{key:"mode",type:"string-enum",values:["linear","pitched"]}];
  assert.deepEqual(stateFromData("Fixture/State",{channels:4,enabled:true,gain:.25,steps:[true,false],matrix:[[1,2],[3,4]],bindings:[{key:65,high:false}],mode:"pitched"},keys),[4,1,.25,1,0,3,65,0,1]);
  assert.deepEqual(dataFromState("Fixture/State",{steps:[false,false,true],matrix:[[1,2],[3,4]],bindings:[{key:-1,data:"keep"}]},[7,0,.75,1,0,9,90,1,1],keys),{channels:7,enabled:false,gain:.75,steps:[true,false,true],matrix:[[1,2],[9,4]],bindings:[{key:90,data:"keep",high:true}],mode:"pitched"});
});

test("late plugin hydration preserves saved params and decodes array state",()=>{
  const unresolved={id:"vcv-9",key:"Fixture/Late",plugin:"Fixture",model:"Late",x:0,y:0,width:90,params:[0],status:"resolving",rack:{params:[{id:1,value:.75}],data:{steps:[true,false]}}};
  const definition={key:"Fixture/Late",plugin:"Fixture",model:"Late",name:"Late",brand:"Fixture",version:"2.0.0",license:"MIT",sourceUrl:"https://example.com/source",libraryUrl:"https://library.vcvrack.com/Fixture/Late",screenshotUrl:"https://example.com/panel.webp",wasmUrl:"/late.wasm",width:180,description:"Late module",params:[{id:0,name:"A",min:0,max:1,default:.25},{id:1,name:"B",min:0,max:1,default:.5}],inputs:[],outputs:[],lights:0,stateKeys:[{key:"steps",type:"boolean",index:0},{key:"steps",type:"boolean",index:1}]};
  const hydrated=hydrateModuleWithDefinition(unresolved,definition);
  assert.deepEqual(hydrated.params,[.25,.75]);assert.deepEqual(hydrated.state,[1,0]);assert.deepEqual(hydrated.stateKeys,definition.stateKeys);assert.equal(hydrated.width,180);assert.equal(hydrated.status,"ready");
});

test("a registry catalog hydrates an existing source-required module in place",()=>{
  const unresolved={id:"module-placeholder",key:"Fixture/Late",plugin:"Fixture",model:"Late",x:30,y:380,width:240,params:[],status:"source-required",error:"Local compiler unavailable"};
  const ready={key:"Fixture/Late",plugin:"Fixture",model:"Late",name:"Late",brand:"Fixture",version:"2.0.0",license:"MIT",sourceUrl:"https://example.com/source",libraryUrl:"https://library.vcvrack.com/Fixture/Late",screenshotUrl:"https://example.com/panel.webp",wasmUrl:"https://example.com/late.wasm",width:180,description:"Late module",params:[{id:0,name:"Tune",min:-1,max:1,default:.25}],inputs:[{id:0,name:"CV"}],outputs:[],lights:0};
  const modules=hydrateModulesWithDefinitions([unresolved],[ready]);
  assert.equal(modules.length,1);assert.equal(modules[0].id,unresolved.id);assert.equal(modules[0].x,30);assert.equal(modules[0].y,380);assert.equal(modules[0].status,"ready");assert.equal(modules[0].width,180);assert.deepEqual(modules[0].params,[.25]);
});

test("a late exact definition replaces a same-width ready fallback module",()=>{
  const fallback={id:"module-placeholder",key:"Interrobang/ScribbleStrip",plugin:"Interrobang",model:"ScribbleStrip",x:30,y:20,width:45,params:[],stateKeys:[],state:[],status:"ready",rack:{data:{labelText:"FILTER BANK",writeTextFromTop:true}}};
  const exact={key:"Interrobang/ScribbleStrip",plugin:"Interrobang",model:"ScribbleStrip",name:"Scribble Strip",brand:"Interrobang",version:"2.0.1",license:"GPL-3.0-or-later",sourceUrl:"https://example.com/source",libraryUrl:"https://library.vcvrack.com/Interrobang/ScribbleStrip",screenshotUrl:"https://example.com/panel.webp",wasmUrl:"/scribble.wasm",width:45,params:[],inputs:[],outputs:[],lights:0,stateKeys:[{key:"writeTextFromTop",type:"boolean",default:0,contextOnly:true}]};
  const [hydrated]=hydrateModulesWithDefinitions([fallback],[exact]);
  assert.notEqual(hydrated,fallback);
  assert.equal(hydrated.width,45);
  assert.deepEqual(hydrated.stateKeys,exact.stateKeys);
  assert.deepEqual(hydrated.state,[1]);
  assert.equal(hydrated.rack.data.labelText,"FILTER BANK");
});

test("browser MIDI learn targets become Rack module ids on export",()=>{
  const document={modules:[
    {id:"map",key:"Core/MIDI-Map",plugin:"Core",model:"MIDI-Map",x:0,y:0,width:180,params:[],status:"ready",rack:{data:{maps:[{cc:74,moduleId:-1,patchworkModuleId:"target",paramId:0}]}}},
    {id:"target",key:"Fundamental/VCA",plugin:"Fundamental",model:"VCA",x:200,y:0,width:75,params:[1,1],status:"ready"},
  ],cables:[]};
  const exported=JSON.parse(serializeVcvPatch(document)),map=exported.modules[0].data.maps[0];
  assert.equal(map.moduleId,exported.modules[1].id);assert.equal("patchworkModuleId" in map,false);
});

test("browser automation targets survive Rack id assignment",()=>{
  const document={modules:[{id:"local-vca",key:"Fundamental/VCA",plugin:"Fundamental",model:"VCA",x:0,y:0,width:75,params:[1,1],status:"ready"}],cables:[],rack:{patchworkWebAutomation:{durationMs:20,events:[{timeMs:10,moduleId:"local-vca",paramId:0,value:.5}]}}};
  const exported=JSON.parse(serializeVcvPatch(document));
  assert.equal(exported.patchworkWebAutomation.events[0].moduleId,`vcv-${exported.modules[0].id}`);
});
