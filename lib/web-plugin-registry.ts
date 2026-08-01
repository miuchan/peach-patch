export type RackWidgetPosition = { x:number; y:number; width?:number; height?:number; zIndex?:number; control?:"selector"; centered?:boolean; widget?:string };
export type ParamSpec = { id: number; name: string; min: number; max: number; default: number; initial?:number; snap?: boolean; button?: boolean; unbounded?:boolean; hidden?:boolean; contextOnly?:boolean; values?:string[]; position?:RackWidgetPosition; resetFrom?:{paramId:number;scale:number;offset:number}; visibleWhenState?:{key:string;equals:number}; visibleWhenInputConnection?:{ids:number[];mode:"any"|"all";connected:boolean} };
export type PortSpec = { id: number; name: string; kind: "cv" | "gate" | "audio"; hidden?:boolean; position?:RackWidgetPosition };
export type LightSpec = { id:number; widget:string; position:RackWidgetPosition; paramId?:number };
export type StateSpec={key:string;type:"integer"|"real"|"boolean"|"string-enum";values?:string[];index?:number;path?:Array<number|string>;name?:string;default?:number;contextOnly?:boolean};
export type RuntimeStrategy = "ordered-translation" | "browser-dsp-adapter" | "rack-boundary" | "direct-rack-source-adapter";
export type ObjectExpanderContract = {
  family: string;
  role: "base" | "member";
  direction: "left" | "right";
  transport: "object-snapshot";
  type: number;
  maxMembers: number;
};
export type MessageExpanderContract = {
  transport: "message-buffer";
  direction: "both";
  capacity: number;
  models: Array<{ key: string; symbol: string; index: number }>;
};
export type ExpanderContract = ObjectExpanderContract | MessageExpanderContract;
export type ManualHelpText = { en:string; zh:string; ja:string };
export type ManualHelpModule = {
  name:string;
  description:ManualHelpText;
  entries:Array<{name:string; text:ManualHelpText}>;
};
export type RuntimeVisual =
  | { kind:"scope"; inputs:[number,number]; width:number; height:number; x:number; y:number }
  | { kind:"multi-meter"; inputs:[number,number,number]; modeParam:number; channelsParam:number; width:number; height:number; x:number; y:number }
  | { kind:"spectrum-analyzer"; inputs:number[]; width:number; height:number; x:number; y:number }
  | { kind:"cella-frequency-analyzer"; inputs:[number,number]; width:number; height:number; x:number; y:number }
  | { kind:"spectrogram"; inputs:[number]; width:number; height:number; x:number; y:number }
  | { kind:"cv-note"; inputs:[number]; width:number; height:number; x:number; y:number }
  | { kind:"note-meter"; inputs:number[]; accidentalParam:number; modeParam:number; decimalsParam:number; styleParam:number; width:number; height:number; rowHeight:number; x:number; y:number }
  | { kind:"bpm-display"; inputs:[number]; styleParam:number; width:number; height:number; x:number; y:number }
  | { kind:"light-matrix"; lightStart:number; columns:number; rows:number; channels:1|2|3; width:number; height:number; x:number; y:number }
  | { kind:"hex-looper"; radius:number; width:number; height:number; x:number; y:number }
  | { kind:"wavetable-display"; width:number; height:number; x:number; y:number }
  | { kind:"wolfram-display"; cells:number; width:number; height:number; x:number; y:number }
  | { kind:"segment"; param:number; values:string[]; width:number; height:number; x:number; y:number }
  | { kind:"param-numeric-display"; param:number; digits:number; width:number; height:number; x:number; y:number }
  | { kind:"elementary-ca"; inputs:[number,number,number]; ruleParam:number; seedParam:number; scaleParam:number; cells:number; scaleValues:string[]; width:number; height:number; x:number; y:number; labelWidth:number; labelHeight:number; labelX:number; labelY:number }
  | { kind:"piano-keyboard"; actionBase:number; keys:number; voices:number; lightStart:number; lightStride?:number; lightVoiceStride?:number; lightChannels?:number; lightOrder?:"top-down"|"bottom-up"; actionSteps?:number; fixedKeyOnDrag?:boolean; modifierBank?:"shift"; width:number; height:number; x:number; y:number; layout?:"small"|"big"; rightClick?:boolean }
  | { kind:"four-view-display"; modeParam:number; sharpState:number; rows:number; width:number; height:number; x:number; y:number; spacingY:number }
  | { kind:"note-echo-display"; tapParam:number; semiParam:number; cv2Param:number; probabilityParam:number; randomSemiParam:number; cv2ModeParam:number; polyParam:number; tap:number; width:number; height:number; x:number; y:number }
  | { kind:"note-loop-display"; param:number; width:number; height:number; x:number; y:number }
  | { kind:"phrase-seq-display"; digits?:number; label?:string; width:number; height:number; x:number; y:number }
  | { kind:"scribble-strip"; dataKey:string; defaultText:string; orientationState:number; width:number; height:number; x:number; y:number }
  | { kind:"bouncy-balls"; actionBase:number; paddleXState:number; paddleYState:number; displayWidth:number; displayHeight:number; width:number; height:number; x:number; y:number }
  | { kind:"full-scope"; points:number; width:number; height:number; x:number; y:number }
  | { kind:"madzine-scope"; points:number; tracks:number; range:number; colors:string[]; width:number; height:number; x:number; y:number }
  | { kind:"madzine-waveform"; points:number; maxSlices:number; maxVoices:number; loopEndParam:number; width:number; height:number; x:number; y:number }
  | { kind:"universal-rhythm"; steps:number; displayX:number; displayY:number; displayWidth:number; displayHeight:number; roleStartX:number; roleSpacing:number; width:number; height:number; x:number; y:number }
  | { kind:"song-mode-sequence"; dataKey:string; defaultText:string; width:number; height:number; x:number; y:number }
  | { kind:"madzine-launchpad"; actionBase:number; rows:number; columns:number; wavePoints:number; cellWidth:number; cellHeight:number; spacingX:number; spacingY:number; width:number; height:number; x:number; y:number }
  | { kind:"the-kick-sample"; clearAction:number; modeActionBase:number; modeParam:number; loadX:number; loadY:number; loadWidth:number; loadHeight:number; labelX:number; labelY:number; labelWidth:number; labelHeight:number; modeX:number; modeY:number; modeWidth:number; modeHeight:number; width:number; height:number; x:number; y:number }
  | { kind:"madzine-manual"; displayX:number; displayY:number; displayWidth:number; displayHeight:number; languageX:number; languageY:number; languageWidth:number; languageHeight:number; decreaseX:number; increaseX:number; fontY:number; fontWidth:number; fontHeight:number; x:number; y:number; width:number; height:number }
  | { kind:"ml-arpeggiator"; channels:number; rows:number; width:number; height:number; x:number; y:number }
  | { kind:"corrupter-display"; bins:number; width:number; height:number; x:number; y:number }
  | { kind:"tapestry-display"; bins:number; maxSplices:number; actionBase:number; deleteActionBase:number; actionSteps:number; width:number; height:number; x:number; y:number }
  | { kind:"xy-pad"; actionBase:number; xParam:number; yParam:number; displayWidth:number; displayHeight:number; width:number; height:number; x:number; y:number }
  | { kind:"wavetable-editor"; actionBase:number; tables:number; samples:number; bitDepth:number; width:number; height:number; gap:number; borderColor?:string; colors:string[]; x:number; y:number }
  | { kind:"racknes-screen"; bufferWidth:number; bufferHeight:number; width:number; height:number; x:number; y:number }
  | { kind:"speck-spectrum"; bins:number; width:number; height:number; x:number; y:number }
  | { kind:"integral-flux-preview"; channel:1|4; offset:number; width:number; height:number; x:number; y:number }
  | { kind:"proc-preview"; offset:number; width:number; height:number; x:number; y:number }
  | { kind:"temporal-deck"; offset:number; lightStart:number; redLightStart:number; width:number; height:number; x:number; y:number }
  | { kind:"td-scope"; offset:number; width:number; height:number; x:number; y:number }
  | { kind:"undertow-preview"; offset:number; width:number; height:number; x:number; y:number }
  | { kind:"octobir-display"; offset:number; width:number; height:number; x:number; y:number }
  | { kind:"rkd-dividers"; offset:number; width:number; height:number; x:number; y:number }
  | { kind:"klokspid-dmd"; offset:number; width:number; height:number; x:number; y:number }
  | { kind:"lomas-sampler"; offset:number; width:number; height:number; x:number; y:number }
  | { kind:"less-mess-labels"; rows:number; dataKeyPrefix:string; width:number; height:number; rowHeight:number; x:number; y:number }
  | { kind:"midi-log"; rows:number; columns:number; width:number; height:number; x:number; y:number }
  | { kind:"audio-display"; channels:2|8|16; width:number; height:number; x:number; y:number };

export type WebPluginModule = {
  key: string;
  plugin: string;
  model: string;
  name: string;
  brand: string;
  version: string;
  license: string;
  sourceUrl: string;
  libraryUrl: string;
  screenshotUrl: string;
  wasmUrl: string;
  manifestUrl?: string;
  sourceCommit?: string;
  artifact?: {
    sha256: string;
    size: number;
  };
  width: number;
  description: string;
  params: ParamSpec[];
  inputs: PortSpec[];
  outputs: PortSpec[];
  lights: number;
  lightWidgets?: LightSpec[];
  stateKeys?: StateSpec[];
  polyphonic?: boolean;
  bypassRoutes?: Array<[inputId:number,outputId:number]>;
  runtime?: {
    strategy?: RuntimeStrategy;
    initialMemory?: number;
    capture?: { format: "wav"|"midi"; channels: "input-dependent"|1; panelControlParam?:number };
    asset?: { type: "audio" | "image" | "binary" | "midi" | "script"; maxSamples: number; maxSeconds: number; channels: 1 | 2 | 4; slots?: number; url?: true };
    midi?: { input?: true; output?: true };
    audio?: { channels: 2 | 8 | 16 };
    expanderMode?: "disconnected" | "host-snapshot" | "message-buffer";
    expander?: ExpanderContract;
    hostControl?: "rack-view";
    hotkey?: { scope:"module-hover"; actionBase:number; recordParam:number; keyState:number; modsState:number };
    manualHelp?: Record<string,ManualHelpModule>;
    visuals?: RuntimeVisual[];
  };
};

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const centeredMm=(x:number,y:number):RackWidgetPosition=>({x:Number((x*75/25.4).toFixed(3)),y:Number((y*75/25.4).toFixed(3)),centered:true});
function rackAudioPorts(channels:2|8|16,direction:"input"|"output"):PortSpec[]{
  const xs=channels===2?[7.285,18.122]:channels===8?[7.81,19.359,30.909,42.459]:[7.815,19.364,30.914,42.464,54.015,65.565,77.114,88.664],columns=xs.length,ys=direction==="output"?Array.from({length:channels},(_,id)=>id<columns?96.859:113.115):channels===2?[96.859,96.859]:channels===8?[57.929,57.929,57.929,57.929,74.286,74.286,74.286,74.286]:[57.929,57.929,57.929,57.929,57.929,57.914,57.914,57.914,74.276,74.276,74.276,74.276,74.291,74.276,74.276,74.276];
  return Array.from({length:channels},(_,id)=>({id,name:`${direction==="input"?"TO":"FROM"} DEVICE ${id+1}`,kind:"audio",position:centeredMm(xs[id%columns],ys[id])}));
}
const rackMidiGrid16=Array.from({length:16},(_,id)=>centeredMm([8.189,19.739,31.289,42.838][id%4],id===12?112.998:[78.431,89.946,101.466,112.984][Math.floor(id/4)]));
function rackAudioPairLights(channels:8|16):LightSpec[]{
  const inputXs=channels===8?[13.54,36.774]:[13.545,36.779,59.745,82.98],outputXs=channels===8?[13.54,36.638]:[13.545,36.644,59.745,82.844],columns=inputXs.length,result:LightSpec[]=[];
  for(let pair=0;pair<channels/2;pair++){const row=Math.floor(pair/columns),column=pair%columns;result.push({id:pair*2,widget:"SmallLight<GreenRedLight>",position:centeredMm(inputXs[column],[52.168,68.53][row])})}
  for(let pair=0;pair<channels/2;pair++){const row=Math.floor(pair/columns),column=pair%columns;result.push({id:channels+pair*2,widget:"SmallLight<GreenRedLight>",position:centeredMm(outputXs[column],[90.791,107.097][row])})}
  return result;
}
function rackAudio2VuLights():LightSpec[]{
  const xs=[6.691,18.709],ys=[28.899,34.196,39.494,44.791,50.089,55.386],widgets=["SmallSimpleLight<RedLight>","SmallSimpleLight<YellowLight>","SmallSimpleLight<GreenLight>","SmallSimpleLight<GreenLight>","SmallSimpleLight<GreenLight>","SmallSimpleLight<GreenLight>"];
  return ys.flatMap((y,band)=>xs.map((x,channel)=>({id:channel*6+band,widget:widgets[band],position:centeredMm(x,y)})));
}
const rackMidiCv12=[centeredMm(7.905,64.347),centeredMm(20.248,64.347),centeredMm(32.591,64.347),centeredMm(7.905,80.603),centeredMm(20.248,80.603),centeredMm(32.591,80.603),centeredMm(32.591,96.859),centeredMm(7.905,96.859),centeredMm(20.248,96.707),centeredMm(7.905,113.115),centeredMm(20.248,113.115),centeredMm(32.591,112.975)];
const rackCvMidi12=[centeredMm(7.906,64.347),centeredMm(20.249,64.347),centeredMm(32.591,64.347),centeredMm(7.906,80.603),centeredMm(20.249,80.603),centeredMm(32.591,80.603),centeredMm(7.906,96.859),centeredMm(20.249,96.707),centeredMm(32.591,96.859),centeredMm(7.906,113.115),centeredMm(20.249,113.115),centeredMm(32.591,112.975)];

export const WEB_PLUGIN_REGISTRY: WebPluginModule[] = [{
  key: "Bruer/SEQ1",
  plugin: "Bruer",
  model: "SEQ1",
  name: "SEQ1",
  brand: "Bruer",
  version: "2.0.3",
  license: "GPL-3.0-or-later",
  sourceUrl: "https://github.com/bruer80/bruer-vcv",
  libraryUrl: "https://library.vcvrack.com/Bruer/SEQ1",
  screenshotUrl: "https://library.vcvrack.com/screenshots/400/Bruer/SEQ1.webp",
  wasmUrl: "/wasm/bruer-seq1.wasm",
  width: 300,
  description: "Probabilistic Turing sequencer with integrated quantizer and Euclidean triggers",
  params: [
    {id:0,name:"Generate",min:0,max:1,default:0}, {id:1,name:"Length",min:1,max:16,default:8,snap:true},
    {id:2,name:"Scale",min:1,max:8,default:2,snap:true}, {id:3,name:"Clear",min:0,max:1,default:0,snap:true},
    {id:4,name:"Euclidean 1",min:0,max:16,default:4,snap:true}, {id:5,name:"Euclidean 2",min:0,max:16,default:5,snap:true},
    {id:6,name:"Euclidean 3",min:0,max:16,default:7,snap:true},
    ...noteNames.map((name,index)=>({id:7+index,name,min:0,max:1,default:[0,2,4,5,7,9,11].includes(index)?1:0,snap:true})),
  ],
  inputs:[{id:0,name:"Clock",kind:"gate"},{id:1,name:"Reset",kind:"gate"}],
  outputs:[{id:0,name:"CV",kind:"cv"},{id:1,name:"Trigger 1",kind:"gate"},{id:2,name:"Trigger 2",kind:"gate"},{id:3,name:"Trigger 3",kind:"gate"}],
  lights:77,
},{
  key:"Fundamental/VCA",plugin:"Fundamental",model:"VCA",name:"VCA",brand:"Fundamental",version:"2.6.4",license:"GPL-3.0-or-later",polyphonic:true,bypassRoutes:[[2,0],[5,1]],
  sourceUrl:"https://github.com/VCVRack/Fundamental",libraryUrl:"https://library.vcvrack.com/Fundamental/VCA",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fundamental/VCA.webp",wasmUrl:"/wasm/fundamental-vca.wasm",width:75,
  description:"Dual voltage-controlled amplifier translated from the Fundamental Rack source",
  params:[{id:0,name:"Level 1",min:0,max:1,default:1},{id:1,name:"Level 2",min:0,max:1,default:1}],
  inputs:[{id:0,name:"EXP 1",kind:"cv"},{id:1,name:"LIN 1",kind:"cv"},{id:2,name:"IN 1",kind:"audio"},{id:3,name:"EXP 2",kind:"cv"},{id:4,name:"LIN 2",kind:"cv"},{id:5,name:"IN 2",kind:"audio"}],
  outputs:[{id:0,name:"OUT 1",kind:"audio"},{id:1,name:"OUT 2",kind:"audio"}],lights:0,
},{
  key:"Fundamental/ADSR",plugin:"Fundamental",model:"ADSR",name:"ADSR",brand:"Fundamental",version:"2.6.4",license:"GPL-3.0-or-later",polyphonic:true,
  sourceUrl:"https://github.com/VCVRack/Fundamental",libraryUrl:"https://library.vcvrack.com/Fundamental/ADSR",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fundamental/ADSR.webp",wasmUrl:"/wasm/fundamental-adsr.wasm",width:135,
  description:"Attack, decay, sustain, release envelope translated from the Fundamental Rack source",
  params:[{id:0,name:"Attack",min:0,max:1,default:.5},{id:1,name:"Decay",min:0,max:1,default:.5},{id:2,name:"Sustain",min:0,max:1,default:.5},{id:3,name:"Release",min:0,max:1,default:.5},{id:4,name:"Attack CV",min:-1,max:1,default:0},{id:5,name:"Decay CV",min:-1,max:1,default:0},{id:6,name:"Sustain CV",min:-1,max:1,default:0},{id:7,name:"Release CV",min:-1,max:1,default:0},{id:8,name:"Push",min:0,max:1,default:0,snap:true}],
  inputs:[{id:0,name:"ATT",kind:"cv"},{id:1,name:"DEC",kind:"cv"},{id:2,name:"SUS",kind:"cv"},{id:3,name:"REL",kind:"cv"},{id:4,name:"GATE",kind:"gate"},{id:5,name:"RETRIG",kind:"gate"}],
  outputs:[{id:0,name:"ENV",kind:"cv"}],lights:5,
},{
  key:"AudibleInstruments/Links",plugin:"AudibleInstruments",model:"Links",name:"Links",brand:"Audible Instruments",version:"2.0.0",license:"GPL-3.0-or-later",
  sourceUrl:"https://github.com/VCVRack/AudibleInstruments",libraryUrl:"https://library.vcvrack.com/AudibleInstruments/Links",screenshotUrl:"https://library.vcvrack.com/screenshots/400/AudibleInstruments/Links.webp",wasmUrl:"/wasm/audible-links.wasm",width:60,
  description:"Three-section buffered multiple and precision adder translated from the Audible Instruments Rack source",params:[],
  inputs:[{id:0,name:"A1",kind:"cv"},{id:1,name:"B1",kind:"cv"},{id:2,name:"B2",kind:"cv"},{id:3,name:"C1",kind:"cv"},{id:4,name:"C2",kind:"cv"},{id:5,name:"C3",kind:"cv"}],
  outputs:[{id:0,name:"A1",kind:"cv"},{id:1,name:"A2",kind:"cv"},{id:2,name:"A3",kind:"cv"},{id:3,name:"B1",kind:"cv"},{id:4,name:"B2",kind:"cv"},{id:5,name:"C1",kind:"cv"}],lights:6,
},{
  key:"AudibleInstruments/Kinks",plugin:"AudibleInstruments",model:"Kinks",name:"Kinks",brand:"Audible Instruments",version:"2.0.0",license:"GPL-3.0-or-later",
  sourceUrl:"https://github.com/VCVRack/AudibleInstruments",libraryUrl:"https://library.vcvrack.com/AudibleInstruments/Kinks",screenshotUrl:"https://library.vcvrack.com/screenshots/400/AudibleInstruments/Kinks.webp",wasmUrl:"/wasm/audible-kinks.wasm",width:60,
  description:"Sign, logic, Gaussian noise, and sample-and-hold utility translated from the Audible Instruments Rack source",params:[],
  inputs:[{id:0,name:"SIGN",kind:"cv"},{id:1,name:"LOGIC A",kind:"cv"},{id:2,name:"LOGIC B",kind:"cv"},{id:3,name:"S&H",kind:"cv"},{id:4,name:"TRIG",kind:"gate"}],
  outputs:[{id:0,name:"INVERT",kind:"cv"},{id:1,name:"HALF",kind:"cv"},{id:2,name:"FULL",kind:"cv"},{id:3,name:"MAX",kind:"cv"},{id:4,name:"MIN",kind:"cv"},{id:5,name:"NOISE",kind:"cv"},{id:6,name:"S&H",kind:"cv"}],lights:6,
},{
  key:"AudibleInstruments/Shades",plugin:"AudibleInstruments",model:"Shades",name:"Shades",brand:"Audible Instruments",version:"2.0.0",license:"GPL-3.0-or-later",
  sourceUrl:"https://github.com/VCVRack/AudibleInstruments",libraryUrl:"https://library.vcvrack.com/AudibleInstruments/Shades",screenshotUrl:"https://library.vcvrack.com/screenshots/400/AudibleInstruments/Shades.webp",wasmUrl:"/wasm/audible-shades.wasm",width:90,
  description:"Three-channel attenuverter and cascading mixer translated from the Audible Instruments Rack source",
  params:[{id:0,name:"Gain 1",min:0,max:1,default:.5},{id:1,name:"Gain 2",min:0,max:1,default:.5},{id:2,name:"Gain 3",min:0,max:1,default:.5},{id:3,name:"Mode 1",min:0,max:1,default:1,snap:true},{id:4,name:"Mode 2",min:0,max:1,default:1,snap:true},{id:5,name:"Mode 3",min:0,max:1,default:1,snap:true}],
  inputs:[{id:0,name:"IN 1",kind:"cv"},{id:1,name:"IN 2",kind:"cv"},{id:2,name:"IN 3",kind:"cv"}],outputs:[{id:0,name:"OUT 1",kind:"cv"},{id:1,name:"OUT 2",kind:"cv"},{id:2,name:"OUT 3",kind:"cv"}],lights:6,
},{
  key:"AudibleInstruments/Branches",plugin:"AudibleInstruments",model:"Branches",name:"Branches",brand:"Audible Instruments",version:"2.0.0",license:"GPL-3.0-or-later",
  sourceUrl:"https://github.com/VCVRack/AudibleInstruments",libraryUrl:"https://library.vcvrack.com/AudibleInstruments/Branches",screenshotUrl:"https://library.vcvrack.com/screenshots/400/AudibleInstruments/Branches.webp",wasmUrl:"/wasm/audible-branches.wasm",width:90,
  description:"Dual Bernoulli gate with latch and toggle modes translated from the Audible Instruments Rack source",
  params:[{id:0,name:"Probability 1",min:0,max:1,default:.5},{id:1,name:"Probability 2",min:0,max:1,default:.5},{id:2,name:"Mode 1",min:0,max:1,default:0,snap:true},{id:3,name:"Mode 2",min:0,max:1,default:0,snap:true}],
  inputs:[{id:0,name:"IN 1",kind:"gate"},{id:1,name:"IN 2",kind:"gate"},{id:2,name:"P 1",kind:"cv"},{id:3,name:"P 2",kind:"cv"}],outputs:[{id:0,name:"OUT 1A",kind:"gate"},{id:1,name:"OUT 2A",kind:"gate"},{id:2,name:"OUT 1B",kind:"gate"},{id:3,name:"OUT 2B",kind:"gate"}],lights:4,
},{
  key:"Fundamental/SEQ3",plugin:"Fundamental",model:"SEQ3",name:"SEQ3",brand:"Fundamental",version:"2.6.4",license:"GPL-3.0-or-later",
  sourceUrl:"https://github.com/VCVRack/Fundamental",libraryUrl:"https://library.vcvrack.com/Fundamental/SEQ3",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fundamental/SEQ3.webp",wasmUrl:"/wasm/fundamental-seq3.wasm",width:330,
  description:"Three-row eight-step sequencer translated from the Fundamental Rack source",
  params:[{id:0,name:"Tempo",min:-2,max:4,default:1},{id:1,name:"Run",min:0,max:1,default:0,snap:true},{id:2,name:"Reset",min:0,max:1,default:0,snap:true},{id:3,name:"Steps",min:1,max:8,default:8,snap:true},...Array.from({length:24},(_,index)=>({id:4+index,name:`CV ${Math.floor(index/8)+1}.${index%8+1}`,min:-10,max:10,default:0})),...Array.from({length:8},(_,index)=>({id:28+index,name:`Gate ${index+1}`,min:0,max:1,default:0,snap:true})),{id:36,name:"Tempo CV",min:0,max:1,default:1},{id:37,name:"Steps CV",min:0,max:1,default:1},{id:38,name:"Clock",min:0,max:1,default:0,snap:true}],
  inputs:[{id:0,name:"TEMPO",kind:"cv"},{id:1,name:"CLOCK",kind:"gate"},{id:2,name:"RESET",kind:"gate"},{id:3,name:"STEPS",kind:"cv"},{id:4,name:"RUN",kind:"gate"}],
  outputs:[{id:0,name:"TRIG",kind:"gate"},...Array.from({length:3},(_,index)=>({id:1+index,name:`CV ${index+1}`,kind:"cv" as const})),...Array.from({length:8},(_,index)=>({id:4+index,name:`STEP ${index+1}`,kind:"gate" as const})),{id:12,name:"STEPS",kind:"cv"},{id:13,name:"CLOCK",kind:"gate"},{id:14,name:"RUN",kind:"gate"},{id:15,name:"RESET",kind:"gate"}],lights:27,
},{
  key:"Core/Blank",plugin:"Core",model:"Blank",name:"Blank",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",runtime:{strategy:"rack-boundary"},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/Blank",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/Blank.webp",wasmUrl:"/wasm/core-blank.wasm",width:150,
  description:"Resizable blank spacer from Rack Core",params:[],inputs:[],outputs:[],lights:0,
},{
  key:"Core/MIDIToCVInterface",plugin:"Core",model:"MIDIToCVInterface",name:"MIDI to CV",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",polyphonic:true,runtime:{strategy:"rack-boundary",midi:{input:true}},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/MIDIToCVInterface",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/MIDIToCVInterface.webp",wasmUrl:"/wasm/core-midi-cv.wasm",width:120,
  description:"Rack Core MIDI-to-CV state machine connected to browser Web MIDI",params:[],inputs:[],outputs:[{id:0,name:"1V/octave pitch",kind:"cv"},{id:1,name:"Gate",kind:"gate"},{id:2,name:"Velocity",kind:"cv"},{id:3,name:"Aftertouch",kind:"cv"},{id:4,name:"Pitch wheel",kind:"cv"},{id:5,name:"Mod wheel",kind:"cv"},{id:6,name:"Retrigger",kind:"gate"},{id:7,name:"Clock",kind:"gate"},{id:8,name:"Clock divider",kind:"gate"},{id:9,name:"Start trigger",kind:"gate"},{id:10,name:"Stop trigger",kind:"gate"},{id:11,name:"Continue trigger",kind:"gate"}].map((port,id)=>({...port,id,kind:port.kind as PortSpec["kind"],position:rackMidiCv12[id]})),lights:0,
},{
  key:"Core/MIDICCToCVInterface",plugin:"Core",model:"MIDICCToCVInterface",name:"MIDI CC to CV",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",polyphonic:true,runtime:{strategy:"rack-boundary",midi:{input:true}},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/MIDICCToCVInterface",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/MIDICCToCVInterface.webp",wasmUrl:"/wasm/core-midi-cc-cv.wasm",width:150,
  description:"Sixteen learned MIDI CC cells with Rack smoothing, MPE, and 14-bit modes",params:[],inputs:[],outputs:Array.from({length:16},(_,id)=>({id,name:`Cell ${id+1}`,kind:"cv" as const,position:rackMidiGrid16[id]})),lights:0,
},{
  key:"Core/MIDITriggerToCVInterface",plugin:"Core",model:"MIDITriggerToCVInterface",name:"MIDI to Gate",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",polyphonic:true,runtime:{strategy:"rack-boundary",midi:{input:true}},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/MIDITriggerToCVInterface",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/MIDITriggerToCVInterface.webp",wasmUrl:"/wasm/core-midi-gate.wasm",width:150,
  description:"Sixteen learned MIDI note gates with trigger, velocity, aftertouch, and MPE modes",params:[],inputs:[],outputs:Array.from({length:16},(_,id)=>({id,name:`Gate ${id+1}`,kind:"gate" as const,position:rackMidiGrid16[id]})),lights:0,
},{
  key:"Core/MIDI-Map",plugin:"Core",model:"MIDI-Map",name:"MIDI Map",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",runtime:{strategy:"rack-boundary",midi:{input:true}},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/MIDI-Map",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/MIDI-Map.webp",wasmUrl:"/wasm/core-midi-map.wasm",width:180,
  description:"Rack host-level MIDI CC mappings that control live WebAssembly module parameters",params:[],inputs:[],outputs:[],lights:0,
},{
  key:"Core/CV-MIDI",plugin:"Core",model:"CV-MIDI",name:"CV to MIDI",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",runtime:{strategy:"rack-boundary",midi:{output:true}},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/CV-MIDI",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/CV-MIDI.webp",wasmUrl:"/wasm/core-cv-midi.wasm",width:120,
  description:"Polyphonic CV, gate, expression, clock, and transport to browser Web MIDI",params:[],inputs:[{id:0,name:"1V/octave pitch",kind:"cv"},{id:1,name:"Gate",kind:"gate"},{id:2,name:"Velocity",kind:"cv"},{id:3,name:"Aftertouch",kind:"cv"},{id:4,name:"Pitch wheel",kind:"cv"},{id:5,name:"Mod wheel",kind:"cv"},{id:6,name:"Clock",kind:"gate"},{id:7,name:"Volume",kind:"cv"},{id:8,name:"Pan",kind:"cv"},{id:9,name:"Start trigger",kind:"gate"},{id:10,name:"Stop trigger",kind:"gate"},{id:11,name:"Continue trigger",kind:"gate"}].map((port,id)=>({...port,id,kind:port.kind as PortSpec["kind"],position:rackCvMidi12[id]})),outputs:[],lights:0,
},{
  key:"Core/CV-CC",plugin:"Core",model:"CV-CC",name:"CV to MIDI CC",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",runtime:{strategy:"rack-boundary",midi:{output:true}},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/CV-CC",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/CV-CC.webp",wasmUrl:"/wasm/core-cv-midi-cc.wasm",width:150,
  description:"Sixteen learned CV-to-MIDI CC cells with Rack's 200 Hz output limiter",params:[],inputs:Array.from({length:16},(_,id)=>({id,name:`Cell ${id+1}`,kind:"cv" as const,position:rackMidiGrid16[id]})),outputs:[],lights:0,
},{
  key:"Core/CV-Gate",plugin:"Core",model:"CV-Gate",name:"Gate to MIDI",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",runtime:{strategy:"rack-boundary",midi:{output:true}},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/CV-Gate",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/CV-Gate.webp",wasmUrl:"/wasm/core-gate-midi.wasm",width:150,
  description:"Sixteen learned Rack gates or velocity CVs sent as browser MIDI notes",params:[],inputs:Array.from({length:16},(_,id)=>({id,name:`Cell ${id+1}`,kind:"gate" as const,position:rackMidiGrid16[id]})),outputs:[],lights:0,
},{
  key:"Befaco/Mixer",plugin:"Befaco",model:"Mixer",name:"Mixer",brand:"Befaco",version:"2.11.0",license:"GPL-3.0-or-later",
  sourceUrl:"https://github.com/VCVRack/Befaco",libraryUrl:"https://library.vcvrack.com/Befaco/Mixer",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Befaco/Mixer.webp",wasmUrl:"/wasm/befaco-mixer.wasm",width:75,
  description:"Four-channel unity/inverted mixer translated from the Befaco Rack source",
  params:Array.from({length:4},(_,id)=>({id,name:`Level ${id+1}`,min:0,max:1,default:0})),
  inputs:Array.from({length:4},(_,id)=>({id,name:`IN ${id+1}`,kind:"audio" as const})),outputs:[{id:0,name:"MAIN",kind:"audio"},{id:1,name:"INV",kind:"audio"}],lights:3,
},{
  key:"Fundamental/VCO",plugin:"Fundamental",model:"VCO",name:"VCO",brand:"Fundamental",version:"2.6.4",license:"GPL-3.0-or-later",polyphonic:true,runtime:{strategy:"browser-dsp-adapter"},
  sourceUrl:"https://github.com/VCVRack/Fundamental",libraryUrl:"https://library.vcvrack.com/Fundamental/VCO",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fundamental/VCO.webp",wasmUrl:"/wasm/fundamental-vco.wasm",width:135,
  description:"PolyBLEP audio oscillator preserving Fundamental VCO parameter and port indices",
  params:[{id:0,name:"Legacy mode",min:0,max:1,default:0,snap:true},{id:1,name:"Sync",min:0,max:1,default:1,snap:true},{id:2,name:"Frequency",min:-76,max:76,default:0},{id:3,name:"Legacy fine",min:-1,max:1,default:0},{id:4,name:"FM",min:-1,max:1,default:0},{id:5,name:"Pulse width",min:.01,max:.99,default:.5},{id:6,name:"PW CV",min:-1,max:1,default:0},{id:7,name:"Linear FM",min:0,max:1,default:0,snap:true}],
  inputs:[{id:0,name:"V/OCT",kind:"cv"},{id:1,name:"FM",kind:"cv"},{id:2,name:"SYNC",kind:"gate"},{id:3,name:"PWM",kind:"cv"}],outputs:[{id:0,name:"SIN",kind:"audio"},{id:1,name:"TRI",kind:"audio"},{id:2,name:"SAW",kind:"audio"},{id:3,name:"SQR",kind:"audio"}],lights:5,
},{
  key:"Fundamental/VCF",plugin:"Fundamental",model:"VCF",name:"VCF",brand:"Fundamental",version:"2.6.4",license:"GPL-3.0-or-later",bypassRoutes:[[3,0],[3,1]],runtime:{strategy:"browser-dsp-adapter"},
  sourceUrl:"https://github.com/VCVRack/Fundamental",libraryUrl:"https://library.vcvrack.com/Fundamental/VCF",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fundamental/VCF.webp",wasmUrl:"/wasm/fundamental-vcf.wasm",width:105,
  description:"Resonant nonlinear four-pole filter preserving Fundamental VCF parameter and port indices",
  params:[{id:0,name:"Cutoff",min:0,max:1,default:.5},{id:1,name:"Legacy fine",min:-1,max:1,default:0},{id:2,name:"Resonance",min:0,max:1,default:0},{id:3,name:"Cutoff CV",min:-1,max:1,default:0},{id:4,name:"Drive",min:-1,max:1,default:0},{id:5,name:"Res CV",min:-1,max:1,default:0},{id:6,name:"Drive CV",min:-1,max:1,default:0}],
  inputs:[{id:0,name:"FREQ",kind:"cv"},{id:1,name:"RES",kind:"cv"},{id:2,name:"DRIVE",kind:"cv"},{id:3,name:"IN",kind:"audio"}],outputs:[{id:0,name:"LPF",kind:"audio"},{id:1,name:"HPF",kind:"audio"}],lights:0,
},{
  key:"Fundamental/Delay",plugin:"Fundamental",model:"Delay",name:"Delay",brand:"Fundamental",version:"2.6.4",license:"GPL-3.0-or-later",bypassRoutes:[[4,0],[4,1]],runtime:{strategy:"browser-dsp-adapter",initialMemory:4194304},
  sourceUrl:"https://github.com/VCVRack/Fundamental",libraryUrl:"https://library.vcvrack.com/Fundamental/Delay",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fundamental/Delay.webp",wasmUrl:"/wasm/fundamental-delay.wasm",width:135,
  description:"Fractional 1ms-to-10s feedback delay preserving Fundamental Delay parameter and port indices",
  params:[{id:0,name:"Time",min:0,max:1,default:.6747425},{id:1,name:"Feedback",min:0,max:1,default:.5},{id:2,name:"Tone",min:0,max:1,default:.5},{id:3,name:"Mix",min:0,max:1,default:.5},{id:4,name:"Time CV",min:-1,max:1,default:0},{id:5,name:"Feedback CV",min:-1,max:1,default:0},{id:6,name:"Tone CV",min:-1,max:1,default:0},{id:7,name:"Mix CV",min:-1,max:1,default:0}],
  inputs:[{id:0,name:"TIME",kind:"cv"},{id:1,name:"FEEDBACK",kind:"cv"},{id:2,name:"TONE",kind:"cv"},{id:3,name:"MIX",kind:"cv"},{id:4,name:"IN",kind:"audio"},{id:5,name:"CLOCK",kind:"gate"}],outputs:[{id:0,name:"MIX",kind:"audio"},{id:1,name:"WET",kind:"audio"}],lights:1,
},{
  key:"Core/AudioInterface2",plugin:"Core",model:"AudioInterface2",name:"Audio-2",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",runtime:{strategy:"rack-boundary",audio:{channels:2},visuals:[{kind:"audio-display",channels:2,x:0,y:38.501,width:75,height:140.924}]},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/AudioInterface2",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/AudioInterface2.webp",wasmUrl:"/wasm/core-audio2.wasm",width:75,
  description:"Two-channel Rack/Web Audio boundary with the original output level control",params:[{id:0,name:"Level",min:0,max:2,default:1,position:centeredMm(12.869,77.362)}],inputs:rackAudioPorts(2,"input"),outputs:rackAudioPorts(2,"output"),lights:12,lightWidgets:rackAudio2VuLights(),
},{
  key:"Core/AudioInterface",plugin:"Core",model:"AudioInterface",name:"Audio-8",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",runtime:{strategy:"rack-boundary",audio:{channels:8},visuals:[{kind:"audio-display",channels:8,x:0,y:38.501,width:150,height:85.692}]},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/AudioInterface",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/AudioInterface.webp",wasmUrl:"/wasm/core-audio8.wasm",width:150,
  description:"Eight-channel Rack/Web Audio boundary; patch inputs route to browser device outputs",
  params:[],inputs:rackAudioPorts(8,"input"),outputs:rackAudioPorts(8,"output"),lights:16,lightWidgets:rackAudioPairLights(8),
},{
  key:"Core/AudioInterface16",plugin:"Core",model:"AudioInterface16",name:"Audio-16",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",runtime:{strategy:"rack-boundary",audio:{channels:16},visuals:[{kind:"audio-display",channels:16,x:0,y:38.501,width:285,height:85.692}]},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/AudioInterface16",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/AudioInterface16.webp",wasmUrl:"/wasm/core-audio16.wasm",width:285,
  description:"Sixteen-channel Rack/Web Audio boundary; browser playback exposes the first stereo pair",params:[],inputs:rackAudioPorts(16,"input"),outputs:rackAudioPorts(16,"output"),lights:32,lightWidgets:rackAudioPairLights(16),
},{
  key:"Core/Notes",plugin:"Core",model:"Notes",name:"Notes",brand:"Rack Core",version:"2.6.6",license:"GPL-3.0-or-later",runtime:{strategy:"rack-boundary"},
  sourceUrl:"https://github.com/VCVRack/Rack",libraryUrl:"https://library.vcvrack.com/Core/Notes",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Core/Notes.webp",wasmUrl:"/wasm/core-notes.wasm",width:240,
  description:"Rack Core multiline patch notes with lossless text JSON",params:[],inputs:[],outputs:[],lights:0,
},{
  key:"Fundamental/Scope",plugin:"Fundamental",model:"Scope",name:"Scope",brand:"Fundamental",version:"2.6.4",license:"GPL-3.0-or-later",bypassRoutes:[[0,0],[1,1]],runtime:{visuals:[{kind:"scope",inputs:[0,1],x:0,y:38.5,width:195,height:165}]},
  sourceUrl:"https://github.com/VCVRack/Fundamental",libraryUrl:"https://library.vcvrack.com/Fundamental/Scope",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fundamental/Scope.webp",wasmUrl:"/wasm/fundamental-scope.wasm",width:195,
  description:"Dual waveform and Lissajous monitor with Rack-compatible pass-through ports",
  params:[{id:0,name:"X scale",min:0,max:8,default:0,snap:true,position:centeredMm(24.897,80.551)},{id:1,name:"X offset",min:-10,max:10,default:0,position:centeredMm(24.897,96.789)},{id:2,name:"Y scale",min:0,max:8,default:0,snap:true,position:centeredMm(41.147,80.551)},{id:3,name:"Y offset",min:-10,max:10,default:0,position:centeredMm(41.147,96.815)},{id:4,name:"Time",min:-5.643856,max:7.643856,default:1,position:centeredMm(8.643,96.819)},{id:5,name:"Lissajous",min:0,max:1,default:0,snap:true,button:true,position:centeredMm(8.643,80.603)},{id:6,name:"Threshold",min:-10,max:10,default:0,position:centeredMm(57.397,96.815)},{id:7,name:"Trigger",min:0,max:1,default:1,snap:true,button:true,position:centeredMm(57.397,80.521)}],
  inputs:[{id:0,name:"X",kind:"audio",position:centeredMm(8.643,113.115)},{id:1,name:"Y",kind:"audio",position:centeredMm(33.023,113.115)},{id:2,name:"TRIG",kind:"gate",position:centeredMm(57.397,113.115)}],outputs:[{id:0,name:"X",kind:"audio",position:centeredMm(20.833,113.115)},{id:1,name:"Y",kind:"audio",position:centeredMm(45.212,113.115)}],lights:2,
},{
  key:"AudibleInstruments/Braids",plugin:"AudibleInstruments",model:"Braids",name:"Braids",brand:"Audible Instruments",version:"2.0.0",license:"GPL-3.0-or-later",runtime:{strategy:"browser-dsp-adapter",visuals:[{kind:"segment",param:6,x:14,y:53,width:148,height:56,values:["CSAW","/\\-_","//-_","FOLD","uuuu","SUB-","SUB/","SYN-","SYN/","//x3","-_x3","/\\x3","SIx3","RING","////","//uu","TOY*","ZLPF","ZPKF","ZBPF","ZHPF","VOSM","VOWL","VFOF","HARM","FM  ","FBFM","WTFM","PLUK","BOWD","BLOW","FLUT","BELL","DRUM","KICK","CYMB","SNAR","WTBL","WMAP","WLIN","WTx4","NOIS","TWNQ","CLKN","CLOU","PRTC","QPSK"]}]},sourceUrl:"https://github.com/VCVRack/AudibleInstruments",libraryUrl:"https://library.vcvrack.com/AudibleInstruments/Braids",screenshotUrl:"https://library.vcvrack.com/screenshots/400/AudibleInstruments/Braids.webp",wasmUrl:"/wasm/audible-braids.wasm",width:240,description:"Browser macro-oscillator adapter preserving every Braids Rack parameter and port index",
  params:[{id:0,name:"Fine",min:-1,max:1,default:0},{id:1,name:"Coarse",min:-5,max:3,default:-1},{id:2,name:"FM",min:-1,max:1,default:0},{id:3,name:"Timbre",min:0,max:1,default:.5},{id:4,name:"Modulation",min:-1,max:1,default:0},{id:5,name:"Color",min:0,max:1,default:.5},{id:6,name:"Model",min:0,max:1,default:0}],inputs:[{id:0,name:"TRIG",kind:"gate"},{id:1,name:"V/OCT",kind:"cv"},{id:2,name:"FM",kind:"cv"},{id:3,name:"TIMBRE",kind:"cv"},{id:4,name:"COLOR",kind:"cv"}],outputs:[{id:0,name:"OUT",kind:"audio"}],lights:0,
},{
  key:"AudibleInstruments/Tides",plugin:"AudibleInstruments",model:"Tides",name:"Tides",brand:"Audible Instruments",version:"2.0.0",license:"GPL-3.0-or-later",runtime:{strategy:"browser-dsp-adapter"},sourceUrl:"https://github.com/VCVRack/AudibleInstruments",libraryUrl:"https://library.vcvrack.com/AudibleInstruments/Tides",screenshotUrl:"https://library.vcvrack.com/screenshots/400/AudibleInstruments/Tides.webp",wasmUrl:"/wasm/audible-tides.wasm",width:210,description:"Browser function-generator adapter preserving every Tides Rack parameter and port index",
  params:[{id:0,name:"Mode",min:0,max:1,default:0,snap:true},{id:1,name:"Range",min:0,max:1,default:0,snap:true},{id:2,name:"Frequency",min:-48,max:48,default:0},{id:3,name:"FM",min:-12,max:12,default:0},{id:4,name:"Shape",min:-1,max:1,default:0},{id:5,name:"Slope",min:-1,max:1,default:0},{id:6,name:"Smoothness",min:-1,max:1,default:0}],inputs:[{id:0,name:"SHAPE",kind:"cv"},{id:1,name:"SLOPE",kind:"cv"},{id:2,name:"SMOOTH",kind:"cv"},{id:3,name:"TRIG",kind:"gate"},{id:4,name:"FREEZE",kind:"gate"},{id:5,name:"V/OCT",kind:"cv"},{id:6,name:"FM",kind:"cv"},{id:7,name:"LEVEL",kind:"cv"},{id:8,name:"CLOCK",kind:"gate"}],outputs:[{id:0,name:"HIGH",kind:"gate"},{id:1,name:"LOW",kind:"gate"},{id:2,name:"UNI",kind:"cv"},{id:3,name:"BI",kind:"cv"}],lights:6,
},{
  key:"AudibleInstruments/Rings",plugin:"AudibleInstruments",model:"Rings",name:"Rings",brand:"Audible Instruments",version:"2.0.0",license:"GPL-3.0-or-later",runtime:{strategy:"browser-dsp-adapter"},sourceUrl:"https://github.com/VCVRack/AudibleInstruments",libraryUrl:"https://library.vcvrack.com/AudibleInstruments/Rings",screenshotUrl:"https://library.vcvrack.com/screenshots/400/AudibleInstruments/Rings.webp",wasmUrl:"/wasm/audible-rings.wasm",width:210,description:"Browser dual-string resonator adapter preserving every Rings Rack parameter and port index",
  params:[{id:0,name:"Polyphony",min:0,max:1,default:0,snap:true},{id:1,name:"Resonator",min:0,max:1,default:0,snap:true},{id:2,name:"Frequency",min:0,max:60,default:30},{id:3,name:"Structure",min:0,max:1,default:.5},{id:4,name:"Brightness",min:0,max:1,default:.5},{id:5,name:"Damping",min:0,max:1,default:.5},{id:6,name:"Position",min:0,max:1,default:.5},...Array.from({length:5},(_,index)=>({id:7+index,name:["Brightness CV","Frequency CV","Damping CV","Structure CV","Position CV"][index],min:-1,max:1,default:0}))],inputs:[{id:0,name:"BRIGHTNESS",kind:"cv"},{id:1,name:"FREQUENCY",kind:"cv"},{id:2,name:"DAMPING",kind:"cv"},{id:3,name:"STRUCTURE",kind:"cv"},{id:4,name:"POSITION",kind:"cv"},{id:5,name:"STRUM",kind:"gate"},{id:6,name:"V/OCT",kind:"cv"},{id:7,name:"IN",kind:"audio"}],outputs:[{id:0,name:"ODD",kind:"audio"},{id:1,name:"EVEN",kind:"audio"}],lights:4,
},{
  key:"AudibleInstruments/Elements",plugin:"AudibleInstruments",model:"Elements",name:"Elements",brand:"Audible Instruments",version:"2.0.0",license:"GPL-3.0-or-later",runtime:{strategy:"browser-dsp-adapter"},sourceUrl:"https://github.com/VCVRack/AudibleInstruments",libraryUrl:"https://library.vcvrack.com/AudibleInstruments/Elements",screenshotUrl:"https://library.vcvrack.com/screenshots/400/AudibleInstruments/Elements.webp",wasmUrl:"/wasm/audible-elements.wasm",width:510,description:"Browser stereo physical-model adapter preserving all 28 Elements parameters and 16 inputs",
  params:[{id:0,name:"Contour",min:0,max:1,default:1},{id:1,name:"Bow",min:0,max:1,default:0},{id:2,name:"Blow",min:0,max:1,default:0},{id:3,name:"Strike",min:0,max:1,default:.5},{id:4,name:"Coarse",min:-30,max:30,default:0},{id:5,name:"Fine",min:-2,max:2,default:0},{id:6,name:"FM",min:-1,max:1,default:0},...Array.from({length:10},(_,index)=>({id:7+index,name:["Flow","Mallet","Geometry","Brightness","Bow timbre","Blow timbre","Strike timbre","Damping","Position","Space"][index],min:0,max:index===9?2:1,default:index===9?0:.5})),...Array.from({length:10},(_,index)=>({id:17+index,name:`Mod ${index+1}`,min:index===9?-2:-1,max:index===9?2:1,default:0})),{id:27,name:"Play",min:0,max:1,default:0,snap:true}],inputs:["NOTE","FM","GATE","STRENGTH","BLOW","STRIKE","BOW TIMBRE","FLOW","BLOW TIMBRE","MALLET","STRIKE TIMBRE","DAMPING","GEOMETRY","POSITION","BRIGHTNESS","SPACE"].map((name,id)=>({id,name,kind:(id===2?"gate":id===4||id===5?"audio":"cv") as PortSpec["kind"]})),outputs:[{id:0,name:"AUX",kind:"audio"},{id:1,name:"MAIN",kind:"audio"}],lights:3,
},{
  key:"Befaco/SpringReverb",plugin:"Befaco",model:"SpringReverb",name:"Spring Reverb",brand:"Befaco",version:"2.11.0",license:"GPL-3.0-or-later",runtime:{strategy:"browser-dsp-adapter"},sourceUrl:"https://github.com/VCVRack/Befaco",libraryUrl:"https://library.vcvrack.com/Befaco/SpringReverb",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Befaco/SpringReverb.webp",wasmUrl:"/wasm/befaco-spring-reverb.wasm",width:120,description:"Dispersive feedback-network web adapter replacing the native spring IR convolver",
  params:[{id:0,name:"Dry/wet",min:0,max:1,default:.5,position:{x:22,y:29,widget:"BefacoBigKnob"}},{id:1,name:"Level 1",min:0,max:1,default:0,position:{x:12,y:116,widget:"BefacoSlidePot"}},{id:2,name:"Level 2",min:0,max:1,default:0,position:{x:93,y:116,widget:"BefacoSlidePot"}},{id:3,name:"HPF",min:0,max:1,default:.5,position:{x:42,y:210,widget:"Davies1900hWhiteKnob"}}],inputs:[{id:0,name:"CV 1",kind:"cv",position:{x:7,y:243}},{id:1,name:"CV 2",kind:"cv",position:{x:88,y:243}},{id:2,name:"IN 1",kind:"audio",position:{x:27,y:281}},{id:3,name:"IN 2",kind:"audio",position:{x:67,y:281}},{id:4,name:"MIX CV",kind:"cv",position:{x:47,y:324}}],outputs:[{id:0,name:"MIX",kind:"audio",position:{x:7,y:317}},{id:1,name:"WET",kind:"audio",position:{x:88,y:317}}],lights:8,lightWidgets:[{id:0,widget:"MediumLight<GreenRedLight>",position:{x:55,y:269}},{id:1,widget:"MediumLight<RedLight>",position:{x:55,y:113}},{id:2,widget:"MediumLight<YellowLight>",position:{x:55,y:126}},{id:3,widget:"MediumLight<YellowLight>",position:{x:55,y:138}},{id:4,widget:"MediumLight<GreenLight>",position:{x:55,y:150}},{id:5,widget:"MediumLight<GreenLight>",position:{x:55,y:163}},{id:6,widget:"MediumLight<GreenLight>",position:{x:55,y:175}},{id:7,widget:"MediumLight<GreenLight>",position:{x:55,y:188}}],
},{
  key:"Fundamental/VCO2",plugin:"Fundamental",model:"VCO2",name:"Wavetable VCO",brand:"Fundamental",version:"2.6.4",license:"GPL-3.0-or-later",polyphonic:true,runtime:{strategy:"browser-dsp-adapter"},sourceUrl:"https://github.com/VCVRack/Fundamental",libraryUrl:"https://library.vcvrack.com/Fundamental/VCO2",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fundamental/VCO2.webp",wasmUrl:"/wasm/fundamental-wtvco.wasm",width:105,description:"Browser wavetable oscillator adapter preserving Fundamental VCO2 parameter, port, sync, and morph indices",
  params:[{id:0,name:"Legacy mode",min:0,max:1,default:0,snap:true},{id:1,name:"Sync",min:0,max:1,default:0,snap:true},{id:2,name:"Frequency",min:-75,max:75,default:0},{id:3,name:"Position",min:0,max:1,default:0},{id:4,name:"FM",min:-1,max:1,default:0},{id:5,name:"Position CV",min:-1,max:1,default:0},{id:6,name:"Linear FM",min:0,max:1,default:0,snap:true}],inputs:[{id:0,name:"FM",kind:"cv"},{id:1,name:"SYNC",kind:"gate"},{id:2,name:"POSITION",kind:"cv"},{id:3,name:"V/OCT",kind:"cv"}],outputs:[{id:0,name:"WAVE",kind:"audio"}],lights:5,
},{
  key:"Fundamental/LFO",plugin:"Fundamental",model:"LFO",name:"LFO",brand:"Fundamental",version:"2.6.4",license:"GPL-3.0-or-later",polyphonic:true,sourceUrl:"https://github.com/VCVRack/Fundamental",libraryUrl:"https://library.vcvrack.com/Fundamental/LFO",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fundamental/LFO.webp",wasmUrl:"/wasm/fundamental-lfo.wasm",width:135,description:"Low-frequency oscillator translated with Fundamental parameter and port indices, clock sync, reset, offset, and invert",
  params:[{id:0,name:"Offset",min:0,max:1,default:1,snap:true},{id:1,name:"Invert",min:0,max:1,default:0,snap:true},{id:2,name:"Frequency",min:-8,max:10,default:1},{id:3,name:"FM",min:-1,max:1,default:0},{id:4,name:"Legacy FM",min:0,max:1,default:0},{id:5,name:"Pulse width",min:.01,max:.99,default:.5},{id:6,name:"PWM",min:-1,max:1,default:0}],inputs:[{id:0,name:"FM",kind:"cv"},{id:1,name:"LEGACY FM",kind:"cv"},{id:2,name:"RESET",kind:"gate"},{id:3,name:"PWM",kind:"cv"},{id:4,name:"CLOCK",kind:"gate"}],outputs:[{id:0,name:"SIN",kind:"cv"},{id:1,name:"TRI",kind:"cv"},{id:2,name:"SAW",kind:"cv"},{id:3,name:"SQR",kind:"gate"}],lights:5,
},{
  key:"Fundamental/Noise",plugin:"Fundamental",model:"Noise",name:"Noise",brand:"Fundamental",version:"2.6.4",license:"GPL-3.0-or-later",sourceUrl:"https://github.com/VCVRack/Fundamental",libraryUrl:"https://library.vcvrack.com/Fundamental/Noise",screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fundamental/Noise.webp",wasmUrl:"/wasm/fundamental-noise.wasm",width:45,description:"Seven-color noise source preserving Fundamental output order and calibrated browser-rate filters",params:[],inputs:[],outputs:["WHITE","PINK","RED","VIOLET","BLUE","GRAY","BLACK"].map((name,id)=>({id,name,kind:"audio" as const})),lights:0,
},{
  key:"voxglitch/looper",plugin:"voxglitch",model:"looper",name:"Looper",brand:"Voxglitch",version:"2.41.1",license:"GPL-3.0-or-later",runtime:{strategy:"browser-dsp-adapter",initialMemory:16777216,asset:{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2}},sourceUrl:"https://github.com/clone45/voxglitch",libraryUrl:"https://library.vcvrack.com/voxglitch/looper",screenshotUrl:"https://library.vcvrack.com/screenshots/400/voxglitch/looper.webp",wasmUrl:"/wasm/voxglitch-looper.wasm",width:45,description:"Stereo sample-loop playback adapter preserving Voxglitch reset, volume, and output indices; starts with an immediate built-in loop",
  params:[{id:0,name:"Volume",min:0,max:1,default:1}],inputs:[{id:0,name:"RESET",kind:"gate"}],outputs:[{id:0,name:"LEFT",kind:"audio"},{id:1,name:"RIGHT",kind:"audio"}],lights:0,
},{
  key:"VCV-Recorder/Recorder",plugin:"VCV-Recorder",model:"Recorder",name:"Recorder",brand:"VCV Recorder",version:"2.0.3",license:"GPL-3.0-or-later",runtime:{strategy:"browser-dsp-adapter",capture:{format:"wav",channels:"input-dependent"}},sourceUrl:"https://github.com/VCVRack/Recorder",libraryUrl:"https://library.vcvrack.com/VCV-Recorder/Recorder",screenshotUrl:"https://library.vcvrack.com/screenshots/400/VCV-Recorder/Recorder.webp",wasmUrl:"/wasm/vcv-recorder.wasm",width:120,description:"VCV Recorder translated to browser-safe PCM capture with Rack-compatible gate, trigger, gain, mono/stereo, VU, and downloadable WAV output",
  params:[{id:0,name:"Level",min:0,max:2,default:1},{id:1,name:"Record",min:0,max:1,default:0,snap:true}],inputs:[{id:0,name:"Gate",kind:"gate"},{id:1,name:"Trigger",kind:"gate"},{id:2,name:"Left/mono",kind:"audio"},{id:3,name:"Right",kind:"audio"}],outputs:[],lights:13,
}];

export const WEB_PLUGIN_BY_KEY = Object.fromEntries(WEB_PLUGIN_REGISTRY.map(module=>[module.key,module]));

export const WEB_RUNTIME_MANIFEST = {
  schemaVersion: 1,
  abiVersion: "0.3",
  modules: WEB_PLUGIN_REGISTRY.map(module => {
    const artifact = module.wasmUrl.split("/").at(-1)?.replace(/\.wasm$/, "");
    if (!artifact || !/^[a-z0-9-]+$/.test(artifact)) throw new Error(`Invalid WASM URL for ${module.key}`);
    return {
      key: module.key,
      entry: artifact.replaceAll("-", "_"),
      artifact,
      initialMemory: module.runtime?.initialMemory ?? 1048576,
      strategy: module.runtime?.strategy ?? "ordered-translation",
    };
  }),
} as const;
