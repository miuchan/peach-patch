"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Maximize2, Play, Square } from "lucide-react";
import { ModulePanel } from "./components/module-panel";
import { PortScope } from "./components/port-scope";
import { RackCablePlug } from "./components/rack-cable-plug";
import { parseVcvArchive } from "../lib/vcv-patch";
import type {
  ModuleInstance,
  PatchDocument,
  SampleAssetRef,
} from "../lib/patch-types";
import { usePatchHistory } from "../lib/use-patch-history";
import { RackAudioEngine, type RackPlugSignal } from "../lib/rack-audio-engine";
import { dataFromState, stateFromData } from "../lib/patch-state";
import { hydrateModuleWithDefinition } from "../lib/patch-hydrate";
import { putSample } from "../lib/sample-store";
import { serializeVcvPatch } from "../lib/vcv-patch-serialize";
import {
  appendAutomationEvent,
  automationClipFromPatch,
  patchWithAutomationClip,
  type PatchAutomationEvent,
} from "../lib/patch-automation";
import {
  applyRackModulePreset,
  anchoredViewportPan,
  connectPatchCable,
  disconnectModuleCables,
  duplicatePatchModules,
  fittedPatchViewport,
  moveRackModulesWithoutOverlap,
  modulesIntersectingViewportRect,
  resolvedModulePortPosition,
  randomizeModuleControls,
  rackSurfaceBounds,
  removeModuleAndHealCable,
  replaceModuleKeepingCompatibleCables,
  resetModuleControls,
  snapRackPosition,
  spliceModuleIntoCable,
} from "../lib/patch-operations";
import { type WebPluginModule } from "../lib/web-plugin-registry";
import {
  isStrokeCvMode,
  STROKE_REPEATABLE_MODES,
} from "../lib/stroke-host";
import {
  allWebPlugins,
  getWebPlugin,
  registerDynamicModule,
  registerDynamicModules,
} from "../lib/runtime-plugin-registry";

const CABLES = [
  "#ef5265",
  "#f6c94a",
  "#43b5df",
  "#55cf91",
  "#ac79ee",
  "#f28a49",
];
type PortClick = { moduleId: string; direction: "in" | "out"; portId: number };
type ResolveResult = {
  key: string;
  plugin: string;
  model: string;
  title: string;
  description: string;
  screenshotUrl: string;
  sourceUrl?: string;
  license?: string;
  version?: string;
  compiled: boolean;
  runtime: WebPluginModule | null;
  error?: string;
};
type BrowserFileHandle = {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};
type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: Record<string, unknown>) => Promise<BrowserFileHandle>;
};
type WasmExports = {
  memory: WebAssembly.Memory;
  _initialize: () => void;
  rack_web_input_buffer: () => number;
  rack_web_output_buffer: () => number;
  rack_web_light_buffer: () => number;
  rack_web_set_param: (id: number, value: number) => void;
  rack_web_set_input_connected: (id: number, connected: number) => void;
  rack_web_set_input_channels: (id: number, channels: number) => void;
  rack_web_set_output_connected: (id: number, connected: number) => void;
  rack_web_set_polyphony: (channels: number) => void;
  rack_web_set_state: (id: number, value: number) => void;
  rack_web_state_buffer?: (bytes: number) => number;
  rack_web_commit_state_json?: (bytes: number) => number;
  rack_web_seed: (seed: number) => void;
  rack_web_process: (frames: number, sampleRate: number) => void;
};

function loadWasmStateJson(wasm: WasmExports, value: unknown) {
  if (!wasm.rack_web_state_buffer || !wasm.rack_web_commit_state_json) return;
  const bytes = new TextEncoder().encode(JSON.stringify(value ?? {})),
    pointer = wasm.rack_web_state_buffer(bytes.length);
  if (!pointer) return;
  new Uint8Array(wasm.memory.buffer, pointer, bytes.length).set(bytes);
  wasm.rack_web_commit_state_json(bytes.length);
}

function browserWasiImports(holder: {
  runtime?: WasmExports;
  randomState?: number;
  clockNanoseconds?: bigint;
}) {
  const missing = () => -2;
  const unsupported = () => -52;
  return {
    env: {
      __syscall_faccessat: missing,
      __syscall_fchmod: unsupported,
      __syscall_chmod: unsupported,
      __syscall_fchown32: unsupported,
      __syscall_ftruncate64: unsupported,
      __syscall_getdents64: missing,
      __syscall_getcwd(buffer: number, size: number) {
        if (!holder.runtime || size < 2) return -34;
        new Uint8Array(holder.runtime.memory.buffer, buffer, 2).set([47, 0]);
        return 2;
      },
      __syscall_readlinkat: missing,
      __syscall_rmdir: missing,
      __syscall_unlinkat: missing,
      __syscall_utimensat: unsupported,
    },
    wasi_snapshot_preview1: {
      fd_write(
        _fd: number,
        iovecs: number,
        iovecCount: number,
        written: number,
      ) {
        if (!holder.runtime) return 0;
        const view = new DataView(holder.runtime.memory.buffer);
        let bytes = 0;
        for (let index = 0; index < iovecCount; index++)
          bytes += view.getUint32(iovecs + index * 8 + 4, true);
        view.setUint32(written, bytes, true);
        return 0;
      },
      fd_read(_fd: number, _iovecs: number, _count: number, read: number) {
        if (holder.runtime)
          new DataView(holder.runtime.memory.buffer).setUint32(read, 0, true);
        return 0;
      },
      fd_sync() {
        return 0;
      },
      fd_seek(
        _fd: number,
        _offset: bigint,
        _whence: number,
        newOffset: number,
      ) {
        if (holder.runtime)
          new DataView(holder.runtime.memory.buffer).setBigUint64(
            newOffset,
            0n,
            true,
          );
        return 0;
      },
      fd_fdstat_get(_fd: number, status: number) {
        if (holder.runtime)
          new Uint8Array(holder.runtime.memory.buffer, status, 24).fill(0);
        return 0;
      },
      clock_time_get(_clockId: number, _precision: bigint, time: number) {
        if (!holder.runtime) return 0;
        holder.clockNanoseconds =
          (holder.clockNanoseconds ?? 1_000_000_000n) + 1_000_000n;
        new DataView(holder.runtime.memory.buffer).setBigUint64(
          time,
          holder.clockNanoseconds,
          true,
        );
        return 0;
      },
      random_get(buffer: number, length: number) {
        if (!holder.runtime) return 0;
        const bytes = new Uint8Array(
          holder.runtime.memory.buffer,
          buffer,
          length,
        );
        let state = holder.randomState ?? 0x9e3779b9;
        for (let index = 0; index < length; index++) {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          bytes[index] = state & 255;
        }
        holder.randomState = state >>> 0;
        return 0;
      },
      environ_sizes_get(count: number, size: number) {
        if (!holder.runtime) return 0;
        const view = new DataView(holder.runtime.memory.buffer);
        view.setUint32(count, 0, true);
        view.setUint32(size, 0, true);
        return 0;
      },
      environ_get() {
        return 0;
      },
      fd_close() {
        return 0;
      },
    },
  };
}

const emptyPatch: PatchDocument = { modules: [], cables: [] };
const AUTOSAVE_KEY = "patchwork-web.autosave.v1";
const LOCAL_PLUGIN_BUILDER = "http://127.0.0.1:4179";

function newModuleId() {
  return `module-${crypto.randomUUID()}`;
}

function repairDuplicateModuleIds(patch: PatchDocument) {
  const seen = new Set<string>();
  let repaired = 0;
  const modules = patch.modules.map((module) => {
    if (!seen.has(module.id)) {
      seen.add(module.id);
      return module;
    }
    repaired++;
    const id = newModuleId();
    seen.add(id);
    return { ...module, id };
  });
  return { patch: repaired ? { ...patch, modules } : patch, repaired };
}

function moduleFromDefinition(
  definition: WebPluginModule,
  x: number,
  y: number,
): ModuleInstance {
  return {
    id: newModuleId(),
    key: definition.key,
    plugin: definition.plugin,
    model: definition.model,
    version: definition.version,
    x,
    y,
    width: definition.width,
    params: definition.params.map((param) => param.default),
    state:
      definition.key === "Stoermelder-P1/Stroke"
        ? [0, ...Array.from({ length: 10 }, () => [-1, -1, 0, 1, 0]).flat()]
        : undefined,
    stateKeys: definition.stateKeys,
    polyphony: definition.polyphonic ? 1 : undefined,
    bypassed: false,
    status: "ready",
    description: definition.description,
    screenshotUrl: definition.screenshotUrl,
    sourceUrl: definition.sourceUrl,
    license: definition.license,
  };
}

function findOpenPosition(
  modules: ModuleInstance[],
  width: number,
  origin: { x: number; y: number },
) {
  const start = snapRackPosition({
    x: origin.x,
    y: origin.y,
  });
  for (let row = 0; row < 24; row++)
    for (let column = 0; column < 240; column++) {
      const candidate = { x: start.x + column * 15, y: start.y + row * 380 };
      const clear = modules.every(
        (module) =>
          candidate.x + width <= module.x ||
          module.x + module.width <= candidate.x ||
          candidate.y + 380 <= module.y ||
          module.y + 380 <= candidate.y,
      );
      if (clear) return candidate;
    }
  return { x: start.x, y: start.y + modules.length * 380 };
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
) {
  let next = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, limit), items.length) },
      async () => {
        while (next < items.length) {
          const index = next++;
          await task(items[index]);
        }
      },
    ),
  );
}

function withoutRackId(rack: Record<string, unknown> | undefined) {
  if (!rack) return undefined;
  const copy = { ...rack };
  delete copy.id;
  return copy;
}

function sampleAssetFromData(
  data: Record<string, unknown> | undefined,
): SampleAssetRef | undefined {
  const value = data?.patchworkWebAsset;
  if (!value || typeof value !== "object") return undefined;
  const asset = value as Record<string, unknown>;
  return typeof asset.storageKey === "string" &&
    typeof asset.name === "string" &&
    typeof asset.sampleRate === "number" &&
    typeof asset.channels === "number" &&
    typeof asset.frames === "number"
    ? (asset as SampleAssetRef)
    : undefined;
}
function sampleAssetsFromData(
  data: Record<string, unknown> | undefined,
): Array<SampleAssetRef | undefined> | undefined {
  const values = data?.patchworkWebAssets;
  if (!Array.isArray(values)) return undefined;
  const assets = values.map((value) => {
    if (!value || typeof value !== "object") return undefined;
    const asset = value as Record<string, unknown>;
    return typeof asset.storageKey === "string" &&
      typeof asset.name === "string" &&
      typeof asset.sampleRate === "number" &&
      typeof asset.channels === "number" &&
      typeof asset.frames === "number"
      ? (asset as SampleAssetRef)
      : undefined;
  });
  return assets.some(Boolean) ? assets : undefined;
}
function polyphonyFromData(data: Record<string, unknown> | undefined) {
  const value = data?.patchworkWebPolyphony;
  return typeof value === "number" && [1, 2, 4, 8, 16].includes(value)
    ? value
    : undefined;
}

function rackKeyFromKeyboard(event: KeyboardEvent) {
  if (event.key.length === 1) return event.key.toUpperCase().charCodeAt(0);
  const named: Record<string, number> = {
    Escape: 256,
    Enter: 257,
    Tab: 258,
    Backspace: 259,
    Insert: 260,
    Delete: 261,
    ArrowRight: 262,
    ArrowLeft: 263,
    ArrowDown: 264,
    ArrowUp: 265,
    PageUp: 266,
    PageDown: 267,
    Home: 268,
    End: 269,
    CapsLock: 280,
    ScrollLock: 281,
    NumLock: 282,
    PrintScreen: 283,
    Pause: 284,
  };
  if (event.key in named) return named[event.key];
  const functionKey = /^F([1-9]|1\d|2[0-5])$/.exec(event.key);
  return functionKey ? 289 + Number(functionKey[1]) : -1;
}

function rackModifiersFromKeyboard(event: KeyboardEvent) {
  return (
    (event.shiftKey ? 1 : 0) |
    (event.ctrlKey ? 2 : 0) |
    (event.altKey ? 4 : 0) |
    (event.metaKey ? 8 : 0)
  );
}

function strokeBindings(module: ModuleInstance) {
  const data = module.rack?.data;
  const values =
    module.state?.length || !data || typeof data !== "object"
      ? (module.state ?? [])
      : stateFromData(
          module.key,
          data as Record<string, unknown>,
          module.stateKeys,
        );
  return Array.from({ length: 10 }, (_, id) => ({
    id,
    button: Number(values[1 + id * 5] ?? -1),
    key: Number(values[2 + id * 5] ?? -1),
    mods: Number(values[3 + id * 5] ?? 0),
    mode: Number(values[4 + id * 5] ?? 1),
    data:
      data &&
      Array.isArray((data as Record<string, unknown>).keys) &&
      typeof ((data as Record<string, unknown>).keys as unknown[])[id] ===
        "object"
        ? String(
            (((data as Record<string, unknown>).keys as unknown[])[id] as Record<
              string,
              unknown
            >).data ?? "",
          )
        : "",
  }));
}

export function RackWebStudio() {
  const history = usePatchHistory(emptyPatch),
    patch = history.value;
  const commitHistory = history.commit,
    mutateHistory = history.mutate,
    checkpointHistory = history.checkpoint,
    undoHistory = history.undo,
    redoHistory = history.redo;
  const [moduleUrl, setModuleUrl] = useState(
    "https://library.vcvrack.com/Bruer/SEQ1",
  );
  const [moduleQuery, setModuleQuery] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{
    left: number;
    top: number;
    worldX: number;
    worldY: number;
    query: string;
  } | null>(null);
  const [moduleMenu, setModuleMenu] = useState<{
    left: number;
    top: number;
    moduleId: string;
  } | null>(null);
  const [marquee, setMarquee] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [cableMenu, setCableMenu] = useState<{
    left: number;
    top: number;
    cableId: string;
  } | null>(null);
  const [status, setStatus] = useState(
    "Rack 2.6.6 source tree detected · Web ABI 0.3",
  );
  const [busy, setBusy] = useState(false),
    [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set()),
    [selectedCableIds, setSelectedCableIds] = useState<Set<string>>(
      () => new Set(),
    ),
    [pending, setPending] = useState<PortClick | null>(null);
  const [audioRunning, setAudioRunning] = useState(false);
  const [midiDevices, setMidiDevices] = useState<{
    inputs: string[];
    outputs: string[];
  }>({ inputs: [], outputs: [] });
  const [midiLearnParamId, setMidiLearnParamId] = useState(0),
    [midiLearnArmed, setMidiLearnArmed] = useState(false);
  const [inspectorStateOpen, setInspectorStateOpen] = useState(false);
  const [, setAutomationRecording] = useState(false),
    [automationPlaying, setAutomationPlaying] = useState(false);
  const [recordingIds, setRecordingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [registry, setRegistry] = useState(() => allWebPlugins());
  const [autosaveReady, setAutosaveReady] = useState(false),
    [patchName, setPatchName] = useState("Peach-Patch.vcv");
  const [pan, setPan] = useState({ x: 30, y: 72 }),
    [zoom, setZoom] = useState(0.9),
    [telemetry, setTelemetry] = useState<Record<string, string>>({});
  const [rackViewportSize, setRackViewportSize] = useState({
    width: 0,
    height: 0,
  });
  const [portPeaks, setPortPeaks] = useState<{
    moduleId: string;
    inputs: number[];
    outputs: number[];
    inputScopes: number[][];
    outputScopes: number[][];
  } | null>(null);
  const [visualSignals, setVisualSignals] = useState<{
    cables: Record<string, number>;
    plugs: Record<string, RackPlugSignal>;
    scopes: Record<string, number[][]>;
    lights: Record<string, number[]>;
  }>({ cables: {}, plugs: {}, scopes: {}, lights: {} });
  const [cablesVisible, setCablesVisible] = useState(true),
    [cableOpacity, setCableOpacity] = useState(1),
    [modulesLocked, setModulesLocked] = useState(false),
    [libraryOpen, setLibraryOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null),
    presetFileRef = useRef<HTMLInputElement>(null),
    presetTargetRef = useRef<string | null>(null),
    patchFileHandleRef = useRef<BrowserFileHandle | null>(null),
    automationRecordingRef = useRef(false),
    automationStartRef = useRef(0),
    automationEventsRef = useRef<PatchAutomationEvent[]>([]),
    automationTimersRef = useRef<number[]>([]),
    automationBeforeRef = useRef<PatchDocument | null>(null),
    automationPlaybackCountRef = useRef(0),
    automationStructureRef = useRef(""),
    rackRef = useRef<HTMLDivElement>(null),
    wasmRef = useRef(new Map<string, WasmExports>());
  const clipboardRef = useRef<{
    modules: ModuleInstance[];
    cables: PatchDocument["cables"];
  } | null>(null);
  const audioRef = useRef<RackAudioEngine | null>(null);
  const audioModuleSyncRef = useRef(
    new Map<string, { controls: string; data: string }>(),
  );
  const audioPatchRef = useRef(patch),
    audioStructureRef = useRef(""),
    audioRestartRef = useRef(0);
  const dragRef = useRef<{
    ids: string[];
    clientX: number;
    clientY: number;
    origins: Map<string, { x: number; y: number }>;
    before: PatchDocument;
  } | null>(null);
  const marqueeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    base: Set<string>;
  } | null>(null);
  const panGestureRef = useRef<{
      pointerId: number;
      clientX: number;
      clientY: number;
      panX: number;
      panY: number;
    } | null>(null),
    touchPointsRef = useRef(new Map<number, { x: number; y: number }>()),
    pinchRef = useRef<{
      distance: number;
      zoom: number;
      worldX: number;
      worldY: number;
    } | null>(null);
  const hoveredModuleRef = useRef<string | null>(null),
    hoveredParamRef = useRef<{ moduleId: string; paramId: number } | null>(null),
    copiedParamRef = useRef<number | null>(null),
    midiLearnTargetRef = useRef<{ moduleId: string; paramId: number } | null>(
      null,
    ),
    runStrokeSpecialRef = useRef<
      (
        source: ModuleInstance,
        binding: ReturnType<typeof strokeBindings>[number],
      ) => void
    >(() => {});

  const resolveModule = useCallback(async (url: string) => {
    const response = await fetch(
        `/api/library/resolve?url=${encodeURIComponent(url)}`,
      ),
      result = (await response.json()) as ResolveResult;
    if (!response.ok || result.error)
      throw new Error(result.error || "Module could not be resolved");
    return result;
  }, []);

  const recordAutomationValue = useCallback(
    (moduleId: string, paramId: number, value: number) => {
      if (!automationRecordingRef.current) return;
      appendAutomationEvent(automationEventsRef.current, {
        timeMs: Math.max(0, performance.now() - automationStartRef.current),
        moduleId,
        paramId,
        value,
      });
    },
    [],
  );

  const setModuleParam = useCallback(
    (moduleId: string, id: number, value: number) => {
      audioRef.current?.setParam(moduleId, id, value);
      recordAutomationValue(moduleId, id, value);
      commitHistory((current) => ({
        ...current,
        modules: current.modules.map((module) =>
          module.id === moduleId
            ? {
                ...module,
                params: module.params.map((currentValue, index) =>
                  index === id ? value : currentValue,
                ),
              }
            : module,
        ),
      }));
    },
    [commitHistory, recordAutomationValue],
  );

  const setModuleState = useCallback(
    (moduleId: string, updates: Array<[id: number, value: number]>) => {
      for (const [id, value] of updates)
        audioRef.current?.setState(moduleId, id, value);
      commitHistory((current) => ({
        ...current,
        modules: current.modules.map((module) => {
          if (module.id !== moduleId) return module;
          const state = [...(module.state ?? [])];
          for (const [id, value] of updates) state[id] = value;
          return { ...module, state };
        }),
      }));
    },
    [commitHistory],
  );

  const createAudioEngine = useCallback(
    () =>
      new RackAudioEngine({
        onMidiParam: (moduleId, id, value) => {
          recordAutomationValue(moduleId, id, value);
          mutateHistory((current) => ({
            ...current,
            modules: current.modules.map((module) => {
              if (
                module.id !== moduleId ||
                id < 0 ||
                id >= module.params.length
              )
                return module;
              const params = [...module.params];
              params[id] = value;
              return { ...module, params };
            }),
          }));
        },
        onMidiDevices: (inputs, outputs) => setMidiDevices({ inputs, outputs }),
        onMidiMessage: (inputName, bytes) => {
          const targetRef = midiLearnTargetRef.current;
          if (!targetRef || bytes.length < 3 || (bytes[0] & 0xf0) !== 0xb0)
            return;
          const current = audioPatchRef.current,
            target = current.modules.find(
              (module) => module.id === targetRef.moduleId,
            ),
            midiMap = current.modules.find(
              (module) => module.key === "Core/MIDI-Map",
            );
          midiLearnTargetRef.current = null;
          setMidiLearnArmed(false);
          if (!target || !midiMap) {
            setStatus("MIDI learn target or Core MIDI-Map is no longer available");
            return;
          }
          const data =
              midiMap.rack?.data && typeof midiMap.rack.data === "object"
                ? (midiMap.rack.data as Record<string, unknown>)
                : {},
            existingMaps = Array.isArray(data.maps) ? data.maps : [],
            targetRackId = Number(target.rack?.id),
            map = {
              cc: bytes[1] & 0x7f,
              moduleId: Number.isInteger(targetRackId) ? targetRackId : -1,
              patchworkModuleId: target.id,
              paramId: targetRef.paramId,
            },
            maps = [
              ...existingMaps.filter((entry) => {
                if (!entry || typeof entry !== "object") return true;
                const value = entry as Record<string, unknown>;
                return !(
                  value.patchworkModuleId === target.id &&
                  Number(value.paramId) === targetRef.paramId
                );
              }),
              map,
            ],
            nextData = { ...data, maps };
          audioRef.current?.setStateJson(midiMap.id, nextData);
          commitHistory((patchValue) => ({
            ...patchValue,
            modules: patchValue.modules.map((module) =>
              module.id === midiMap.id
                ? {
                    ...module,
                    rack: { ...(module.rack ?? {}), data: nextData },
                  }
                : module,
            ),
          }));
          const definition = getWebPlugin(target.key),
            paramName =
              definition?.params.find(
                (param) => param.id === targetRef.paramId,
              )?.name ?? `parameter ${targetRef.paramId + 1}`;
          setStatus(
            `MIDI learn · ${inputName || "default input"} CC ${map.cc} → ${target.plugin}/${target.model} ${paramName}`,
          );
        },
        onAutomationComplete: () => {
          const before = automationBeforeRef.current;
          automationBeforeRef.current = null;
          automationStructureRef.current = "";
          if (before) checkpointHistory(before);
          setAutomationPlaying(false);
          setStatus(
            `AudioWorklet automation complete · ${automationPlaybackCountRef.current} events · undo is available`,
          );
        },
        onPortPeaks: (
          moduleId,
          inputs,
          outputs,
          inputScopes,
          outputScopes,
        ) =>
          setPortPeaks({
            moduleId,
            inputs,
            outputs,
            inputScopes,
            outputScopes,
          }),
        onVisualSignals: (cables, scopes, plugs, lights) =>
          setVisualSignals({ cables, scopes, plugs, lights }),
        onStateSnapshot: (moduleId, data) =>
          commitHistory((current) => ({
            ...current,
            modules: current.modules.map((module) => {
              if (module.id !== moduleId) return module;
              const previous =
                  module.rack?.data && typeof module.rack.data === "object"
                    ? (module.rack.data as Record<string, unknown>)
                    : {},
                hostData = Object.fromEntries(
                  Object.entries(previous).filter(([key]) =>
                    key.startsWith("patchworkWeb"),
                  ),
                ),
                merged = { ...data, ...hostData },
                definition = getWebPlugin(module.key),
                state = stateFromData(
                  module.key,
                  merged,
                  definition?.stateKeys,
                );
              return {
                ...module,
                rack: { ...(module.rack ?? {}), data: merged },
                state: state.length ? state : module.state,
              };
            }),
          })),
        onCaptureState: (moduleId, active) =>
          setRecordingIds((current) => {
            const next = new Set(current);
            if (active) next.add(moduleId);
            else next.delete(moduleId);
            return next;
          }),
        onRecordingComplete: (recording) => {
          const rackModule = audioPatchRef.current.modules.find(
              (module) => module.id === recording.moduleId,
            ),
            stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z"),
            name = `${rackModule?.model || "Recorder"}-${stamp}.wav`,
            url = URL.createObjectURL(recording.blob),
            anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = name;
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          setStatus(
            `${name} captured · ${(recording.frames / recording.sampleRate).toFixed(1)}s · ${recording.channels === 2 ? "stereo" : "mono"}`,
          );
        },
      }),
    [
      checkpointHistory,
      commitHistory,
      mutateHistory,
      recordAutomationValue,
    ],
  );

  const compileModule = useCallback(async (url: string) => {
    const response = await fetch(`${LOCAL_PLUGIN_BUILDER}/compile`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      }),
      result = (await response.json()) as {
        runtime?: WebPluginModule;
        error?: string;
      };
    if (!response.ok || !result.runtime)
      throw new Error(result.error || "Local Rack Web compiler is unavailable");
    registerDynamicModule(result.runtime);
    setRegistry(allWebPlugins());
    return result.runtime;
  }, []);

  useEffect(() => {
    void fetch(`${LOCAL_PLUGIN_BUILDER}/catalog`)
      .then((response) => (response.ok ? response.json() : []))
      .then((modules: WebPluginModule[]) => {
        if (!Array.isArray(modules) || !modules.length) return;
        registerDynamicModules(modules);
        setRegistry(allWebPlugins());
        mutateHistory((current) => {
          let changed = false;
          const nextModules = current.modules.map((module) => {
            if (module.key === "Core/Blank") return module;
            const width = getWebPlugin(module.key)?.width;
            if (!width || Math.abs(module.width - width) < 0.001) return module;
            changed = true;
            return { ...module, width };
          });
          return changed ? { ...current, modules: nextModules } : current;
        });
      })
      .catch(() => undefined);
  }, [mutateHistory]);

  useEffect(() => {
    const rack = rackRef.current;
    if (!rack) return;
    const updateSize = () =>
      setRackViewportSize({
        width: rack.clientWidth,
        height: rack.clientHeight,
      });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(rack);
    return () => observer.disconnect();
  }, []);

  const addFromUrl = async () => {
    if (modulesLocked) {
      setStatus("Exit Perform mode before adding a module");
      return;
    }
    setBusy(true);
    setStatus("Reading official Library module metadata…");
    try {
      const result = await resolveModule(moduleUrl);
      const addRuntime = (runtime: WebPluginModule) => {
        history.commit((current) => {
          const position = findOpenPosition(current.modules, runtime.width, {
            x: (-pan.x + 80) / zoom,
            y: (-pan.y + 80) / zoom,
          });
          return {
            ...current,
            modules: [
              ...current.modules,
              moduleFromDefinition(runtime, position.x, position.y),
            ],
          };
        });
      };
      setStatus(`${result.key}: isolating original Rack DSP and compiling WASM…`);
      try {
        const runtime = await compileModule(moduleUrl);
        addRuntime(runtime);
        setStatus(`${result.key} compiled from original Rack source and loaded`);
      } catch (compileFailure) {
        const compileError =
          compileFailure instanceof Error
            ? compileFailure.message
            : "Automatic build failed";
        if (result.compiled && result.runtime) {
          addRuntime(result.runtime);
          setStatus(
            `${result.key} loaded with bundled browser adapter · source build: ${compileError}`,
          );
        } else {
          const origin = {
              x: (-pan.x + 80) / zoom,
              y: (-pan.y + 80) / zoom,
            },
            position = findOpenPosition(history.value.modules, 240, origin),
            instance: ModuleInstance = {
              id: newModuleId(),
              key: result.key,
              plugin: result.plugin,
              model: result.model,
              version: result.version,
              x: position.x,
              y: position.y,
              width: 240,
              params: [],
              status: "source-required",
              description: result.description,
              screenshotUrl: result.screenshotUrl,
              sourceUrl: result.sourceUrl,
              license: result.license,
              error: compileError,
            };
          history.commit((current) => ({
            ...current,
            modules: [...current.modules, instance],
          }));
          setStatus(`${result.key}: ${compileError}`);
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Module load failed");
    } finally {
      setBusy(false);
    }
  };

  const hydrateMissing = useCallback(
    async (modules: ModuleInstance[]) => {
      const missing = [
        ...new Map(
          modules
            .filter((module) => module.status !== "ready")
            .map((module) => [module.key, module]),
        ).values(),
      ];
      if (!missing.length) {
        setStatus("Patch opened · all modules ready");
        return;
      }
      let completed = 0,
        loaded = 0,
        blocked = 0;
      setStatus(`Resolving 0/${missing.length} missing plugin models…`);
      await runWithConcurrency(missing, 2, async (module) => {
          try {
            const result = await resolveModule(
              `https://library.vcvrack.com/${module.plugin}/${module.model}`,
            );
            const runtime =
              result.runtime ??
              (await compileModule(
                `https://library.vcvrack.com/${module.plugin}/${module.model}`,
              ).catch(() => undefined));
            if (runtime) loaded++;
            else blocked++;
            mutateHistory((current) => ({
              ...current,
              modules: current.modules.map((item) =>
                item.key !== module.key
                  ? item
                  : runtime
                    ? hydrateModuleWithDefinition(item, runtime, result)
                    : {
                      ...item,
                      version: result.version ?? item.version,
                      status: "source-required",
                      description: result.description,
                      screenshotUrl: result.screenshotUrl,
                      sourceUrl: result.sourceUrl,
                      license: result.license,
                    },
              ),
            }));
          } catch (error) {
            blocked++;
            mutateHistory((current) => ({
              ...current,
              modules: current.modules.map((item) =>
                item.key === module.key
                  ? {
                      ...item,
                      status: "error",
                      error:
                        error instanceof Error ? error.message : "Not found",
                    }
                  : item,
              ),
            }));
          } finally {
            completed++;
            setStatus(
              `Resolving ${completed}/${missing.length} missing plugin models · ${loaded} loaded · ${blocked} blocked`,
            );
          }
        });
      setStatus(
        blocked
          ? `Patch opened · ${loaded} missing models loaded · ${blocked} still need a browser adapter`
          : `Patch opened · all ${loaded} missing plugin models loaded`,
      );
    },
    [compileModule, mutateHistory, resolveModule],
  );

  const openPatch = async (file: File) => {
    for (const timer of automationTimersRef.current) window.clearTimeout(timer);
    automationTimersRef.current = [];
    automationBeforeRef.current = null;
    automationRecordingRef.current = false;
    setAutomationPlaying(false);
    setAutomationRecording(false);
    setBusy(true);
    try {
      const raw = parseVcvArchive(await file.arrayBuffer()),
        minX = raw.modules.length
          ? Math.min(...raw.modules.map((module) => module.pos[0]))
          : 0,
        minY = raw.modules.length
          ? Math.min(...raw.modules.map((module) => module.pos[1]))
          : 0,
        rack = Object.fromEntries(
          Object.entries(raw).filter(
            ([key]) => key !== "modules" && key !== "cables",
          ),
        );
      const modules = raw.modules.map((source) => {
        const key = `${source.plugin}/${source.model}`,
          definition = getWebPlugin(key),
          values =
            definition?.params.map((param) => param.default) ??
            Array.from({ length: source.params?.length ?? 0 }, () => 0);
        source.params?.forEach((param) => {
          values[param.id] = param.value;
        });
        const blankWidth =
          source.plugin === "Core" && source.model === "Blank"
            ? Math.max(45, Number(source.data?.width ?? 10) * 15)
            : undefined;
        return {
          id: `vcv-${source.id}`,
          key,
          plugin: source.plugin,
          model: source.model,
          version: source.version ?? definition?.version,
          x: (source.pos[0] - minX) * 15,
          y: (source.pos[1] - minY) * 380,
          width:
            blankWidth ??
            definition?.width ??
            Math.max(90, Number(source.data?.width ?? 12) * 15),
          params: values,
          state: stateFromData(key, source.data, definition?.stateKeys),
          stateKeys: definition?.stateKeys,
          asset: sampleAssetFromData(source.data),
          assets: sampleAssetsFromData(source.data),
          polyphony:
            polyphonyFromData(source.data) ??
            (definition?.polyphonic ? 1 : undefined),
          bypassed: source.bypass === true || source.disabled === true,
          rack: { ...source },
          status: definition ? "ready" : "resolving",
          description: definition?.description,
          screenshotUrl: definition?.screenshotUrl,
          sourceUrl: definition?.sourceUrl,
          license: definition?.license,
        } as ModuleInstance;
      });
      const cables = raw.cables.map((cable) => ({
        id: `vcv-cable-${cable.id}`,
        fromModule: `vcv-${cable.outputModuleId}`,
        fromPort: cable.outputId,
        toModule: `vcv-${cable.inputModuleId}`,
        toPort: cable.inputId,
        color: cable.color ?? CABLES[cable.id % CABLES.length],
        rack: { ...cable },
      }));
      history.commit({ modules, cables, rack, rackOrigin: [minX, minY] });
      setSelectedIds(new Set());
      setSelectedCableIds(new Set());
      setReplaceMode(false);
      setPending(null);
      setTelemetry({});
      const fitted = fittedPatchViewport(
        modules,
        rackRef.current?.clientWidth ?? window.innerWidth,
        Math.max(200, window.innerHeight - 80),
      );
      setPan(fitted?.pan ?? { x: 20, y: 70 });
      setZoom(fitted?.zoom ?? 0.55);
      setLibraryOpen(false);
      setPatchName(`${file.name.replace(/\.vcv$/i, "")}-web.vcv`);
      setStatus(
        `${file.name} · ${modules.length} modules · ${cables.length} cables · resolving plugins…`,
      );
      void hydrateMissing(modules);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Invalid .vcv patch");
    } finally {
      setBusy(false);
    }
  };

  const choosePatchFile = async () => {
    // A regular file input is supported by every target browser and remains
    // controllable by accessibility tools. showOpenFilePicker() bypasses the
    // DOM chooser event in several embedded browsers, leaving Open .vcv inert.
    fileRef.current?.click();
  };

  const loadSample = async (module: ModuleInstance, file: File, slot = 0) => {
    const assetContract = getWebPlugin(module.key)?.runtime?.asset;
    if (!assetContract) {
      setStatus(`${module.plugin}/${module.model} does not expose a browser audio asset input`);
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setStatus("Sample is larger than the 100 MB browser decode limit");
      return;
    }
    setBusy(true);
    setStatus(`Decoding ${file.name} locally…`);
    let decoder: AudioContext | null = null;
    try {
      if (assetContract.type === "image") {
        const bitmap = await createImageBitmap(file),
          maxPixels = Math.max(1, Math.floor(assetContract.maxSamples / 4)),
          scale = Math.min(1, Math.sqrt(maxPixels / (bitmap.width * bitmap.height))),
          width = Math.max(1, Math.floor(bitmap.width * scale)),
          height = Math.max(1, Math.floor(bitmap.height * scale)),
          canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Browser could not create an image decoder");
        context.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        const rgba = context.getImageData(0, 0, width, height).data,
          samples = new Float32Array(width * height * 4);
        for (let index = 0; index < rgba.length; index++) samples[index] = rgba[index] / 255;
        const ref: SampleAssetRef = {
          storageKey: `sample-${crypto.randomUUID()}`,
          name: file.name,
          sampleRate: width,
          channels: 4,
          frames: width * height,
        };
        await putSample({ ref, samples });
        commitHistory((current) => ({
          ...current,
          modules: current.modules.map((item) => item.id === module.id ? { ...item, asset: ref } : item),
        }));
        setStatus(`${file.name} loaded · ${width}×${height} RGBA · stored in this browser`);
        return;
      }
      decoder = new AudioContext();
      const buffer = await decoder.decodeAudioData(await file.arrayBuffer()),
        channels = Math.min(assetContract.channels, buffer.numberOfChannels),
        frames = Math.min(
          buffer.length,
          Math.floor(buffer.sampleRate * assetContract.maxSeconds),
          Math.floor(assetContract.maxSamples / channels),
        ),
        samples = new Float32Array(frames * channels);
      for (let frame = 0; frame < frames; frame++)
        for (let channel = 0; channel < channels; channel++)
          samples[frame * channels + channel] =
            buffer.getChannelData(channel)[frame];
      const ref: SampleAssetRef = {
        storageKey: `sample-${crypto.randomUUID()}`,
        name: file.name,
        sampleRate: buffer.sampleRate,
        channels,
        frames,
      };
      await putSample({ ref, samples });
      commitHistory((current) => ({
        ...current,
        modules: current.modules.map((item) =>
          item.id === module.id
            ? assetContract.slots && assetContract.slots > 1
              ? {
                  ...item,
                  assets: Array.from(
                    { length: assetContract.slots },
                    (_, index) => (index === slot ? ref : item.assets?.[index]),
                  ),
                }
              : { ...item, asset: ref }
            : item,
        ),
      }));
      setStatus(
        `${file.name} loaded${assetContract.slots && assetContract.slots > 1 ? ` into channel ${slot + 1}` : ""} · ${(frames / buffer.sampleRate).toFixed(1)}s · ${channels === 2 ? "stereo" : "mono"} · stored in this browser`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Browser could not decode this audio file",
      );
    } finally {
      await decoder?.close();
      setBusy(false);
    }
  };

  const runClock = async (module: ModuleInstance) => {
    const definition = getWebPlugin(module.key);
    if (!definition) return;
    try {
      let wasm = wasmRef.current.get(module.id);
      if (!wasm) {
        const bytes = await fetch(definition.wasmUrl).then((response) =>
            response.arrayBuffer(),
          ),
          wasiHolder: { runtime?: WasmExports; randomState?: number } = {},
          result = await WebAssembly.instantiate(
            bytes,
            browserWasiImports(wasiHolder),
          );
        wasm = result.instance.exports as unknown as WasmExports;
        wasiHolder.runtime = wasm;
        wasm._initialize();
        wasm.rack_web_seed(0x51c0ffee);
        wasmRef.current.set(module.id, wasm);
      }
      wasm.rack_web_set_polyphony(module.polyphony ?? 1);
      module.params.forEach((value, id) => wasm!.rack_web_set_param(id, value));
      loadWasmStateJson(
        wasm,
        dataFromState(
          module.key,
          module.rack?.data && typeof module.rack.data === "object"
            ? (module.rack.data as Record<string, unknown>)
            : undefined,
          module.state,
          module.stateKeys,
        ),
      );
      module.state?.forEach((value, id) => wasm!.rack_web_set_state(id, value));
      const input = new Float32Array(
          wasm.memory.buffer,
          wasm.rack_web_input_buffer(),
          definition.inputs.length * 16 * 128,
        ),
        output = new Float32Array(
          wasm.memory.buffer,
          wasm.rack_web_output_buffer(),
          definition.outputs.length * 16 * 128,
        ),
        lights = new Float32Array(
          wasm.memory.buffer,
          wasm.rack_web_light_buffer(),
          definition.lights,
        ),
        testInput =
          module.key === "Fundamental/ADSR"
            ? 4
            : module.key === "Fundamental/VCA"
              ? 2
              : module.key === "Fundamental/SEQ3"
                ? 1
                : 0;
      input.fill(0);
      definition.inputs.forEach((port) => {
        const connected = port.id === testInput && definition.inputs.length > 0;
        wasm!.rack_web_set_input_connected(port.id, connected ? 1 : 0);
        wasm!.rack_web_set_input_channels(port.id, connected ? 1 : 0);
      });
      definition.outputs.forEach((port) =>
        wasm!.rack_web_set_output_connected(port.id, 1),
      );
      if (module.key === "Fundamental/ADSR")
        input.fill(10, testInput * 128, (testInput + 1) * 128);
      else if (definition.inputs.length) input[testInput * 128] = 10;
      wasm.rack_web_process(128, 48000);
      const peaks = definition.outputs
          .map(
            (port) =>
              `${port.name} ${Math.max(...Array.from(output.slice(port.id * 128, port.id * 128 + 128), (value) => Math.abs(value))).toFixed(2)}V`,
          )
          .join(" · "),
        activeLights = Array.from(lights).filter((value) => value > 0.5).length;
      setTelemetry((current) => ({
        ...current,
        [module.id]: `${peaks || "No signal ports"} · ${activeLights} lights`,
      }));
      setStatus(`${module.key} processed 128 frames in WebAssembly`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "WASM failed");
    }
  };

  const connectPort = (port: PortClick) => {
    if (modulesLocked) {
      setStatus("Exit Perform mode before changing cables");
      setPending(null);
      return;
    }
    if (!pending) {
      setPending(port);
      return;
    }
    if (
      pending.direction === port.direction ||
      pending.moduleId === port.moduleId
    ) {
      setPending(port);
      return;
    }
    const from = pending.direction === "out" ? pending : port,
      to = pending.direction === "in" ? pending : port;
    const next = connectPatchCable(
      patch,
      from,
      to,
      `cable-${crypto.randomUUID()}`,
      CABLES[patch.cables.length % CABLES.length],
    );
    if (!next) return;
    commitHistory(next);
    setSelectedCableIds(new Set());
    setPending(null);
    setStatus("Cable connected · undo is available");
  };

  const connectDraggedPorts = (first: PortClick, second: PortClick) => {
    if (modulesLocked) {
      setPending(null);
      setStatus("Exit Perform mode before changing cables");
      return;
    }
    if (
      first.direction === second.direction ||
      first.moduleId === second.moduleId
    ) {
      setPending(null);
      setStatus("Drag between an output and an input on different modules");
      return;
    }
    const from = first.direction === "out" ? first : second,
      to = first.direction === "in" ? first : second,
      next = connectPatchCable(
        patch,
        from,
        to,
        `cable-${crypto.randomUUID()}`,
        CABLES[patch.cables.length % CABLES.length],
      );
    setPending(null);
    if (!next) return;
    commitHistory(next);
    setSelectedCableIds(new Set());
    setStatus("Cable dragged into place · existing input cable replaced · undo is available");
  };

  const cablePaths = useMemo(() => {
      const definitionsByKey=new Map(registry.map(definition=>[definition.key,definition])),topInputs=new Map<string,{id:string;order:number}>(),topOutputs=new Map<string,{id:string;order:number}>();
      patch.cables.forEach((cable,index)=>{
        const inputOrder=Number(cable.rack?.inputPlugOrder),outputOrder=Number(cable.rack?.outputPlugOrder),
          inputKey=`${cable.toModule}:${cable.toPort}`,outputKey=`${cable.fromModule}:${cable.fromPort}`,
          rankedInput=Number.isFinite(inputOrder)?inputOrder:index*2+1,rankedOutput=Number.isFinite(outputOrder)?outputOrder:index*2;
        if((topInputs.get(inputKey)?.order??-Infinity)<=rankedInput)topInputs.set(inputKey,{id:cable.id,order:rankedInput});
        if((topOutputs.get(outputKey)?.order??-Infinity)<=rankedOutput)topOutputs.set(outputKey,{id:cable.id,order:rankedOutput});
      });
      return patch.cables
        .map((cable) => {
          const from = patch.modules.find(
              (module) => module.id === cable.fromModule,
            ),
            to = patch.modules.find((module) => module.id === cable.toModule);
          if (!from || !to) return null;
          const fromDefinition = definitionsByKey.get(from.key),
            toDefinition = definitionsByKey.get(to.key),
            outputPosition = resolvedModulePortPosition(
              from,
              "out",
              cable.fromPort,
              fromDefinition?.outputs ?? [],
              fromDefinition?.width ?? from.width,
            ),
            inputPosition = resolvedModulePortPosition(
              to,
              "in",
              cable.toPort,
              toDefinition?.inputs ?? [],
              toDefinition?.width ?? to.width,
            ),
            x1 = outputPosition.x,
            y1 = outputPosition.y,
            x2 = inputPosition.x,
            y2 = inputPosition.y,
            sag = Math.max(70, Math.abs(x2 - x1) * 0.22),
            slumpX = (x1 + x2) / 2,
            slumpY = (y1 + y2) / 2 + sag,
            outputAngle = Math.atan2(slumpY - y1, slumpX - x1),
            inputAngle = Math.atan2(slumpY - y2, slumpX - x2),
            plugClearance = 14,
            cableStartX = x1 + Math.cos(outputAngle) * plugClearance,
            cableStartY = y1 + Math.sin(outputAngle) * plugClearance,
            cableEndX = x2 + Math.cos(inputAngle) * plugClearance,
            cableEndY = y2 + Math.sin(inputAngle) * plugClearance;
          return {
            ...cable,
            x1,y1,x2,y2,
            outputAngle,
            inputAngle,
            topOutputPlug:topOutputs.get(`${cable.fromModule}:${cable.fromPort}`)?.id===cable.id,
            topInputPlug:topInputs.get(`${cable.toModule}:${cable.toPort}`)?.id===cable.id,
            d: `M${cableStartX} ${cableStartY} Q${slumpX} ${slumpY},${cableEndX} ${cableEndY}`,
          };
        })
        .filter(Boolean);
    },[patch,registry]);
  const jackSignalLevels = useMemo(() => {
    const levels = new Map<string, number>();
    for (const cable of patch.cables) {
      const level = visualSignals.cables[cable.id] ?? 0,
        outputKey = `${cable.fromModule}:out:${cable.fromPort}`,
        inputKey = `${cable.toModule}:in:${cable.toPort}`;
      levels.set(outputKey, Math.max(levels.get(outputKey) ?? 0, level));
      levels.set(inputKey, Math.max(levels.get(inputKey) ?? 0, level));
    }
    return levels;
  }, [patch.cables, visualSignals.cables]);
  const structureKey = useMemo(
    () =>
      `${layoutRevision}#${patch.modules.map((module) => `${module.id}:${module.key}:${module.status}:${module.asset?.storageKey ?? ""}:${module.assets?.map(asset=>asset?.storageKey??"").join(",")??""}:${module.polyphony ?? 1}:${module.x}:${module.y}:${module.width}`).join("|")}#${patch.cables.map((cable) => `${cable.fromModule}:${cable.fromPort}>${cable.toModule}:${cable.toPort}`).join("|")}`,
    [layoutRevision, patch.cables, patch.modules],
  );
  const rackSurface = useMemo(
    () =>
      rackSurfaceBounds(
        patch.modules,
        rackViewportSize.width || 1,
        rackViewportSize.height || 1,
        pan,
        zoom,
      ),
    [pan, patch.modules, rackViewportSize.height, rackViewportSize.width, zoom],
  );
  const filteredModules = useMemo(() => {
    const query = moduleQuery.trim().toLowerCase();
    return query
      ? registry.filter((module) =>
          `${module.key} ${module.name} ${module.brand} ${module.description}`
            .toLowerCase()
            .includes(query),
        )
      : registry;
  }, [moduleQuery, registry]);
  const quickAddQuery = quickAdd?.query ?? "";
  const quickAddMatches = useMemo(() => {
    const query = quickAddQuery.trim().toLowerCase();
    return (query
      ? registry.filter((module) =>
          `${module.key} ${module.name} ${module.brand} ${module.description}`
            .toLowerCase()
            .includes(query),
        )
      : registry
    ).slice(0, 12);
  }, [quickAddQuery, registry]);
  const replaceModule = (
    targetId: string,
    definition: WebPluginModule,
  ) => {
    const target = patch.modules.find((module) => module.id === targetId),
      targetDefinition = target ? getWebPlugin(target.key) : undefined;
    if (!target) return false;
    const oldParamsByName = new Map(
        (targetDefinition?.params ?? []).map((param) => [
          param.name.trim().toLowerCase(),
          param.id,
        ]),
      ),
      replacement = {
        ...moduleFromDefinition(definition, target.x, target.y),
        id: targetId,
        params: definition.params.map((param) => {
          const oldId = oldParamsByName.get(param.name.trim().toLowerCase()),
            value = oldId === undefined ? undefined : target.params[oldId];
          return Number.isFinite(value)
            ? Math.min(param.max, Math.max(param.min, value!))
            : param.default;
        }),
        polyphony: definition.polyphonic ? (target.polyphony ?? 1) : undefined,
        bypassed: target.bypassed,
        rack:
          typeof target.rack?.id === "number"
            ? { id: target.rack.id }
            : undefined,
      },
      result = replaceModuleKeepingCompatibleCables(
        patch,
        targetId,
        replacement,
        new Set(definition.inputs.map((port) => port.id)),
        new Set(definition.outputs.map((port) => port.id)),
      );
    if (!result) return false;
    commitHistory(result.patch);
    setReplaceMode(false);
    setSelectedIds(new Set([targetId]));
    setSelectedCableIds(new Set());
    setStatus(
      `${target.key} replaced with ${definition.key} · compatible parameters and cables kept${result.droppedCables ? ` · ${result.droppedCables} incompatible cable(s) removed` : ""} · undo is available`,
    );
    return true;
  };

  const addRegistryModule = (definition: WebPluginModule) => {
      if (modulesLocked) {
        setStatus("Exit Perform mode before adding or inserting a module");
        return;
      }
      if (replaceMode && selectedIds.size === 1) {
        const targetId = selectedIds.values().next().value;
        if (targetId && replaceModule(targetId, definition)) return;
        setReplaceMode(false);
        setStatus("The selected module is no longer available to replace");
        return;
      }
      const selectedCableId =
          selectedCableIds.size === 1
            ? selectedCableIds.values().next().value
            : undefined,
        selectedCable = selectedCableId
          ? patch.cables.find((cable) => cable.id === selectedCableId)
          : undefined,
        fromModule = selectedCable
          ? patch.modules.find(
              (module) => module.id === selectedCable.fromModule,
            )
          : undefined,
        toModule = selectedCable
          ? patch.modules.find((module) => module.id === selectedCable.toModule)
          : undefined,
        canInsert = Boolean(
          selectedCable &&
            fromModule &&
            toModule &&
            definition.inputs.length &&
            definition.outputs.length,
        ),
        origin = canInsert
          ? {
              x: Math.round(
                  ((fromModule!.x + fromModule!.width / 2 +
                    toModule!.x +
                    toModule!.width / 2) /
                    2 -
                    definition.width / 2) /
                    15,
                ) * 15,
              y:
                Math.round(((fromModule!.y + toModule!.y) / 2) / 380) * 380,
            }
          : {
              x: (-pan.x + 80) / zoom,
              y: (-pan.y + 80) / zoom,
            },
        position = findOpenPosition(
          patch.modules,
          definition.width,
          origin,
        ),
        instance = moduleFromDefinition(
          definition,
          position.x,
          position.y,
        );

      if (canInsert && selectedCableId) {
        const incomingCableId = `cable-${crypto.randomUUID()}`,
          outgoingCableId = `cable-${crypto.randomUUID()}`,
          next = spliceModuleIntoCable(
            patch,
            selectedCableId,
            instance,
            incomingCableId,
            outgoingCableId,
          );
        if (next) {
          commitHistory(next);
          setSelectedIds(new Set([instance.id]));
          setSelectedCableIds(new Set());
          setStatus(
            `${definition.key} inserted on cable · input 1 → output 1 · undo is available`,
          );
          return;
        }
      }

      commitHistory((current) => ({
        ...current,
        modules: [...current.modules, instance],
      }));
      setSelectedIds(new Set([instance.id]));
      setSelectedCableIds(new Set());
      setStatus(`${definition.key} loaded`);
    };

  const addQuickModule = (definition: WebPluginModule) => {
    if (!quickAdd || modulesLocked) return;
    const position = findOpenPosition(patch.modules, definition.width, {
        x: Math.round(quickAdd.worldX / 15) * 15,
        y: Math.round(quickAdd.worldY / 380) * 380,
      }),
      instance = moduleFromDefinition(definition, position.x, position.y);
    commitHistory((current) => ({
      ...current,
      modules: [...current.modules, instance],
    }));
    setSelectedIds(new Set([instance.id]));
    setSelectedCableIds(new Set());
    setQuickAdd(null);
    setStatus(`${definition.key} added at the requested rack position`);
  };

  const selectModule = (id: string, event: PointerEvent<HTMLElement>) => {
    setReplaceMode(false);
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    if (!additive) setSelectedCableIds(new Set());
    setSelectedIds((current) => {
      if (!additive)
        return current.size === 1 && current.has(id) ? current : new Set([id]);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectCable = (
    id: string,
    event: {
      stopPropagation: () => void;
      metaKey: boolean;
      ctrlKey: boolean;
      shiftKey: boolean;
    },
  ) => {
    event.stopPropagation();
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    if (!additive) setSelectedIds(new Set());
    setSelectedCableIds((current) => {
      if (!additive)
        return current.size === 1 && current.has(id) ? current : new Set([id]);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPending(null);
  };

  const startDrag = (
    module: ModuleInstance,
    event: PointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const ids = selectedIds.has(module.id) ? [...selectedIds] : [module.id];
    if (!selectedIds.has(module.id)) setSelectedIds(new Set(ids));
    const wanted = new Set(ids),
      origins = new Map(
        patch.modules
          .filter((item) => wanted.has(item.id))
          .map((item) => [item.id, { x: item.x, y: item.y }]),
      );
    dragRef.current = {
      ids,
      clientX: event.clientX,
      clientY: event.clientY,
      origins,
      before: patch,
    };
  };

  const copySelection = useCallback(() => {
    if (!selectedIds.size) {
      setStatus("Select modules to copy");
      return;
    }
    const wanted = new Set(selectedIds),
      modules = patch.modules
        .filter((module) => wanted.has(module.id))
        .map((module) => ({
          ...module,
          params: [...module.params],
          state: module.state ? [...module.state] : undefined,
          rack: module.rack ? { ...module.rack } : undefined,
        })),
      cables = patch.cables
        .filter(
          (cable) => wanted.has(cable.fromModule) && wanted.has(cable.toModule),
        )
        .map((cable) => ({
          ...cable,
          rack: cable.rack ? { ...cable.rack } : undefined,
        }));
    clipboardRef.current = { modules, cables };
    setStatus(
      `${modules.length} modules copied · ${cables.length} internal cables`,
    );
  }, [patch, selectedIds]);

  const pasteSelection = useCallback(() => {
    const copied = clipboardRef.current;
    if (!copied) {
      setStatus("Copy modules before pasting");
      return;
    }
    const stamp = Date.now(),
      ids = new Map<string, string>();
    copied.modules.forEach((module) => ids.set(module.id, newModuleId()));
    const modules = copied.modules.map((module) => ({
        ...module,
        id: ids.get(module.id)!,
        x: module.x + 30,
        y: module.y + 40,
        params: [...module.params],
        state: module.state ? [...module.state] : undefined,
        rack: withoutRackId(module.rack),
      })),
      cables = copied.cables.flatMap((cable, index) => {
        const fromModule = ids.get(cable.fromModule),
          toModule = ids.get(cable.toModule);
        return fromModule && toModule
          ? [
              {
                ...cable,
                id: `cable-${stamp}-${index}-${crypto.randomUUID()}`,
                fromModule,
                toModule,
                rack: withoutRackId(cable.rack),
              },
            ]
          : [];
      });
    commitHistory((current) => ({
      ...current,
      modules: [...current.modules, ...modules],
      cables: [...current.cables, ...cables],
    }));
    setSelectedIds(new Set(modules.map((module) => module.id)));
    setStatus(`${modules.length} modules pasted · undo is available`);
  }, [commitHistory]);

  const duplicateSelection = useCallback(() => {
    if (!selectedIds.size) {
      setStatus("Select modules to duplicate");
      return;
    }
    const result = duplicatePatchModules(
      patch,
      selectedIds,
      () => newModuleId(),
      () => `cable-${crypto.randomUUID()}`,
    );
    if (!result) return;
    commitHistory(result.patch);
    setSelectedIds(new Set(result.moduleIds));
    setSelectedCableIds(new Set());
    setStatus(
      `${result.moduleIds.length} module${result.moduleIds.length === 1 ? "" : "s"} duplicated · ${result.cableCount} internal cable${result.cableCount === 1 ? "" : "s"} preserved`,
    );
  }, [commitHistory, patch, selectedIds]);

  const resetControls = useCallback(
    (module: ModuleInstance, definition: WebPluginModule) => {
      const next = resetModuleControls(patch, module.id, definition.params);
      if (!next) return;
      commitHistory(next);
      setStatus(
        `${module.plugin}/${module.model} controls reset to source defaults · undo is available`,
      );
    },
    [commitHistory, patch],
  );

  const randomizeControls = useCallback(
    (module: ModuleInstance, definition: WebPluginModule) => {
      const next = randomizeModuleControls(
        patch,
        module.id,
        definition.params,
      );
      if (!next) return;
      commitHistory(next);
      setStatus(
        `${module.plugin}/${module.model} controls randomized within source ranges · undo is available`,
      );
    },
    [commitHistory, patch],
  );

  const disconnectModule = useCallback(
    (module: ModuleInstance) => {
      const result = disconnectModuleCables(patch, module.id);
      if (!result) return;
      if (!result.removedCables) {
        setStatus(`${module.plugin}/${module.model} has no connected cables`);
        return;
      }
      commitHistory(result.patch);
      setSelectedCableIds(new Set());
      setPending(null);
      setStatus(
        `${result.removedCables} cable${result.removedCables === 1 ? "" : "s"} disconnected from ${module.plugin}/${module.model} · undo is available`,
      );
    },
    [commitHistory, patch],
  );

  const deleteModules = useCallback(
    (ids: Set<string>) => {
      if (!ids.size) return;
      commitHistory((current) => ({
        ...current,
        modules: current.modules.filter((module) => !ids.has(module.id)),
        cables: current.cables.filter(
          (cable) => !ids.has(cable.fromModule) && !ids.has(cable.toModule),
        ),
      }));
      setSelectedIds(
        (current) => new Set([...current].filter((id) => !ids.has(id))),
      );
      setSelectedCableIds(new Set());
      setPending((current) =>
        current && ids.has(current.moduleId) ? null : current,
      );
      setStatus(
        `${ids.size} module${ids.size === 1 ? "" : "s"} removed · undo is available`,
      );
    },
    [commitHistory],
  );
  const deleteSelection = useCallback(() => {
    if (!selectedIds.size && !selectedCableIds.size) return;
    const modules = new Set(selectedIds),
      cables = new Set(selectedCableIds);
    commitHistory((current) => ({
      ...current,
      modules: current.modules.filter((module) => !modules.has(module.id)),
      cables: current.cables.filter(
        (cable) =>
          !cables.has(cable.id) &&
          !modules.has(cable.fromModule) &&
          !modules.has(cable.toModule),
      ),
    }));
    setSelectedIds(new Set());
    setSelectedCableIds(new Set());
    setPending(null);
    setStatus(
      `${modules.size ? `${modules.size} module${modules.size === 1 ? "" : "s"}` : ""}${modules.size && cables.size ? " and " : ""}${cables.size ? `${cables.size} cable${cables.size === 1 ? "" : "s"}` : ""} removed · undo is available`,
    );
  }, [commitHistory, selectedCableIds, selectedIds]);

  const healDeleteSelection = useCallback(() => {
    if (selectedIds.size !== 1) {
      setStatus("Heal delete needs one selected module");
      return;
    }
    const moduleId = selectedIds.values().next().value,
      selectedModule = patch.modules.find(
        (candidate) => candidate.id === moduleId,
      ),
      next = moduleId
        ? removeModuleAndHealCable(
            patch,
            moduleId,
            `cable-${crypto.randomUUID()}`,
          )
        : null;
    if (!next) {
      setStatus(
        "Heal delete needs exactly one incoming and one outgoing cable",
      );
      return;
    }
    commitHistory(next);
    setSelectedIds(new Set());
    setSelectedCableIds(new Set());
    setPending(null);
    setStatus(
      `${selectedModule?.plugin}/${selectedModule?.model} removed and signal path healed · undo is available`,
    );
  }, [commitHistory, patch, selectedIds]);

  const startBackgroundGesture = (event: PointerEvent<HTMLElement>) => {
    const rack = rackRef.current;
    if (!rack) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional on older touch browsers.
    }
    if (event.pointerType === "touch") {
      touchPointsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      const points = [...touchPointsRef.current.values()];
      if (points.length === 1) {
        panGestureRef.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          panX: pan.x,
          panY: pan.y,
        };
        pinchRef.current = null;
      } else if (points.length >= 2) {
        const [first, second] = points,
          rect = rack.getBoundingClientRect(),
          midX = (first.x + second.x) / 2 - rect.left,
          midY = (first.y + second.y) / 2 - rect.top;
        pinchRef.current = {
          distance: Math.max(
            1,
            Math.hypot(second.x - first.x, second.y - first.y),
          ),
          zoom,
          worldX: (midX - pan.x) / zoom,
          worldY: (midY - pan.y) / zoom,
        };
        panGestureRef.current = null;
      }
      event.preventDefault();
      return;
    }
    if (event.button === 0 || event.button === 1) {
      panGestureRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      event.preventDefault();
    }
  };

  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    const selection = marqueeRef.current;
    if (selection?.pointerId === event.pointerId) {
      const rack = rackRef.current;
      if (!rack) return;
      const rect = rack.getBoundingClientRect();
      selection.currentX = event.clientX - rect.left;
      selection.currentY = event.clientY - rect.top;
      setMarquee({
        left: Math.min(selection.startX, selection.currentX),
        top: Math.min(selection.startY, selection.currentY),
        width: Math.abs(selection.currentX - selection.startX),
        height: Math.abs(selection.currentY - selection.startY),
      });
      event.preventDefault();
      return;
    }
    const drag = dragRef.current;
    if (drag) {
      const dx = (event.clientX - drag.clientX) / zoom,
        dy = (event.clientY - drag.clientY) / zoom;
      history.mutate((current) => ({
        ...current,
        modules: moveRackModulesWithoutOverlap(
          current.modules,
          drag.origins,
          { x: dx, y: dy },
        ),
      }));
      return;
    }
    if (event.pointerType === "touch" && touchPointsRef.current.has(event.pointerId)) {
      touchPointsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      const points = [...touchPointsRef.current.values()],
        pinch = pinchRef.current,
        rack = rackRef.current;
      if (points.length >= 2 && pinch && rack) {
        const [first, second] = points,
          rect = rack.getBoundingClientRect(),
          midX = (first.x + second.x) / 2 - rect.left,
          midY = (first.y + second.y) / 2 - rect.top,
          distance = Math.max(
            1,
            Math.hypot(second.x - first.x, second.y - first.y),
          ),
          nextZoom = Math.min(
            1.5,
            Math.max(0.08, pinch.zoom * (distance / pinch.distance)),
          );
        setZoom(nextZoom);
        setPan({
          x: midX - pinch.worldX * nextZoom,
          y: midY - pinch.worldY * nextZoom,
        });
      } else {
        const gesture = panGestureRef.current;
        if (gesture?.pointerId === event.pointerId)
          setPan({
            x: gesture.panX + event.clientX - gesture.clientX,
            y: gesture.panY + event.clientY - gesture.clientY,
          });
      }
      event.preventDefault();
      return;
    }
    const gesture = panGestureRef.current;
    if (gesture?.pointerId === event.pointerId) {
      setPan({
        x: gesture.panX + event.clientX - gesture.clientX,
        y: gesture.panY + event.clientY - gesture.clientY,
      });
      event.preventDefault();
    }
  };
  const pointerUp = (event?: PointerEvent<HTMLElement>) => {
    const selection = marqueeRef.current;
    if (selection && (!event || selection.pointerId === event.pointerId)) {
      const left = Math.min(selection.startX, selection.currentX),
        top = Math.min(selection.startY, selection.currentY),
        right = Math.max(selection.startX, selection.currentX),
        bottom = Math.max(selection.startY, selection.currentY),
        hits = modulesIntersectingViewportRect(patch.modules, pan, zoom, {
          left,
          top,
          right,
          bottom,
        }),
        next = new Set(selection.base);
      for (const id of hits) next.add(id);
      setSelectedIds(next);
      setSelectedCableIds(new Set());
      setStatus(
        `${hits.length} module${hits.length === 1 ? "" : "s"} added by marquee · ${next.size} selected`,
      );
      marqueeRef.current = null;
      setMarquee(null);
    }
    if (dragRef.current) {
      history.checkpoint(dragRef.current.before);
      dragRef.current = null;
      setLayoutRevision((revision) => revision + 1);
    }
    if (!event) return;
    touchPointsRef.current.delete(event.pointerId);
    if (panGestureRef.current?.pointerId === event.pointerId)
      panGestureRef.current = null;
    const remaining = [...touchPointsRef.current.entries()];
    pinchRef.current = null;
    if (remaining.length === 1) {
      const [pointerId, point] = remaining[0];
      panGestureRef.current = {
        pointerId,
        clientX: point.x,
        clientY: point.y,
        panX: pan.x,
        panY: pan.y,
      };
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
  };

  const fitPatch = () => {
    const rack = rackRef.current;
    if (!rack || !patch.modules.length) return;
    const fitted = fittedPatchViewport(
      patch.modules,
      rack.clientWidth,
      rack.clientHeight,
    );
    if (!fitted) return;
    setZoom(fitted.zoom);
    setPan(fitted.pan);
    setStatus(
      `Patch fitted · ${patch.modules.length} modules · ${patch.cables.length} cables`,
    );
  };

  const adjustZoom = (delta: number) => {
    const rack = rackRef.current;
    if (!rack) return;
    const nextZoom = Math.min(1.5, Math.max(0.08, zoom + delta)),
      anchor = { x: rack.clientWidth / 2, y: rack.clientHeight / 2 };
    setPan(anchoredViewportPan(pan, zoom, nextZoom, anchor));
    setZoom(nextZoom);
  };

  const togglePerformanceMode = useCallback(() => {
    const next = !modulesLocked;
    setModulesLocked(next);
    setPending(null);
    if (next) setLibraryOpen(false);
    setStatus(
      next
        ? "Perform mode · parameters stay live; layout and patching are locked"
        : "Edit mode · module movement and patching restored",
    );
  }, [modulesLocked]);

  const focusModule = (moduleId: string, requestedZoom?: number) => {
    const rack = rackRef.current,
      focusedModule = patch.modules.find(
        (candidate) => candidate.id === moduleId,
      );
    if (!rack || !focusedModule) return;
    const nextZoom = requestedZoom
      ? Math.min(1.5, Math.max(0.08, requestedZoom))
      : Math.min(
          1.25,
          Math.max(
            0.9,
            Math.min(
              (rack.clientWidth - 160) / Math.max(focusedModule.width, 180),
              (rack.clientHeight - 120) / 380,
            ),
          ),
        );
    setZoom(nextZoom);
    setPan({
      x:
        rack.clientWidth / 2 -
        (focusedModule.x + focusedModule.width / 2) * nextZoom,
      y: rack.clientHeight / 2 - (focusedModule.y + 190) * nextZoom,
    });
    setStatus(
      `Focused ${focusedModule.plugin}/${focusedModule.model} · double-click another module to follow it`,
    );
  };

  const clearAutomationTimers = useCallback(() => {
    for (const timer of automationTimersRef.current) window.clearTimeout(timer);
    automationTimersRef.current = [];
  }, []);

  const finishAutomationPlayback = useCallback(
    (message: string) => {
      clearAutomationTimers();
      audioRef.current?.stopAutomation();
      const before = automationBeforeRef.current;
      automationBeforeRef.current = null;
      automationStructureRef.current = "";
      if (before) checkpointHistory(before);
      setAutomationPlaying(false);
      setStatus(message);
    },
    [checkpointHistory, clearAutomationTimers],
  );

  const toggleAutomationRecording = useCallback(() => {
    if (automationRecordingRef.current) {
      automationRecordingRef.current = false;
      setAutomationRecording(false);
      const events = [...automationEventsRef.current],
        durationMs = Math.max(
          1,
          performance.now() - automationStartRef.current,
          events.at(-1)?.timeMs ?? 0,
        );
      if (!events.length) {
        setStatus("Automation recording stopped · no parameter changes captured");
        return;
      }
      commitHistory((current) =>
        patchWithAutomationClip(current, { durationMs, events }),
      );
      setStatus(
        `Automation captured · ${events.length} events · ${(durationMs / 1000).toFixed(1)}s · saved in patch`,
      );
      return;
    }
    if (automationPlaying)
      finishAutomationPlayback("Automation playback stopped for recording");
    automationEventsRef.current = [];
    automationStartRef.current = performance.now();
    automationRecordingRef.current = true;
    setAutomationRecording(true);
    setStatus("Automation recording · move module controls or mapped MIDI CCs");
  }, [automationPlaying, commitHistory, finishAutomationPlayback]);

  const toggleAutomationPlayback = useCallback(() => {
    if (automationPlaying) {
      finishAutomationPlayback("Automation playback stopped · undo is available");
      return;
    }
    const clip = automationClipFromPatch(patch);
    if (!clip?.events.length) {
      setStatus("Record parameter automation before playing it");
      return;
    }
    if (automationRecordingRef.current) toggleAutomationRecording();
    const validEvents = clip.events.filter((event) => {
      const targetModule = patch.modules.find(
        (item) => item.id === event.moduleId,
      );
      return (
        targetModule &&
        event.paramId >= 0 &&
        event.paramId < targetModule.params.length
      );
    });
    if (!validEvents.length) {
      setStatus("Automation targets are not present in this patch");
      return;
    }
    automationBeforeRef.current = patch;
    automationPlaybackCountRef.current = validEvents.length;
    automationStructureRef.current = structureKey;
    setAutomationPlaying(true);
    if (audioRef.current) {
      audioRef.current.playAutomation(validEvents, clip.durationMs);
      setStatus(
        `AudioWorklet automation playing · ${validEvents.length} events · sample-accurate audio clock`,
      );
      return;
    }
    for (const event of validEvents)
      automationTimersRef.current.push(
        window.setTimeout(() => {
          audioRef.current?.setParam(
            event.moduleId,
            event.paramId,
            event.value,
          );
          mutateHistory((current) => ({
            ...current,
            modules: current.modules.map((module) => {
              if (module.id !== event.moduleId) return module;
              const params = [...module.params];
              params[event.paramId] = event.value;
              return { ...module, params };
            }),
          }));
        }, event.timeMs),
      );
    automationTimersRef.current.push(
      window.setTimeout(
        () =>
          finishAutomationPlayback(
            `Automation played · ${validEvents.length} events · undo is available`,
          ),
        Math.max(clip.durationMs, validEvents.at(-1)?.timeMs ?? 0) + 10,
      ),
    );
    setStatus(
      `Automation playing · ${validEvents.length} events · ${(clip.durationMs / 1000).toFixed(1)}s`,
    );
  }, [
    automationPlaying,
    finishAutomationPlayback,
    mutateHistory,
    patch,
    structureKey,
    toggleAutomationRecording,
  ]);

  const savePatch = async () => {
    const contents = serializeVcvPatch(patch),
      pickerWindow = window as FilePickerWindow;
    try {
      let handle = patchFileHandleRef.current;
      if (!handle && pickerWindow.showSaveFilePicker)
        handle = await pickerWindow.showSaveFilePicker({
          suggestedName: patchName,
          types: [
            {
              description: "VCV Rack patch",
              accept: { "application/json": [".vcv"] },
            },
          ],
        });
      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(contents);
        await writable.close();
        patchFileHandleRef.current = handle;
        setPatchName(handle.name);
        setStatus(`${handle.name} saved in place · Rack-compatible JSON .vcv`);
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus(error instanceof Error ? error.message : "Patch save failed");
      return;
    }
    const blob = new Blob([contents], { type: "application/json" }),
      url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = patchName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus(`${patchName} downloaded · Rack-compatible JSON .vcv`);
  };

  const toggleCapture = async (module: ModuleInstance) => {
    if (recordingIds.has(module.id)) {
      audioRef.current?.setCaptureEnabled(module.id, false);
      return;
    }
    setBusy(true);
    try {
      let engine = audioRef.current;
      if (!engine) {
        engine = createAudioEngine();
        const stats = await engine.start(patch);
        audioRef.current = engine;
        engine.setMonitoredModule(
          selectedIds.size === 1
            ? (selectedIds.values().next().value ?? null)
            : null,
        );
        setAudioRunning(true);
        setStatus(
          `Audio live · ${stats.activeModules} WASM modules · ${stats.connectedCables} cables · MIDI ${stats.midiInputs} in/${stats.midiOutputs} out · ready to record`,
        );
      }
      engine.setCaptureEnabled(module.id, true);
    } catch (error) {
      await audioRef.current?.stop();
      audioRef.current = null;
      setAudioRunning(false);
      setStatus(error instanceof Error ? error.message : "Recorder failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleAudio = async () => {
    setBusy(true);
    try {
      if (audioRef.current) {
        await audioRef.current.stop();
        audioRef.current = null;
        setAudioRunning(false);
        setStatus("Browser audio stopped");
        return;
      }
      const engine = createAudioEngine(),
        stats = await engine.start(patch);
      audioRef.current = engine;
      engine.setMonitoredModule(
        selectedIds.size === 1
          ? (selectedIds.values().next().value ?? null)
          : null,
      );
      setAudioRunning(true);
      setStatus(
        `Audio live · ${stats.activeModules} WASM modules · one graph worklet · ${stats.connectedCables} cables · MIDI ${stats.midiInputs} in/${stats.midiOutputs} out · ${stats.feedbackEdges} feedback edges · ${stats.skippedModules} modules skipped`,
      );
    } catch (error) {
      await audioRef.current?.stop();
      audioRef.current = null;
      setAudioRunning(false);
      setStatus(error instanceof Error ? error.message : "Audio engine failed");
    } finally {
      setBusy(false);
    }
  };

  const strokeTargetModule = (data = "") => {
    const storedTarget = data
      ? patch.modules.find(
          (module) =>
            module.id === data ||
            module.id === `vcv-${data}` ||
            String(module.rack?.id ?? "") === data,
        )
      : undefined;
    if (storedTarget) return storedTarget;
    const hovered = hoveredModuleRef.current
      ? patch.modules.find((module) => module.id === hoveredModuleRef.current)
      : undefined;
    if (hovered) return hovered;
    if (selectedIds.size === 1) {
      const id = selectedIds.values().next().value;
      return patch.modules.find((module) => module.id === id);
    }
  };

  const saveStrokePreset = (module: ModuleInstance, asDefault: boolean) => {
    const serialized = JSON.parse(
        serializeVcvPatch({ modules: [module], cables: [] }),
      ) as { modules?: unknown[] },
      preset = serialized.modules?.[0];
    if (!preset) return;
    const blob = new Blob([JSON.stringify(preset, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${module.plugin}-${module.model}${asDefault ? "-default" : ""}.vcvm`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus(
      `${module.plugin}/${module.model} ${asDefault ? "default " : ""}preset downloaded`,
    );
  };

  const requestPresetLoad = (module: ModuleInstance) => {
    presetTargetRef.current = module.id;
    presetFileRef.current?.click();
  };

  const loadModulePreset = async (file: File) => {
    const moduleId = presetTargetRef.current;
    if (!moduleId) return;
    try {
      const preset = JSON.parse(await file.text()) as unknown;
      if (!preset || typeof preset !== "object" || Array.isArray(preset))
        throw new Error("Preset must contain one Rack module object");
      const targetModule = patch.modules.find((item) => item.id === moduleId),
        definition = targetModule ? getWebPlugin(targetModule.key) : undefined;
      if (!targetModule || !definition)
        throw new Error("Preset target is no longer available");
      const next = applyRackModulePreset(
        patch,
        moduleId,
        preset as Record<string, unknown>,
        definition,
      );
      if (!next)
        throw new Error(
          `Preset is for another model; expected ${targetModule.plugin}/${targetModule.model}`,
        );
      commitHistory(next);
      setStatus(
        `${file.name} loaded into ${targetModule.plugin}/${targetModule.model} · undo is available`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preset load failed");
    } finally {
      presetTargetRef.current = null;
    }
  };

  const runStrokeSpecial = (
    source: ModuleInstance,
    binding: ReturnType<typeof strokeBindings>[number],
  ) => {
    const target = strokeTargetModule(binding.data);
    switch (binding.mode) {
      case 9:
      case 10:
      case 11: {
        const hovered = hoveredParamRef.current,
          targetModule = hovered
            ? patch.modules.find((item) => item.id === hovered.moduleId)
            : undefined;
        if (!hovered || !targetModule) {
          setStatus("Stroke parameter command needs the pointer over a parameter");
          return;
        }
        const current = targetModule.params[hovered.paramId] ?? 0;
        if (binding.mode === 10) {
          copiedParamRef.current = current;
          setStatus(`Stroke copied ${targetModule.model} parameter ${hovered.paramId + 1}`);
          return;
        }
        const definition = getWebPlugin(targetModule.key),
          param = definition?.params.find((item) => item.id === hovered.paramId),
          next =
            binding.mode === 9
              ? (param?.min ?? 0) +
                Math.random() * ((param?.max ?? 1) - (param?.min ?? 0))
              : copiedParamRef.current;
        if (next === null) {
          setStatus("Stroke paste needs a copied parameter value first");
          return;
        }
        audioRef.current?.setParam(targetModule.id, hovered.paramId, next);
        commitHistory((currentPatch) => ({
          ...currentPatch,
          modules: currentPatch.modules.map((item) =>
            item.id === targetModule.id
              ? {
                  ...item,
                  params: item.params.map((value, id) =>
                    id === hovered.paramId ? next : value,
                  ),
                }
              : item,
          ),
        }));
        setStatus(
          `Stroke ${binding.mode === 9 ? "randomized" : "pasted"} ${targetModule.model} parameter ${hovered.paramId + 1}`,
        );
        return;
      }
      case 12:
      case 121:
        if (target) focusModule(target.id, 0.9);
        else setStatus("Stroke focus needs a hovered or selected module");
        return;
      case 14:
      case 141:
        if (target) focusModule(target.id, 0.3);
        else setStatus("Stroke focus needs a hovered or selected module");
        return;
      case 16:
      case 161: {
        const customZoom = Number(binding.data);
        if (target && Number.isFinite(customZoom)) focusModule(target.id, customZoom);
        else setStatus("Stroke custom focus is missing a valid zoom value");
        return;
      }
      case 17:
      case 171:
        if (target) focusModule(target.id, 0.9);
        else setStatus(`Stroke target module ${binding.data || "is missing"}`);
        return;
      case 13:
      case 131:
        fitPatch();
        return;
      case 15:
      case 151:
        if (zoom >= 0.75) fitPatch();
        else if (target) focusModule(target.id, 0.9);
        else setStatus("Stroke zoom toggle needs a hovered or selected module");
        return;
      case 20:
        setCableOpacity((value) => (value > 0 ? 0 : 1));
        setStatus(`Stroke ${cableOpacity > 0 ? "hid" : "restored"} cable opacity`);
        return;
      case 21:
      case 24: {
        if (!selectedCableIds.size) {
          setStatus("Stroke cable color needs at least one selected cable");
          return;
        }
        commitHistory((current) => ({
          ...current,
          cables: current.cables.map((cable) => {
            if (!selectedCableIds.has(cable.id)) return cable;
            const currentIndex = CABLES.indexOf(cable.color.toLowerCase());
            const nextColor =
              binding.mode === 24 && /^#[\da-f]{6,8}$/i.test(binding.data)
                ? binding.data
                : CABLES[(currentIndex + 1 + CABLES.length) % CABLES.length];
            return { ...cable, color: nextColor };
          }),
        }));
        setStatus(`Stroke recolored ${selectedCableIds.size} selected cable(s)`);
        return;
      }
      case 22:
        if (!selectedCableIds.size) {
          setStatus("Stroke cable rotate needs at least one selected cable");
          return;
        }
        commitHistory((current) => ({
          ...current,
          cables: [
            ...current.cables.filter((cable) => !selectedCableIds.has(cable.id)),
            ...current.cables.filter((cable) => selectedCableIds.has(cable.id)),
          ],
        }));
        setStatus("Stroke moved selected cables to the front layer");
        return;
      case 23:
        setCablesVisible((value) => !value);
        setStatus(`Stroke ${cablesVisible ? "hid" : "showed"} all cables`);
        return;
      case 33:
        setModulesLocked((value) => !value);
        setStatus(`Stroke ${modulesLocked ? "unlocked" : "locked"} module movement`);
        return;
      case 38: {
        const candidates = allWebPlugins().filter(
            (definition) => definition.key !== source.key,
          ),
          definition = candidates[Math.floor(Math.random() * candidates.length)];
        if (!definition) return;
        commitHistory((current) => {
          const position = findOpenPosition(current.modules, definition.width, {
            x: (-pan.x + 80) / zoom,
            y: (-pan.y + 80) / zoom,
          });
          return {
            ...current,
            modules: [
              ...current.modules,
              moduleFromDefinition(definition, position.x, position.y),
            ],
          };
        });
        setStatus(`Stroke added random web module ${definition.key}`);
        return;
      }
      case 36:
      case 37:
        if (target) saveStrokePreset(target, binding.mode === 37);
        else setStatus("Stroke preset save needs a hovered or selected module");
        return;
      case 40:
      case 41:
      case 42:
      case 43:
        setPan((value) => ({
          x: value.x + (binding.mode === 40 ? 30 : binding.mode === 41 ? -30 : 0),
          y: value.y + (binding.mode === 42 ? 30 : binding.mode === 43 ? -30 : 0),
        }));
        return;
      case 44:
        setStatus("Stroke window minimize is unavailable in a browser tab");
        return;
      default:
        setStatus(`Stroke desktop command ${binding.mode} has no browser-safe equivalent yet`);
    }
  };
  runStrokeSpecialRef.current = runStrokeSpecial;

  useEffect(() => {
    if (!moduleMenu && !cableMenu) return;
    const close = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".pw-module-menu,.pw-cable-menu")
      )
        return;
      setModuleMenu(null);
      setCableMenu(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [cableMenu, moduleMenu]);
  useEffect(() => {
    const dispatchStroke = (event: KeyboardEvent, active: boolean) => {
      const keyCode = rackKeyFromKeyboard(event),
        modifiers = rackModifiersFromKeyboard(event);
      if (keyCode < 0) return false;
      let matched = false;
      for (const strokeModule of patch.modules) {
        if (strokeModule.key !== "Stoermelder-P1/Stroke") continue;
        for (const binding of strokeBindings(strokeModule)) {
          if (binding.key !== keyCode || binding.mods !== modifiers) continue;
          if (event.repeat && !STROKE_REPEATABLE_MODES.has(binding.mode)) continue;
          matched = true;
          if (isStrokeCvMode(binding.mode))
            audioRef.current?.triggerAction(strokeModule.id, binding.id, active);
          else if (active) runStrokeSpecialRef.current(strokeModule, binding);
        }
      }
      return matched;
    };
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      if (dispatchStroke(event, true)) {
        event.preventDefault();
        return;
      }
      const command = event.metaKey || event.ctrlKey,
        letter = event.key.toLowerCase();
      if (event.key === "Escape" && (moduleMenu || cableMenu)) {
        event.preventDefault();
        setModuleMenu(null);
        setCableMenu(null);
        return;
      }
      if (
        modulesLocked &&
        ((command && ["z", "y", "v", "d"].includes(letter)) ||
          event.key === "Delete" ||
          event.key === "Backspace")
      ) {
        event.preventDefault();
        setStatus("Exit Perform mode before editing the patch");
        return;
      }
      if (command && letter === "z") {
        event.preventDefault();
        if (event.shiftKey) redoHistory();
        else undoHistory();
        return;
      }
      if (command && letter === "y") {
        event.preventDefault();
        redoHistory();
        return;
      }
      if (command && letter === "c") {
        event.preventDefault();
        copySelection();
        return;
      }
      if (command && letter === "v") {
        event.preventDefault();
        pasteSelection();
        return;
      }
      if (command && letter === "d") {
        event.preventDefault();
        duplicateSelection();
        return;
      }
      if (command && letter === "a") {
        event.preventDefault();
        setSelectedIds(new Set(patch.modules.map((module) => module.id)));
        setSelectedCableIds(new Set());
        setStatus(`${patch.modules.length} modules selected`);
        return;
      }
      if (command && event.shiftKey && letter === "p") {
        event.preventDefault();
        togglePerformanceMode();
        return;
      }
      if (command && event.shiftKey && letter === "r") {
        event.preventDefault();
        toggleAutomationRecording();
        return;
      }
      if (command && event.shiftKey && event.code === "Space") {
        event.preventDefault();
        toggleAutomationPlayback();
        return;
      }
      if (
        event.shiftKey &&
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedIds.size === 1
      ) {
        event.preventDefault();
        healDeleteSelection();
        return;
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        (selectedIds.size || selectedCableIds.size)
      ) {
        event.preventDefault();
        deleteSelection();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      dispatchStroke(event, false);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", keyUp);
    };
  }, [
    copySelection,
    deleteSelection,
    duplicateSelection,
    cableMenu,
    healDeleteSelection,
    modulesLocked,
    moduleMenu,
    pasteSelection,
    patch.modules,
    redoHistory,
    selectedCableIds,
    selectedIds,
    toggleAutomationPlayback,
    toggleAutomationRecording,
    togglePerformanceMode,
    undoHistory,
  ]);
  useEffect(
    () => () => {
      for (const timer of automationTimersRef.current)
        window.clearTimeout(timer);
      void audioRef.current?.stop();
    },
    [],
  );
  useEffect(() => {
    audioPatchRef.current = patch;
  }, [patch]);
  useEffect(() => {
    const engine = audioRef.current;
    if (!engine || !audioRunning) {
      audioModuleSyncRef.current.clear();
      return;
    }
    const active = new Set<string>();
    for (const rackModule of patch.modules) {
      if (rackModule.status !== "ready") continue;
      active.add(rackModule.id);
      const definition = getWebPlugin(rackModule.key),
        source =
          rackModule.rack?.data && typeof rackModule.rack.data === "object"
            ? (rackModule.rack.data as Record<string, unknown>)
            : undefined,
        data = dataFromState(
          rackModule.key,
          source,
          rackModule.state,
          rackModule.stateKeys ?? definition?.stateKeys,
        ),
        controls = JSON.stringify([
          rackModule.params,
          rackModule.state ?? [],
          Boolean(rackModule.bypassed),
        ]),
        dataSignature = JSON.stringify(data ?? {}),
        previous = audioModuleSyncRef.current.get(rackModule.id);
      if (previous?.data !== dataSignature)
        engine.setStateJson(rackModule.id, data);
      if (previous?.controls !== controls) {
        rackModule.params.forEach((value, id) =>
          engine.setParam(rackModule.id, id, value),
        );
        rackModule.state?.forEach((value, id) =>
          engine.setState(rackModule.id, id, value),
        );
        engine.setBypassed(rackModule.id, Boolean(rackModule.bypassed));
      }
      audioModuleSyncRef.current.set(rackModule.id, {
        controls,
        data: dataSignature,
      });
    }
    for (const id of audioModuleSyncRef.current.keys())
      if (!active.has(id)) audioModuleSyncRef.current.delete(id);
  }, [audioRunning, patch.modules]);
  useEffect(() => {
    if (dragRef.current) return;
    if (audioStructureRef.current === structureKey) return;
    audioStructureRef.current = structureKey;
    const previous = audioRef.current;
    if (!previous || !audioRunning) return;
    const generation = ++audioRestartRef.current;
    audioRef.current = null;
    setBusy(true);
    setStatus("Patch structure changed · rebuilding browser audio graph…");
    void (async () => {
      try {
        await previous.stop();
        if (generation !== audioRestartRef.current) return;
        const engine = createAudioEngine(),
          stats = await engine.start(audioPatchRef.current);
        if (generation !== audioRestartRef.current) {
          await engine.stop();
          return;
        }
        audioRef.current = engine;
        engine.setMonitoredModule(
          selectedIds.size === 1
            ? (selectedIds.values().next().value ?? null)
            : null,
        );
        setStatus(
          `Audio rebuilt · ${stats.activeModules} WASM modules · one graph worklet · ${stats.connectedCables} cables · MIDI ${stats.midiInputs} in/${stats.midiOutputs} out · ${stats.feedbackEdges} feedback edges · ${stats.skippedModules} modules skipped`,
        );
      } catch (error) {
        audioRef.current = null;
        setAudioRunning(false);
        setStatus(
          error instanceof Error ? error.message : "Audio graph rebuild failed",
        );
      } finally {
        if (generation === audioRestartRef.current) setBusy(false);
      }
    })();
  }, [audioRunning, createAudioEngine, selectedIds, structureKey]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const value = JSON.parse(saved) as PatchDocument;
        if (Array.isArray(value.modules) && Array.isArray(value.cables)) {
          const restored = repairDuplicateModuleIds(value),
            restoredPatch = {
              ...restored.patch,
              modules: restored.patch.modules.map((module) => {
                if (module.key === "Core/Blank") return module;
                const definition = getWebPlugin(module.key);
                return definition && module.width !== definition.width
                  ? { ...module, width: definition.width }
                  : module;
              }),
            };
          mutateHistory(() => restoredPatch);
          setLibraryOpen(restoredPatch.modules.length < 12);
          if (restoredPatch.modules.length >= 12) {
            const fitted = fittedPatchViewport(
              restoredPatch.modules,
              rackRef.current?.clientWidth ?? window.innerWidth,
              Math.max(200, window.innerHeight - 80),
            );
            if (fitted) {
              setZoom(fitted.zoom);
              setPan(fitted.pan);
            }
          }
          setStatus(
            `Autosave restored · ${value.modules.length} modules${restored.repaired ? ` · repaired ${restored.repaired} duplicate ID` : ""}`,
          );
        }
      }
    } finally {
      setAutosaveReady(true);
    }
  }, [mutateHistory]);
  useEffect(() => {
    if (!autosaveReady) return;
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(patch));
    } catch {
      setStatus("Autosave storage is full");
    }
  }, [autosaveReady, patch]);
  const selectedId =
    selectedIds.size === 1 ? selectedIds.values().next().value : undefined;
  const selectedModule = selectedId
      ? patch.modules.find((module) => module.id === selectedId)
      : undefined,
    selectedDefinition = selectedModule
      ? getWebPlugin(selectedModule.key)
      : undefined,
    selectedPeaks =
      portPeaks?.moduleId === selectedId ? portPeaks : undefined;
  const contextModule = moduleMenu
      ? patch.modules.find((module) => module.id === moduleMenu.moduleId)
      : undefined,
    contextDefinition = contextModule
      ? getWebPlugin(contextModule.key)
      : undefined,
    contextCable = cableMenu
      ? patch.cables.find((cable) => cable.id === cableMenu.cableId)
      : undefined;
  const midiMapModule = patch.modules.find(
      (module) => module.key === "Core/MIDI-Map",
    ),
    selectedLearnParamId = selectedDefinition?.params.some(
      (param) => param.id === midiLearnParamId,
    )
      ? midiLearnParamId
      : (selectedDefinition?.params[0]?.id ?? 0);
  useEffect(() => {
    midiLearnTargetRef.current = null;
    setMidiLearnArmed(false);
    setInspectorStateOpen(false);
  }, [selectedId]);
  useEffect(() => {
    if (
      automationPlaying &&
      automationStructureRef.current &&
      automationStructureRef.current !== structureKey
    )
      finishAutomationPlayback(
        "Automation stopped because the patch structure changed · undo is available",
      );
  }, [automationPlaying, finishAutomationPlayback, structureKey]);
  useEffect(() => {
    audioRef.current?.setMonitoredModule(selectedId ?? null);
    if (!selectedId) setPortPeaks(null);
  }, [audioRunning, selectedId, structureKey]);

  return (
    <main className={`pw-app ${libraryOpen ? "" : "library-collapsed"}`}>
      <header className="pw-topbar">
        <div className="pw-brand">
          <i />
          <span>PEACH</span>
          <b>PATCH</b>
        </div>
        <nav className="pw-actions" aria-label="Peach Patch application menu">
          <div className="pw-action-group" aria-label="File actions">
            <button
              type="button"
              disabled={modulesLocked}
              title="Create a new patch"
              onClick={() => {
                clearAutomationTimers();
                automationBeforeRef.current = null;
                automationRecordingRef.current = false;
                setAutomationPlaying(false);
                setAutomationRecording(false);
                history.commit(emptyPatch);
                patchFileHandleRef.current = null;
                setPatchName("Peach-Patch.vcv");
                setSelectedIds(new Set());
                setSelectedCableIds(new Set());
                setReplaceMode(false);
                setPending(null);
                setLibraryOpen(true);
                setStatus("New empty patch");
              }}
            >
              New
            </button>
            <button
              type="button"
              onClick={() => void choosePatchFile()}
              disabled={modulesLocked}
              title="Open a .vcv patch"
            >
              Open
            </button>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept=".vcv"
              onChange={(event) => {
                patchFileHandleRef.current = null;
                if (event.target.files?.[0]) void openPatch(event.target.files[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={presetFileRef}
              hidden
              type="file"
              accept=".vcvm,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadModulePreset(file);
                event.target.value = "";
              }}
            />
            <button type="button" onClick={() => void savePatch()} title="Save the current .vcv patch">
              Save
            </button>
          </div>
          <div className="pw-action-group" aria-label="History actions">
            <button
              type="button"
              onClick={history.undo}
              disabled={modulesLocked || !history.canUndo}
              title="Undo · ⌘/Ctrl+Z"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={history.redo}
              disabled={modulesLocked || !history.canRedo}
              title="Redo · ⇧⌘/Ctrl+Z"
            >
              Redo
            </button>
          </div>
          <div className="pw-action-group" aria-label="View actions">
            <button
              type="button"
              className={libraryOpen ? "active" : ""}
              aria-pressed={libraryOpen}
              onClick={() => setLibraryOpen((open) => !open)}
              title="Show or hide the module Library"
            >
              Library
            </button>
          </div>
          <button
            type="button"
            className={`pw-audio-action ${audioRunning ? "audio-live" : ""}`}
            onClick={() => void toggleAudio()}
            disabled={busy}
            title={audioRunning ? "Stop browser audio" : "Start browser audio"}
          >
            {audioRunning ? (
              <Square aria-hidden="true" size={11} strokeWidth={2.25} />
            ) : (
              <Play aria-hidden="true" size={11} strokeWidth={2.25} />
            )}
            <span>{audioRunning ? "Stop audio" : "Start audio"}</span>
          </button>
        </nav>
      </header>
      <output className="pw-status-sr" aria-live="polite">
        {status}
      </output>
      <aside className="pw-library">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void addFromUrl();
          }}
        >
          <input
            aria-label="VCV Library module URL"
            value={moduleUrl}
            onChange={(event) => setModuleUrl(event.target.value)}
            placeholder="https://library.vcvrack.com/Plugin/Model"
          />
          <button disabled={busy} type="submit" title="Load module from VCV Library URL">
            {busy ? "Loading…" : "Load URL"}
          </button>
        </form>
        <div className="pw-registry">
          <label>
            <span>
              MODULES · {filteredModules.length}/{registry.length}
            </span>
            <input
              aria-label="Search web builds"
              value={moduleQuery}
              onChange={(event) => setModuleQuery(event.target.value)}
              placeholder="VCO, mixer, brand…"
            />
          </label>
          <div className="pw-registry-results">
            {filteredModules.map((module) => (
              <button
                key={module.key}
                draggable={!modulesLocked}
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "application/x-patchwork-module",
                    module.key,
                  );
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => {
                  setModuleUrl(module.libraryUrl);
                  addRegistryModule(module);
                }}
                title={
                  replaceMode && selectedIds.size === 1
                    ? `Replace the selected module with ${module.key}`
                    : selectedCableIds.size === 1 &&
                  module.inputs.length > 0 &&
                  module.outputs.length > 0
                    ? `Insert ${module.key} on the selected cable`
                    : `Add ${module.key} to the patch`
                }
              >
                <b>{module.key}</b>
                <em>{module.version}</em>
                <small>
                  {replaceMode && selectedIds.size === 1
                    ? "REPLACE"
                    : selectedCableIds.size === 1 &&
                  module.inputs.length > 0 &&
                  module.outputs.length > 0
                    ? "INSERT"
                    : "WASM"}
                </small>
              </button>
            ))}
          </div>
        </div>
      </aside>
      <section
        ref={rackRef}
        className={`pw-rack ${modulesLocked ? "modules-locked" : ""}`}
        aria-label="Peach Patch modular rack"
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerLeave={pointerUp}
        onPointerDown={(event) => {
          const target = event.target as Element,
            background =
              event.target === event.currentTarget ||
              target.classList.contains("pw-world");
          if (background) {
            if (event.shiftKey && event.button === 0) {
              const rack = rackRef.current;
              if (!rack) return;
              const rect = rack.getBoundingClientRect(),
                startX = event.clientX - rect.left,
                startY = event.clientY - rect.top;
              marqueeRef.current = {
                pointerId: event.pointerId,
                startX,
                startY,
                currentX: startX,
                currentY: startY,
                base: new Set(selectedIds),
              };
              setMarquee({ left: startX, top: startY, width: 0, height: 0 });
              setSelectedCableIds(new Set());
              setPending(null);
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // Pointer capture is optional.
              }
              event.preventDefault();
              return;
            }
            setSelectedIds(new Set());
            setSelectedCableIds(new Set());
            setPending(null);
            setReplaceMode(false);
            setQuickAdd(null);
            setModuleMenu(null);
            setCableMenu(null);
            startBackgroundGesture(event);
          }
        }}
        onContextMenu={(event) => {
          const target = event.target as Element;
          if (
            target.closest(
              ".pw-module,.pw-cables,.pw-inspector,.pw-zoom,.pw-telemetry",
            )
          )
            return;
          event.preventDefault();
          if (modulesLocked) {
            setStatus("Exit Perform mode before adding a module");
            return;
          }
          const rack = rackRef.current;
          if (!rack) return;
          const rect = rack.getBoundingClientRect(),
            localX = event.clientX - rect.left,
            localY = event.clientY - rect.top;
          setModuleMenu(null);
          setCableMenu(null);
          setQuickAdd({
            left: Math.max(8, Math.min(localX, rack.clientWidth - 298)),
            top: Math.max(8, Math.min(localY, rack.clientHeight - 404)),
            worldX: (localX - pan.x) / zoom,
            worldY: (localY - pan.y) / zoom,
            query: "",
          });
        }}
        onWheel={(event) => {
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            const rack = rackRef.current;
            if (!rack) return;
            const rect = rack.getBoundingClientRect(),
              anchor = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              },
              nextZoom = Math.min(
                1.5,
                Math.max(0.08, zoom - event.deltaY * 0.001),
              );
            setPan(anchoredViewportPan(pan, zoom, nextZoom, anchor));
            setZoom(nextZoom);
          } else
            setPan((value) => ({
              x: value.x - event.deltaX,
              y: value.y - event.deltaY,
            }));
        }}
      >
        {selectedModule && selectedDefinition && (
          <aside
            className="pw-inspector"
            aria-label={`Live inspector for ${selectedModule.plugin}/${selectedModule.model}`}
          >
            <header>
              <span>{audioRunning ? "LIVE PORTS" : "MODULE INSPECTOR"}</span>
              <b>{selectedModule.model}</b>
              <small>{selectedModule.plugin}</small>
            </header>
            <div className="pw-inspector-ports">
              {selectedDefinition.inputs.map((port) => {
                const peak = selectedPeaks?.inputs[port.id] ?? 0;
                return (
                  <label key={`in-${port.id}`}>
                    <span>IN · {port.name}</span>
                    <PortScope
                      samples={selectedPeaks?.inputScopes[port.id] ?? []}
                      label={`${port.name} input waveform`}
                    />
                    <em>{peak.toFixed(2)}V</em>
                  </label>
                );
              })}
              {selectedDefinition.outputs.map((port) => {
                const peak = selectedPeaks?.outputs[port.id] ?? 0;
                return (
                  <label key={`out-${port.id}`}>
                    <span>OUT · {port.name}</span>
                    <PortScope
                      samples={selectedPeaks?.outputScopes[port.id] ?? []}
                      label={`${port.name} output waveform`}
                    />
                    <em>{peak.toFixed(2)}V</em>
                  </label>
                );
              })}
            </div>
            {selectedDefinition.params.some((param) => !param.hidden && !param.button) && (
              <details className="pw-inspector-params">
                <summary>
                  PARAMETERS · {selectedDefinition.params.filter((param) => !param.hidden && !param.button).length}
                </summary>
                <div>
                  {selectedDefinition.params
                    .filter((param) => !param.hidden && !param.button)
                    .map((param) => {
                      const value =
                        selectedModule.params[param.id] ?? param.default;
                      return (
                        <label key={param.id}>
                          <span title={param.name}>{param.name}</span>
                          <input
                            aria-label={`${selectedModule.model} ${param.name} inspector control`}
                            type="range"
                            min={param.min}
                            max={param.max}
                            step={param.snap ? 1 : "any"}
                            value={value}
                            onPointerEnter={() => {
                              hoveredParamRef.current = {
                                moduleId: selectedModule.id,
                                paramId: param.id,
                              };
                            }}
                            onPointerLeave={() => {
                              if (
                                hoveredParamRef.current?.moduleId ===
                                  selectedModule.id &&
                                hoveredParamRef.current.paramId === param.id
                              )
                                hoveredParamRef.current = null;
                            }}
                            onChange={(event) =>
                              setModuleParam(
                                selectedModule.id,
                                param.id,
                                Number(event.target.value),
                              )
                            }
                          />
                          <output>{Number(value).toFixed(param.snap ? 0 : 3)}</output>
                        </label>
                      );
                    })}
                </div>
              </details>
            )}
            {selectedDefinition.stateKeys?.length ? (
              <details
                className="pw-inspector-state"
                open={inspectorStateOpen}
                onToggle={(event) =>
                  setInspectorStateOpen(event.currentTarget.open)
                }
              >
                <summary>
                  MODULE STATE · {selectedDefinition.stateKeys.length}
                </summary>
                {inspectorStateOpen && (
                  <div>
                    {selectedDefinition.stateKeys.map((stateKey, id) => {
                      const value = Number(selectedModule.state?.[id] ?? 0),
                        suffix = stateKey.path?.length
                          ? `.${stateKey.path.join(".")}`
                          : stateKey.index === undefined
                            ? ""
                            : `[${stateKey.index}]`,
                        label = `${stateKey.key}${suffix}`;
                      return (
                        <label key={`${label}-${id}`}>
                          <span title={label}>{label}</span>
                          {stateKey.type === "boolean" ? (
                            <input
                              aria-label={`${selectedModule.model} ${label} state`}
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(event) =>
                                setModuleState(selectedModule.id, [
                                  [id, event.target.checked ? 1 : 0],
                                ])
                              }
                            />
                          ) : stateKey.type === "string-enum" ? (
                            <select
                              aria-label={`${selectedModule.model} ${label} state`}
                              value={Math.round(value)}
                              onChange={(event) =>
                                setModuleState(selectedModule.id, [
                                  [id, Number(event.target.value)],
                                ])
                              }
                            >
                              {(stateKey.values ?? []).map((option, index) => (
                                <option key={`${option}-${index}`} value={index}>
                                  {option || `(empty ${index})`}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              aria-label={`${selectedModule.model} ${label} state`}
                              type="number"
                              step={stateKey.type === "integer" ? 1 : "any"}
                              value={value}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                if (Number.isFinite(next))
                                  setModuleState(selectedModule.id, [[id, next]]);
                              }}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </details>
            ) : null}
            {selectedDefinition.params.length > 0 && (
              <div className="pw-midi-learn">
                <label>
                  <span>MIDI LEARN TARGET</span>
                  <select
                    aria-label={`${selectedModule.model} MIDI learn parameter`}
                    value={selectedLearnParamId}
                    onChange={(event) =>
                      setMidiLearnParamId(Number(event.target.value))
                    }
                  >
                    {selectedDefinition.params.map((param) => (
                      <option key={param.id} value={param.id}>
                        {param.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={midiLearnArmed ? "active" : ""}
                  disabled={!audioRunning || !midiMapModule}
                  title={
                    !midiMapModule
                      ? "Add a Core MIDI-Map module first"
                      : !audioRunning
                        ? "Start audio to receive Web MIDI"
                        : "Move the next MIDI CC to create a mapping"
                  }
                  onClick={() => {
                    midiLearnTargetRef.current = {
                      moduleId: selectedModule.id,
                      paramId: selectedLearnParamId,
                    };
                    setMidiLearnArmed(true);
                    setStatus(
                      `MIDI learn armed for ${selectedModule.plugin}/${selectedModule.model} ${selectedDefinition.params.find((param) => param.id === selectedLearnParamId)?.name ?? "parameter"} · move a CC`,
                    );
                  }}
                >
                  {midiLearnArmed ? "Waiting for CC…" : "Map next MIDI CC"}
                </button>
              </div>
            )}
            <div className="pw-inspector-actions">
              {selectedModule.sourceUrl && (
                <a
                  href={selectedModule.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original source
                </a>
              )}
              <button
                type="button"
                disabled={modulesLocked}
                onClick={() => {
                  setReplaceMode(true);
                  setLibraryOpen(true);
                  setStatus(
                    `Choose a Library module to replace ${selectedModule.plugin}/${selectedModule.model}`,
                  );
                }}
              >
                Replace from Library…
              </button>
              <button
                type="button"
                disabled={modulesLocked}
                onClick={duplicateSelection}
                title="⌘/Ctrl+D"
              >
                Duplicate
              </button>
              <button
                type="button"
                disabled={modulesLocked || !selectedDefinition.params.length}
                onClick={() => resetControls(selectedModule, selectedDefinition)}
              >
                Initialize controls
              </button>
              <button
                type="button"
                disabled={modulesLocked || !selectedDefinition.params.length}
                onClick={() => randomizeControls(selectedModule, selectedDefinition)}
              >
                Randomize controls
              </button>
              <button
                type="button"
                disabled={modulesLocked}
                onClick={() => disconnectModule(selectedModule)}
              >
                Disconnect cables
              </button>
              <button
                type="button"
                onClick={() => saveStrokePreset(selectedModule, false)}
              >
                Save .vcvm preset
              </button>
              <button
                type="button"
                disabled={modulesLocked}
                onClick={() => requestPresetLoad(selectedModule)}
              >
                Load .vcvm preset…
              </button>
            </div>
          </aside>
        )}
        {quickAdd && (
          <div
            className="pw-quick-add"
            style={{ left: quickAdd.left, top: quickAdd.top }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (quickAddMatches[0]) addQuickModule(quickAddMatches[0]);
              }}
            >
              <input
                autoFocus
                aria-label="Quick add module"
                value={quickAdd.query}
                onChange={(event) =>
                  setQuickAdd((current) =>
                    current
                      ? { ...current, query: event.target.value }
                      : current,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") setQuickAdd(null);
                }}
                placeholder="Add module at this position…"
              />
              <kbd>↵</kbd>
            </form>
            <div>
              {quickAddMatches.map((module) => (
                <button
                  key={module.key}
                  type="button"
                  onClick={() => addQuickModule(module)}
                >
                  <b>{module.model}</b>
                  <span>{module.plugin}</span>
                  <small>{module.inputs.length} in · {module.outputs.length} out</small>
                </button>
              ))}
              {!quickAddMatches.length && <p>No matching web build</p>}
            </div>
          </div>
        )}
        <div
          className="pw-world"
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        >
          <div
            className="pw-rack-surface"
            aria-hidden="true"
            data-rack-left={rackSurface.x}
            data-rack-top={rackSurface.y}
            data-rack-right={rackSurface.right}
            data-rack-bottom={rackSurface.bottom}
            style={{
              left: rackSurface.x,
              top: rackSurface.y,
              width: rackSurface.width,
              height: rackSurface.height,
              backgroundPosition: `${-rackSurface.x}px ${-rackSurface.y}px`,
            }}
          />
          <svg
            className="pw-cables"
            viewBox={`${rackSurface.x} ${rackSurface.y} ${rackSurface.width} ${rackSurface.height}`}
            style={{
              left: rackSurface.x,
              top: rackSurface.y,
              width: rackSurface.width,
              height: rackSurface.height,
              opacity: cableOpacity,
              display: cablesVisible ? undefined : "none",
            }}
          >
            {cablePaths.map(
              (path,index) =>
                path && (
                  <g
                    key={path.id}
                    className={`${selectedCableIds.has(path.id) ? "selected" : ""} ${Math.abs(visualSignals.cables[path.id] ?? 0) > .01 ? "powered" : ""}`}
                  >
                    <path d={path.d} stroke={path.color} />
                    <path
                      className="hit"
                      d={path.d}
                      role="button"
                      aria-label={`Cable ${path.id}`}
                      tabIndex={0}
                      onPointerDown={(event) => selectCable(path.id, event)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const rack = rackRef.current;
                        if (!rack) return;
                        const rect = rack.getBoundingClientRect(),
                          localX = event.clientX - rect.left,
                          localY = event.clientY - rect.top;
                        setSelectedIds(new Set());
                        setSelectedCableIds(new Set([path.id]));
                        setModuleMenu(null);
                        setQuickAdd(null);
                        setCableMenu({
                          left: Math.max(
                            8,
                            Math.min(localX, rack.clientWidth - 210),
                          ),
                          top: Math.max(
                            8,
                            Math.min(localY, rack.clientHeight - 178),
                          ),
                          cableId: path.id,
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectCable(path.id, event);
                        }
                      }}
                    />
                    <RackCablePlug
                      x={path.x1}
                      y={path.y1}
                      angle={path.outputAngle}
                      color={path.color}
                      signal={visualSignals.plugs[path.id]}
                      top={path.topOutputPlug}
                      gradientId={`plug-out-${index}`}
                      cableId={path.id}
                      moduleId={path.fromModule}
                      direction="out"
                      portId={path.fromPort}
                    />
                    <RackCablePlug
                      x={path.x2}
                      y={path.y2}
                      angle={path.inputAngle}
                      color={path.color}
                      signal={visualSignals.plugs[path.id]}
                      top={path.topInputPlug}
                      gradientId={`plug-in-${index}`}
                      cableId={path.id}
                      moduleId={path.toModule}
                      direction="in"
                      portId={path.toPort}
                    />
                  </g>
                ),
            )}
          </svg>
          {patch.modules.map((module) => (
            <ModulePanel
              key={module.id}
              module={module}
              definition={getWebPlugin(module.key)}
              selected={selectedIds.has(module.id)}
              pending={pending}
              inputSignalLevels={Object.fromEntries(
                (getWebPlugin(module.key)?.inputs ?? []).flatMap((port) => {
                  const key = `${module.id}:in:${port.id}`;
                  return jackSignalLevels.has(key)
                    ? [[port.id, jackSignalLevels.get(key) ?? 0]]
                    : [];
                }),
              )}
              outputSignalLevels={Object.fromEntries(
                (getWebPlugin(module.key)?.outputs ?? []).flatMap((port) => {
                  const key = `${module.id}:out:${port.id}`;
                  return jackSignalLevels.has(key)
                    ? [[port.id, jackSignalLevels.get(key) ?? 0]]
                    : [];
                }),
              )}
              scopeSamples={visualSignals.scopes[module.id]}
              lightValues={visualSignals.lights[module.id]}
              audioRunning={audioRunning}
              onSelect={(event) => {
                setModuleMenu(null);
                setCableMenu(null);
                selectModule(module.id, event);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const rack = rackRef.current;
                if (!rack) return;
                const rect = rack.getBoundingClientRect(),
                  localX = event.clientX - rect.left,
                  localY = event.clientY - rect.top;
                setSelectedIds(new Set([module.id]));
                setSelectedCableIds(new Set());
                setQuickAdd(null);
                setCableMenu(null);
                setModuleMenu({
                  left: Math.max(8, Math.min(localX, rack.clientWidth - 224)),
                  top: Math.max(8, Math.min(localY, rack.clientHeight - 432)),
                  moduleId: module.id,
                });
              }}
              onDragStart={(event) => {
                if (modulesLocked) {
                  event.stopPropagation();
                  setStatus("Module movement is locked · use Stroke or unlock it first");
                  return;
                }
                startDrag(module, event);
              }}
              onModuleHover={(hovered) => {
                if (hovered) hoveredModuleRef.current = module.id;
                else if (hoveredModuleRef.current === module.id)
                  hoveredModuleRef.current = null;
              }}
              onFocus={() => focusModule(module.id)}
              onParam={(id, value) => {
                setModuleParam(module.id, id, value);
              }}
              onMomentary={(id, active) => {
                audioRef.current?.setParam(module.id, id, active ? 1 : 0);
                recordAutomationValue(module.id, id, active ? 1 : 0);
                if (!active) audioRef.current?.snapshotState(module.id);
              }}
              onParamHover={(paramId) => {
                if (paramId === null) {
                  if (hoveredParamRef.current?.moduleId === module.id)
                    hoveredParamRef.current = null;
                } else hoveredParamRef.current = { moduleId: module.id, paramId };
              }}
              onState={(updates) => {
                setModuleState(module.id, updates);
              }}
              onData={(data) => {
                const previous =
                    module.rack?.data && typeof module.rack.data === "object"
                      ? (module.rack.data as Record<string, unknown>)
                      : {},
                  next = { ...previous, ...data };
                audioRef.current?.setStateJson(module.id, next);
                commitHistory((current) => ({
                  ...current,
                  modules: current.modules.map((item) =>
                    item.id === module.id
                      ? {
                          ...item,
                          rack: { ...(item.rack ?? {}), data: next },
                        }
                      : item,
                  ),
                }));
              }}
              onPolyphony={(polyphony) =>
                commitHistory((current) => ({
                  ...current,
                  modules: current.modules.map((item) =>
                    item.id === module.id ? { ...item, polyphony } : item,
                  ),
                }))
              }
              midiDevices={midiDevices}
              onMidiDevice={(deviceName) => {
                const definition = getWebPlugin(module.key),
                  data =
                    module.rack?.data && typeof module.rack.data === "object"
                      ? (module.rack.data as Record<string, unknown>)
                      : {},
                  previousMidi =
                    data.midi &&
                    typeof data.midi === "object" &&
                    !Array.isArray(data.midi)
                      ? (data.midi as Record<string, unknown>)
                      : {},
                  nextData = {
                    ...data,
                    midi: { ...previousMidi, deviceName },
                  };
                audioRef.current?.setMidiDevice(
                  module.id,
                  deviceName,
                  Boolean(definition?.runtime?.midi?.input),
                  Boolean(definition?.runtime?.midi?.output),
                );
                commitHistory((current) => ({
                  ...current,
                  modules: current.modules.map((item) =>
                    item.id === module.id
                      ? {
                          ...item,
                          rack: { ...(item.rack ?? {}), data: nextData },
                        }
                      : item,
                  ),
                }));
                setStatus(
                  `${module.plugin}/${module.model} MIDI ${deviceName || "default route"} selected`,
                );
              }}
              onBypass={() => {
                const bypassed = !module.bypassed;
                audioRef.current?.setBypassed(module.id, bypassed);
                commitHistory((current) => ({
                  ...current,
                  modules: current.modules.map((item) =>
                    item.id === module.id ? { ...item, bypassed } : item,
                  ),
                }));
              }}
              onPort={connectPort}
              onPortDragStart={(port) => {
                if (modulesLocked) {
                  setStatus("Exit Perform mode before changing cables");
                  return;
                }
                setPending(port);
              }}
              onPortDrop={connectDraggedPorts}
              onPortDragEnd={() => setPending(null)}
              onClock={() => void runClock(module)}
              onSample={(file, slot) => void loadSample(module, file, slot)}
              recording={recordingIds.has(module.id)}
              onCapture={() => void toggleCapture(module)}
              onRemove={() => {
                if (modulesLocked) {
                  setStatus("Exit Perform mode before removing a module");
                  return;
                }
                deleteModules(new Set([module.id]));
              }}
              onReplaceDrop={(key) => {
                if (modulesLocked) {
                  setStatus("Exit Perform mode before replacing a module");
                  return;
                }
                const definition = getWebPlugin(key);
                if (definition) replaceModule(module.id, definition);
              }}
            />
          ))}
        </div>
        {moduleMenu && contextModule && (
          <div
            className="pw-module-menu"
            style={{ left: moduleMenu.left, top: moduleMenu.top }}
            role="menu"
            aria-label={`${contextModule.plugin}/${contextModule.model} actions`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <span>MODULE</span>
              <b>{contextModule.model}</b>
              <small>{contextModule.plugin}</small>
            </header>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const bypassed = !contextModule.bypassed;
                audioRef.current?.setBypassed(contextModule.id, bypassed);
                commitHistory((current) => ({
                  ...current,
                  modules: current.modules.map((item) =>
                    item.id === contextModule.id ? { ...item, bypassed } : item,
                  ),
                }));
                setModuleMenu(null);
              }}
            >
              {contextModule.bypassed ? "Enable module" : "Bypass module"}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={modulesLocked}
              onClick={() => {
                duplicateSelection();
                setModuleMenu(null);
              }}
            >
              Duplicate <kbd>⌘D</kbd>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={modulesLocked || !contextDefinition?.params.length}
              onClick={() => {
                if (contextDefinition)
                  resetControls(contextModule, contextDefinition);
                setModuleMenu(null);
              }}
            >
              Initialize controls
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={modulesLocked || !contextDefinition?.params.length}
              onClick={() => {
                if (contextDefinition)
                  randomizeControls(contextModule, contextDefinition);
                setModuleMenu(null);
              }}
            >
              Randomize controls
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={modulesLocked}
              onClick={() => {
                disconnectModule(contextModule);
                setModuleMenu(null);
              }}
            >
              Disconnect cables
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                saveStrokePreset(contextModule, false);
                setModuleMenu(null);
              }}
            >
              Save .vcvm preset
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={modulesLocked}
              onClick={() => {
                requestPresetLoad(contextModule);
                setModuleMenu(null);
              }}
            >
              Load .vcvm preset…
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={modulesLocked}
              onClick={() => {
                setReplaceMode(true);
                setLibraryOpen(true);
                setModuleMenu(null);
                setStatus(
                  `Choose a Library module to replace ${contextModule.plugin}/${contextModule.model}`,
                );
              }}
            >
              Replace from Library…
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger"
              disabled={modulesLocked}
              onClick={() => {
                deleteModules(new Set([contextModule.id]));
                setModuleMenu(null);
              }}
            >
              Delete module
            </button>
          </div>
        )}
        {cableMenu && contextCable && (
          <div
            className="pw-cable-menu"
            style={{ left: cableMenu.left, top: cableMenu.top }}
            role="menu"
            aria-label={`Cable ${contextCable.id} actions`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <span>CABLE</span>
              <b>Signal connection</b>
            </header>
            <div aria-label="Cable color">
              {CABLES.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="menuitem"
                  className={contextCable.color === color ? "active" : ""}
                  aria-label={`Use cable color ${color}`}
                  style={{ backgroundColor: color }}
                  disabled={modulesLocked}
                  onClick={() => {
                    commitHistory((current) => ({
                      ...current,
                      cables: current.cables.map((cable) =>
                        cable.id === contextCable.id
                          ? { ...cable, color }
                          : cable,
                      ),
                    }));
                    setCableMenu(null);
                    setStatus("Cable color changed · undo is available");
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              role="menuitem"
              disabled={modulesLocked}
              onClick={() => {
                setCableMenu(null);
                setLibraryOpen(true);
                setStatus(
                  "Choose a compatible Library module to insert on this cable",
                );
              }}
            >
              Insert module here…
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger"
              disabled={modulesLocked}
              onClick={() => {
                commitHistory((current) => ({
                  ...current,
                  cables: current.cables.filter(
                    (cable) => cable.id !== contextCable.id,
                  ),
                }));
                setSelectedCableIds(new Set());
                setCableMenu(null);
                setStatus("Cable removed · undo is available");
              }}
            >
              Delete cable
            </button>
          </div>
        )}
        {marquee && (
          <div
            className="pw-marquee"
            style={{
              left: marquee.left,
              top: marquee.top,
              width: marquee.width,
              height: marquee.height,
            }}
            aria-hidden="true"
          />
        )}
        {(selectedIds.size > 1 || selectedCableIds.size > 0) && (
          <div className="pw-selection-count">
            {selectedIds.size
              ? `${selectedIds.size} module${selectedIds.size === 1 ? "" : "s"}`
              : ""}
            {selectedIds.size && selectedCableIds.size ? " + " : ""}
            {selectedCableIds.size
              ? `${selectedCableIds.size} cable${selectedCableIds.size === 1 ? "" : "s"}`
              : ""}{" "}
            selected · {selectedCableIds.size === 1
              ? "choose a Library module to insert it on this cable"
              : "delete is undoable"}
          </div>
        )}
        {!patch.modules.length && (
          <div className="pw-empty">
            <b>Empty rack.</b>
            <span>Paste a Library URL or open a .vcv patch.</span>
            <button onClick={() => void addFromUrl()}>
              Load the SEQ1 WASM example
            </button>
          </div>
        )}
        <div className="pw-zoom">
          <button type="button" onClick={() => adjustZoom(-0.1)} aria-label="Zoom out" title="Zoom out">
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => adjustZoom(0.1)} aria-label="Zoom in" title="Zoom in">
            ＋
          </button>
          <button
            type="button"
            className="pw-zoom-fit"
            onClick={fitPatch}
            disabled={!patch.modules.length}
            aria-label="Fit complete patch in view"
            title="Fit complete patch in view"
          >
            <Maximize2 aria-hidden="true" size={11} strokeWidth={2.25} />
          </button>
        </div>
        {selectedId && telemetry[selectedId] && (
          <output className="pw-telemetry">{telemetry[selectedId]}</output>
        )}
      </section>
    </main>
  );
}
