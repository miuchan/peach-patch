import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import type { ModuleInstance } from "../../lib/patch-types";
import { resolvedModulePortPosition } from "../../lib/patch-operations";
import { rackParamResetValue, registerRackParamPress, type RackParamPress } from "../../lib/rack-param-interaction";
import type { ParamSpec, PortSpec, WebPluginModule } from "../../lib/web-plugin-registry";
import { rackRuntimePorts } from "../../lib/rack-runtime-ports";
import { rackUiGeometryIsTrustworthy } from "../../lib/rack-ui-geometry";
import { rackParamIsVisible } from "../../lib/rack-param-visibility";
import { STROKE_SPECIAL_MODES, strokeSpecialModeLabel } from "../../lib/stroke-host";
import { RackScopeDisplay } from "./rack-scope-display";
import { RackParamVisual, rackParamControlSize, rackParamInteraction, rackParamSwitchFrames } from "./rack-param-visual";
import { rackLegacyUi } from "../../lib/rack-module-compatibility";
import { RackSegmentDisplay } from "./rack-segment-display";
import { RackParamNumericDisplay } from "./rack-param-numeric-display";
import { RackLightVisual } from "./rack-light-visual";
import { RackAudioDisplay } from "./rack-audio-display";
import { RackMultiMeterDisplay } from "./rack-multi-meter-display";
import { RackSpectrumDisplay } from "./rack-spectrum-display";
import { CellaFrequencyAnalyzerDisplay } from "./cella-frequency-analyzer-display";
import { RackCvNoteDisplay } from "./rack-cv-note-display";
import { RackNoteMeterDisplay } from "./rack-note-meter-display";
import { RackBpmDisplay } from "./rack-bpm-display";
import { RackLightMatrixDisplay } from "./rack-light-matrix-display";
import { RackHexLooperDisplay } from "./rack-hex-looper-display";
import { RackWavetableDisplay } from "./rack-wavetable-display";
import { RackElementaryCaDisplay } from "./rack-elementary-ca-display";
import { RackPianoKeyboard } from "./rack-piano-keyboard";
import { RackFourViewDisplay } from "./rack-four-view-display";
import { RackNoteEchoDisplay } from "./rack-note-echo-display";
import { RackNoteLoopDisplay } from "./rack-note-loop-display";
import { RackPhraseSeqDisplay } from "./rack-phrase-seq-display";
import { RackBouncyBallsDisplay } from "./rack-bouncy-balls-display";
import { RackFullScopeDisplay } from "./rack-full-scope-display";
import { RackMadzineScopeDisplay } from "./rack-madzine-scope-display";
import { RackMadzineWaveformDisplay } from "./rack-madzine-waveform-display";
import { RackUniversalRhythmDisplay } from "./rack-universal-rhythm-display";
import { RackMadzineLaunchpad } from "./rack-madzine-launchpad";
import { RackTheKickSample } from "./rack-the-kick-sample";
import { RackMadzineManual, type MadzineManualTarget } from "./rack-madzine-manual";
import { RackMlArpeggiatorDisplay } from "./rack-ml-arpeggiator-display";
import { RackCorrupterDisplay } from "./rack-corrupter-display";
import { RackTapestryDisplay } from "./rack-tapestry-display";
import { RackXYPadDisplay } from "./rack-xy-pad-display";
import { RackWavetableEditor } from "./rack-wavetable-editor";
import { RackNesScreenDisplay } from "./rack-nes-screen-display";
import { RackSpeckSpectrumDisplay } from "./rack-speck-spectrum-display";
import { RackIntegralFluxPreview } from "./rack-integral-flux-preview";
import { RackTemporalDeckDisplay } from "./rack-temporal-deck-display";
import { RackTdScopeDisplay } from "./rack-td-scope-display";
import { RackUndertowPreview } from "./rack-undertow-preview";
import { RackLomasSamplerDisplay } from "./rack-lomas-sampler-display";
import { RackWolframDisplay } from "./rack-wolfram-display";
import { RackOctobirDisplay } from "./rack-octobir-display";
import { RackRkdDividers } from "./rack-rkd-dividers";
import { RackKlokSpidDmd } from "./rack-klokspid-dmd";

type PortClick = { moduleId: string; direction: "in" | "out"; portId: number };

function rackKeyFromEvent(event: KeyboardEvent) {
  if (event.key.length === 1) return event.key.toUpperCase().charCodeAt(0);
  const named: Record<string, number> = {Escape:256,Enter:257,Tab:258,Backspace:259,Insert:260,Delete:261,ArrowRight:262,ArrowLeft:263,ArrowDown:264,ArrowUp:265,PageUp:266,PageDown:267,Home:268,End:269,PrintScreen:283,Pause:284};
  if (event.key in named) return named[event.key];
  const functionKey=/^F([1-9]|1\d|2[0-5])$/.exec(event.key);return functionKey?289+Number(functionKey[1]):-1;
}

function rackModifiersFromEvent(event: KeyboardEvent) {return (event.shiftKey?1:0)|(event.ctrlKey?2:0)|(event.altKey?4:0)|(event.metaKey?8:0);}
function strokeKeyLabel(key:number,mods:number){if(key<0)return"Map key";const modifier=[mods&8?"⌘":"",mods&2?"Ctrl+":"",mods&4?"Alt+":"",mods&1?"Shift+":""].join(""),named:Record<number,string>={256:"Esc",257:"Enter",258:"Tab",259:"Backspace",260:"Insert",261:"Delete",262:"→",263:"←",264:"↓",265:"↑",266:"Page Up",267:"Page Down",268:"Home",269:"End",283:"Print",284:"Pause"},label=named[key]??(key>=290&&key<=314?`F${key-289}`:String.fromCharCode(key));return `${modifier}${label}`;}
function rackMidiLogText(values:number[]|undefined,rows:number,columns:number){
  if(!values?.length)return"";
  const count=Math.max(0,Math.min(rows,Math.round(values[0]??0))),lines:string[]=[];
  for(let row=0;row<count;row++){
    const offset=1+row*(columns+1),length=Math.max(0,Math.min(columns,Math.round(values[offset]??0)));
    lines.push(String.fromCharCode(...values.slice(offset+1,offset+1+length).map(value=>Math.max(0,Math.min(255,Math.round(value))))));
  }
  return lines.join("\n");
}

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
  onParamReset,
  onMomentary,
  onParamHover,
  onPortHover,
  manualHelpTarget,
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
  onPortPointerDown,
  onPortPointerUp,
  onClock,
  onSample,
  recording,
  onCapture,
  onRemove,
  onReplaceDrop,
  inputSignalLevels,
  connectedInputIds,
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
  onParamReset: (id: number, value: number) => void;
  onMomentary: (id: number, active: boolean) => void;
  onParamHover: (id: number | null) => void;
  onPortHover: (direction:"in"|"out",id:number|null) => void;
  manualHelpTarget:MadzineManualTarget|null;
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
  onPortPointerDown: (port: PortClick, event: React.PointerEvent<HTMLButtonElement>) => void;
  onPortPointerUp: (port: PortClick, event: React.PointerEvent<HTMLButtonElement>) => void;
  onClock: () => void;
  onSample: (file: File, slot?: number) => void;
  recording: boolean;
  onCapture: () => void;
  onRemove: () => void;
  onReplaceDrop: (key: string) => void;
  inputSignalLevels: Record<number, number>;
  connectedInputIds: ReadonlySet<number>;
  outputSignalLevels: Record<number, number>;
  scopeSamples?: number[][];
  lightValues?: number[];
  audioRunning: boolean;
}) {
  const [dropTarget, setDropTarget] = useState(false);
  const [failedPanelArtworkUrl,setFailedPanelArtworkUrl]=useState<string|null>(null);
  const [paramNotice,setParamNotice]=useState<{id:number;serial:number}|null>(null);
  const paramNoticeSerialRef=useRef(0);
  useEffect(()=>{
    if(!paramNotice)return;
    const timer=window.setTimeout(()=>setParamNotice(current=>current?.serial===paramNotice.serial?null:current),3_000);
    return()=>window.clearTimeout(timer);
  },[paramNotice]);
  const updateParam=(id:number,value:number)=>{
    if(module.key==="ImpromptuModular/NoteEcho"&&((id>=4&&id<=15)||(id>=22&&id<=25))){
      paramNoticeSerialRef.current+=1;
      setParamNotice({id,serial:paramNoticeSerialRef.current});
    }
    onParam(id,value);
  };
  const paramDragRef=useRef<{pointerId:number;paramId:number;startCoordinate:number;startValue:number;min:number;max:number;snap:boolean;unbounded:boolean;axis:"x"|"y"}|null>(null);
  const lastParamPressRef=useRef<RackParamPress|null>(null);
  const assetInputRef=useRef<HTMLInputElement|null>(null);
  const pendingAssetSlotRef=useRef<number|null>(null);
  const assetPickerTimerRef=useRef<number|null>(null);
  const suppressAssetPickerRef=useRef(false);
  useEffect(()=>()=>{if(assetPickerTimerRef.current!==null)window.clearTimeout(assetPickerTimerRef.current);},[]);
  const compatibilityUi = rackLegacyUi(module),
    hiddenParamIds = new Set(compatibilityUi.hiddenParamIds),
    runtimeAudio = definition?.runtime?.audio,
    runtimePorts = definition ? rackRuntimePorts(definition) : undefined;
  const inputs: PortSpec[] =
    runtimePorts?.inputs ??
    Array.from({ length: 2 }, (_, id) => ({
      id,
      name: `IN ${id + 1}`,
      kind: "cv" as const,
    }));
  const outputs: PortSpec[] =
    runtimePorts?.outputs ??
    Array.from({ length: 2 }, (_, id) => ({
      id,
      name: `OUT ${id + 1}`,
      kind: "cv" as const,
    }));
  const params: ParamSpec[] =
    definition?.params.filter((param)=>!hiddenParamIds.has(param.id)&&!param.hidden&&!param.contextOnly&&rackParamIsVisible(param,definition.stateKeys,module.state,connectedInputIds)) ??
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
    audioChannels=runtimeAudio?.channels,
    renderedLightValues=lightValues??(audioChannels?audioBoundaryLightValues(audioChannels,definition?.lights??0,audioRunning,inputSignalLevels):[]);
  const hasDeclaredPanelArtwork=Boolean(module.screenshotUrl),
    panelArtworkFailed=failedPanelArtworkUrl===module.screenshotUrl,
    hasPanelArtwork=hasDeclaredPanelArtwork&&!panelArtworkFailed;
  const panelStyle = {
    left: module.x,
    top: module.y,
    width: module.width,
    "--panel-image": hasPanelArtwork
      ? `url(${module.screenshotUrl})`
      : "none",
  } as CSSProperties;
  const sourcePorts=[...inputs,...outputs],
    hasTrustworthySourceGeometry=rackUiGeometryIsTrustworthy(params,inputs,outputs),
    allowSourceGeometry=!panelArtworkFailed&&hasTrustworthySourceGeometry,
    positionedParams=allowSourceGeometry?params.filter(param=>param.position):[],
    hasParamSourceLayout=Boolean(definition&&!definition.runtime?.midi&&(positionedParams.length||hasPanelArtwork)),
    panelParams=hasParamSourceLayout?positionedParams:params,
    panelInputs=hasPanelArtwork?(hasTrustworthySourceGeometry?inputs.filter(port=>port.position):[]):inputs,
    panelOutputs=hasPanelArtwork?(hasTrustworthySourceGeometry?outputs.filter(port=>port.position):[]):outputs,
    hasPortSourceLayout=Boolean(definition&&allowSourceGeometry&&(hasPanelArtwork||(sourcePorts.length&&sourcePorts.every(port=>port.position)))),
    hasSourceLayout=hasPanelArtwork||hasParamSourceLayout||hasPortSourceLayout,
    assetSlots=definition?.runtime?.asset?.slots??1,
    assetSlotParam=assetSlots>1?definition?.params.find(param=>param.name.toLowerCase()==="channel"):undefined,
    assetSlot=Math.max(0,Math.min(assetSlots-1,Math.round(assetSlotParam?module.params[assetSlotParam.id]??0:0))),
    selectedAsset=module.assets?.[assetSlot]??(assetSlot===0?module.asset:undefined);
  const rackWidgetStyle=(param:ParamSpec)=>{
    if(!param.position||!definition)return undefined;
    const position=param.position,size=rackParamControlSize(param),scale=module.width/definition.width,
      centerX=position.x+(position.centered?0:size.width/2),centerY=position.y+(position.centered?0:size.height/2);
    return {left:`${centerX/definition.width*100}%`,top:`${centerY/380*100}%`,width:size.width*scale,height:size.height,zIndex:position.zIndex,transform:"translate(-50%, -50%)"} as CSSProperties;
  };
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
      {hasPanelArtwork ? (
        <>
          {/* The official Library raster is the canonical fully assembled module. */}
          <img
            className="pw-module-image"
            src={module.screenshotUrl}
            alt=""
            draggable={false}
            onError={()=>setFailedPanelArtworkUrl(module.screenshotUrl??null)}
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
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="octobir-display").map((visual,index)=>(
        <RackOctobirDisplay
          key={`octobir-display-${index}`}
          values={scopeSamples?.[0]?.slice(visual.offset)}
          filenames={[module.assets?.[0]?.name,module.assets?.[1]?.name]}
          dynamic={(module.params[6]??0)>.5}
          threshold={scopeSamples?.[0]?.[visual.offset+4]??module.params[8]??-30}
          range={scopeSamples?.[0]?.[visual.offset+5]??module.params[9]??20}
          scaleX={module.width/definition.width}
          onLoad={(slot)=>{pendingAssetSlotRef.current=slot;assetInputRef.current?.click();}}
        />
      ))}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="rkd-dividers").map((visual,index)=>(
        <RackRkdDividers key={`rkd-dividers-${index}`} values={scopeSamples?.[0]?.slice(visual.offset)} scaleX={module.width/definition.width}/>
      ))}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="klokspid-dmd").map((visual,index)=>(
        <RackKlokSpidDmd key={`klokspid-dmd-${index}`} values={scopeSamples?.[0]?.slice(visual.offset)} scaleX={module.width/definition.width}/>
      ))}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="multi-meter").map((visual,index)=><RackMultiMeterDisplay key={`multi-meter-${index}`} samples={scopeSamples} mode={module.params[visual.modeParam]??0} channelsMode={module.params[visual.channelsParam]??0} refs={module.params.slice(2,18)} x={visual.x*module.width/definition.width} y={visual.y} width={visual.width*module.width/definition.width} height={visual.height}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="spectrum-analyzer"||visual.kind==="spectrogram").map((visual,index)=><RackSpectrumDisplay key={`${visual.kind}-${index}`} kind={visual.kind} samples={scopeSamples} params={module.params} state={module.state} running={(renderedLightValues[0]??1)>.5} x={visual.x*module.width/definition.width} y={visual.y} width={visual.width*module.width/definition.width} height={visual.height}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="cella-frequency-analyzer").map((visual,index)=><CellaFrequencyAnalyzerDisplay key={`cella-frequency-analyzer-${index}`} samples={scopeSamples} params={module.params} state={module.state} x={visual.x*module.width/definition.width} y={visual.y} width={visual.width*module.width/definition.width} height={visual.height}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="cv-note").map((visual,index)=><RackCvNoteDisplay key={`cv-note-${index}`} samples={scopeSamples?.[0]} x={visual.x} y={visual.y} width={visual.width} height={visual.height} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="note-meter").map((visual,index)=><RackNoteMeterDisplay key={`note-meter-${index}`} samples={scopeSamples} params={module.params} x={visual.x} y={visual.y} width={visual.width} height={visual.height} rowHeight={visual.rowHeight} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="bpm-display").map((visual,index)=><RackBpmDisplay key={`bpm-display-${index}`} samples={scopeSamples?.[0]} params={module.params} styleParam={visual.styleParam} x={visual.x} y={visual.y} width={visual.width} height={visual.height} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="midi-log").map((visual,index)=><pre key={`midi-log-${index}`} className="pw-midi-log" aria-label="MIDI log" style={{left:visual.x*module.width/definition.width,top:visual.y,width:visual.width*module.width/definition.width,height:visual.height}}>{rackMidiLogText(scopeSamples?.[0],visual.rows,visual.columns)}</pre>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="light-matrix").map((visual,index)=><RackLightMatrixDisplay key={`light-matrix-${index}`} values={renderedLightValues} lightStart={visual.lightStart} columns={visual.columns} rows={visual.rows} channels={visual.channels} x={visual.x} y={visual.y} width={visual.width} height={visual.height} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="hex-looper").map((visual,index)=><RackHexLooperDisplay key={`hex-looper-${index}`} values={scopeSamples?.[0]} radius={visual.radius} x={visual.x} y={visual.y} width={visual.width} height={visual.height} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="wavetable-display").map((visual,index)=><RackWavetableDisplay key={`wavetable-display-${index}`} values={scopeSamples?.[0]} x={visual.x} y={visual.y} width={visual.width} height={visual.height} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="wolfram-display").map((visual,index)=><RackWolframDisplay key={`wolfram-display-${index}`} values={scopeSamples?.[0]} {...visual} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="segment").map((visual,index)=><RackSegmentDisplay key={`segment-${index}`} value={module.params[visual.param]??0} values={visual.values} x={visual.x} y={visual.y} width={visual.width} height={visual.height} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="param-numeric-display").map((visual,index)=><RackParamNumericDisplay key={`param-numeric-display-${index}`} value={module.params[visual.param]??0} digits={visual.digits} x={visual.x} y={visual.y} width={visual.width} height={visual.height} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="elementary-ca").map((visual,index)=><RackElementaryCaDisplay key={`elementary-ca-${index}`} samples={scopeSamples} params={module.params} {...visual} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="piano-keyboard").map((visual,index)=><RackPianoKeyboard key={`piano-keyboard-${index}`} {...visual} values={renderedLightValues} scaleX={module.width/definition.width} onMomentary={onMomentary}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="four-view-display").map((visual,index)=><RackFourViewDisplay key={`four-view-display-${index}`} {...visual} values={scopeSamples?.[0]} params={module.params} state={module.state} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="note-echo-display").map((visual,index)=><RackNoteEchoDisplay key={`note-echo-display-${index}`} {...visual} params={module.params} wetOnly={(renderedLightValues[0]??0)>.5} notifiedParam={paramNotice?.id??null} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="note-loop-display").map((visual,index)=><RackNoteLoopDisplay key={`note-loop-display-${index}`} value={module.params[visual.param]??0} {...visual} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="phrase-seq-display").map((visual,index)=><RackPhraseSeqDisplay key={`phrase-seq-display-${index}`} values={scopeSamples?.[0]} {...visual} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="scribble-strip").map((visual,index)=>{
        const text=String(rackData[visual.dataKey]??visual.defaultText),fromTop=Boolean(module.state?.[visual.orientationState]??definition.stateKeys?.[visual.orientationState]?.default??0);
        return <div key={`scribble-strip-${index}`} className={`pw-scribble-strip-display ${fromTop?"from-top":"from-bottom"}`} aria-label={`ScribbleStrip label: ${text}`} style={{left:visual.x*module.width/definition.width,top:visual.y,width:visual.width*module.width/definition.width,height:visual.height}}><span>{text}</span></div>;
      })}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="bouncy-balls").map((visual,index)=><RackBouncyBallsDisplay key={`bouncy-balls-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width} onState={onState} onMomentary={onMomentary}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="full-scope").map((visual,index)=><RackFullScopeDisplay key={`full-scope-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="madzine-scope").map((visual,index)=><RackMadzineScopeDisplay key={`madzine-scope-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="madzine-waveform").map((visual,index)=><RackMadzineWaveformDisplay key={`madzine-waveform-${index}`} {...visual} values={scopeSamples?.[0]} loopEnd={module.params[visual.loopEndParam]??definition.params[visual.loopEndParam]?.default??1} scaleX={module.width/definition.width} onLoopEnd={value=>updateParam(visual.loopEndParam,value)} onLoopEndReset={()=>onParamReset(visual.loopEndParam,definition.params[visual.loopEndParam]?.default??1)}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="universal-rhythm").map((visual,index)=><RackUniversalRhythmDisplay key={`universal-rhythm-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="song-mode-sequence").map((visual,index)=>(
        <input
          key={`song-mode-sequence-${index}`}
          className="pw-song-mode-sequence"
          aria-label="Playback sequence"
          type="text"
          spellCheck={false}
          value={String(rackData[visual.dataKey]??visual.defaultText)}
          style={{left:visual.x*module.width/definition.width,top:visual.y,width:visual.width*module.width/definition.width,height:visual.height}}
          onPointerDown={(event)=>event.stopPropagation()}
          onDoubleClick={(event)=>event.stopPropagation()}
          onKeyDown={(event)=>event.stopPropagation()}
          onKeyUp={(event)=>event.stopPropagation()}
          onChange={(event)=>onData({[visual.dataKey]:event.target.value})}
        />
      ))}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="madzine-launchpad").map((visual,index)=><RackMadzineLaunchpad key={`madzine-launchpad-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width} onMomentary={onMomentary}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="the-kick-sample").map((visual,index)=><RackTheKickSample key={`the-kick-sample-${index}`} {...visual} scaleX={module.width/definition.width} loaded={Boolean(selectedAsset)||Boolean(rackData.hasSample)} mode={Number(module.state?.[2]??rackData.modeValue??0)} filename={selectedAsset?.name??String(rackData.samplePath??"Sample")} onLoad={()=>assetInputRef.current?.click()} onMomentary={onMomentary}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="madzine-manual").map((visual,index)=><RackMadzineManual key={`madzine-manual-${index}`} {...visual} help={definition.runtime?.manualHelp??{}} target={manualHelpTarget} languageValue={Number(rackData.language??1)} fontSizeValue={Number(rackData.fontSize??20)} scaleX={module.width/definition.width} onData={onData}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="ml-arpeggiator").map((visual,index)=><RackMlArpeggiatorDisplay key={`ml-arpeggiator-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="corrupter-display").map((visual,index)=><RackCorrupterDisplay key={`corrupter-display-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="tapestry-display").map((visual,index)=><RackTapestryDisplay key={`tapestry-display-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width} onMomentary={onMomentary}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="xy-pad").map((visual,index)=><RackXYPadDisplay key={`xy-pad-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width} onParam={updateParam} onMomentary={onMomentary}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="wavetable-editor").map((visual,index)=><RackWavetableEditor key={`wavetable-editor-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width} onMomentary={onMomentary}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="racknes-screen").map((visual,index)=><RackNesScreenDisplay key={`racknes-screen-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="speck-spectrum").map((visual,index)=><RackSpeckSpectrumDisplay key={`speck-spectrum-${index}`} {...visual} values={scopeSamples?.[0]} params={module.params} linLog={(renderedLightValues[1]??0)>.5} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="integral-flux-preview").map((visual,index)=><RackIntegralFluxPreview key={`integral-flux-preview-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="proc-preview").map((visual,index)=><RackIntegralFluxPreview key={`proc-preview-${index}`} {...visual} channel={1} label="Proc" values={scopeSamples?.[0]} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="temporal-deck").map((visual,index)=><RackTemporalDeckDisplay key={`temporal-deck-${index}`} {...visual} values={scopeSamples?.[0]} lights={renderedLightValues} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="td-scope").map((visual,index)=><RackTdScopeDisplay key={`td-scope-${index}`} {...visual} values={scopeSamples?.[0]} state={module.state} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="undertow-preview").map((visual,index)=><RackUndertowPreview key={`undertow-preview-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="lomas-sampler").map((visual,index)=><RackLomasSamplerDisplay key={`lomas-sampler-${index}`} {...visual} values={scopeSamples?.[0]} scaleX={module.width/definition.width}/>)}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="less-mess-labels").map((visual,index)=>(
        <div key={`less-mess-labels-${index}`} className="pw-less-mess-labels" style={{left:visual.x*module.width/definition.width,top:visual.y,width:visual.width*module.width/definition.width}}>
          {Array.from({length:visual.rows},(_,row)=>{
            const key=`${visual.dataKeyPrefix}${row}`;
            return <input key={key} aria-label={`Cable label ${row+1}`} type="text" value={String(rackData[key]??"")} style={{top:row*visual.rowHeight,height:visual.height}} onPointerDown={(event)=>event.stopPropagation()} onDoubleClick={(event)=>event.stopPropagation()} onChange={(event)=>onData({[key]:event.target.value})}/>;
          })}
        </div>
      ))}
      {definition?.runtime?.visuals?.filter(visual=>visual.kind==="audio-display").map((visual,index)=><RackAudioDisplay key={`audio-display-${index}`} audio={audioData} running={audioRunning} channels={visual.channels} x={visual.x} y={visual.y} width={visual.width} height={visual.height} scaleX={module.width/definition.width}/>)}
      {definition?.lightWidgets?.map((light)=><RackLightVisual key={`light-${light.id}`} light={light} values={renderedLightValues} moduleWidth={module.width} sourceWidth={definition.width} param={light.paramId===undefined?undefined:definition.params.find(param=>param.id===light.paramId)} paramValue={light.paramId===undefined?undefined:module.params[light.paramId]}/>)}
      {hasParamSourceLayout&&definition&&panelParams.map(param=><RackParamVisual key={`visual-${param.id}`} param={param} value={module.params[param.id]??param.default} moduleWidth={module.width} sourceWidth={definition.width}/>)}
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
          ) : panelParams.map((param) => {
            const interaction=rackParamInteraction(param),label=`${module.model} ${param.name}`,
              resetParam=()=>window.requestAnimationFrame(()=>onParamReset(param.id,rackParamResetValue(param,module.params))),
              opensAssetPicker=Boolean(definition?.runtime?.asset&&param.position?.widget==="LoadButton"),
              queueAssetPicker=()=>{
                if(!opensAssetPicker||suppressAssetPickerRef.current)return;
                if(assetPickerTimerRef.current!==null)window.clearTimeout(assetPickerTimerRef.current);
                assetPickerTimerRef.current=window.setTimeout(()=>{
                  assetPickerTimerRef.current=null;
                  assetInputRef.current?.click();
                },220);
              };
            return <label
              key={param.id}
              className={`rack-control-${interaction} ${param.position?.control === "selector" ? "rack-selector" : ""}`}
              title={`${param.name}: ${module.params[param.id] ?? param.default}`}
              style={hasParamSourceLayout?rackWidgetStyle(param):undefined}
            >
              <span>{param.name}</span>
              {interaction==="button" ? <button
                type="button"
                className="pw-param-button"
                aria-label={label}
                onPointerDown={(event)=>{
                  if(event.button>0)return;
                  event.preventDefault();event.stopPropagation();
                  const press=registerRackParamPress(lastParamPressRef.current,param.id,event.pointerType,performance.now());
                  lastParamPressRef.current=press.next;
                  if(event.detail>1||press.doubleClick){
                    if(assetPickerTimerRef.current!==null){window.clearTimeout(assetPickerTimerRef.current);assetPickerTimerRef.current=null;}
                    suppressAssetPickerRef.current=true;
                    onMomentary(param.id,false);
                    resetParam();
                    return;
                  }
                  suppressAssetPickerRef.current=false;
                  event.currentTarget.setPointerCapture(event.pointerId);onParamHover(param.id);onMomentary(param.id,true);
                }}
                onPointerUp={(event)=>{
                  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
                  onMomentary(param.id,false);
                  queueAssetPicker();
                  suppressAssetPickerRef.current=false;
                }}
                onPointerCancel={()=>{suppressAssetPickerRef.current=false;onMomentary(param.id,false);}}
                onKeyDown={(event)=>{if((event.key===" "||event.key==="Enter")&&!event.repeat){event.preventDefault();onMomentary(param.id,true);}}}
                onKeyUp={(event)=>{if(event.key===" "||event.key==="Enter"){event.preventDefault();onMomentary(param.id,false);if(opensAssetPicker)assetInputRef.current?.click();}}}
                onDoubleClick={(event)=>{event.preventDefault();event.stopPropagation();if(assetPickerTimerRef.current!==null){window.clearTimeout(assetPickerTimerRef.current);assetPickerTimerRef.current=null;}suppressAssetPickerRef.current=true;onMomentary(param.id,false);resetParam();}}
                onBlur={()=>{onParamHover(null);onMomentary(param.id,false);}}
              >{param.name}</button> : interaction==="switch" ? <button
                type="button"
                className="pw-param-switch"
                aria-label={`${label}: ${module.params[param.id]??param.default}`}
                onPointerDown={(event)=>{
                  if(event.button>0)return;
                  event.stopPropagation();
                  const press=registerRackParamPress(lastParamPressRef.current,param.id,event.pointerType,performance.now());
                  lastParamPressRef.current=press.next;
                  if(event.detail>1||press.doubleClick){
                    event.preventDefault();
                    resetParam();
                  }
                }}
                onDoubleClick={(event)=>{event.preventDefault();event.stopPropagation();resetParam();}}
                onClick={(event)=>{
                  if(event.detail>1)return;
                  const frames=rackParamSwitchFrames(param),current=module.params[param.id]??param.default,
                    normalized=param.max===param.min?0:(current-param.min)/(param.max-param.min),
                    nextFrame=(Math.round(normalized*(frames-1))+1)%frames;
                  updateParam(param.id,param.min+nextFrame/(frames-1)*(param.max-param.min));
                }}
              >{param.name}</button> : <input
                aria-label={label}
                type="range"
                min={Math.min(param.min,param.max)}
                max={Math.max(param.min,param.max)}
                step={param.snap?1:"any"}
                value={module.params[param.id]??param.default}
                onPointerDown={(event)=>{
                  if(event.button>0)return;
                  event.preventDefault();event.stopPropagation();
                  const press=registerRackParamPress(lastParamPressRef.current,param.id,event.pointerType,performance.now());
                  lastParamPressRef.current=press.next;
                  if(event.detail>1||press.doubleClick){
                    paramDragRef.current=null;
                    resetParam();
                    return;
                  }
                  const axis=interaction==="selector"?"x":"y",startCoordinate=axis==="x"?event.clientX:event.clientY;
                  paramDragRef.current={pointerId:event.pointerId,paramId:param.id,startCoordinate,startValue:module.params[param.id]??param.default,min:param.min,max:param.max,snap:Boolean(param.snap),unbounded:Boolean(param.unbounded),axis};
                  event.currentTarget.setPointerCapture(event.pointerId);onParamHover(param.id);
                }}
                onMouseDown={(event)=>{
                  if(event.button>0)return;
                  // A real mouse press dispatches pointerdown before its compatibility
                  // mousedown. The pointer handler already owns this drag, so do not
                  // register the same press twice and accidentally classify it as a
                  // double-click/reset.
                  if(paramDragRef.current?.paramId===param.id)return;
                  const press=registerRackParamPress(lastParamPressRef.current,param.id,"mouse",performance.now());
                  lastParamPressRef.current=press.next;
                  if(event.detail>1||press.doubleClick){
                    event.preventDefault();event.stopPropagation();paramDragRef.current=null;resetParam();
                  }
                }}
                onPointerMove={(event)=>{
                  const drag=paramDragRef.current;
                  if(!drag||drag.pointerId!==event.pointerId||drag.paramId!==param.id)return;
                  event.preventDefault();
                  const coordinate=drag.axis==="x"?event.clientX:event.clientY,direction=drag.axis==="x"?1:-1,sensitivity=event.shiftKey?600:140,
                    raw=drag.startValue+(coordinate-drag.startCoordinate)*direction*(drag.max-drag.min)/sensitivity,
                    stepped=drag.snap?Math.round(raw):raw,
                    next=drag.unbounded?stepped:Math.min(Math.max(drag.min,drag.max),Math.max(Math.min(drag.min,drag.max),stepped));
                  updateParam(param.id,next);
                }}
                onPointerUp={(event)=>{
                  const drag=paramDragRef.current;
                  if(!drag||drag.pointerId!==event.pointerId||drag.paramId!==param.id)return;
                  paramDragRef.current=null;
                  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={()=>{paramDragRef.current=null;}}
                onPointerEnter={()=>onParamHover(param.id)}
                onPointerLeave={()=>onParamHover(null)}
                onFocus={()=>onParamHover(param.id)}
                onBlur={()=>onParamHover(null)}
                onDoubleClick={(event)=>{event.preventDefault();event.stopPropagation();paramDragRef.current=null;resetParam();}}
                onKeyDown={(event)=>{
                  const current=module.params[param.id]??param.default;
                  if(event.key==="Home"||event.key==="End"){event.preventDefault();updateParam(param.id,event.key==="Home"?param.min:param.max);return;}
                  const direction=event.key==="ArrowLeft"||event.key==="ArrowDown"?-1:event.key==="ArrowRight"||event.key==="ArrowUp"?1:0;
                  if(!direction)return;
                  event.preventDefault();
                  const increment=param.snap?1:(param.max-param.min)/(event.shiftKey?1000:100);
                  const next=current+direction*increment;
                  updateParam(param.id,param.unbounded?next:Math.min(Math.max(param.min,param.max),Math.max(Math.min(param.min,param.max),next)));
                }}
                onChange={(event)=>updateParam(param.id,Number(event.target.value))}
              />}
            </label>;
          })}
          {module.key === "FrankBuss/Formula" && (
            <div className="pw-formula-editors">
              <textarea
                aria-label="Formula output expression"
                spellCheck={false}
                value={String(
                  module.rack?.data && typeof module.rack.data === "object"
                    ? (module.rack.data as Record<string, unknown>).text ?? ""
                    : "",
                )}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => onData({ text: event.target.value })}
              />
              <input
                aria-label="Formula frequency expression"
                spellCheck={false}
                value={String(
                  module.rack?.data && typeof module.rack.data === "object"
                    ? (module.rack.data as Record<string, unknown>).freq ?? ""
                    : "",
                )}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => onData({ freq: event.target.value })}
              />
            </div>
          )}
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
        <label className={`pw-sample-load ${definition.runtime.asset.url?"with-url":""} ${definition.runtime.visuals?.some(visual=>visual.kind==="octobir-display")?"input-only":""}`}>
          <input
            ref={assetInputRef}
            aria-label={`${module.model} ${definition.runtime.asset.type} asset`}
            type="file"
            accept={definition.runtime.asset.type === "image" ? "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" : definition.runtime.asset.type === "binary" ? ".nes,application/octet-stream" : definition.runtime.asset.type === "midi" ? "audio/midi,audio/x-midi,.mid,.midi" : definition.runtime.asset.type === "script" ? "text/plain,text/x-lua,.lua,.luna,.lunaire,.anair" : "audio/*,.wav,.aif,.aiff,.mp3,.m4a,.ogg,.flac"}
            onChange={(event) => {
              const file = event.target.files?.[0];
              const targetSlot=pendingAssetSlotRef.current??assetSlot;
              pendingAssetSlotRef.current=null;
              if (file) onSample(file, targetSlot);
              event.target.value = "";
            }}
          />
          <b>{selectedAsset ? `${assetSlots>1?`Channel ${assetSlot+1} · `:""}${selectedAsset.name}` : `${assetSlots>1?`Channel ${assetSlot+1} · `:""}${definition.runtime.asset.type === "image" ? "Load image" : definition.runtime.asset.type === "binary" ? "Load NES ROM" : definition.runtime.asset.type === "midi" ? "Load MIDI file" : definition.runtime.asset.type === "script" ? "Load Lua script" : "Load audio sample"}`}</b>
          <small>
            {selectedAsset
              ? definition.runtime.asset.type === "image"
                ? `${selectedAsset.sampleRate}×${Math.floor(selectedAsset.frames / selectedAsset.sampleRate)} RGBA`
                : definition.runtime.asset.type === "binary" || definition.runtime.asset.type === "midi" || definition.runtime.asset.type === "script"
                  ? `${selectedAsset.frames.toLocaleString()} bytes · stored locally`
                : definition.runtime.asset.maxSeconds > 0
                  ? `${(selectedAsset.frames / selectedAsset.sampleRate).toFixed(1)}s · ${selectedAsset.channels === 2 ? "stereo" : "mono"}`
                  : `${selectedAsset.frames.toLocaleString()} samples · ${selectedAsset.channels === 2 ? "stereo" : "mono"}`
              : definition.runtime.asset.type === "image"
                ? "PNG, JPEG or WebP · decoded locally"
                : definition.runtime.asset.type === "binary"
                  ? `iNES .nes file · up to ${definition.runtime.asset.maxSamples.toLocaleString()} bytes`
                : definition.runtime.asset.type === "midi"
                  ? `Standard MIDI File · up to ${definition.runtime.asset.maxSamples.toLocaleString()} bytes`
                : definition.runtime.asset.type === "script"
                  ? `UTF-8 Lua script · up to ${definition.runtime.asset.maxSamples.toLocaleString()} bytes`
                : definition.runtime.asset.maxSeconds > 0
                  ? `WAV, MP3, AIFF, M4A, OGG or FLAC · first ${definition.runtime.asset.maxSeconds}s`
                  : `WAV, MP3, AIFF, M4A, OGG or FLAC · up to ${definition.runtime.asset.maxSamples.toLocaleString()} samples`}
          </small>
        </label>
        </>
      )}
      {definition?.runtime?.capture && definition.runtime.capture.panelControlParam===undefined && (
        <button
          type="button"
          className={`pw-record ${recording ? "active" : ""}`}
          aria-pressed={recording}
          onClick={onCapture}
        >
          <i />
          <span>{recording ? `Stop & download ${definition.runtime.capture.format.toUpperCase()}` : `Record ${definition.runtime.capture.format.toUpperCase()}`}</span>
        </button>
      )}
      <div
        className={`pw-ports inputs aligned-layout ${panelInputs.length > 5 ? "compact" : ""} ${hasPortSourceLayout?"source-layout":""}`}
        style={
          { "--port-columns": panelInputs.length > 5 ? 2 : 1 } as CSSProperties
        }
      >
        {panelInputs.map((port) => (
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
            onPointerDown={(event) => onPortPointerDown({ moduleId: module.id, direction: "in", portId: port.id }, event)}
            onPointerUp={(event) => onPortPointerUp({ moduleId: module.id, direction: "in", portId: port.id }, event)}
            onPointerEnter={()=>onPortHover("in",port.id)}
            onPointerLeave={()=>onPortHover("in",null)}
          >
            <i />
            <span>{port.name}</span>
          </button>
        ))}
      </div>
      <div
        className={`pw-ports outputs aligned-layout ${panelOutputs.length > 5 ? "compact" : ""} ${hasPortSourceLayout?"source-layout":""}`}
        style={
          { "--port-columns": panelOutputs.length > 5 ? 2 : 1 } as CSSProperties
        }
      >
        {panelOutputs.map((port) => (
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
            onPointerDown={(event) => onPortPointerDown({ moduleId: module.id, direction: "out", portId: port.id }, event)}
            onPointerUp={(event) => onPortPointerUp({ moduleId: module.id, direction: "out", portId: port.id }, event)}
            onPointerEnter={()=>onPortHover("out",port.id)}
            onPointerLeave={()=>onPortHover("out",null)}
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
