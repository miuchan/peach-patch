import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Maximize2 } from "lucide-react";
import type { MadzineManualTarget } from "./components/rack-madzine-manual";
import { RackStudioCableLayer } from "./components/rack-studio-cable-layer";
import {
  RackStudioCablePreviewLayer,
  type RackCablePreviewLayerHandle,
  type RackCablePreviewLayout,
} from "./components/rack-studio-cable-preview-layer";
import { parseVcvArchive } from "../lib/vcv-patch";
import type {
  ModuleInstance,
  PatchDocument,
} from "../lib/patch-types";
import { usePatchHistory } from "../lib/use-patch-history";
import { RackAudioEngine, type RackHostControl, type RackPlugSignal } from "../lib/rack-audio-engine";
import { dataFromState } from "../lib/patch-state";
import { createRackAudioEngine } from "../lib/rack-audio-controller";
import { syncRackAudioModules } from "../lib/rack-audio-patch-sync";
import { applyRackHostViewportControl } from "../lib/rack-viewport-control";
import {
  normalizeRestoredPatch,
  parseAutosavedPatch,
  serializeAutosavePatch,
} from "../lib/patch-autosave";
import {
  cableSignalLevels,
  layoutPatchCables,
  layoutRackCablePreview,
  layoutRackCableDraft,
  type RackCablePreviewSession,
} from "../lib/rack-cable-layout";
import {
  createRackCablePreviewWriter,
} from "../lib/rack-cable-preview";
import { loadBrowserAsset } from "../lib/browser-asset-loader";
import { importVcvPatch } from "../lib/vcv-patch-import";
import {
  assertVcvPatchModulesLoadable,
  BlockedVcvPatchError,
} from "../lib/vcv-patch-compatibility";
import * as studioHelpers from "../lib/rack-studio-helpers";
import * as wasmHost from "../lib/rack-wasm-host";
import {
  hydrateModulesWithDefinitions,
} from "../lib/patch-hydrate";
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
  reconnectPatchCableEndpoint,
  disconnectModuleCables,
  duplicatePatchModules,
  fittedPatchViewport,
  randomizeModuleControls,
  rackSurfaceBounds,
  removeModuleAndHealCable,
  replaceModuleKeepingCompatibleCables,
  resetModuleControls,
  spliceModuleIntoCable,
  mergeModuleData,
  updateModuleParam,
  updateModuleState,
} from "../lib/patch-operations";
import { type WebPluginModule } from "../lib/web-plugin-registry";
import {
  isStrokeCvMode,
  STROKE_REPEATABLE_MODES,
} from "../lib/stroke-host";
import {
  allWebPlugins,
  getWebPlugin,
  replaceRegistryModules,
} from "../lib/runtime-plugin-registry";
import {
  fetchVerifiedWasm,
  loadPeachRegistry,
} from "../lib/peach-registry-client";
import { RackStudioLibrary } from "./components/rack-studio-library";
import { RackStudioTopbar } from "./components/rack-studio-topbar";
import { RackStudioInspector } from "./components/rack-studio-inspector";
import { RackStudioContextMenus } from "./components/rack-studio-context-menus";
import { RackStudioModuleLayer } from "./components/rack-studio-module-layer";
import { RackStudioQuickAdd, type RackStudioQuickAddState } from "./components/rack-studio-quick-add";
import {
  useRackCanvasGestures,
  type RackDragState,
  type RackMarqueeState,
  type RackPanGestureState,
  type RackPinchState,
} from "../lib/use-rack-canvas-gestures";
import {
  rackViewportTransform,
  RACK_VIEWPORT_OVERVIEW_ZOOM,
} from "../lib/rack-viewport-transform";
import { useStableEvent } from "../lib/use-stable-event";

const CABLES = [
  "#ef5265",
  "#f6c94a",
  "#43b5df",
  "#55cf91",
  "#ac79ee",
  "#f28a49",
];
const EMPTY_RACK_PATCH_URL = "https://patchstorage.com/meditation-patch/";
type PortClick = { moduleId: string; direction: "in" | "out"; portId: number };
type CablePoint = { x: number; y: number };
type CableRackOrigin = { left: number; top: number };
type CableDrag = {
  cableId: string;
  side: "input" | "output";
  port: PortClick;
  initialPoint: CablePoint;
  rackOrigin: CableRackOrigin;
};
type CableDraft = {
  port: PortClick;
  color: string;
  initialPoint: CablePoint;
  rackOrigin: CableRackOrigin;
};
type PatchOpenFailure =
  | { kind: "blocked"; error: BlockedVcvPatchError }
  | { kind: "invalid"; message: string };
type RackVisualSignals = {
  cables: Record<string, number>;
  plugs: Record<string, RackPlugSignal>;
  scopes: Record<string, number[][]>;
  lights: Record<string, number[]>;
};

function rackPointFromClient(
  rackOrigin: CableRackOrigin,
  clientX: number,
  clientY: number,
  viewport: { pan: CablePoint; zoom: number },
): CablePoint {
  return {
    x: (clientX - rackOrigin.left - viewport.pan.x) / viewport.zoom,
    y: (clientY - rackOrigin.top - viewport.pan.y) / viewport.zoom,
  };
}
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
export function RackWebStudio() {
  const history = usePatchHistory(studioHelpers.emptyPatch),
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
  const [patchUrl, setPatchUrl] = useState("");
  const [patchUrlOpen, setPatchUrlOpen] = useState(false);
  const [patchUrlError, setPatchUrlError] = useState("");
  const [patchOpenFailure, setPatchOpenFailure] = useState<PatchOpenFailure | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [quickAdd, setQuickAdd] = useState<RackStudioQuickAddState | null>(null);
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
    "Loading modules from the GitHub registry…",
  );
  const [busy, setBusy] = useState(false),
    [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set()),
    [selectedCableIds, setSelectedCableIds] = useState<Set<string>>(
      () => new Set(),
    ),
    [pending, setPending] = useState<PortClick | null>(null),
    [cableDrag, setCableDrag] = useState<CableDrag | null>(null),
    [cableDraft, setCableDraft] = useState<CableDraft | null>(null);
  const [manualHelpHover,setManualHelpHover]=useState<{
    moduleId:string;
    type:"module"|"param"|"in"|"out";
    id?:number;
  }|null>(null);
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
  const [registryState,setRegistryState]=useState<"loading"|"ready"|"error">("loading");
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
  const [visualSignals, setVisualSignals] = useState<RackVisualSignals>(
    { cables: {}, plugs: {}, scopes: {}, lights: {} },
  );
  const [cablesVisible, setCablesVisible] = useState(true),
    [cableOpacity, setCableOpacity] = useState(1),
    [cableTension, setCableTension] = useState(.5),
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
    suppressPortClickRef = useRef(false),
    rackRef = useRef<HTMLDivElement>(null),
    worldRef = useRef<HTMLDivElement>(null),
    viewportInteractingRef = useRef(false),
    cableInteractingRef = useRef(false),
    deferredVisualSignalsRef = useRef(false),
    visualSignalsRef = useRef(visualSignals),
    wasmRef = useRef(new Map<string, wasmHost.WasmExports>());
  const cablePreviewLayerRef = useRef<RackCablePreviewLayerHandle | null>(null),
    cablePreviewWriterRef = useRef<ReturnType<typeof createRackCablePreviewWriter> | null>(null);
  useEffect(() => {
    const writer = createRackCablePreviewWriter((preview) => {
      cablePreviewLayerRef.current?.draw(
        preview.geometry,
        preview.viewport,
        preview.color,
      );
    });
    cablePreviewWriterRef.current = writer;
    return () => {
      writer.cancel();
      cablePreviewWriterRef.current = null;
    };
  }, []);
  const viewportControlRef=useRef({pan,zoom}),
    undularLockRef=useRef<{x:number|null;y:number|null}>({x:null,y:null});
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
  const dragRef = useRef<RackDragState | null>(null);
  const marqueeRef = useRef<RackMarqueeState | null>(null);
  const panGestureRef = useRef<RackPanGestureState | null>(null),
    touchPointsRef = useRef(new Map<number, { x: number; y: number }>()),
    pinchRef = useRef<RackPinchState | null>(null);
  const hoveredModuleRef = useRef<string | null>(null),
    hoveredParamRef = useRef<{ moduleId: string; paramId: number } | null>(null),
    copiedParamRef = useRef<number | null>(null),
    midiLearnTargetRef = useRef<{ moduleId: string; paramId: number } | null>(
      null,
    ),
    runStrokeSpecialRef = useRef<
      (
        source: ModuleInstance,
        binding: ReturnType<typeof studioHelpers.strokeBindings>[number],
      ) => void
    >(() => {});

  const resolveModule = useCallback(async (url: string) => {
    const response = await fetch(
        `/api/library/resolve?url=${encodeURIComponent(url)}`,
      ),
      result = (await response.json()) as ResolveResult;
    if (!response.ok || result.error)
      throw new Error(result.error || "Module could not be resolved");
    const runtime=getWebPlugin(result.key);
    return {...result,compiled:Boolean(runtime),runtime:runtime??null};
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
      commitHistory((current) => updateModuleParam(current, moduleId, id, value));
    },
    [commitHistory, recordAutomationValue],
  );

  const resetModuleParam = useCallback(
    (moduleId: string, id: number, value: number) => {
      audioRef.current?.resetParam(moduleId, id, value);
      recordAutomationValue(moduleId, id, value);
      commitHistory((current) => updateModuleParam(current, moduleId, id, value));
    },
    [commitHistory, recordAutomationValue],
  );

  const setModuleState = useCallback(
    (moduleId: string, updates: Array<[id: number, value: number]>) => {
      for (const [id, value] of updates)
        audioRef.current?.setState(moduleId, id, value);
      commitHistory((current) => updateModuleState(current, moduleId, updates));
    },
    [commitHistory],
  );

  const setModuleData = useCallback(
    (moduleId: string, data: Record<string, unknown>) => {
      const next = mergeModuleData(patch, moduleId, data).data;
      audioRef.current?.setStateJson(moduleId, next);
      commitHistory((current) => mergeModuleData(current, moduleId, data).patch);
    },
    [commitHistory, patch],
  );

  const applyRackHostControl=useCallback((control:RackHostControl)=>{
    if(Number.isFinite(control.opacity))setCableOpacity(Math.max(0,Math.min(1,control.opacity!)));
    if(Number.isFinite(control.tension))setCableTension(Math.max(0,Math.min(1,control.tension!)));
    const next = applyRackHostViewportControl(control, {
      pan: viewportControlRef.current.pan,
      zoom: viewportControlRef.current.zoom,
      lockX: undularLockRef.current.x,
      lockY: undularLockRef.current.y,
    }, {
      modules: audioPatchRef.current.modules,
      width: rackRef.current?.clientWidth ?? 1,
      height: rackRef.current?.clientHeight ?? 1,
    });
    viewportControlRef.current = { pan: next.pan, zoom: next.zoom };
    undularLockRef.current = { x: next.lockX, y: next.lockY };
    setZoom(next.zoom);
    setPan(next.pan);
  },[]);

  const updateVisualSignals = useCallback(
    (updater: (previous: RackVisualSignals) => RackVisualSignals) => {
      const next = updater(visualSignalsRef.current);
      visualSignalsRef.current = next;
      if (viewportInteractingRef.current || cableInteractingRef.current) {
        deferredVisualSignalsRef.current = true;
        return;
      }
      setVisualSignals(next);
    },
    [],
  );

  const handleViewportInteractionChange = useCallback((active: boolean) => {
    viewportInteractingRef.current = active;
    if (active || cableInteractingRef.current || !deferredVisualSignalsRef.current) return;
    deferredVisualSignalsRef.current = false;
    startTransition(() => setVisualSignals(visualSignalsRef.current));
  }, []);

  useEffect(() => {
    const active = Boolean(cableDrag || cableDraft);
    cableInteractingRef.current = active;
    if (active || viewportInteractingRef.current || !deferredVisualSignalsRef.current) return;
    deferredVisualSignalsRef.current = false;
    startTransition(() => setVisualSignals(visualSignalsRef.current));
  }, [cableDraft, cableDrag]);

  const createAudioEngine = useCallback(
    () =>
      createRackAudioEngine({
        applyRackHostControl,
        recordAutomationValue,
        mutateHistory,
        commitHistory,
        checkpointHistory,
        setMidiDevices,
        setMidiLearnArmed,
        midiLearnTargetRef,
        audioPatchRef,
        audioRef,
        setStatus,
        setAutomationPlaying,
        automationBeforeRef,
        automationStructureRef,
        automationPlaybackCountRef,
        setPortPeaks,
        setVisualSignals: updateVisualSignals,
        setRecordingIds,
      }),
    [
      applyRackHostControl,
      checkpointHistory,
      commitHistory,
      mutateHistory,
      recordAutomationValue,
      updateVisualSignals,
    ],
  );

  useEffect(() => {
    let cancelled=false;
    const controller=new AbortController();
    const load=async()=>{
      try{
        const modules=await loadPeachRegistry(undefined,controller.signal);
        if(cancelled)return;
        replaceRegistryModules(modules);
        setRegistry(modules);
        setRegistryState("ready");
        mutateHistory((current) => {
          const nextModules = hydrateModulesWithDefinitions(
            current.modules,
            modules,
          );
          return nextModules === current.modules
            ? current
            : { ...current, modules: nextModules };
        });
        setStatus(`GitHub registry ready · ${modules.length} verified modules`);
      }catch(error){
        if(cancelled||controller.signal.aborted)return;
        replaceRegistryModules([]);
        setRegistry([]);
        setRegistryState("error");
        setStatus(`GitHub registry unavailable · ${error instanceof Error?error.message:"request failed"}`);
      }
    };
    void load();
    return()=>{cancelled=true;controller.abort()};
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

  useEffect(() => {
    if (!cableDraft) return;
    const cancelDraft = () => {
      setCableDraft(null);
      setPending(null);
    };
    const finishOutsideRack = (event: globalThis.PointerEvent) => {
      if (rackRef.current?.contains(event.target as Node)) return;
      cancelDraft();
      setStatus("Cable drag cancelled");
    };
    window.addEventListener("pointerup", finishOutsideRack);
    window.addEventListener("pointercancel", cancelDraft);
    return () => {
      window.removeEventListener("pointerup", finishOutsideRack);
      window.removeEventListener("pointercancel", cancelDraft);
    };
  }, [cableDraft]);

  const addFromUrl = async () => {
    if(registryState!=="ready"){
      setStatus(registryState==="error"?"GitHub registry is unavailable":"Wait for the GitHub registry to finish loading");
      return;
    }
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
          const viewport = viewportControlRef.current;
          const position = studioHelpers.findOpenPosition(current.modules, runtime.width, {
            x: (-viewport.pan.x + 80) / viewport.zoom,
            y: (-viewport.pan.y + 80) / viewport.zoom,
          });
          return {
            ...current,
            modules: [
              ...current.modules,
              studioHelpers.moduleFromDefinition(runtime, position.x, position.y),
            ],
          };
        });
      };
      if(result.runtime){
        const runtime=result.runtime;
        addRuntime(runtime);
        setStatus(`${result.key} loaded from the GitHub registry`);
      }else{
        const registryError=`${result.key} is not available in the GitHub registry`;
        const viewport = viewportControlRef.current,
          origin = {
              x: (-viewport.pan.x + 80) / viewport.zoom,
              y: (-viewport.pan.y + 80) / viewport.zoom,
            },
            position = studioHelpers.findOpenPosition(history.value.modules, 240, origin),
            instance: ModuleInstance = {
              id: studioHelpers.newModuleId(),
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
              error: registryError,
            };
          history.commit((current) => ({
            ...current,
            modules: [...current.modules, instance],
          }));
          setStatus(registryError);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Module load failed");
    } finally {
      setBusy(false);
    }
  };

  const openPatch = async (file: File) => {
    if(registryState!=="ready"){
      const message = registryState==="error"?"GitHub registry is unavailable":"Wait for the GitHub registry to finish loading";
      setPatchOpenFailure({ kind: "invalid", message });
      setStatus(message);
      return;
    }
    setPatchOpenFailure(null);
    setBusy(true);
    try {
      const raw = parseVcvArchive(await file.arrayBuffer());
      assertVcvPatchModulesLoadable(raw, getWebPlugin);
      for (const timer of automationTimersRef.current) window.clearTimeout(timer);
      automationTimersRef.current = [];
      automationBeforeRef.current = null;
      automationRecordingRef.current = false;
      setAutomationPlaying(false);
      setAutomationRecording(false);
      const imported = importVcvPatch(raw, getWebPlugin, CABLES);
      const { modules, cables, rack, rackOrigin } = imported;
      history.commit({ modules, cables, rack, rackOrigin });
      setSelectedIds(new Set());
      setSelectedCableIds(new Set());
      setReplaceMode(false);
      setPending(null);
      setCableDraft(null);
      setCableDrag(null);
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
      setStatus(`${file.name} opened · ${modules.length} modules · ${cables.length} cables · all modules ready`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid .vcv patch";
      setPatchOpenFailure(error instanceof BlockedVcvPatchError
        ? { kind: "blocked", error }
        : { kind: "invalid", message });
      setStatus(message);
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

  const openPatchStoragePatch = async (url = patchUrl) => {
    const requested = url.trim();
    if (!requested) return;
    setBusy(true);
    setPatchUrlError("");
    setStatus("Loading patch from PatchStorage…");
    try {
      const response = await fetch(`/api/patchstorage?url=${encodeURIComponent(requested)}`);
      if (!response.ok) {
        let message = `PatchStorage import returned ${response.status}`;
        try {
          const result = (await response.json()) as { error?: unknown };
          if (typeof result.error === "string") message = result.error;
        } catch {
          // Keep the status-based fallback when an upstream proxy returns non-JSON.
        }
        throw new Error(message);
      }
      const filename = response.headers.get("x-patch-filename") || "PatchStorage.vcv";
      const file = new File([await response.arrayBuffer()], filename, {
        type: "application/octet-stream",
      });
      patchFileHandleRef.current = null;
      setPatchUrlOpen(false);
      await openPatch(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load the PatchStorage patch";
      setPatchUrlError(message);
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async (module: ModuleInstance, file: File, slot = 0) => {
    const assetContract = getWebPlugin(module.key)?.runtime?.asset;
    if (!assetContract) {
      setStatus(`${module.plugin}/${module.model} does not expose a browser audio asset input`);
      return;
    }
    setBusy(true);
    setStatus(`Decoding ${file.name} locally…`);
    try {
      const loaded = await loadBrowserAsset(file, assetContract);
      const { ref } = loaded;
      await putSample({ ref, samples: loaded.samples });
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
        `${file.name} loaded${assetContract.slots && assetContract.slots > 1 ? ` into channel ${slot + 1}` : ""} · ${loaded.detail} · stored in this browser`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Browser could not decode this audio file",
      );
    } finally { setBusy(false); }
  };

  const runClock = async (module: ModuleInstance) => {
    const definition = getWebPlugin(module.key);
    if (!definition) return;
    try {
      let wasm = wasmRef.current.get(module.id);
      if (!wasm) {
        const bytes = await fetchVerifiedWasm(definition),
          wasiHolder: wasmHost.WasmHostState = {},
          result = await WebAssembly.instantiate(
            bytes,
            wasmHost.browserWasiImports(wasiHolder),
          );
        wasm = result.instance.exports as unknown as wasmHost.WasmExports;
        wasiHolder.runtime = wasm;
        wasm._initialize();
        wasm.rack_web_seed(0x51c0ffee);
        wasmRef.current.set(module.id, wasm);
      }
      wasm.rack_web_set_polyphony(module.polyphony ?? 1);
      module.params.forEach((value, id) => wasm!.rack_web_set_param(id, value));
      wasmHost.loadWasmStateJson(
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
    if (suppressPortClickRef.current) {
      suppressPortClickRef.current = false;
      return;
    }
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
    if (!next) {
      setPending(null);
      setStatus("That exact cable connection already exists");
      return;
    }
    commitHistory(next);
    setSelectedCableIds(new Set());
    setPending(null);
    setStatus("Cable connected · undo is available");
  };

  const connectDraggedPorts = useCallback((first: PortClick, second: PortClick) => {
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
    if (!next) {
      setStatus("That exact cable connection already exists");
      return;
    }
    commitHistory(next);
    setSelectedCableIds(new Set());
    setStatus("Cable added to port stack · undo is available");
  }, [commitHistory, modulesLocked, patch]);

  const suppressNextPortClick = useCallback(() => {
    suppressPortClickRef.current = true;
    window.setTimeout(() => {
      suppressPortClickRef.current = false;
    }, 0);
  }, []);

  const startCableDrag = useCallback((path: ReturnType<typeof layoutPatchCables>[number], side: "input" | "output", event: React.PointerEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();
    if (modulesLocked) {
      setStatus("Exit Perform mode before changing cables");
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      const port = side === "input"
        ? { moduleId: path.toModule, direction: "in" as const, portId: path.toPort }
        : { moduleId: path.fromModule, direction: "out" as const, portId: path.fromPort };
      const rack = rackRef.current;
      if (!rack) return;
      const viewport = viewportControlRef.current;
      const rect = rack.getBoundingClientRect();
      const rackOrigin = { left: rect.left, top: rect.top };
      const initialPoint = rackPointFromClient(rackOrigin, event.clientX, event.clientY, viewport);
      setCableDraft({
        port,
        color: CABLES[patch.cables.length % CABLES.length],
        initialPoint,
        rackOrigin,
      });
      setStatus("Stacking a new cable · release on a compatible port");
      return;
    }
    const port = side === "input"
      ? { moduleId: path.fromModule, direction: "out" as const, portId: path.fromPort }
      : { moduleId: path.toModule, direction: "in" as const, portId: path.toPort };
    const rack = rackRef.current;
    if (!rack) return;
    const rect = rack.getBoundingClientRect();
    const rackOrigin = { left: rect.left, top: rect.top };
    const initialPoint = rackPointFromClient(
      rackOrigin,
      event.clientX,
      event.clientY,
      viewportControlRef.current,
    );
    setCableDrag({ cableId: path.id, side, port, initialPoint, rackOrigin });
    setStatus("Dragging cable end · release on another compatible port to reconnect, or empty rack to disconnect");
  }, [modulesLocked, patch.cables.length, rackRef]);

  const startCableDragFromPort = useCallback((port: PortClick, event: React.PointerEvent<HTMLButtonElement>) => {
    if (modulesLocked || event.button !== 0) return;
    const path = layoutPatchCables(patch, registry, cableTension).find((candidate) =>
      port.direction === "in"
        ? candidate.toModule === port.moduleId && candidate.toPort === port.portId
        : candidate.fromModule === port.moduleId && candidate.fromPort === port.portId,
    );
    if (path && !event.metaKey && !event.ctrlKey) {
      startCableDrag(path, port.direction === "in" ? "input" : "output", event);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rack = rackRef.current;
    if (!rack) return;
    const viewport = viewportControlRef.current;
    const rect = rack.getBoundingClientRect();
    const rackOrigin = { left: rect.left, top: rect.top };
    const initialPoint = rackPointFromClient(rackOrigin, event.clientX, event.clientY, viewport);
    setCableDraft({
      port,
      color: CABLES[patch.cables.length % CABLES.length],
      initialPoint,
      rackOrigin,
    });
    setStatus("Dragging a new cable · release on a compatible port to connect");
  }, [cableTension, modulesLocked, patch, registry, startCableDrag]);

  const finishCableDragOnPort = useCallback((target: PortClick, event: React.PointerEvent<HTMLButtonElement>) => {
    if (cableDraft) {
      const samePort = cableDraft.port.moduleId === target.moduleId
        && cableDraft.port.direction === target.direction
        && cableDraft.port.portId === target.portId;
      if (samePort) {
        event.stopPropagation();
        setCableDraft(null);
        return true;
      }
      event.preventDefault();
      event.stopPropagation();
      suppressNextPortClick();
      connectDraggedPorts(cableDraft.port, target);
      setCableDraft(null);
      return true;
    }
    if (!cableDrag) return false;
    event.preventDefault();
    event.stopPropagation();
    suppressNextPortClick();
    if (cableDrag.port.direction === target.direction || cableDrag.port.moduleId === target.moduleId) {
      setStatus("Cable end needs the opposite port on another module");
      setCableDrag(null);
      setPending(null);
      return true;
    }
    const next = reconnectPatchCableEndpoint(patch, cableDrag.cableId, cableDrag.side, target);
    if (next) {
      commitHistory(next);
      setStatus("Cable reconnected · port stacks preserved · undo is available");
    } else setStatus("That exact cable connection already exists");
    setCableDrag(null);
    setPending(null);
    return true;
  }, [cableDraft, cableDrag, commitHistory, connectDraggedPorts, patch, suppressNextPortClick]);

  const cablePaths = useMemo(
    () => layoutPatchCables(patch, registry, cableTension),
    [cableTension, patch, registry],
  );
  const cableDraftPath = useMemo(
    () => cableDraft
      ? layoutRackCableDraft(patch, registry, cableTension, {
          ...cableDraft.port,
          ...cableDraft.initialPoint,
          color: cableDraft.color,
        })
      : undefined,
    [cableDraft, cableTension, patch, registry],
  );
  const cableDragPath = useMemo(
    () => cableDrag
      ? cablePaths.find((candidate) => candidate.id === cableDrag.cableId)
      : undefined,
    [cableDrag, cablePaths],
  );
  const cablePreviewSession = useMemo<RackCablePreviewSession | null>(() => {
    if (cableDrag) {
      if (!cableDragPath) return null;
      return {
        movingSide: cableDrag.side,
        anchor: cableDrag.side === "input"
          ? { x: cableDragPath.x1, y: cableDragPath.y1 }
          : { x: cableDragPath.x2, y: cableDragPath.y2 },
        initialPoint: cableDrag.initialPoint,
      };
    }
    if (!cableDraft || !cableDraftPath) return null;
    const movingSide = cableDraft.port.direction === "out" ? "input" : "output";
    return {
      movingSide,
      anchor: movingSide === "input"
        ? { x: cableDraftPath.x1, y: cableDraftPath.y1 }
        : { x: cableDraftPath.x2, y: cableDraftPath.y2 },
      initialPoint: cableDraft.initialPoint,
    };
  }, [cableDraft, cableDraftPath, cableDrag, cableDragPath]);
  const cablePreviewLayout = useMemo<RackCablePreviewLayout | null>(() => {
    if (!cablePreviewSession) return null;
    const geometry = layoutRackCablePreview(
      cablePreviewSession,
      cablePreviewSession.initialPoint,
      cableTension,
    );
    if (cableDrag) {
      return cableDragPath ? {
        ...geometry,
        color: cableDragPath.color,
      } : null;
    }
    if (!cableDraft) return null;
    return {
      ...geometry,
      color: cableDraft.color,
    };
  }, [cableDraft, cableDrag, cableDragPath, cablePreviewSession, cableTension]);

  useLayoutEffect(() => {
    const writer = cablePreviewWriterRef.current;
    writer?.cancel();
    const world = worldRef.current;
    if (!writer || !world || !cablePreviewLayout) return;
    const sourceGroup = cableDrag
      ? world.querySelector<SVGGElement>(
          `.pw-cable-layout[data-cable-id="${CSS.escape(cableDrag.cableId)}"]`,
        )
      : null;
    const previousVisibility = sourceGroup?.style.visibility ?? "";
    if (sourceGroup) sourceGroup.style.visibility = "hidden";
    writer.preview({
      geometry: cablePreviewLayout,
      viewport: { pan, zoom },
      color: cablePreviewLayout.color,
    });
    writer.flush();
    return () => {
      writer.cancel();
      if (sourceGroup) sourceGroup.style.visibility = previousVisibility;
    };
  }, [cableDrag, cablePreviewLayout, pan, zoom]);

  const jackSignalLevels = useMemo(
    () => cableSignalLevels(patch.cables, visualSignals.cables),
    [patch.cables, visualSignals.cables],
  );
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
        ...studioHelpers.moduleFromDefinition(definition, target.x, target.y),
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
        viewport = viewportControlRef.current,
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
              x: (-viewport.pan.x + 80) / viewport.zoom,
              y: (-viewport.pan.y + 80) / viewport.zoom,
            },
        position = studioHelpers.findOpenPosition(
          patch.modules,
          definition.width,
          origin,
        ),
        instance = studioHelpers.moduleFromDefinition(
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
    const position = studioHelpers.findOpenPosition(patch.modules, definition.width, {
        x: Math.round(quickAdd.worldX / 15) * 15,
        y: Math.round(quickAdd.worldY / 380) * 380,
      }),
      instance = studioHelpers.moduleFromDefinition(definition, position.x, position.y);
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
  const selectCable = useCallback((
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
  }, []);

  const openCableContextMenu = useCallback((
    id: string,
    event: React.MouseEvent<SVGPathElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const rack = rackRef.current;
    if (!rack) return;
    const rect = rack.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    setSelectedIds(new Set());
    setSelectedCableIds(new Set([id]));
    setModuleMenu(null);
    setQuickAdd(null);
    setCableMenu({
      left: Math.max(8, Math.min(localX, rack.clientWidth - 210)),
      top: Math.max(8, Math.min(localY, rack.clientHeight - 178)),
      cableId: id,
    });
  }, []);

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
    copied.modules.forEach((module) => ids.set(module.id, studioHelpers.newModuleId()));
    const modules = copied.modules.map((module) => ({
        ...module,
        id: ids.get(module.id)!,
        x: module.x + 30,
        y: module.y + 40,
        params: [...module.params],
        state: module.state ? [...module.state] : undefined,
        rack: studioHelpers.withoutRackId(module.rack),
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
                rack: studioHelpers.withoutRackId(cable.rack),
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
      () => studioHelpers.newModuleId(),
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

  const {
    startBackgroundGesture,
    pointerMove,
    pointerUp,
    previewViewport,
    readViewport,
    commitViewportSoon,
  } = useRackCanvasGestures({
    rackRef,
    worldRef,
    viewportRef: viewportControlRef,
    dragRef,
    marqueeRef,
    panGestureRef,
    touchPointsRef,
    pinchRef,
    modules: patch.modules,
    pan,
    zoom,
    setPan,
    setZoom,
    setMarquee,
    setSelectedIds,
    setSelectedCableIds,
    setStatus,
    mutatePatch: history.mutate,
    checkpointPatch: history.checkpoint,
    bumpLayoutRevision: () => setLayoutRevision((revision) => revision + 1),
    onViewportInteractionChange: handleViewportInteractionChange,
  });
  const addFromUrlEvent = useStableEvent(() => void addFromUrl());
  const addRegistryModuleEvent = useStableEvent(addRegistryModule);

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
    const viewport = viewportControlRef.current,
      nextZoom = Math.min(1.5, Math.max(0.08, viewport.zoom + delta)),
      anchor = { x: rack.clientWidth / 2, y: rack.clientHeight / 2 };
    setPan(anchoredViewportPan(viewport.pan, viewport.zoom, nextZoom, anchor));
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
    if(registryState!=="ready"){
      setStatus(registryState==="error"?"GitHub registry is unavailable":"Wait for the GitHub registry to finish loading");
      return;
    }
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
    return undefined;
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
    binding: ReturnType<typeof studioHelpers.strokeBindings>[number],
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
        if (viewportControlRef.current.zoom >= 0.75) fitPatch();
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
          const viewport = viewportControlRef.current;
          const position = studioHelpers.findOpenPosition(current.modules, definition.width, {
            x: (-viewport.pan.x + 80) / viewport.zoom,
            y: (-viewport.pan.y + 80) / viewport.zoom,
          });
          return {
            ...current,
            modules: [
              ...current.modules,
              studioHelpers.moduleFromDefinition(definition, position.x, position.y),
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
  useEffect(() => {
    runStrokeSpecialRef.current = runStrokeSpecial;
  });

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
      const keyCode = studioHelpers.rackKeyFromKeyboard(event),
        modifiers = studioHelpers.rackModifiersFromKeyboard(event);
      if (keyCode < 0) return false;
      let matched = false;
      for (const strokeModule of patch.modules) {
        if (strokeModule.key !== "Stoermelder-P1/Stroke") continue;
        for (const binding of studioHelpers.strokeBindings(strokeModule)) {
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
    const dispatchHoveredHotkey = (event: KeyboardEvent) => {
      if (event.repeat) return false;
      const moduleId = hoveredModuleRef.current,
        hotkeyModule = moduleId
          ? patch.modules.find((module) => module.id === moduleId)
          : undefined,
        definition = hotkeyModule ? getWebPlugin(hotkeyModule.key) : undefined,
        contract = definition?.runtime?.hotkey;
      if (!hotkeyModule || !contract) return false;
      const keyCode = studioHelpers.rackKeyFromKeyboard(event),
        modifiers = studioHelpers.rackModifiersFromKeyboard(event);
      if (keyCode < 0) return false;
      const recording =
          (hotkeyModule.params[contract.recordParam] ?? 0) >= 0.5,
        storedKey =
          hotkeyModule.state?.[contract.keyState] ??
          definition.stateKeys?.[contract.keyState]?.default ??
          -1,
        storedModifiers =
          hotkeyModule.state?.[contract.modsState] ??
          definition.stateKeys?.[contract.modsState]?.default ??
          0;
      if (
        !recording &&
        (keyCode !== storedKey || modifiers !== storedModifiers)
      )
        return false;
      const action =
        contract.actionBase |
        ((modifiers & 0xf) << 16) |
        (keyCode & 0xffff);
      audioRef.current?.triggerAction(hotkeyModule.id, action, true);
      if (recording) {
        setModuleState(hotkeyModule.id, [
          [contract.keyState, keyCode],
          [contract.modsState, modifiers],
        ]);
        setModuleParam(hotkeyModule.id, contract.recordParam, 0);
        setStatus(`Hotkey recorded · ${event.key}`);
      }
      return true;
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
      if (dispatchHoveredHotkey(event)) {
        event.preventDefault();
        return;
      }
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
    setModuleParam,
    setModuleState,
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
    syncRackAudioModules(engine, patch.modules, audioModuleSyncRef.current);
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
      const restored = parseAutosavedPatch(localStorage.getItem(studioHelpers.AUTOSAVE_KEY));
      if (restored) {
            const restoredPatch = normalizeRestoredPatch(restored.patch, getWebPlugin);
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
            `Autosave restored · ${restoredPatch.modules.length} modules${restored.repaired ? ` · repaired ${restored.repaired} duplicate ID` : ""}`,
          );
      }
    } finally {
      setAutosaveReady(true);
    }
  }, [mutateHistory]);
  useEffect(() => {
    if (!autosaveReady) return;
    try {
      localStorage.setItem(studioHelpers.AUTOSAVE_KEY, serializeAutosavePatch(patch));
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
  const manualHelpTarget=useMemo<MadzineManualTarget|null>(()=>{
    if(!manualHelpHover)return null;
    const targetModule=patch.modules.find(module=>module.id===manualHelpHover.moduleId),
      targetDefinition=targetModule?getWebPlugin(targetModule.key):undefined;
    if(!targetModule||!targetDefinition||targetDefinition.plugin!=="MADZINE"||targetDefinition.model==="Manual")return null;
    if(manualHelpHover.type==="module")return {moduleSlug:targetDefinition.model,moduleName:targetDefinition.name};
    const targetName=manualHelpHover.type==="param"
      ? targetDefinition.params.find(param=>param.id===manualHelpHover.id)?.name
      : manualHelpHover.type==="in"
        ? targetDefinition.inputs.find(port=>port.id===manualHelpHover.id)?.name
        : targetDefinition.outputs.find(port=>port.id===manualHelpHover.id)?.name;
    return {
      moduleSlug:targetDefinition.model,
      moduleName:targetDefinition.name,
      ...(targetName?{targetName}:{}),
      targetType:manualHelpHover.type==="param"?"param":manualHelpHover.type==="in"?"input":"output",
    };
  },[manualHelpHover,patch.modules]);
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

  const handleNewPatch = () => {
    clearAutomationTimers();
    automationBeforeRef.current = null;
    automationRecordingRef.current = false;
    setAutomationPlaying(false);
    setAutomationRecording(false);
    history.commit(studioHelpers.emptyPatch);
    patchFileHandleRef.current = null;
    setPatchName("Peach-Patch.vcv");
    setSelectedIds(new Set());
    setSelectedCableIds(new Set());
    setReplaceMode(false);
    setPending(null);
    setCableDraft(null);
    setCableDrag(null);
    setLibraryOpen(true);
    setStatus("New empty patch");
  };
  const patchFileInput = (
    <input ref={fileRef} hidden type="file" accept=".vcv" onChange={(event) => {
      patchFileHandleRef.current = null;
      if (event.target.files?.[0]) void openPatch(event.target.files[0]);
      event.target.value = "";
    }} />
  );
  const presetFileInput = (
    <input ref={presetFileRef} hidden type="file" accept=".vcvm,application/json" onChange={(event) => {
      const file = event.target.files?.[0];
      if (file) void loadModulePreset(file);
      event.target.value = "";
    }} />
  );

  return (
    <main className={`pw-app ${libraryOpen ? "" : "library-collapsed"}`}>
      <RackStudioTopbar
        modulesLocked={modulesLocked}
        registryReady={registryState === "ready"}
        libraryOpen={libraryOpen}
        audioRunning={audioRunning}
        busy={busy}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onNewPatch={handleNewPatch}
        onOpenPatch={() => void choosePatchFile()}
        onOpenPatchUrl={() => {
          setPatchUrlError("");
          setPatchUrlOpen(true);
        }}
        onSavePatch={() => void savePatch()}
        onUndo={history.undo}
        onRedo={history.redo}
        onToggleLibrary={() => setLibraryOpen((open) => !open)}
        onToggleAudio={() => void toggleAudio()}
        fileInput={patchFileInput}
        presetInput={presetFileInput}
      />
      {patchUrlOpen ? (
        <div
          className="pw-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setPatchUrlOpen(false);
          }}
        >
          <form
            className="pw-patch-url-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pw-patch-url-title"
            onSubmit={(event) => {
              event.preventDefault();
              void openPatchStoragePatch();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !busy) setPatchUrlOpen(false);
            }}
          >
            <header>
              <div>
                <span>OPEN FROM LINK</span>
                <b id="pw-patch-url-title">PatchStorage patch</b>
              </div>
              <button type="button" aria-label="Close" disabled={busy} onClick={() => setPatchUrlOpen(false)}>×</button>
            </header>
            <label htmlFor="pw-patch-url">Paste the public PatchStorage page link</label>
            <input
              id="pw-patch-url"
              type="url"
              value={patchUrl}
              placeholder="https://patchstorage.com/meditation-patch/"
              autoFocus
              required
              spellCheck={false}
              onChange={(event) => {
                setPatchUrl(event.target.value);
                setPatchUrlError("");
              }}
            />
            {patchUrlError ? <p role="alert">{patchUrlError}</p> : <small>The patch is downloaded from PatchStorage and opened in this browser.</small>}
            <footer>
              <button type="button" disabled={busy} onClick={() => setPatchUrlOpen(false)}>Cancel</button>
              <button type="submit" disabled={busy || !patchUrl.trim()}>{busy ? "Loading…" : "Open patch"}</button>
            </footer>
          </form>
        </div>
      ) : null}
      {patchOpenFailure ? (
        <div
          className="pw-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPatchOpenFailure(null);
          }}
        >
          <section
            className="pw-patch-url-dialog pw-patch-error-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pw-patch-error-title"
            aria-describedby="pw-patch-error-description"
            onKeyDown={(event) => {
              if (event.key === "Escape") setPatchOpenFailure(null);
            }}
          >
            <header>
              <div>
                <span>{patchOpenFailure.kind === "blocked" ? "PATCH BLOCKED" : "PATCH NOT LOADED"}</span>
                <b id="pw-patch-error-title">
                  {patchOpenFailure.kind === "blocked"
                    ? "Commercial or unavailable modules"
                    : "Unsupported or invalid VCV patch"}
                </b>
              </div>
              <button type="button" aria-label="Close" onClick={() => setPatchOpenFailure(null)}>×</button>
            </header>
            <p id="pw-patch-error-description">
              {patchOpenFailure.kind === "blocked"
                ? <>Nothing was loaded. This patch contains {patchOpenFailure.error.instanceCount} module instance{patchOpenFailure.error.instanceCount === 1 ? "" : "s"} that the verified browser runtime cannot use.</>
                : <>Nothing was loaded. {patchOpenFailure.message}</>}
            </p>
            {patchOpenFailure.kind === "blocked" ? (
              <ul className="pw-patch-error-list">
                {patchOpenFailure.error.blocked.map((module) => (
                  <li key={module.key}>
                    <b>{module.key}</b>
                    <span>
                      {module.count > 1 ? `${module.count} instances · ` : ""}
                      {module.reason === "commercial-license"
                        ? `commercial license (${module.license})`
                        : "not available in the verified browser registry"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <footer>
              <button type="button" autoFocus onClick={() => setPatchOpenFailure(null)}>Keep current patch</button>
            </footer>
          </section>
        </div>
      ) : null}
      <output className="pw-status-sr" aria-live="polite">
        {status}
      </output>
      <RackStudioLibrary
        moduleUrl={moduleUrl}
        moduleQuery={moduleQuery}
        busy={busy}
        registryState={registryState}
        filteredModules={filteredModules}
        registryCount={registry.length}
        modulesLocked={modulesLocked}
        replaceMode={replaceMode}
        selectedModuleCount={selectedIds.size}
        selectedCableCount={selectedCableIds.size}
        onModuleUrlChange={setModuleUrl}
        onModuleQueryChange={setModuleQuery}
        onAddFromUrl={addFromUrlEvent}
        onAddModule={addRegistryModuleEvent}
      />
      <section
        ref={rackRef}
        className={`pw-rack ${modulesLocked ? "modules-locked" : ""} ${cableDrag || cableDraft ? "cable-active" : ""}`}
        aria-label="Peach Patch modular rack"
        onPointerMove={(event) => {
          const cableInteraction = cableDrag ?? cableDraft;
          if (cableInteraction && cablePreviewSession) {
            const viewport = readViewport();
            const point = rackPointFromClient(
              cableInteraction.rackOrigin,
              event.clientX,
              event.clientY,
              viewport,
            );
            cablePreviewWriterRef.current?.preview(
              {
                geometry: layoutRackCablePreview(cablePreviewSession, point, cableTension),
                viewport,
                color: cablePreviewLayout?.color ?? "#fff",
              },
            );
          }
          pointerMove(event);
        }}
        onPointerUp={(event) => {
          if (cableDraft) {
            if ((event.target as Element).closest(".pw-ports button")) return;
            setCableDraft(null);
            setPending(null);
            setStatus("Cable drag cancelled");
            return;
          }
          if (cableDrag) {
            if ((event.target as Element).closest(".pw-ports button")) return;
            commitHistory((current) => ({
              ...current,
              cables: current.cables.filter((cable) => cable.id !== cableDrag.cableId),
            }));
            setCableDrag(null);
            setPending(null);
            setStatus("Cable disconnected · undo is available");
            return;
          }
          pointerUp(event);
        }}
        onPointerLeave={(event) => {
          if (cableDrag || cableDraft) return;
          pointerUp(event);
        }}
        onPointerCancel={(event) => {
          if (cableDrag || cableDraft) {
            setCableDrag(null);
            setCableDraft(null);
            setPending(null);
            setStatus("Cable drag cancelled");
            return;
          }
          pointerUp(event);
        }}
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
            setSelectedIds((current) => current.size ? new Set() : current);
            setSelectedCableIds((current) => current.size ? new Set() : current);
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
            localY = event.clientY - rect.top,
            viewport = readViewport();
          setModuleMenu(null);
          setCableMenu(null);
          setQuickAdd({
            left: Math.max(8, Math.min(localX, rack.clientWidth - 298)),
            top: Math.max(8, Math.min(localY, rack.clientHeight - 404)),
            worldX: (localX - viewport.pan.x) / viewport.zoom,
            worldY: (localY - viewport.pan.y) / viewport.zoom,
            query: "",
          });
        }}
        onWheel={(event) => {
          const viewport = readViewport();
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
                Math.max(0.08, viewport.zoom - event.deltaY * 0.001),
              );
            previewViewport({
              pan: anchoredViewportPan(viewport.pan, viewport.zoom, nextZoom, anchor),
              zoom: nextZoom,
            });
          } else {
            event.preventDefault();
            previewViewport({
              pan: {
                x: viewport.pan.x - event.deltaX,
                y: viewport.pan.y - event.deltaY,
              },
              zoom: viewport.zoom,
            });
          }
          commitViewportSoon();
        }}
      >
        {selectedModule && selectedDefinition && (
          <RackStudioInspector
            module={selectedModule}
            definition={selectedDefinition}
            peaks={selectedPeaks ?? undefined}
            audioRunning={audioRunning}
            modulesLocked={modulesLocked}
            inspectorStateOpen={inspectorStateOpen}
            setInspectorStateOpen={setInspectorStateOpen}
            hoveredParamRef={hoveredParamRef}
            midiLearnArmed={midiLearnArmed}
            selectedLearnParamId={selectedLearnParamId}
            midiMapAvailable={Boolean(midiMapModule)}
            setMidiLearnParamId={setMidiLearnParamId}
            onArmMidiLearn={(paramId) => {
              midiLearnTargetRef.current = { moduleId: selectedModule.id, paramId };
              setMidiLearnArmed(true);
              setStatus(
                `MIDI learn armed for ${selectedModule.plugin}/${selectedModule.model} ${selectedDefinition.params.find((param) => param.id === paramId)?.name ?? "parameter"} · move a CC`,
              );
            }}
            onSetParam={setModuleParam}
            onSetState={setModuleState}
            onReplace={() => {
              setReplaceMode(true);
              setLibraryOpen(true);
              setStatus(`Choose a Library module to replace ${selectedModule.plugin}/${selectedModule.model}`);
            }}
            onDuplicate={duplicateSelection}
            onReset={() => resetControls(selectedModule, selectedDefinition)}
            onRandomize={() => randomizeControls(selectedModule, selectedDefinition)}
            onDisconnect={() => disconnectModule(selectedModule)}
            onSavePreset={() => saveStrokePreset(selectedModule, false)}
            onLoadPreset={() => requestPresetLoad(selectedModule)}
          />
        )}
        {quickAdd && (
          <RackStudioQuickAdd
            state={quickAdd}
            matches={quickAddMatches}
            onQueryChange={(query) => setQuickAdd((current) => current ? { ...current, query } : current)}
            onSubmit={() => { if (quickAddMatches[0]) addQuickModule(quickAddMatches[0]); }}
            onSelect={addQuickModule}
            onDismiss={() => setQuickAdd(null)}
          />
        )}
        <div
          ref={worldRef}
          className={`pw-world ${zoom < RACK_VIEWPORT_OVERVIEW_ZOOM ? "viewport-overview" : ""}`}
          style={{
            transform: rackViewportTransform({ pan, zoom }),
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
          <RackStudioCableLayer
            paths={cablePaths}
            surface={rackSurface}
            visible={cablesVisible}
            opacity={cableOpacity}
            selectedIds={selectedCableIds}
            signalLevels={visualSignals.cables}
            plugSignals={visualSignals.plugs}
            onPlugPointerDown={startCableDrag}
            onSelect={selectCable}
            onContextMenu={openCableContextMenu}
          />
          <RackStudioModuleLayer
            modules={patch.modules}
            cables={patch.cables}
            getDefinition={getWebPlugin}
            selectedIds={selectedIds}
            pending={pending}
            jackSignalLevels={jackSignalLevels}
            visualSignals={visualSignals}
            audioRunning={audioRunning}
            recordingIds={recordingIds}
            midiDevices={midiDevices}
            manualHelpTarget={manualHelpTarget}
            modulesLocked={modulesLocked}
            hoveredModuleRef={hoveredModuleRef}
            hoveredParamRef={hoveredParamRef}
            onSelect={(module, event) => {
              setModuleMenu(null);
              setCableMenu(null);
              selectModule(module.id, event);
            }}
            onContextMenu={(module, event) => {
              event.preventDefault();
              event.stopPropagation();
              const rack = rackRef.current;
              if (!rack) return;
              const rect = rack.getBoundingClientRect();
              const localX = event.clientX - rect.left;
              const localY = event.clientY - rect.top;
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
            onDragStart={(module, event) => {
              if (modulesLocked) {
                event.stopPropagation();
                setStatus("Module movement is locked · use Stroke or unlock it first");
                return;
              }
              startDrag(module, event);
            }}
            onModuleHover={(module, hovered) => {
              if (hovered) setManualHelpHover({ moduleId: module.id, type: "module" });
              else setManualHelpHover((current) => current?.moduleId === module.id ? null : current);
            }}
            onFocus={(module) => focusModule(module.id)}
            onParam={(module, id, value) => setModuleParam(module.id, id, value)}
            onParamReset={(module, id, value) => resetModuleParam(module.id, id, value)}
            onMomentary={(module, id, active) => {
              audioRef.current?.setMomentaryParam(module.id, id, active);
              audioRef.current?.triggerAction(module.id, id, active);
              recordAutomationValue(module.id, id, active ? 1 : 0);
              if (!active) window.setTimeout(() => audioRef.current?.snapshotState(module.id), 20);
            }}
            onParamHover={(module, paramId) => {
              setManualHelpHover(paramId === null
                ? { moduleId: module.id, type: "module" }
                : { moduleId: module.id, type: "param", id: paramId });
            }}
            onPortHover={(module, direction, portId) => {
              setManualHelpHover(portId === null
                ? { moduleId: module.id, type: "module" }
                : { moduleId: module.id, type: direction, id: portId });
            }}
            onState={(module, updates) => setModuleState(module.id, updates)}
            onData={(module, data) => setModuleData(module.id, data)}
            onPolyphony={(module, polyphony) => commitHistory((current) => ({
              ...current,
              modules: current.modules.map((item) => item.id === module.id ? { ...item, polyphony } : item),
            }))}
            onMidiDevice={(module, deviceName) => {
              const definition = getWebPlugin(module.key);
              const data = module.rack?.data && typeof module.rack.data === "object"
                ? module.rack.data as Record<string, unknown>
                : {};
              const previousMidi = data.midi && typeof data.midi === "object" && !Array.isArray(data.midi)
                ? data.midi as Record<string, unknown>
                : {};
              const nextData = { ...data, midi: { ...previousMidi, deviceName } };
              audioRef.current?.setMidiDevice(module.id, deviceName, Boolean(definition?.runtime?.midi?.input), Boolean(definition?.runtime?.midi?.output));
              commitHistory((current) => ({
                ...current,
                modules: current.modules.map((item) => item.id === module.id
                  ? { ...item, rack: { ...(item.rack ?? {}), data: nextData } }
                  : item),
              }));
              setStatus(module.plugin + "/" + module.model + " MIDI " + (deviceName || "default route") + " selected");
            }}
            onBypass={(module) => {
              const bypassed = !module.bypassed;
              audioRef.current?.setBypassed(module.id, bypassed);
              commitHistory((current) => ({
                ...current,
                modules: current.modules.map((item) => item.id === module.id ? { ...item, bypassed } : item),
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
            onPortPointerDown={startCableDragFromPort}
            onPortPointerUp={finishCableDragOnPort}
            onClock={(module) => void runClock(module)}
            onSample={(module, file, slot) => void loadSample(module, file, slot)}
            onCapture={(module) => void toggleCapture(module)}
            onRemove={(module) => {
              if (modulesLocked) {
                setStatus("Exit Perform mode before removing a module");
                return;
              }
              deleteModules(new Set([module.id]));
            }}
            onReplaceDrop={(module, key) => {
              if (modulesLocked) {
                setStatus("Exit Perform mode before replacing a module");
                return;
              }
              const definition = getWebPlugin(key);
              if (definition) replaceModule(module.id, definition);
            }}
          />
        </div>
        <RackStudioCablePreviewLayer
          ref={cablePreviewLayerRef}
          layout={cablePreviewLayout}
          pan={pan}
          zoom={zoom}
        />
        <RackStudioContextMenus
          moduleMenu={moduleMenu}
          cableMenu={cableMenu}
          module={contextModule}
          definition={contextDefinition}
          cable={contextCable}
          colors={CABLES}
          modulesLocked={modulesLocked}
          onSetParam={setModuleParam}
          onResetParam={resetModuleParam}
          onSetState={setModuleState}
          onSetData={setModuleData}
          onToggleBypass={(module) => {
            const bypassed = !module.bypassed;
            audioRef.current?.setBypassed(module.id, bypassed);
            commitHistory((current) => ({ ...current, modules: current.modules.map((item) => item.id === module.id ? { ...item, bypassed } : item) }));
            setModuleMenu(null);
          }}
          onDuplicate={() => { duplicateSelection(); setModuleMenu(null); }}
          onReset={(module, definition) => { resetControls(module, definition); setModuleMenu(null); }}
          onRandomize={(module, definition) => { randomizeControls(module, definition); setModuleMenu(null); }}
          onDisconnect={(module) => { disconnectModule(module); setModuleMenu(null); }}
          onSavePreset={(module) => { saveStrokePreset(module, false); setModuleMenu(null); }}
          onLoadPreset={(module) => { requestPresetLoad(module); setModuleMenu(null); }}
          onReplace={(module) => { setReplaceMode(true); setLibraryOpen(true); setModuleMenu(null); setStatus(`Choose a Library module to replace ${module.plugin}/${module.model}`); }}
          onDeleteModule={(module) => { deleteModules(new Set([module.id])); setModuleMenu(null); }}
          onColor={(color) => {
            if (!contextCable) return;
            commitHistory((current) => ({ ...current, cables: current.cables.map((item) => item.id === contextCable.id ? { ...item, color } : item) }));
            setCableMenu(null);
            setStatus("Cable color changed · undo is available");
          }}
          onInsertCable={() => { setCableMenu(null); setLibraryOpen(true); setStatus("Choose a compatible Library module to insert on this cable"); }}
          onDeleteCable={(cable) => {
            commitHistory((current) => ({ ...current, cables: current.cables.filter((item) => item.id !== cable.id) }));
            setSelectedCableIds(new Set());
            setCableMenu(null);
            setStatus("Cable removed · undo is available");
          }}
        />
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
        {selectedIds.size + selectedCableIds.size > 1 && (
          <div className="pw-selection-count">
            {selectedIds.size
              ? `${selectedIds.size} module${selectedIds.size === 1 ? "" : "s"}`
              : ""}
            {selectedIds.size && selectedCableIds.size ? " + " : ""}
            {selectedCableIds.size
              ? `${selectedCableIds.size} cable${selectedCableIds.size === 1 ? "" : "s"}`
              : ""}{" "}
            selected · delete is undoable
          </div>
        )}
        {!patch.modules.length && (
          <div className="pw-empty">
            <b>Empty rack.</b>
            <span>Paste a Library URL or open a .vcv patch.</span>
            <button
              disabled={registryState!=="ready" || busy}
              onClick={() => void openPatchStoragePatch(EMPTY_RACK_PATCH_URL)}
            >
              Load the Meditation patch
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
