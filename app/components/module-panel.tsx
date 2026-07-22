"use client";

import { useState, type CSSProperties, type DragEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import type { ModuleInstance } from "../../lib/patch-types";
import { resolvedModulePortPosition } from "../../lib/patch-operations";
import type { ParamSpec, PortSpec, RackWidgetPosition, WebPluginModule } from "../../lib/web-plugin-registry";
import { STROKE_SPECIAL_MODES, strokeSpecialModeLabel } from "../../lib/stroke-host";
import { RackScopeDisplay } from "./rack-scope-display";
import { RackParamVisual } from "./rack-param-visual";
import { RackSegmentDisplay } from "./rack-segment-display";
import { RackLightVisual } from "./rack-light-visual";
import { RackAudioDisplay } from "./rack-audio-display";

type PortClick = { moduleId: string; direction: "in" | "out"; portId: number };

function rackKeyFromEvent(event: KeyboardEvent) {
  if (event.key.length === 1) return event.key.toUpperCase().charCodeAt(0);
  const named: Record<string, number> = {Escape:256,Enter:257,Tab:258,Backspace:259,Insert:260,Delete:261,ArrowRight:262,ArrowLeft:263,ArrowDown:264,ArrowUp:265,PageUp:266,PageDown:267,Home:268,End:269,PrintScreen:283,Pause:284};
  if (event.key in named) return named[event.key];
  const functionKey=/^F([1-9]|1\d|2[0-5])$/.exec(event.key);return functionKey?289+Number(functionKey[1]):-1;
}

function rackModifiersFromEvent(event: KeyboardEvent) {return (event.shiftKey?1:0)|(event.ctrlKey?2:0)|(event.altKey?4:0)|(event.metaKey?8:0);}
function strokeKeyLabel(key:number,mods:number){if(key<0)return"Map key";const modifier=[mods&8?"⌘":"",mods&2?"Ctrl+":"",mods&4?"Alt+":"",mods&1?"Shift+":""].join(""),named:Record<number,string>={256:"Esc",257:"Enter",258:"Tab",259:"Backspace",260:"Insert",261:"Delete",262:"→",263:"←",264:"↓",265:"↑",266:"Page Up",267:"Page Down",268:"Home",269:"End",283:"Print",284:"Pause"},label=named[key]??(key>=290&&key<=314?`F${key-289}`:String.fromCharCode(key));return `${modifier}${label}`;}

async function boundedResponse(response:Response,maxBytes=16*1024*1024,maxMilliseconds=12_000){
  if(!response.ok)throw new Error(`Audio URL returned HTTP ${response.status}`);
  if(!response.body)return new Uint8Array(await response.arrayBuffer());
  const reader=response.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]=[],deadline=Date.now()+maxMilliseconds;
  let length=0;
  while(length<maxBytes&&Date.now()<deadline){
    const remaining=Math.max(1,deadline-Date.now()),result=await Promise.race([
      reader.read(),
      new Promise<null>((resolve)=>window.setTimeout(()=>resolve(null),remaining)),
    ]);
    if(!result||result.done)break;
    const room=maxBytes-length,chunk=result.value.byteLength>room?result.value.slice(0,room):result.value;
    chunks.push(chunk as Uint8Array<ArrayBuffer>);length+=chunk.byteLength;
  }
  await reader.cancel().catch(()=>undefined);
  if(!length)throw new Error("The audio URL returned no decodable data");
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return bytes;
}

function playlistEntry(text:string,base:string){
  const pls=[...text.matchAll(/^File\d+\s*=\s*(.+)$/gim)].map(match=>match[1].trim()),
    m3u=text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith("#")),
    entry=(pls[0]??m3u[0]);
  if(!entry)throw new Error("The playlist contains no audio URL");
  return new URL(entry,base).href;
}

async function audioFileFromUrl(value:string){
  let url=new URL(value).href;
  for(let pass=0;pass<2;pass++){
    const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),8_000);
    let response:Response;
    try{response=await fetch(url,{signal:controller.signal,headers:{Range:"bytes=0-16777215"}});}
    finally{window.clearTimeout(timeout);}
    const contentType=(response.headers.get("content-type")??"").split(";")[0].toLowerCase(),
      pathname=new URL(response.url||url).pathname,
      isPlaylist=/\.(?:m3u8?|pls)$/i.test(pathname)||contentType.includes("mpegurl")||contentType.includes("scpls"),
      bytes=await boundedResponse(response,isPlaylist?512*1024:16*1024*1024,isPlaylist?4_000:12_000);
    if(isPlaylist){url=playlistEntry(new TextDecoder().decode(bytes),response.url||url);continue;}
    const name=decodeURIComponent(pathname.split("/").filter(Boolean).at(-1)??"internet-radio.mp3");
    return new File([bytes],name,{type:contentType.startsWith("audio/")?contentType:"audio/mpeg"});
  }
  throw new Error("Nested playlists are not supported");
}

function audioBoundaryLightValues(channels:2|8|16,count:number,running:boolean,inputLevels:Record<number,number>){
  const values=Array.from({length:count},()=>0);
  if(channels>2){if(running)values[0]=1;return values;}
  const thresholds=[0,-6,-12,-24,-36,-48];
  for(let channel=0;channel<2;channel++){
    const db=20*Math.log10(Math.max(1e-9,(inputLevels[channel]??0)/10));
    for(let band=0;band<6;band++)values[channel*6+band]=db>=thresholds[band]?1:0;
  }
  return values;
}

export function ModulePanel({
  module,
  definition,
  selected,
  pending,
  onSelect,
  onContextMenu,
  onDragStart,
  onModuleHover,
  onFocus,
  onParam,
  onMomentary,
  onParamHover,
  onState,
  onData,
  onPolyphony,
  midiDevices,
  onMidiDevice,
  onBypass,
  onPort,
  onPortDragStart,
  onPortDrop,
  onPortDragEnd,
  onClock,
  onSample,
  recording,
  onCapture,
  onRemove,
  onReplaceDrop,
  inputSignalLevels,
  outputSignalLevels,
  scopeSamples,
  lightValues,
  audioRunning,
}: {
  module: ModuleInstance;
  definition?: WebPluginModule;
  selected: boolean;
  pending: PortClick | null;
  onSelect: (event: PointerEvent<HTMLElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onDragStart: (event: PointerEvent<HTMLElement>) => void;
  onModuleHover: (hovered: boolean) => void;
  onFocus: () => void;
  onParam: (id: number, value: number) => void;
  onMomentary: (id: number, active: boolean) => void;
  onParamHover: (id: number | null) => void;
  onState: (updates: Array<[id: number, value: number]>) => void;
  onData: (data: Record<string, unknown>) => void;
  onPolyphony: (channels: number) => void;
  midiDevices: { inputs: string[]; outputs: string[] };
  onMidiDevice: (deviceName: string) => void;
  onBypass: () => void;
  onPort: (port: PortClick) => void;
  onPortDragStart: (port: PortClick) => void;
  onPortDrop: (from: PortClick, to: PortClick) => void;
  onPortDragEnd: () => void;
  onClock: () => void;
  onSample: (file: File, slot?: number) => void;
  recording: boolean;
  onCapture: () => void;
  onRemove: () => void;
  onReplaceDrop: (key: string) => void;
  inputSignalLevels: Record<number, number>;
  outputSignalLevels: Record<number, number>;
  scopeSamples?: number[][];
  lightValues?: number[];
  audioRunning: boolean;
}) {
  const [dropTarget, setDropTarget] = useState(false);
  const inputs: PortSpec[] =
    definition?.inputs.filter((port)=>!port.hidden) ??
    Array.from({ length: 2 }, (_, id) => ({
      id,
      name: `IN ${id + 1}`,
      kind: "cv" as const,
    }));
  const outputs: PortSpec[] =
    definition?.outputs.filter((port)=>!port.hidden) ??
    Array.from({ length: 2 }, (_, id) => ({
      id,
      name: `OUT ${id + 1}`,
      kind: "cv" as const,
    }));
  const params: ParamSpec[] =
    definition?.params.filter((param)=>!param.hidden) ??
    module.params.map((value, id) => ({
      id,
      name: `PARAM ${id + 1}`,
      min: Math.min(-1, value),
      max: Math.max(1, value),
      default: value,
    }));
  const rackData =
      module.rack?.data && typeof module.rack.data === "object"
        ? (module.rack.data as Record<string, unknown>)
        : {},
    midiData =
      rackData.midi &&
      typeof rackData.midi === "object" &&
      !Array.isArray(rackData.midi)
        ? (rackData.midi as Record<string, unknown>)
        : {},
    midiDeviceName = String(midiData.deviceName || ""),
    midiOptions = definition?.runtime?.midi?.input
      ? midiDevices.inputs
      : midiDevices.outputs;
  const [assetUrl,setAssetUrl]=useState(typeof rackData.url==="string"?rackData.url:""),
    [urlStatus,setUrlStatus]=useState("");
  const audioData=rackData.audio&&typeof rackData.audio==="object"&&!Array.isArray(rackData.audio)?rackData.audio as Record<string,unknown>:undefined,
    audioChannels=definition?.runtime?.audio?.channels,
    renderedLightValues=lightValues??(audioChannels?audioBoundaryLightValues(audioChannels,definition?.lights??0,audioRunning,inputSignalLevels):[]);
  const panelStyle = {
    left: module.x,
    top: module.y,
    width: module.width,
    "--panel-image": module.screenshotUrl
      ? `url(${module.screenshotUrl})`
      : "none",
  } as CSSProperties;
  const sourcePorts=[...inputs,...outputs],positionedParams=params.filter(param=>param.position),hasParamSourceLayout=Boolean(definition&&positionedParams.length&&!definition.runtime?.midi),panelParams=hasParamSourceLayout?positionedParams:params,hasPortSourceLayout=Boolean(definition&&sourcePorts.length&&sourcePorts.every(port=>port.position)),hasSourceLayout=hasParamSourceLayout||hasPortSourceLayout,hasPanelArtwork=Boolean(module.screenshotUrl),
    assetSlots=definition?.runtime?.asset?.slots??1,
    assetSlotParam=assetSlots>1?definition?.params.find(param=>param.name.toLowerCase()==="channel"):undefined,
    assetSlot=Math.max(0,Math.min(assetSlots-1,Math.round(assetSlotParam?module.params[assetSlotParam.id]??0:0))),
    selectedAsset=module.assets?.[assetSlot]??(assetSlot===0?module.asset:undefined);
  const rackWidgetStyle=(position?:RackWidgetPosition)=>position&&definition?{
    left:`${position.x/module.width*100}%`,
    top:`${position.y/380*100}%`,
    ...(position.width?{width:`${position.width/definition.width*100}%`}:{}),
    ...(position.height?{height:`${position.height/380*100}%`}:{}),
    ...(position.centered?{transform:"translate(-50%, -50%)"}:{}),
  } as CSSProperties:undefined;
  const rackPortStyle=(port:PortSpec,direction:"in"|"out")=>{
    const position=resolvedModulePortPosition(module,direction,port.id,direction==="in"?inputs:outputs,definition?.width??module.width);
    return {left:position.x-module.x,top:position.y-module.y,transform:"translate(-50%, -50%)"} as CSSProperties;
  };
  const startPortDrag = (
    event: DragEvent<HTMLButtonElement>,
    port: PortClick,
  ) => {
    event.stopPropagation();
    event.dataTransfer.setData(
      "application/x-patchwork-port",
      JSON.stringify(port),
    );
    event.dataTransfer.effectAllowed = "link";
    onPortDragStart(port);
  };
  const dropPort = (
    event: DragEvent<HTMLButtonElement>,
    to: PortClick,
  ) => {
    const encoded = event.dataTransfer.getData(
      "application/x-patchwork-port",
    );
    if (!encoded) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      const from = JSON.parse(encoded) as PortClick;
      onPortDrop(from, to);
    } catch {
      onPortDragEnd();
    }
  };
  const allowPortDrop = (event: DragEvent<HTMLButtonElement>) => {
    if (!event.dataTransfer.types.includes("application/x-patchwork-port"))
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "link";
  };
  const loadAssetUrl=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();event.stopPropagation();
    try{
      const normalized=new URL(assetUrl.trim());
      if(!["http:","https:"].includes(normalized.protocol))throw new Error("Use an HTTP or HTTPS audio URL");
      onData({url:normalized.href});setUrlStatus("FETCHING…");
      const file=await audioFileFromUrl(normalized.href);
      setUrlStatus("DECODING…");onSample(file,assetSlot);
    }catch(error){setUrlStatus(error instanceof Error?error.message:"Audio URL could not be loaded");}
  };
  return (
    <article
      className={`pw-module ${selected ? "selected" : ""} ${dropTarget ? "drop-target" : ""} ${module.bypassed ? "bypassed" : ""} ${hasSourceLayout ? "has-source-layout" : ""} ${hasPanelArtwork ? "has-panel-artwork" : ""} status-${module.status}`}
      style={panelStyle}
      aria-label={`${module.plugin} ${module.model} module`}
      onPointerDown={onSelect}
      onContextMenu={onContextMenu}
      onPointerEnter={() => onModuleHover(true)}
      onPointerLeave={() => onModuleHover(false)}
      onDragOver={(event: DragEvent<HTMLElement>) => {
        const moduleReplacement = event.dataTransfer.types.includes(
            "application/x-patchwork-module",
          ),
          audioFile =
            Boolean(definition?.runtime?.asset) &&
            event.dataTransfer.types.includes("Files");
        if (!moduleReplacement && !audioFile) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropTarget(true);
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(event: DragEvent<HTMLElement>) => {
        const key = event.dataTransfer.getData(
          "application/x-patchwork-module",
        );
        if (key) {
          event.preventDefault();
          event.stopPropagation();
          setDropTarget(false);
          onReplaceDrop(key);
          return;
        }
        const sample = event.dataTransfer.files[0];
        if (definition?.runtime?.asset && sample) {
          event.preventDefault();
          event.stopPropagation();
          setDropTarget(false);
          onSample(sample, assetSlot);
        }
      }}
    >
      <header onPointerDown={onDragStart} onDoubleClick={onFocus}>
        <span>{module.plugin}</span>
        <b>{module.model}</b>
        <button
          type="button"
          className="pw-bypass"
          aria-label={`${module.bypassed ? "Enable" : "Bypass"} ${module.model}`}
          title={module.bypassed ? "Enable module" : "Bypass module"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onBypass}
        >
          ⏻
        </button>
        <button
          type="button"
          aria-label={`Remove ${module.model}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onRemove}
        >
          ×
        </button>
      </header>
      {module.screenshotUrl ? (
        <>
          {/* The official Library raster is the canonical fully assembled module. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pw-module-image"
            src={module.screenshotUrl}
            alt=""
            draggable={false}
          />
        </>
      ) : (
        <div className="pw-module-image" aria-hidden="true" />
      )}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="scope").map((visual,index)=>(
        <RackScopeDisplay key={`scope-${index}`}
          x={scopeSamples?.[0]}
          y={scopeSamples?.[1]}
          lissajous={(module.params[5] ?? 0) > .5}
          gainX={module.params[0] ?? 0}
          gainY={module.params[2] ?? 0}
          offsetX={module.params[1] ?? 0}
          offsetY={module.params[3] ?? 0}
          threshold={module.params[6] ?? 0}
          triggerEnabled={(module.params[7] ?? 1) < .5}
          width={visual.width*module.width/definition.width}
          height={visual.height}
          left={visual.x*module.width/definition.width}
          top={visual.y}
        />
      ))}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="segment").map((visual,index)=><RackSegmentDisplay key={`segment-${index}`} value={module.params[visual.param]??0} values={visual.values} x={visual.x} y={visual.y} width={visual.width} height={visual.height} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="audio-display").map((visual,index)=><RackAudioDisplay key={`audio-display-${index}`} audio={audioData} running={audioRunning} channels={visual.channels} x={visual.x} y={visual.y} width={visual.width} height={visual.height} scaleX={module.width/definition.width}/>)}
      {definition?.lightWidgets?.map((light)=><RackLightVisual key={`light-${light.id}`} light={light} values={renderedLightValues} moduleWidth={module.width} sourceWidth={module.width} param={light.paramId===undefined?undefined:definition.params.find(param=>param.id===light.paramId)} paramValue={light.paramId===undefined?undefined:module.params[light.paramId]}/>)}
      {hasParamSourceLayout&&definition&&panelParams.map(param=><RackParamVisual key={`visual-${param.id}`} param={param} value={module.params[param.id]??param.default} moduleWidth={module.width} sourceWidth={module.width}/>)}
      <div className="pw-module-state">
        <i />
        <span>
          {module.status === "ready"
            ? "WASM READY"
            : module.status === "resolving"
              ? "RESOLVING"
              : module.status === "source-required"
                ? "SOURCE BUILD NEEDED"
                : "LOAD ERROR"}
        </span>
      </div>
      {module.status === "ready" ? (
        <div className={`pw-controls ${hasParamSourceLayout?"source-layout":""}`}>
          {module.key === "Core/Notes" ? (
            <textarea
              className="pw-notes-editor"
              aria-label="Notes text"
              value={String(
                module.rack?.data && typeof module.rack.data === "object"
                  ? (module.rack.data as Record<string, unknown>).text ?? ""
                  : "",
              )}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => onData({ text: event.target.value })}
            />
          ) : panelParams.map((param) => (
            <label
              key={param.id}
              className={param.position?.control === "selector" ? "rack-selector" : undefined}
              title={`${param.name}: ${module.params[param.id] ?? param.default}`}
              style={hasParamSourceLayout?rackWidgetStyle(param.position):undefined}
            >
              <span>{param.name}</span>
              {"button" in param && param.button ? (
                <button
                  type="button"
                  className="pw-param-button"
                  aria-label={`${module.model} ${param.name}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onParamHover(param.id);
                    onMomentary(param.id, true);
                  }}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    onMomentary(param.id, false);
                  }}
                  onPointerCancel={() => onMomentary(param.id, false)}
                  onKeyDown={(event) => {
                    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                      event.preventDefault();
                      onMomentary(param.id, true);
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      onMomentary(param.id, false);
                    }
                  }}
                  onBlur={() => {
                    onParamHover(null);
                    onMomentary(param.id, false);
                  }}
                >
                  {param.name}
                </button>
              ) : (
                <input
                  aria-label={`${module.model} ${param.name}`}
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={"snap" in param && param.snap ? 1 : "any"}
                  value={module.params[param.id] ?? param.default}
                  onPointerEnter={() => onParamHover(param.id)}
                  onPointerLeave={() => onParamHover(null)}
                  onFocus={() => onParamHover(param.id)}
                  onBlur={() => onParamHover(null)}
                  onKeyDown={(event) => {
                    if ("snap" in param && param.snap) return;
                    const current = module.params[param.id] ?? param.default;
                    if (event.key === "Home" || event.key === "End") {
                      event.preventDefault();
                      onParam(param.id, event.key === "Home" ? param.min : param.max);
                      return;
                    }
                    const direction =
                      event.key === "ArrowLeft" || event.key === "ArrowDown"
                        ? -1
                        : event.key === "ArrowRight" || event.key === "ArrowUp"
                          ? 1
                          : 0;
                    if (!direction) return;
                    event.preventDefault();
                    const increment =
                      (param.max - param.min) / (event.shiftKey ? 1000 : 100);
                    onParam(
                      param.id,
                      Math.min(param.max, Math.max(param.min, current + direction * increment)),
                    );
                  }}
                  onChange={(event) =>
                    onParam(param.id, Number(event.target.value))
                  }
                />
              )}
            </label>
          ))}
          {module.key === "Stoermelder-P1/Stroke" && (
            <div className="pw-stroke-map">
              {Array.from({ length: 10 }, (_, slot) => {
                const offset=1+slot*5,key=Number(module.state?.[offset+1]??-1),mods=Number(module.state?.[offset+2]??0),mode=Number(module.state?.[offset+3]??1);
                return <div key={slot}>
                  <span>{slot+1}</span>
                  <button type="button" aria-label={`Stroke map ${slot+1}`} title="Focus, then press a key" onKeyDown={(event)=>{const next=rackKeyFromEvent(event);if(next<0)return;event.preventDefault();event.stopPropagation();onState([[offset,-1],[offset+1,next],[offset+2,rackModifiersFromEvent(event)]]);}}>{strokeKeyLabel(key,mods)}</button>
                  <select aria-label={`Stroke mode ${slot+1}`} value={mode} onChange={(event)=>onState([[offset+3,Number(event.target.value)]])}>
                    <option value={0}>Off</option><option value={1}>Trigger</option><option value={2}>Gate</option><option value={3}>Toggle</option>
                    <optgroup label="Browser commands">{STROKE_SPECIAL_MODES.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>
                    {mode>3&&!strokeSpecialModeLabel(mode)&&<option value={mode}>Imported desktop command {mode}</option>}
                  </select>
                  <button type="button" aria-label={`Clear Stroke map ${slot+1}`} onClick={()=>onState([[offset,-1],[offset+1,-1],[offset+2,0],[offset+4,0]])}>×</button>
                </div>;
              })}
            </div>
          )}
          {definition?.polyphonic && (
            <label>
              <span>Voices</span>
              <select
                aria-label={`${module.model} polyphony`}
                value={module.polyphony ?? 1}
                onChange={(event) => onPolyphony(Number(event.target.value))}
              >
                {[1, 2, 4, 8, 16].map((channels) => (
                  <option key={channels} value={channels}>
                    {channels}
                  </option>
                ))}
              </select>
            </label>
          )}
          {definition?.runtime?.midi && (
            <label className="pw-midi-device">
              <span>
                MIDI {definition.runtime.midi.input ? "input" : "output"}
              </span>
              <select
                aria-label={`${module.model} MIDI device`}
                value={midiDeviceName}
                onChange={(event) => onMidiDevice(event.target.value)}
              >
                <option value="">
                  {definition.runtime.midi.input
                    ? "All MIDI inputs"
                    : "First MIDI output"}
                </option>
                {midiOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {!midiOptions.length && <small>Start audio to enumerate</small>}
            </label>
          )}
        </div>
      ) : (
        <div className="pw-missing">
          <p>
            {module.description ||
              "This module is not compiled for the web runtime yet."}
          </p>
          {module.sourceUrl && (
            <a href={module.sourceUrl} target="_blank" rel="noreferrer">
              Source repository ↗
            </a>
          )}
          <small>{module.license || module.error}</small>
        </div>
      )}
      {definition?.runtime?.asset && (
        <>
        {definition.runtime.asset.url&&<form className="pw-url-load" onSubmit={loadAssetUrl}>
          <input aria-label={`${module.model} audio URL`} type="url" placeholder="https://…/stream.mp3 or .m3u" value={assetUrl} onChange={(event)=>setAssetUrl(event.target.value)} onBlur={()=>{if(assetUrl.trim())onData({url:assetUrl.trim()});}} />
          <button type="submit" disabled={!assetUrl.trim()}>Load URL</button>
          {urlStatus&&<small title={urlStatus}>{urlStatus}</small>}
        </form>}
        <label className={`pw-sample-load ${definition.runtime.asset.url?"with-url":""}`}>
          <input
            aria-label={`${module.model} ${definition.runtime.asset.type} asset`}
            type="file"
            accept={definition.runtime.asset.type === "image" ? "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" : "audio/*,.wav,.aif,.aiff,.mp3,.m4a,.ogg,.flac"}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onSample(file, assetSlot);
              event.target.value = "";
            }}
          />
          <b>{selectedAsset ? `${assetSlots>1?`Channel ${assetSlot+1} · `:""}${selectedAsset.name}` : `${assetSlots>1?`Channel ${assetSlot+1} · `:""}${definition.runtime.asset.type === "image" ? "Load image" : "Load audio sample"}`}</b>
          <small>
            {selectedAsset
              ? definition.runtime.asset.type === "image"
                ? `${selectedAsset.sampleRate}×${Math.floor(selectedAsset.frames / selectedAsset.sampleRate)} RGBA`
                : `${(selectedAsset.frames / selectedAsset.sampleRate).toFixed(1)}s · ${selectedAsset.channels === 2 ? "stereo" : "mono"}`
              : definition.runtime.asset.type === "image"
                ? "PNG, JPEG or WebP · decoded locally"
                : `WAV, MP3, AIFF, M4A, OGG or FLAC · first ${definition.runtime.asset.maxSeconds}s`}
          </small>
        </label>
        </>
      )}
      {definition?.runtime?.capture && (
        <button
          type="button"
          className={`pw-record ${recording ? "active" : ""}`}
          aria-pressed={recording}
          onClick={onCapture}
        >
          <i />
          <span>{recording ? "Stop & download WAV" : "Record WAV"}</span>
        </button>
      )}
      <div
        className={`pw-ports inputs aligned-layout ${inputs.length > 5 ? "compact" : ""} ${hasPortSourceLayout?"source-layout":""}`}
        style={
          { "--port-columns": inputs.length > 5 ? 2 : 1 } as CSSProperties
        }
      >
        {inputs.map((port) => (
          <button
            type="button"
            draggable
            key={port.id}
            style={rackPortStyle(port,"in")}
            data-module-id={module.id}
            data-port-direction="in"
            data-port-id={port.id}
            className={`${Object.hasOwn(inputSignalLevels, port.id) ? "connected" : ""} ${Math.abs(inputSignalLevels[port.id] ?? 0) > .01 ? "powered" : ""} ${
              pending?.moduleId === module.id &&
              pending.direction === "in" &&
              pending.portId === port.id
                ? "pending"
                : ""
            }`}
            data-signal={Math.min(10, Math.abs(inputSignalLevels[port.id] ?? 0)).toFixed(3)}
            aria-label={`${module.model} ${port.name} input`}
            onClick={() =>
              onPort({ moduleId: module.id, direction: "in", portId: port.id })
            }
            onDragStart={(event) =>
              startPortDrag(event, {
                moduleId: module.id,
                direction: "in",
                portId: port.id,
              })
            }
            onDragOver={allowPortDrop}
            onDrop={(event) =>
              dropPort(event, {
                moduleId: module.id,
                direction: "in",
                portId: port.id,
              })
            }
            onDragEnd={onPortDragEnd}
          >
            <i />
            <span>{port.name}</span>
          </button>
        ))}
      </div>
      <div
        className={`pw-ports outputs aligned-layout ${outputs.length > 5 ? "compact" : ""} ${hasPortSourceLayout?"source-layout":""}`}
        style={
          { "--port-columns": outputs.length > 5 ? 2 : 1 } as CSSProperties
        }
      >
        {outputs.map((port) => (
          <button
            type="button"
            draggable
            key={port.id}
            style={rackPortStyle(port,"out")}
            data-module-id={module.id}
            data-port-direction="out"
            data-port-id={port.id}
            className={`${Object.hasOwn(outputSignalLevels, port.id) ? "connected" : ""} ${Math.abs(outputSignalLevels[port.id] ?? 0) > .01 ? "powered" : ""} ${
              pending?.moduleId === module.id &&
              pending.direction === "out" &&
              pending.portId === port.id
                ? "pending"
                : ""
            }`}
            data-signal={Math.min(10, Math.abs(outputSignalLevels[port.id] ?? 0)).toFixed(3)}
            aria-label={`${module.model} ${port.name} output`}
            onClick={() =>
              onPort({ moduleId: module.id, direction: "out", portId: port.id })
            }
            onDragStart={(event) =>
              startPortDrag(event, {
                moduleId: module.id,
                direction: "out",
                portId: port.id,
              })
            }
            onDragOver={allowPortDrop}
            onDrop={(event) =>
              dropPort(event, {
                moduleId: module.id,
                direction: "out",
                portId: port.id,
              })
            }
            onDragEnd={onPortDragEnd}
          >
            <i />
            <span>{port.name}</span>
          </button>
        ))}
      </div>
      {module.status === "ready" && (
        <button type="button" className="pw-test-clock" onClick={onClock}>
          Run WASM block
        </button>
      )}
    </article>
  );
}
