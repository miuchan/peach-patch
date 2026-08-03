import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { ModuleInstance } from "../../lib/patch-types";
import { resolvedModulePortPosition } from "../../lib/patch-operations";
import type { ParamSpec, PortSpec, WebPluginModule } from "../../lib/web-plugin-registry";
import { rackRuntimePorts } from "../../lib/rack-runtime-ports";
import { rackUiGeometryIsTrustworthy } from "../../lib/rack-ui-geometry";
import { rackParamIsVisible } from "../../lib/rack-param-visibility";
import { RackParamVisual } from "./rack-param-visual";
import { rackLegacyUi } from "../../lib/rack-module-compatibility";
import { RackLightVisual } from "./rack-light-visual";
import type { MadzineManualTarget } from "./rack-madzine-manual";
import { audioBoundaryLightValues } from "../../lib/rack-module-panel-data";
import { audioFileFromUrl } from "../../lib/rack-module-remote-audio";
import { ModulePanelControls } from "./module-panel-controls";
import { ModulePanelPortBank, type ModulePanelPort } from "./module-panel-ports";
import { ModulePanelVisuals } from "./module-panel-visuals";

type PortClick = ModulePanelPort;

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
  onPortHover: (direction: "in" | "out", id: number | null) => void;
  manualHelpTarget: MadzineManualTarget | null;
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
  const [failedPanelArtworkUrl, setFailedPanelArtworkUrl] = useState<string | null>(null);
  const [paramNotice, setParamNotice] = useState<{ id: number; serial: number } | null>(null);
  const paramNoticeSerialRef = useRef(0);
  useEffect(() => {
    if (!paramNotice) return;
    const timer = window.setTimeout(
      () => setParamNotice((current) => (current?.serial === paramNotice.serial ? null : current)),
      3_000,
    );
    return () => window.clearTimeout(timer);
  }, [paramNotice]);
  const updateParam = (id: number, value: number) => {
    if (
      module.key === "ImpromptuModular/NoteEcho" &&
      ((id >= 4 && id <= 15) || (id >= 22 && id <= 25))
    ) {
      paramNoticeSerialRef.current += 1;
      setParamNotice({ id, serial: paramNoticeSerialRef.current });
    }
    onParam(id, value);
  };
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAssetSlotRef = useRef<number | null>(null);
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
    definition?.params.filter(
      (param) =>
        !hiddenParamIds.has(param.id) &&
        !param.hidden &&
        !param.contextOnly &&
        rackParamIsVisible(param, definition.stateKeys, module.state, connectedInputIds),
    ) ??
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
      : {};
  const [assetUrl, setAssetUrl] = useState(typeof rackData.url === "string" ? rackData.url : ""),
    [urlStatus, setUrlStatus] = useState("");
  const audioData =
      rackData.audio && typeof rackData.audio === "object" && !Array.isArray(rackData.audio)
        ? (rackData.audio as Record<string, unknown>)
        : undefined,
    audioChannels = runtimeAudio?.channels,
    renderedLightValues =
      lightValues ??
      (audioChannels
        ? audioBoundaryLightValues(
            audioChannels,
            definition?.lights ?? 0,
            audioRunning,
            inputSignalLevels,
          )
        : []);
  const hasDeclaredPanelArtwork = Boolean(module.screenshotUrl),
    panelArtworkFailed = failedPanelArtworkUrl === module.screenshotUrl,
    hasPanelArtwork = hasDeclaredPanelArtwork && !panelArtworkFailed;
  const panelStyle = {
    left: module.x,
    top: module.y,
    width: module.width,
    "--panel-image": hasPanelArtwork ? `url(${module.screenshotUrl})` : "none",
  } as CSSProperties;
  const sourcePorts = [...inputs, ...outputs],
    hasTrustworthySourceGeometry = rackUiGeometryIsTrustworthy(params, inputs, outputs),
    allowSourceGeometry = !panelArtworkFailed && hasTrustworthySourceGeometry,
    positionedParams = allowSourceGeometry ? params.filter((param) => param.position) : [],
    hasParamSourceLayout = Boolean(
      definition && !definition.runtime?.midi && (positionedParams.length || hasPanelArtwork),
    ),
    panelParams = hasParamSourceLayout ? positionedParams : params,
    panelInputs = hasPanelArtwork
      ? hasTrustworthySourceGeometry
        ? inputs.filter((port) => port.position)
        : []
      : inputs,
    panelOutputs = hasPanelArtwork
      ? hasTrustworthySourceGeometry
        ? outputs.filter((port) => port.position)
        : []
      : outputs,
    hasPortSourceLayout = Boolean(
      definition &&
      allowSourceGeometry &&
      (hasPanelArtwork || (sourcePorts.length && sourcePorts.every((port) => port.position))),
    ),
    hasSourceLayout = hasPanelArtwork || hasParamSourceLayout || hasPortSourceLayout,
    assetSlots = definition?.runtime?.asset?.slots ?? 1,
    assetSlotParam =
      assetSlots > 1
        ? definition?.params.find((param) => param.name.toLowerCase() === "channel")
        : undefined,
    assetSlot = Math.max(
      0,
      Math.min(
        assetSlots - 1,
        Math.round(assetSlotParam ? (module.params[assetSlotParam.id] ?? 0) : 0),
      ),
    ),
    selectedAsset = module.assets?.[assetSlot] ?? (assetSlot === 0 ? module.asset : undefined);
  const rackPortStyle = (port: PortSpec, direction: "in" | "out") => {
    const position = resolvedModulePortPosition(
      module,
      direction,
      port.id,
      direction === "in" ? inputs : outputs,
      definition?.width ?? module.width,
    );
    return {
      left: position.x - module.x,
      top: position.y - module.y,
      transform: "translate(-50%, -50%)",
    } as CSSProperties;
  };
  const loadAssetUrl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const normalized = new URL(assetUrl.trim());
      if (!["http:", "https:"].includes(normalized.protocol))
        throw new Error("Use an HTTP or HTTPS audio URL");
      onData({ url: normalized.href });
      setUrlStatus("FETCHING…");
      const file = await audioFileFromUrl(normalized.href);
      setUrlStatus("DECODING…");
      onSample(file, assetSlot);
    } catch (error) {
      setUrlStatus(error instanceof Error ? error.message : "Audio URL could not be loaded");
    }
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
            Boolean(definition?.runtime?.asset) && event.dataTransfer.types.includes("Files");
        if (!moduleReplacement && !audioFile) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropTarget(true);
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(event: DragEvent<HTMLElement>) => {
        const key = event.dataTransfer.getData("application/x-patchwork-module");
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
            onError={() => setFailedPanelArtworkUrl(module.screenshotUrl ?? null)}
          />
        </>
      ) : (
        <div className="pw-module-image" aria-hidden="true" />
      )}
      <ModulePanelVisuals
        module={module}
        definition={definition}
        scopeSamples={scopeSamples}
        renderedLightValues={renderedLightValues}
        rackData={rackData}
        audioData={audioData}
        audioRunning={audioRunning}
        selectedAsset={selectedAsset}
        paramNotice={paramNotice}
        manualHelpTarget={manualHelpTarget}
        onLoadAsset={() => assetInputRef.current?.click()}
        onLoadAssetSlot={(slot) => {
          pendingAssetSlotRef.current = slot;
          assetInputRef.current?.click();
        }}
        onParam={updateParam}
        onParamReset={onParamReset}
        onMomentary={onMomentary}
        onState={onState}
        onData={onData}
      />
      {definition?.lightWidgets?.map((light) => (
        <RackLightVisual
          key={`light-${light.id}`}
          light={light}
          values={renderedLightValues}
          moduleWidth={module.width}
          sourceWidth={definition.width}
          param={
            light.paramId === undefined
              ? undefined
              : definition.params.find((param) => param.id === light.paramId)
          }
          paramValue={light.paramId === undefined ? undefined : module.params[light.paramId]}
        />
      ))}
      {hasParamSourceLayout &&
        definition &&
        panelParams.map((param) => (
          <RackParamVisual
            key={`visual-${param.id}`}
            param={param}
            value={module.params[param.id] ?? param.default}
            moduleWidth={module.width}
            sourceWidth={definition.width}
          />
        ))}
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
        <ModulePanelControls
          module={module}
          definition={definition}
          params={panelParams}
          hasSourceLayout={hasParamSourceLayout}
          midiDevices={midiDevices}
          onOpenAssetPicker={() => assetInputRef.current?.click()}
          onParam={updateParam}
          onParamReset={onParamReset}
          onMomentary={onMomentary}
          onParamHover={onParamHover}
          onState={onState}
          onData={onData}
          onPolyphony={onPolyphony}
          onMidiDevice={onMidiDevice}
        />
      ) : (
        <div className="pw-missing">
          <p>{module.description || "This module is not compiled for the web runtime yet."}</p>
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
          {definition.runtime.asset.url && (
            <form className="pw-url-load" onSubmit={loadAssetUrl}>
              <input
                aria-label={`${module.model} audio URL`}
                type="url"
                placeholder="https://…/stream.mp3 or .m3u"
                value={assetUrl}
                onChange={(event) => setAssetUrl(event.target.value)}
                onBlur={() => {
                  if (assetUrl.trim()) onData({ url: assetUrl.trim() });
                }}
              />
              <button type="submit" disabled={!assetUrl.trim()}>
                Load URL
              </button>
              {urlStatus && <small title={urlStatus}>{urlStatus}</small>}
            </form>
          )}
          <label
            className={`pw-sample-load ${definition.runtime.asset.url ? "with-url" : ""} ${definition.runtime.visuals?.some((visual) => visual.kind === "octobir-display") ? "input-only" : ""}`}
          >
            <input
              ref={assetInputRef}
              aria-label={`${module.model} ${definition.runtime.asset.type} asset`}
              type="file"
              accept={
                definition.runtime.asset.type === "image"
                  ? "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  : definition.runtime.asset.type === "binary"
                    ? ".nes,application/octet-stream"
                    : definition.runtime.asset.type === "midi"
                      ? "audio/midi,audio/x-midi,.mid,.midi"
                      : definition.runtime.asset.type === "script"
                        ? "text/plain,text/x-lua,.lua,.luna,.lunaire,.anair"
                        : "audio/*,.wav,.aif,.aiff,.mp3,.m4a,.ogg,.flac"
              }
              onChange={(event) => {
                const file = event.target.files?.[0];
                const targetSlot = pendingAssetSlotRef.current ?? assetSlot;
                pendingAssetSlotRef.current = null;
                if (file) onSample(file, targetSlot);
                event.target.value = "";
              }}
            />
            <b>
              {selectedAsset
                ? `${assetSlots > 1 ? `Channel ${assetSlot + 1} · ` : ""}${selectedAsset.name}`
                : `${assetSlots > 1 ? `Channel ${assetSlot + 1} · ` : ""}${definition.runtime.asset.type === "image" ? "Load image" : definition.runtime.asset.type === "binary" ? "Load NES ROM" : definition.runtime.asset.type === "midi" ? "Load MIDI file" : definition.runtime.asset.type === "script" ? "Load Lua script" : "Load audio sample"}`}
            </b>
            <small>
              {selectedAsset
                ? definition.runtime.asset.type === "image"
                  ? `${selectedAsset.sampleRate}×${Math.floor(selectedAsset.frames / selectedAsset.sampleRate)} RGBA`
                  : definition.runtime.asset.type === "binary" ||
                      definition.runtime.asset.type === "midi" ||
                      definition.runtime.asset.type === "script"
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
      {definition?.runtime?.capture &&
        definition.runtime.capture.panelControlParam === undefined && (
          <button
            type="button"
            className={`pw-record ${recording ? "active" : ""}`}
            aria-pressed={recording}
            onClick={onCapture}
          >
            <i />
            <span>
              {recording
                ? `Stop & download ${definition.runtime.capture.format.toUpperCase()}`
                : `Record ${definition.runtime.capture.format.toUpperCase()}`}
            </span>
          </button>
        )}
      <ModulePanelPortBank
        moduleId={module.id}
        moduleModel={module.model}
        direction="in"
        ports={panelInputs}
        pending={pending}
        signalLevels={inputSignalLevels}
        sourceLayout={hasPortSourceLayout}
        portStyle={rackPortStyle}
        onPort={onPort}
        onPortDragStart={onPortDragStart}
        onPortDrop={onPortDrop}
        onPortDragEnd={onPortDragEnd}
        onPortPointerDown={onPortPointerDown}
        onPortPointerUp={onPortPointerUp}
        onPortHover={onPortHover}
      />
      <ModulePanelPortBank
        moduleId={module.id}
        moduleModel={module.model}
        direction="out"
        ports={panelOutputs}
        pending={pending}
        signalLevels={outputSignalLevels}
        sourceLayout={hasPortSourceLayout}
        portStyle={rackPortStyle}
        onPort={onPort}
        onPortDragStart={onPortDragStart}
        onPortDrop={onPortDrop}
        onPortDragEnd={onPortDragEnd}
        onPortPointerDown={onPortPointerDown}
        onPortPointerUp={onPortPointerUp}
        onPortHover={onPortHover}
      />
      {module.status === "ready" && (
        <button type="button" className="pw-test-clock" onClick={onClock}>
          Run WASM block
        </button>
      )}
    </article>
  );
}
