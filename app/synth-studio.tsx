"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ModuleType = "midi" | "vco" | "vcf" | "vca" | "adsr" | "lfo" | "noise" | "mixer" | "attenuator" | "multiple" | "sequencer" | "delay" | "scope" | "audio";
type ParamValue = number | string | boolean | number[];
type RackModule = { id: string; type: ModuleType; x: number; y: number; params: Record<string, ParamValue> };
type Cable = { id: string; from: string; to: string; color: string };
type PortDef = { key: string; label: string; kind: "audio" | "cv" | "gate" };
type ModuleDef = {
  type: ModuleType; name: string; brand: string; description: string; tags: string[]; width: number; panel: string;
  inputs: PortDef[]; outputs: PortDef[]; defaults: Record<string, ParamValue>;
};
type AudioPart = { input?: AudioNode; output?: AudioNode; params?: Record<string, AudioParam>; oscillator?: OscillatorNode };
type Engine = { ctx: AudioContext; parts: Map<string, AudioPart>; master: GainNode };

const CABLE_COLORS = ["#e73950", "#f0c33c", "#31a6df", "#7ccf50", "#a96cdb", "#f18435"];
const MODULES: ModuleDef[] = [
  { type:"midi", name:"MIDI-CV", brand:"VCV", description:"Convert computer keyboard notes to pitch and gate voltages", tags:["MIDI","Controller"], width:150, panel:"silver", inputs:[], outputs:[{key:"pitch",label:"V/OCT",kind:"cv"},{key:"gate",label:"GATE",kind:"gate"},{key:"vel",label:"VEL",kind:"cv"}], defaults:{ channel:"QWERTY", octave:3 } },
  { type:"vco", name:"VCO-1", brand:"VCV", description:"Voltage-controlled oscillator with four waveform outputs", tags:["Oscillator","VCO"], width:150, panel:"cream", inputs:[{key:"voct",label:"V/OCT",kind:"cv"},{key:"fm",label:"FM",kind:"cv"}], outputs:[{key:"sin",label:"SIN",kind:"audio"},{key:"tri",label:"TRI",kind:"audio"},{key:"saw",label:"SAW",kind:"audio"},{key:"sqr",label:"SQR",kind:"audio"}], defaults:{ frequency:261.63, fine:0, pulse:50, wave:"sawtooth" } },
  { type:"vcf", name:"VCF", brand:"VCV", description:"Four-pole transistor ladder filter", tags:["Filter","VCF"], width:150, panel:"cream", inputs:[{key:"in",label:"IN",kind:"audio"},{key:"freq",label:"FREQ",kind:"cv"}], outputs:[{key:"lp",label:"LPF",kind:"audio"},{key:"hp",label:"HPF",kind:"audio"}], defaults:{ cutoff:1800, resonance:2.4, drive:0 } },
  { type:"vca", name:"VCA", brand:"VCV", description:"Voltage-controlled amplifier", tags:["Amplifier","VCA"], width:105, panel:"cream", inputs:[{key:"in",label:"IN",kind:"audio"},{key:"cv",label:"CV",kind:"cv"}], outputs:[{key:"out",label:"OUT",kind:"audio"}], defaults:{ level:80, response:"EXP" } },
  { type:"adsr", name:"ADSR", brand:"VCV", description:"Attack, decay, sustain, release envelope generator", tags:["Envelope generator"], width:135, panel:"cream", inputs:[{key:"gate",label:"GATE",kind:"gate"},{key:"retrig",label:"RETRIG",kind:"gate"}], outputs:[{key:"env",label:"ENV",kind:"cv"}], defaults:{ attack:0.015, decay:0.18, sustain:0.62, release:0.28 } },
  { type:"lfo", name:"LFO", brand:"VCV", description:"Low-frequency oscillator", tags:["LFO","Modulator"], width:135, panel:"cream", inputs:[{key:"reset",label:"RESET",kind:"gate"}], outputs:[{key:"sin",label:"SIN",kind:"cv"},{key:"tri",label:"TRI",kind:"cv"},{key:"sqr",label:"SQR",kind:"cv"}], defaults:{ rate:1.2, offset:0, invert:false } },
  { type:"noise", name:"NOISE", brand:"VCV", description:"White and pink noise generator", tags:["Noise","Random"], width:90, panel:"cream", inputs:[], outputs:[{key:"white",label:"WHITE",kind:"audio"},{key:"pink",label:"PINK",kind:"audio"}], defaults:{ level:35 } },
  { type:"mixer", name:"MIX", brand:"VCV", description:"Four-channel audio and CV mixer", tags:["Mixer"], width:150, panel:"cream", inputs:[{key:"in1",label:"1",kind:"audio"},{key:"in2",label:"2",kind:"audio"},{key:"in3",label:"3",kind:"audio"},{key:"in4",label:"4",kind:"audio"}], outputs:[{key:"out",label:"OUT",kind:"audio"}], defaults:{ ch1:80,ch2:80,ch3:80,ch4:80 } },
  { type:"attenuator", name:"8VERT", brand:"VCV", description:"Eight-channel attenuverter and offset generator", tags:["Attenuator","Utility"], width:120, panel:"cream", inputs:[{key:"in",label:"IN",kind:"cv"}], outputs:[{key:"out",label:"OUT",kind:"cv"}], defaults:{ amount:50, offset:0 } },
  { type:"multiple", name:"MULT", brand:"VCV", description:"Passive signal multiple", tags:["Multiple","Utility"], width:75, panel:"cream", inputs:[{key:"in",label:"IN",kind:"audio"}], outputs:[{key:"out1",label:"1",kind:"audio"},{key:"out2",label:"2",kind:"audio"},{key:"out3",label:"3",kind:"audio"}], defaults:{} },
  { type:"sequencer", name:"SEQ-3", brand:"VCV", description:"Three-row, eight-step CV sequencer", tags:["Sequencer","Clock"], width:240, panel:"cream", inputs:[{key:"clock",label:"CLOCK",kind:"gate"},{key:"reset",label:"RESET",kind:"gate"}], outputs:[{key:"cv",label:"ROW 1",kind:"cv"},{key:"gate",label:"GATE",kind:"gate"}], defaults:{ tempo:120, running:false, step:0, values:[0,2,3,5,7,5,3,2] } },
  { type:"delay", name:"DELAY", brand:"VCV", description:"Stereo delay effect", tags:["Delay","Effect"], width:150, panel:"cream", inputs:[{key:"in",label:"IN",kind:"audio"},{key:"timecv",label:"TIME",kind:"cv"}], outputs:[{key:"out",label:"OUT",kind:"audio"}], defaults:{ time:0.28, feedback:32, mix:28 } },
  { type:"scope", name:"SCOPE", brand:"VCV", description:"Two-channel oscilloscope", tags:["Visual","Scope"], width:210, panel:"dark", inputs:[{key:"x",label:"X IN",kind:"audio"},{key:"y",label:"Y IN",kind:"audio"}], outputs:[{key:"thru",label:"THRU",kind:"audio"}], defaults:{ scale:50, time:45 } },
  { type:"audio", name:"AUDIO-2", brand:"Core", description:"Send Rack audio to your browser audio device", tags:["Audio","Output"], width:180, panel:"black", inputs:[{key:"l",label:"1",kind:"audio"},{key:"r",label:"2",kind:"audio"}], outputs:[], defaults:{ driver:"Web Audio", level:74 } },
];
const DEF = Object.fromEntries(MODULES.map((module) => [module.type, module])) as Record<ModuleType, ModuleDef>;

let nextId = 20;
const createModule = (type: ModuleType, x: number, y: number, id = `m${nextId++}`): RackModule => ({ id, type, x, y, params:{...DEF[type].defaults} });

const INITIAL_MODULES: RackModule[] = [
  createModule("midi",80,70,"midi1"), createModule("vco",250,70,"vco1"), createModule("vcf",420,70,"vcf1"),
  createModule("vca",590,70,"vca1"), createModule("adsr",715,70,"adsr1"), createModule("scope",870,70,"scope1"), createModule("audio",1100,70,"audio1"),
];
const INITIAL_CABLES: Cable[] = [
  {id:"c1",from:"midi1:out:pitch",to:"vco1:in:voct",color:CABLE_COLORS[2]},
  {id:"c2",from:"midi1:out:gate",to:"adsr1:in:gate",color:CABLE_COLORS[0]},
  {id:"c3",from:"vco1:out:saw",to:"vcf1:in:in",color:CABLE_COLORS[3]},
  {id:"c4",from:"vcf1:out:lp",to:"vca1:in:in",color:CABLE_COLORS[1]},
  {id:"c5",from:"adsr1:out:env",to:"vca1:in:cv",color:CABLE_COLORS[4]},
  {id:"c6",from:"vca1:out:out",to:"scope1:in:x",color:CABLE_COLORS[5]},
  {id:"c7",from:"scope1:out:thru",to:"audio1:in:l",color:CABLE_COLORS[0]},
  {id:"c8",from:"scope1:out:thru",to:"audio1:in:r",color:CABLE_COLORS[0]},
];

function Knob({label,value,min,max,step=1,onChange,small=false}:{label:string;value:number;min:number;max:number;step?:number;onChange:(v:number)=>void;small?:boolean}) {
  const turn = -135 + ((value-min)/(max-min))*270;
  return <label className={`rack-knob ${small?"small":""}`} title={`${label}: ${Number(value.toFixed(2))}`}>
    <span style={{"--turn":`${turn}deg`} as React.CSSProperties}><i/></span>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(Number(e.target.value))}/>
    <b>{label}</b><em>{value>=100?Math.round(value):Number(value.toFixed(2))}</em>
  </label>;
}

function Port({moduleId,direction,port,pending,onStart}:{moduleId:string;direction:"in"|"out";port:PortDef;pending:string|null;onStart:(id:string,e:React.PointerEvent)=>void}) {
  const id=`${moduleId}:${direction}:${port.key}`;
  return <button type="button" className={`jack jack-${port.kind} ${pending===id?"pending":""}`} data-port-id={id} data-direction={direction} aria-label={`${port.label} ${direction}`} title={`${port.label} ${direction} · ${port.kind}`} onPointerDown={(e)=>onStart(id,e)}>
    <span/><b>{port.label}</b>
  </button>;
}

function ModuleFace({module,onParam,playingStep,activeNote}:{module:RackModule;onParam:(key:string,value:ParamValue)=>void;playingStep:number;activeNote:number|null}) {
  const p=module.params;
  switch(module.type) {
    case "midi": return <div className="face midi-face"><div className="lcd"><b>{activeNote===null?"MIDI":`NOTE ${activeNote}`}</b><span>{String(p.channel)}</span><small>CH 1 · OCT {String(p.octave)}</small></div><div className={`midi-lights ${activeNote!==null?"active":""}`}><i/><i/><i/><i/></div><p>Play with<br/><b>QWERTY / ZXCVB</b></p></div>;
    case "vco": return <div className="face vco-face"><Knob label="FREQUENCY" value={Number(p.frequency)} min={55} max={880} step={1} onChange={(v)=>onParam("frequency",v)}/><div className="two-knobs"><Knob small label="FINE" value={Number(p.fine)} min={-100} max={100} onChange={(v)=>onParam("fine",v)}/><Knob small label="PULSE" value={Number(p.pulse)} min={5} max={95} onChange={(v)=>onParam("pulse",v)}/></div><div className="wave-window">∿ △ ⋰ ⊓</div></div>;
    case "vcf": return <div className="face vcf-face"><Knob label="CUTOFF" value={Number(p.cutoff)} min={80} max={8000} step={10} onChange={(v)=>onParam("cutoff",v)}/><div className="two-knobs"><Knob small label="RESONANCE" value={Number(p.resonance)} min={0} max={18} step={.1} onChange={(v)=>onParam("resonance",v)}/><Knob small label="DRIVE" value={Number(p.drive)} min={0} max={24} step={.5} onChange={(v)=>onParam("drive",v)}/></div><div className="filter-curve"><i/></div></div>;
    case "vca": return <div className="face vca-face"><Knob label="LEVEL" value={Number(p.level)} min={0} max={100} onChange={(v)=>onParam("level",v)}/><div className="response-switch"><button className={p.response==="LIN"?"on":""} onClick={()=>onParam("response","LIN")}>LIN</button><button className={p.response==="EXP"?"on":""} onClick={()=>onParam("response","EXP")}>EXP</button></div><div className="vu"><i/><i/><i/><i/><i/></div></div>;
    case "adsr": return <div className="face adsr-face">{[["ATTACK",.005,1.5,.005],["DECAY",.01,2,.01],["SUSTAIN",0,1,.01],["RELEASE",.02,3,.01]].map(([name,min,max,step])=><Knob key={name as string} small label={name as string} value={Number(p[(name as string).toLowerCase()])} min={min as number} max={max as number} step={step as number} onChange={(v)=>onParam((name as string).toLowerCase(),v)}/>)}</div>;
    case "lfo": return <div className="face lfo-face"><Knob label="FREQUENCY" value={Number(p.rate)} min={.05} max={20} step={.05} onChange={(v)=>onParam("rate",v)}/><div className="lfo-wave"><i/><span>−5V</span><span>+5V</span></div><Knob small label="OFFSET" value={Number(p.offset)} min={-5} max={5} step={.1} onChange={(v)=>onParam("offset",v)}/></div>;
    case "noise": return <div className="face noise-face"><div className="noise-cloud">░▒▓<br/>▓▒░</div><Knob small label="LEVEL" value={Number(p.level)} min={0} max={100} onChange={(v)=>onParam("level",v)}/></div>;
    case "mixer": return <div className="face mixer-face">{[1,2,3,4].map((n)=><Knob small key={n} label={`CH ${n}`} value={Number(p[`ch${n}`])} min={0} max={100} onChange={(v)=>onParam(`ch${n}`,v)}/>)}</div>;
    case "attenuator": return <div className="face atten-face"><Knob label="AMOUNT" value={Number(p.amount)} min={-100} max={100} onChange={(v)=>onParam("amount",v)}/><Knob small label="OFFSET" value={Number(p.offset)} min={-10} max={10} step={.1} onChange={(v)=>onParam("offset",v)}/></div>;
    case "multiple": return <div className="face mult-face"><i/><span>PASSIVE</span><i/><i/><i/></div>;
    case "sequencer": { const values=p.values as number[]; return <div className="face seq-face"><div className="seq-controls"><button className={p.running?"running":""} onClick={()=>onParam("running",!p.running)}>{p.running?"STOP":"RUN"}</button><Knob small label="TEMPO" value={Number(p.tempo)} min={40} max={240} onChange={(v)=>onParam("tempo",v)}/></div><div className="seq-steps">{values.map((value,i)=><label className={playingStep===i?"active":""} key={i}><b>{i+1}</b><input aria-label={`Sequencer step ${i+1}`} type="range" min="0" max="12" value={value} onChange={(e)=>{const next=[...values];next[i]=Number(e.target.value);onParam("values",next)}}/><em>{value}</em></label>)}</div></div>; }
    case "delay": return <div className="face delay-face"><Knob label="TIME" value={Number(p.time)} min={.03} max={1.2} step={.01} onChange={(v)=>onParam("time",v)}/><div className="two-knobs"><Knob small label="FEEDBACK" value={Number(p.feedback)} min={0} max={85} onChange={(v)=>onParam("feedback",v)}/><Knob small label="MIX" value={Number(p.mix)} min={0} max={100} onChange={(v)=>onParam("mix",v)}/></div><div className="delay-taps"><i/><i/><i/><i/></div></div>;
    case "scope": return <div className="face scope-face"><div className="scope-screen"><span className="scope-grid"/><i className="scope-trace"/></div><div className="two-knobs"><Knob small label="SCALE" value={Number(p.scale)} min={1} max={100} onChange={(v)=>onParam("scale",v)}/><Knob small label="TIME" value={Number(p.time)} min={1} max={100} onChange={(v)=>onParam("time",v)}/></div></div>;
    case "audio": return <div className="face audio-face"><div className="audio-screen"><b>{String(p.driver)}</b><span>44.1 kHz</span><span>256 samples</span></div><div className="audio-meter">{Array.from({length:12},(_,i)=><i key={i}/>)}</div><Knob small label="LEVEL" value={Number(p.level)} min={0} max={100} onChange={(v)=>onParam("level",v)}/></div>;
  }
}

export default function SynthStudio() {
  const [modules,setModules]=useState<RackModule[]>(INITIAL_MODULES);
  const [cables,setCables]=useState<Cable[]>(INITIAL_CABLES);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const [browser,setBrowser]=useState<{x:number;y:number;clientX:number;clientY:number}|null>(null);
  const [search,setSearch]=useState("");
  const [tag,setTag]=useState("All");
  const [favorites,setFavorites]=useState<ModuleType[]>(["vco","vcf","adsr"]);
  const [pending,setPending]=useState<string|null>(null);
  const [pointer,setPointer]=useState<{x:number;y:number}|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [context,setContext]=useState<{id:string;x:number;y:number}|null>(null);
  const [menu,setMenu]=useState<"File"|"Edit"|"View"|null>(null);
  const [audioOn,setAudioOn]=useState(false);
  const [status,setStatus]=useState("Template patch loaded");
  const [cableOpacity,setCableOpacity]=useState(.72);
  const [playingStep,setPlayingStep]=useState(-1);
  const [activeNote,setActiveNote]=useState<number|null>(null);
  const rackRef=useRef<HTMLDivElement>(null);
  const cableRef=useRef<HTMLCanvasElement>(null);
  const engineRef=useRef<Engine|null>(null);
  const dragRef=useRef<{id?:string;startX:number;startY:number;originX:number;originY:number;pan?:boolean}|null>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const seqTimerRef=useRef<number|null>(null);
  const modulesStateRef=useRef(modules);
  const cablesStateRef=useRef(cables);
  useEffect(()=>{modulesStateRef.current=modules;cablesStateRef.current=cables},[modules,cables]);

  const topologyKey=useMemo(()=>modules.map(m=>`${m.id}:${m.type}`).join("|")+"/"+cables.map(c=>`${c.from}>${c.to}`).join("|"),[modules,cables]);
  const tags=useMemo(()=>["All","Favorites",...Array.from(new Set(MODULES.flatMap(m=>m.tags)))],[ ]);

  const drawCables=useCallback(()=>{
    const canvas=cableRef.current, rack=rackRef.current;if(!canvas||!rack)return;
    const rect=rack.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);canvas.style.width=`${rect.width}px`;canvas.style.height=`${rect.height}px`;
    const ctx=canvas.getContext("2d");if(!ctx)return;ctx.scale(dpr,dpr);ctx.clearRect(0,0,rect.width,rect.height);ctx.globalAlpha=cableOpacity;ctx.lineCap="round";
    const point=(id:string)=>{const el=rack.querySelector(`[data-port-id="${id}"]`) as HTMLElement|null;if(!el)return null;const r=el.getBoundingClientRect();return{x:r.left+r.width/2-rect.left,y:r.top+r.height/2-rect.top}};
    const curve=(a:{x:number;y:number},b:{x:number;y:number},color:string,live=false)=>{const sag=Math.max(34,Math.abs(b.x-a.x)*.18+Math.abs(b.y-a.y)*.12);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(a.x,a.y+sag,b.x,b.y+sag,b.x,b.y);ctx.strokeStyle="#151515";ctx.lineWidth=live?8:9;ctx.stroke();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(a.x,a.y+sag,b.x,b.y+sag,b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=live?4:5;ctx.stroke();};
    cables.forEach(c=>{const a=point(c.from),b=point(c.to);if(a&&b)curve(a,b,c.color)});
    if(pending&&pointer){const a=point(pending);if(a)curve(a,pointer,"#f2d34e",true)}
  },[cables,pending,pointer,cableOpacity]);

  useEffect(()=>{const id=requestAnimationFrame(drawCables);window.addEventListener("resize",drawCables);return()=>{cancelAnimationFrame(id);window.removeEventListener("resize",drawCables)}},[drawCables,modules,zoom,pan]);

  const closeEngine=useCallback(()=>{if(engineRef.current){void engineRef.current.ctx.close();engineRef.current=null}},[]);

  const buildEngine=useCallback(async()=>{
    closeEngine();
    const rackModules=modulesStateRef.current,rackCables=cablesStateRef.current;
    const AudioCtx=window.AudioContext||(window as typeof window&{webkitAudioContext:typeof AudioContext}).webkitAudioContext;
    const ctx=new AudioCtx();const master=ctx.createGain();master.gain.value=.22;const compressor=ctx.createDynamicsCompressor();master.connect(compressor).connect(ctx.destination);const parts=new Map<string,AudioPart>();
    for(const rackModule of rackModules){const p=rackModule.params;let part:AudioPart={};
      if(rackModule.type==="vco"){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="sawtooth";osc.frequency.value=Number(p.frequency);gain.gain.value=.55;osc.connect(gain);osc.start();part={output:gain,oscillator:osc,params:{frequency:osc.frequency}}}
      else if(rackModule.type==="noise"){const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=Number(p.level)/300;source.connect(gain);source.start();part={output:gain,params:{level:gain.gain}}}
      else if(rackModule.type==="vcf"){const filter=ctx.createBiquadFilter();filter.type="lowpass";filter.frequency.value=Number(p.cutoff);filter.Q.value=Number(p.resonance);part={input:filter,output:filter,params:{cutoff:filter.frequency,resonance:filter.Q}}}
      else if(rackModule.type==="vca"){const gain=ctx.createGain();const modulated=rackCables.some(c=>c.to===`${rackModule.id}:in:cv`);gain.gain.value=modulated?.0001:Number(p.level)/100;part={input:gain,output:gain,params:{level:gain.gain}}}
      else if(rackModule.type==="lfo"){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=Number(p.rate);gain.gain.value=350;osc.connect(gain);osc.start();part={output:gain,oscillator:osc,params:{rate:osc.frequency}}}
      else if(rackModule.type==="delay"){const input=ctx.createGain(),output=ctx.createGain(),dry=ctx.createGain(),wet=ctx.createGain(),delay=ctx.createDelay(2),feedback=ctx.createGain();delay.delayTime.value=Number(p.time);feedback.gain.value=Number(p.feedback)/100;wet.gain.value=Number(p.mix)/100;dry.gain.value=1-Number(p.mix)/100;input.connect(dry).connect(output);input.connect(delay).connect(wet).connect(output);delay.connect(feedback).connect(delay);part={input,output,params:{time:delay.delayTime,feedback:feedback.gain,mix:wet.gain,dry:dry.gain}}}
      else if(rackModule.type==="audio"){const input=ctx.createGain();input.gain.value=Number(p.level)/100;input.connect(master);part={input,params:{level:input.gain}}}
      else if(["mixer","attenuator","multiple","scope"].includes(rackModule.type)){const gain=ctx.createGain();if(rackModule.type==="attenuator")gain.gain.value=Number(p.amount)/100;part={input:gain,output:gain,params:{amount:gain.gain}}}
      parts.set(rackModule.id,part);
    }
    for(const cable of rackCables){const [fromId,,fromKey]=cable.from.split(":"),[toId,,toKey]=cable.to.split(":");const source=parts.get(fromId),target=parts.get(toId);if(!source?.output||!target)continue;
      if(toKey==="freq"&&target.params?.cutoff)source.output.connect(target.params.cutoff);else if(["voct","cv","gate","retrig","clock","reset","timecv"].includes(toKey)){}else if(target.input)source.output.connect(target.input);
      void fromKey;
    }
    engineRef.current={ctx,parts,master};await ctx.resume();setAudioOn(true);setStatus("Audio engine running");
  },[closeEngine]);

  useEffect(()=>{if(!audioOn)return;const timer=window.setTimeout(()=>void buildEngine(),0);return()=>window.clearTimeout(timer)},[topologyKey,audioOn,buildEngine]);
  useEffect(()=>()=>{closeEngine();if(seqTimerRef.current)clearInterval(seqTimerRef.current)},[closeEngine]);

  const updateParam=(id:string,key:string,value:ParamValue)=>{
    setModules(current=>current.map(m=>m.id===id?{...m,params:{...m.params,[key]:value}}:m));
    if(key==="running"&&value===false)setPlayingStep(-1);
    const part=engineRef.current?.parts.get(id);const now=engineRef.current?.ctx.currentTime??0;
    if(typeof value==="number"&&part?.params?.[key])part.params[key].setTargetAtTime(key==="level"?value/100:value,now,.02);
  };

  const triggerNote=useCallback((midi:number,on:boolean)=>{
    setActiveNote(on?midi:null);
    const engine=engineRef.current;if(!engine)return;const now=engine.ctx.currentTime,freq=440*Math.pow(2,(midi-69)/12);
    cables.filter(c=>c.from.endsWith(":out:pitch")&&c.to.endsWith(":in:voct")).forEach(c=>engine.parts.get(c.to.split(":")[0])?.oscillator?.frequency.setTargetAtTime(freq,now,.008));
    const envelopeLinks=cables.filter(c=>c.from.endsWith(":out:env")&&c.to.endsWith(":in:cv"));
    envelopeLinks.forEach(link=>{const adsr=modules.find(m=>m.id===link.from.split(":")[0]),vca=engine.parts.get(link.to.split(":")[0]);const gain=vca?.params?.level;if(!adsr||!gain)return;gain.cancelScheduledValues(now);if(on){gain.setValueAtTime(Math.max(.0001,gain.value),now);gain.exponentialRampToValueAtTime(1,now+Math.max(.006,Number(adsr.params.attack)));gain.exponentialRampToValueAtTime(Math.max(.0001,Number(adsr.params.sustain)),now+Number(adsr.params.attack)+Number(adsr.params.decay));}else{gain.setValueAtTime(Math.max(.0001,gain.value),now);gain.exponentialRampToValueAtTime(.0001,now+Number(adsr.params.release));}});
  },[cables,modules]);

  useEffect(()=>{const map:Record<string,number>={z:48,s:49,x:50,d:51,c:52,v:53,g:54,b:55,h:56,n:57,j:58,m:59,q:60,"2":61,w:62,"3":63,e:64,r:65,"5":66,t:67,"6":68,y:69,"7":70,u:71};const down=(e:KeyboardEvent)=>{if((e.target as HTMLElement).matches("input,textarea"))return;if(e.key==="Escape"&&pending){setPending(null);setPointer(null);return}if((e.ctrlKey||e.metaKey)&&["-","=","0"].includes(e.key)){e.preventDefault();setZoom(e.key==="0"?1:z=>Math.min(2.4,Math.max(.35,z+(e.key==="="?.1:-.1))));return}if(e.key==="Enter"&&!browser){const rect=rackRef.current?.getBoundingClientRect();if(rect)setBrowser({x:(rect.width/2-pan.x)/zoom,y:(rect.height/2-pan.y)/zoom,clientX:rect.width/2,clientY:rect.height/2});}if((e.key==="Delete"||e.key==="Backspace")&&selected){setModules(ms=>ms.filter(m=>m.id!==selected));setCables(cs=>cs.filter(c=>!c.from.startsWith(`${selected}:`)&&!c.to.startsWith(`${selected}:`)));setSelected(null)}const note=map[e.key.toLowerCase()];if(note&&!e.repeat){void (audioOn?Promise.resolve():buildEngine()).then(()=>triggerNote(note,true))}};const up=(e:KeyboardEvent)=>{const note=map[e.key.toLowerCase()];if(note)triggerNote(note,false)};window.addEventListener("keydown",down);window.addEventListener("keyup",up);return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)}},[audioOn,browser,buildEngine,pan,pending,selected,triggerNote,zoom]);

  useEffect(()=>{const seq=modules.find(m=>m.type==="sequencer"&&m.params.running);if(seq){if(seqTimerRef.current)clearInterval(seqTimerRef.current);seqTimerRef.current=window.setInterval(()=>{setPlayingStep(step=>{const next=(step+1)%8;const value=(seq.params.values as number[])[next];triggerNote(48+value,true);window.setTimeout(()=>triggerNote(48+value,false),80);return next})},60000/Number(seq.params.tempo)/2)}else{if(seqTimerRef.current)clearInterval(seqTimerRef.current);seqTimerRef.current=null}return()=>{if(seqTimerRef.current)clearInterval(seqTimerRef.current)}},[modules,triggerNote]);

  const startPort=(id:string,e:React.PointerEvent)=>{e.stopPropagation();const direction=(e.currentTarget as HTMLElement).dataset.direction;if(!pending){if(direction==="in"){const existing=cables.find(c=>c.to===id);if(existing){setCables(cs=>cs.filter(c=>c.id!==existing.id));setPending(existing.from)}else setPending(id)}else setPending(id)}setPointer({x:e.clientX-(rackRef.current?.getBoundingClientRect().left??0),y:e.clientY-(rackRef.current?.getBoundingClientRect().top??0)});};
  const finishCable=(a:string,b:string)=>{const aOut=a.includes(":out:"),bOut=b.includes(":out:");if(aOut===bOut){setPending(null);setPointer(null);return}const from=aOut?a:b,to=aOut?b:a;setCables(cs=>[...cs.filter(c=>c.to!==to),{id:`c${Date.now()}`,from,to,color:CABLE_COLORS[cs.length%CABLE_COLORS.length]}]);setPending(null);setPointer(null);setStatus("Cable connected")};
  const rackPointerMove=(e:React.PointerEvent)=>{const rect=rackRef.current?.getBoundingClientRect();if(pending&&rect)setPointer({x:e.clientX-rect.left,y:e.clientY-rect.top});const drag=dragRef.current;if(!drag)return;if(drag.pan)setPan({x:drag.originX+e.clientX-drag.startX,y:drag.originY+e.clientY-drag.startY});else if(drag.id)setModules(ms=>ms.map(m=>m.id===drag.id?{...m,x:Math.round((drag.originX+(e.clientX-drag.startX)/zoom)/15)*15,y:Math.max(20,Math.round((drag.originY+(e.clientY-drag.startY)/zoom)/20)*20)}:m))};
  const pointerUp=(e:React.PointerEvent)=>{if(pending){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-port-id]") as HTMLElement|null;if(target&&target.dataset.portId!==pending)finishCable(pending,target.dataset.portId!);else if(!target){setPending(null);setPointer(null)}}dragRef.current=null};
  const openBrowser=(e:React.MouseEvent)=>{if((e.target as HTMLElement).closest(".rack-module,.rack-menu,.module-browser"))return;e.preventDefault();const rect=rackRef.current!.getBoundingClientRect();setBrowser({x:(e.clientX-rect.left-pan.x)/zoom,y:(e.clientY-rect.top-pan.y)/zoom,clientX:e.clientX-rect.left,clientY:e.clientY-rect.top});setSearch("");setTag("All");setContext(null)};
  const addModule=(type:ModuleType)=>{if(!browser)return;setModules(ms=>[...ms,createModule(type,Math.max(10,browser.x-DEF[type].width/2),Math.max(20,browser.y-30))]);setBrowser(null);setStatus(`${DEF[type].name} added`)};
  const deleteModule=(id:string)=>{setModules(ms=>ms.filter(m=>m.id!==id));setCables(cs=>cs.filter(c=>!c.from.startsWith(`${id}:`)&&!c.to.startsWith(`${id}:`)));setContext(null);setSelected(null)};
  const savePatch=()=>{localStorage.setItem("web-rack-patch",JSON.stringify({modules,cables,zoom,pan}));setStatus("Patch saved")};
  const loadSaved=()=>{const raw=localStorage.getItem("web-rack-patch");if(!raw){setStatus("No saved patch");return}try{const patch=JSON.parse(raw);setModules(patch.modules);setCables(patch.cables);setZoom(patch.zoom??1);setPan(patch.pan??{x:0,y:0});setStatus("Patch loaded")}catch{setStatus("Could not load patch")}};
  const downloadPatch=()=>{const blob=new Blob([JSON.stringify({version:1,modules,cables},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="web-rack-patch.json";a.click();URL.revokeObjectURL(url);setStatus("Patch downloaded")};
  const openPatch=(file:File)=>{const reader=new FileReader();reader.onload=()=>{try{const patch=JSON.parse(String(reader.result));setModules(patch.modules);setCables(patch.cables);setStatus("Patch opened")}catch{setStatus("Invalid patch file")}};reader.readAsText(file)};
  const filtered=MODULES.filter(m=>(tag==="All"||tag==="Favorites"&&favorites.includes(m.type)||m.tags.includes(tag))&&`${m.brand} ${m.name} ${m.description} ${m.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase()));

  return <main className="rack-app">
    <header className="rack-topbar">
      <div className="rack-logo"><span>VCV</span><b>RACK</b></div>
      {(["File","Edit","View"] as const).map(name=><div className="menu-wrap" key={name}><button className={menu===name?"active":""} onClick={()=>setMenu(menu===name?null:name)}>{name}</button>{menu===name&&<div className="rack-menu">
        {name==="File"&&<><button onClick={()=>{setModules(INITIAL_MODULES);setCables(INITIAL_CABLES);setMenu(null)}}>New <kbd>⌘N</kbd></button><button onClick={()=>fileRef.current?.click()}>Open… <kbd>⌘O</kbd></button><button onClick={savePatch}>Save <kbd>⌘S</kbd></button><button onClick={downloadPatch}>Save as…</button><hr/><button onClick={loadSaved}>Revert to saved</button></>}
        {name==="Edit"&&<><button onClick={()=>{setCables([]);setMenu(null)}}>Clear cables</button><button onClick={()=>{setModules([]);setCables([]);setMenu(null)}}>Clear patch</button><hr/><button disabled>Undo <kbd>⌘Z</kbd></button><button disabled>Redo <kbd>⇧⌘Z</kbd></button></>}
        {name==="View"&&<><label>Zoom <input type="range" min=".35" max="2.4" step=".05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><em>{Math.round(zoom*100)}%</em></label><label>Cable opacity <input type="range" min=".15" max="1" step=".05" value={cableOpacity} onChange={e=>setCableOpacity(Number(e.target.value))}/></label><button onClick={()=>{setZoom(1);setPan({x:0,y:0});setMenu(null)}}>Reset view <kbd>⌘0</kbd></button></>}
      </div>}</div>)}
      <button className="library-button" onClick={()=>{const rect=rackRef.current?.getBoundingClientRect();if(rect)setBrowser({x:(rect.width/2-pan.x)/zoom,y:(rect.height/2-pan.y)/zoom,clientX:rect.width/2,clientY:90})}}>＋ Add module</button>
      <div className="top-spacer"/><span className="engine-status"><i className={audioOn?"on":""}/>{status}</span><button className={`power ${audioOn?"on":""}`} onClick={()=>audioOn?(closeEngine(),setAudioOn(false),setStatus("Audio engine stopped")):void buildEngine()}>{audioOn?"ENGINE ON":"START ENGINE"}</button><div className="cpu"><span>CPU</span><i/><i/><i/><i/><i/></div>
    </header>
    <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e=>e.target.files?.[0]&&openPatch(e.target.files[0])}/>
    <section ref={rackRef} className={`rack-viewport ${pending?"cabling":""}`} role="application" aria-label="Web Rack modular patching workspace" tabIndex={0} onContextMenu={openBrowser} onPointerMove={rackPointerMove} onPointerUp={pointerUp} onPointerLeave={()=>{if(dragRef.current?.pan)dragRef.current=null}} onWheel={e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();setZoom(z=>Math.min(2.4,Math.max(.35,z-e.deltaY*.001)))}else setPan(p=>({x:p.x-e.deltaX-(e.shiftKey?e.deltaY:0),y:p.y-(e.shiftKey?0:e.deltaY)}))}} onPointerDown={e=>{if(e.button===1||(e.button===0&&(e.target as HTMLElement)===rackRef.current)){dragRef.current={pan:true,startX:e.clientX,startY:e.clientY,originX:pan.x,originY:pan.y};setSelected(null);setContext(null)}}}>
      <div className="rack-world" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>
        {modules.map(module=>{const def=DEF[module.type];return <article key={module.id} className={`rack-module panel-${def.panel} ${selected===module.id?"selected":""}`} aria-label={`${def.brand} ${def.name} module`} tabIndex={0} data-module-id={module.id} style={{left:module.x,top:module.y,width:def.width}} onFocus={()=>setSelected(module.id)} onPointerDown={()=>setSelected(module.id)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setContext({id:module.id,x:e.clientX,y:e.clientY})}}>
          <div className="module-screw tl"/><div className="module-screw tr"/>
          <header onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();dragRef.current={id:module.id,startX:e.clientX,startY:e.clientY,originX:module.x,originY:module.y};setSelected(module.id)}}><span>{def.brand}</span><b>{def.name}</b><button aria-label={`${def.name} menu`} onClick={e=>{e.stopPropagation();const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setContext({id:module.id,x:r.right,y:r.bottom})}}>⋮</button></header>
          <ModuleFace module={module} activeNote={activeNote} playingStep={module.type==="sequencer"?playingStep:-1} onParam={(key,value)=>updateParam(module.id,key,value)}/>
          <div className="ports-area"><div className="port-group inputs">{def.inputs.map(port=><Port key={port.key} moduleId={module.id} direction="in" port={port} pending={pending} onStart={startPort}/>)}</div><div className="port-group outputs">{def.outputs.map(port=><Port key={port.key} moduleId={module.id} direction="out" port={port} pending={pending} onStart={startPort}/>)}</div></div>
          <div className="module-screw bl"/><div className="module-screw br"/>
        </article>})}
      </div>
      <canvas ref={cableRef} className="cable-layer"/>
      <div className="rack-help"><b>Right-click or Enter</b> to add modules · drag ports to patch · QWERTY / ZXCVB to play · middle-drag to pan</div>
      <div className="zoom-widget"><button onClick={()=>setZoom(z=>Math.max(.35,z-.1))}>−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.min(2.4,z+.1))}>＋</button></div>
    </section>

    {browser&&<div className="browser-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)setBrowser(null)}}><section className="module-browser" role="dialog" aria-modal="true" aria-label="Module Browser" style={{left:Math.min(browser.clientX,window.innerWidth-830),top:Math.min(browser.clientY,window.innerHeight-590)}}>
      <header><b>Module Browser</b><span>{filtered.length} modules</span><button onClick={()=>setBrowser(null)}>×</button></header>
      <div className="browser-search"><span>⌕</span><input autoFocus aria-label="Search modules" placeholder="Search modules" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Escape")setBrowser(null);if(e.key==="Enter"&&filtered.length===1)addModule(filtered[0].type)}}/><kbd>esc</kbd></div>
      <div className="browser-body">
        <nav>{tags.map(item=><button key={item} className={tag===item?"active":""} onClick={()=>setTag(item)}>{item}{item==="Favorites"&&<em>{favorites.length}</em>}</button>)}</nav>
        <div className="module-grid">{filtered.map(module=><article className="module-card" key={module.type}>
          <button className="module-card-main" aria-label={`Add ${module.name}`} onClick={()=>addModule(module.type)}>
            <span className={`mini-panel panel-${module.panel}`}><i/><b>{module.name}</b><em>{module.brand}</em><strong>{module.inputs.length+module.outputs.length}</strong></span>
            <span className="module-card-copy"><b>{module.name}</b><span>{module.brand}</span><p>{module.description}</p></span>
          </button>
          <button className={favorites.includes(module.type)?"fav on":"fav"} aria-label={`${favorites.includes(module.type)?"Remove":"Add"} ${module.name} ${favorites.includes(module.type)?"from":"to"} favorites`} onClick={()=>setFavorites(fs=>fs.includes(module.type)?fs.filter(f=>f!==module.type):[...fs,module.type])}>★</button>
        </article>)}</div>
      </div>
      <footer>Click a module to add it at the cursor</footer>
    </section></div>}
    {context&&<div className="module-context" style={{left:context.x,top:context.y}}><b>{DEF[modules.find(m=>m.id===context.id)?.type??"vco"].name}</b><button onClick={()=>{const source=modules.find(m=>m.id===context.id);if(source)setModules(ms=>[...ms,createModule(source.type,source.x+30,source.y+30)]);setContext(null)}}>Duplicate <kbd>⌘D</kbd></button><button onClick={()=>{setCables(cs=>cs.filter(c=>!c.from.startsWith(`${context.id}:`)&&!c.to.startsWith(`${context.id}:`)));setContext(null)}}>Disconnect cables</button><hr/><button className="danger" onClick={()=>deleteModule(context.id)}>Delete</button></div>}
  </main>;
}
