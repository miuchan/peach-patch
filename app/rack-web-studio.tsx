import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { Maximize2 } from "lucide-react";
import type { MadzineManualTarget } from "./components/rack-madzine-manual";
import { RackStudioCableLayer } from "./components/rack-studio-cable-layer";
import { RackBisetBlankOverlay } from "./components/rack-biset-blank-overlay";
import {
  RackStudioCablePreviewLayer,
  type RackCablePreviewLayerHandle,
  type RackCablePreviewLayout,
} from "./components/rack-studio-cable-preview-layer";
import { parseVcvArchive } from "../lib/vcv-patch";
import type { ModuleInstance, PatchDocument } from "../lib/patch-types";
import { usePatchHistory } from "../lib/use-patch-history";
import {
  type RackAudioEngine,
  type RackHostControl,
  type RackHoveredControl,
  type RackPlugSignal,
} from "../lib/rack-audio-engine";
import { dataFromState } from "../lib/patch-state";
import {
  createRackAudioEngine,
  type RackAudioControllerStatus,
} from "../lib/rack-audio-controller";
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
import { createRackCablePreviewWriter } from "../lib/rack-cable-preview";
import { loadBrowserAsset } from "../lib/browser-asset-loader";
import { importVcvPatch } from "../lib/vcv-patch-import";
import {
  assertVcvPatchModulesLoadable,
  BlockedVcvPatchError,
} from "../lib/vcv-patch-compatibility";
import * as studioHelpers from "../lib/rack-studio-helpers";
import * as wasmHost from "../lib/rack-wasm-host";
import { putSample } from "../lib/sample-store";
import { serializeVcvPatch } from "../lib/vcv-patch-serialize";
import {
  applyRackModulePreset,
  anchoredViewportPan,
  connectPatchCable,
  reconnectPatchCableEndpoint,
  disconnectModuleCables,
  duplicatePatchModules,
  fittedPatchViewport,
  randomizeModuleControls,
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
  globalPointerMatches,
  globalPointerMiddleEnabled,
  rackModifierMask,
} from "../lib/rack-global-pointer";
import { rackRowToolAction, rackRowToolDragIds } from "../lib/rack-row-tool";
import {
  discoverableRegistryModules,
  getWebPlugin,
  isRegistryModuleDiscoverable,
} from "../lib/runtime-plugin-registry";
import { fetchVerifiedWasm } from "../lib/peach-registry-client";
import { RackStudioLibrary } from "./components/rack-studio-library";
import { RackStudioTopbar } from "./components/rack-studio-topbar";
import { RackStudioInspector } from "./components/rack-studio-inspector";
import { RackStudioContextMenus } from "./components/rack-studio-context-menus";
import { RackStudioModuleLayer } from "./components/rack-studio-module-layer";
import {
  RackStudioQuickAdd,
  type RackStudioQuickAddState,
} from "./components/rack-studio-quick-add";
import {
  useRackCanvasGestures,
  type RackDragState,
  type RackMarqueeState,
  type RackPanGestureState,
  type RackPinchState,
} from "../lib/use-rack-canvas-gestures";
import {
  rackCableIntersectsViewport,
  rackViewportPresentation,
} from "../lib/rack-viewport-transform";
import { useStableEvent } from "../lib/use-stable-event";
import {
  PatchOpenFailureDialog,
  PatchStorageUrlDialog,
  type PatchOpenFailure,
} from "./components/rack-studio-dialogs";
import { usePeachRegistry } from "./hooks/use-peach-registry";
import { useRackAutomation } from "./hooks/use-rack-automation";
import { useRackAudioRuntime } from "./hooks/use-rack-audio-runtime";
import { useRackStrokeControls } from "./hooks/use-rack-stroke-controls";
import { useI18n } from "./i18n/provider";
import { formatUserMessage, issue, message, type UserMessage } from "./i18n/user-message";

const CABLES = ["#ef5265", "#f6c94a", "#43b5df", "#55cf91", "#ac79ee", "#f28a49"];
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
type RackVisualSignals = {
  cables: Record<string, number>;
  cableWaves: Record<string, number[]>;
  blankScopes: Record<string, number[]>;
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
type ModuleTelemetry = {
  peaks: Array<{ port: string; value: number }>;
  activeLights: number;
};

async function decodePatchStorageFailure(response: Response): Promise<unknown> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string")
      return { kind: "legacy", status: response.status, detail: payload.error };
    if (payload.error && typeof payload.error === "object") {
      const error = payload.error as { code?: unknown; params?: unknown };
      if (typeof error.code === "string")
        return {
          kind: "structured",
          status: response.status,
          code: error.code,
          params: error.params && typeof error.params === "object" ? error.params : undefined,
        };
    }
  } catch {
    // Non-JSON upstream failures still use the localized client fallback.
  }
  return { kind: "http", status: response.status };
}

export function RackWebStudio() {
  const { formatNumber, t } = useI18n();
  const history = usePatchHistory(studioHelpers.emptyPatch),
    patch = history.value;
  const commitHistory = history.commit,
    mutateHistory = history.mutate,
    checkpointHistory = history.checkpoint,
    undoHistory = history.undo,
    redoHistory = history.redo;
  const [moduleUrl, setModuleUrl] = useState("https://library.vcvrack.com/Bruer/SEQ1");
  const [moduleQuery, setModuleQuery] = useState("");
  const [patchUrl, setPatchUrl] = useState("");
  const [patchUrlOpen, setPatchUrlOpen] = useState(false);
  const [patchUrlError, setPatchUrlError] = useState<UserMessage | null>(null);
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
  const [status, setStatus] = useState<UserMessage>(() =>
    message("status.registry.loadingModules"),
  );
  const [busy, setBusy] = useState(false),
    [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set()),
    [selectedCableIds, setSelectedCableIds] = useState<Set<string>>(() => new Set()),
    [pending, setPending] = useState<PortClick | null>(null),
    [cableDrag, setCableDrag] = useState<CableDrag | null>(null),
    [cableDraft, setCableDraft] = useState<CableDraft | null>(null);
  const [manualHelpHover, setManualHelpHover] = useState<{
    moduleId: string;
    type: "module" | "param" | "in" | "out";
    id?: number;
  } | null>(null);
  const [midiDevices, setMidiDevices] = useState<{
    inputs: string[];
    outputs: string[];
  }>({ inputs: [], outputs: [] });
  const [midiLearnParamId, setMidiLearnParamId] = useState(0),
    [midiLearnArmed, setMidiLearnArmed] = useState(false);
  const [inspectorStateOpen, setInspectorStateOpen] = useState(false);
  const [recordingIds, setRecordingIds] = useState<Set<string>>(() => new Set());
  const [layoutRevision, setLayoutRevision] = useState(0);
  const structureKey = useMemo(
    () =>
      `${layoutRevision}#${patch.modules.map((module) => `${module.id}:${module.key}:${module.status}:${module.asset?.storageKey ?? ""}:${module.assets?.map((asset) => asset?.storageKey ?? "").join(",") ?? ""}:${module.polyphony ?? 1}:${module.x}:${module.y}:${module.width}`).join("|")}#${patch.cables.map((cable) => `${cable.fromModule}:${cable.fromPort}>${cable.toModule}:${cable.toPort}`).join("|")}`,
    [layoutRevision, patch.cables, patch.modules],
  );
  const { modules: registry, state: registryState } = usePeachRegistry({
    mutatePatch: mutateHistory,
    onStatus: setStatus,
  });
  const [autosaveReady, setAutosaveReady] = useState(false),
    [patchName, setPatchName] = useState("Peach-Patch.vcv");
  const [pan, setPan] = useState({ x: 30, y: 72 }),
    [zoom, setZoom] = useState(0.9),
    [telemetry, setTelemetry] = useState<Record<string, ModuleTelemetry>>({});
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
  const [visualSignals, setVisualSignals] = useState<RackVisualSignals>({
    cables: {},
    cableWaves: {},
    blankScopes: {},
    plugs: {},
    scopes: {},
    lights: {},
  });
  const [hoveredRackPort, setHoveredRackPort] = useState<PortClick | null>(null),
    [rackModifiers, setRackModifiers] = useState(0);
  const [cablesVisible, setCablesVisible] = useState(true),
    [cableOpacity, setCableOpacity] = useState(1),
    [cableTension, setCableTension] = useState(0.5),
    [modulesLocked, setModulesLocked] = useState(false),
    [directInteractionActive, setDirectInteractionActive] = useState(false),
    [libraryOpen, setLibraryOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null),
    presetFileRef = useRef<HTMLInputElement>(null),
    presetTargetRef = useRef<string | null>(null),
    patchFileHandleRef = useRef<BrowserFileHandle | null>(null),
    suppressPortClickRef = useRef(false),
    rackRef = useRef<HTMLDivElement>(null),
    worldRef = useRef<HTMLDivElement>(null),
    directInteractingRef = useRef(false),
    cableInteractingRef = useRef(false),
    visualSignalsRef = useRef(visualSignals),
    wasmRef = useRef(new Map<string, wasmHost.WasmExports>());
  const cablePreviewLayerRef = useRef<RackCablePreviewLayerHandle | null>(null),
    cablePreviewWriterRef = useRef<ReturnType<typeof createRackCablePreviewWriter> | null>(null);
  useEffect(() => {
    const writer = createRackCablePreviewWriter((preview) => {
      cablePreviewLayerRef.current?.draw(preview.geometry, preview.viewport, preview.color);
    });
    cablePreviewWriterRef.current = writer;
    return () => {
      writer.cancel();
      cablePreviewWriterRef.current = null;
    };
  }, []);
  const viewportControlRef = useRef({ pan, zoom }),
    undularLockRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null });
  const clipboardRef = useRef<{
    modules: ModuleInstance[];
    cables: PatchDocument["cables"];
  } | null>(null);
  const audioRef = useRef<RackAudioEngine | null>(null);
  const {
    beforePlaybackRef: automationBeforeRef,
    playbackEventCountRef: automationPlaybackCountRef,
    playbackStructureRef: automationStructureRef,
    recordValue: recordAutomationValue,
    reset: resetAutomation,
    setPlaying: setAutomationPlaying,
    togglePlayback: toggleAutomationPlayback,
    toggleRecording: toggleAutomationRecording,
  } = useRackAutomation({
    patch,
    structureKey,
    audioRef,
    commitPatch: commitHistory,
    mutatePatch: mutateHistory,
    checkpointPatch: checkpointHistory,
    onStatus: setStatus,
  });
  const audioPatchRef = useRef(patch);
  const dragRef = useRef<RackDragState | null>(null);
  const marqueeRef = useRef<RackMarqueeState | null>(null);
  const panGestureRef = useRef<RackPanGestureState | null>(null),
    touchPointsRef = useRef(new Map<number, { x: number; y: number }>()),
    pinchRef = useRef<RackPinchState | null>(null);
  const hoveredModuleRef = useRef<string | null>(null),
    hoveredParamRef = useRef<{ moduleId: string; paramId: number } | null>(null),
    hoveredControlRef = useRef<Omit<RackHoveredControl, "modifiers"> | null>(null),
    hoverModifiersRef = useRef(0),
    globalPointerScrollTimesRef = useRef(new Map<string, number>()),
    globalPointerMiddleModulesRef = useRef(new Set<string>()),
    midiLearnTargetRef = useRef<{ moduleId: string; paramId: number } | null>(null);

  const syncHoveredControl = useStableEvent(() => {
    const target = hoveredControlRef.current;
    audioRef.current?.setHoveredControl(
      target ? { ...target, modifiers: hoverModifiersRef.current } : null,
    );
  });
  const setHoveredControl = useStableEvent(
    (target: Omit<RackHoveredControl, "modifiers"> | null) => {
      hoveredControlRef.current = target;
      syncHoveredControl();
    },
  );
  useEffect(() => {
    const update = (event: KeyboardEvent) => {
      const modifiers =
        (event.shiftKey ? 1 : 0) |
        (event.ctrlKey ? 2 : 0) |
        (event.altKey ? 4 : 0) |
        (event.metaKey ? 8 : 0);
      if (modifiers === hoverModifiersRef.current) return;
      hoverModifiersRef.current = modifiers;
      setRackModifiers(modifiers);
      syncHoveredControl();
    };
    const clear = () => {
      if (!hoverModifiersRef.current) return;
      hoverModifiersRef.current = 0;
      setRackModifiers(0);
      syncHoveredControl();
    };
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", update);
      window.removeEventListener("keyup", update);
      window.removeEventListener("blur", clear);
    };
  }, [syncHoveredControl]);

  useEffect(() => {
    const activeIds = new Set<string>(),
      now = performance.now();
    for (const module of patch.modules) {
      const contract = getWebPlugin(module.key)?.runtime?.globalPointer;
      if (!contract?.wheel) continue;
      activeIds.add(module.id);
      if (!globalPointerScrollTimesRef.current.has(module.id))
        globalPointerScrollTimesRef.current.set(module.id, now);
    }
    for (const moduleId of globalPointerScrollTimesRef.current.keys())
      if (!activeIds.has(moduleId)) globalPointerScrollTimesRef.current.delete(moduleId);
  }, [patch.modules, registryState]);

  const handleGlobalPointerWheel = useStableEvent((event: WheelEvent<HTMLElement>) => {
    const modifiers = rackModifierMask(event),
      now = performance.now();
    let consumed = false;
    for (const module of patch.modules) {
      const definition = getWebPlugin(module.key),
        contract = definition?.runtime?.globalPointer;
      if (!definition || !contract?.wheel) continue;
      const last = globalPointerScrollTimesRef.current.get(module.id) ?? now;
      if (
        !globalPointerMatches(module, definition, contract, modifiers, hoveredControlRef.current) ||
        now - last <= contract.wheel.lockMs
      ) {
        globalPointerScrollTimesRef.current.set(module.id, now);
        continue;
      }
      const action =
        event.deltaY > 0
          ? contract.wheel.downAction
          : event.deltaY < 0
            ? contract.wheel.upAction
            : undefined;
      if (action !== undefined) {
        audioRef.current?.triggerAction(module.id, action, true);
        audioRef.current?.triggerAction(module.id, action, false);
      }
      consumed = true;
    }
    if (!consumed) return;
    event.preventDefault();
    event.stopPropagation();
  });

  const handleGlobalPointerDown = useStableEvent((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 1) return;
    const modifiers = rackModifierMask(event);
    let consumed = false;
    for (const module of patch.modules) {
      const definition = getWebPlugin(module.key),
        contract = definition?.runtime?.globalPointer;
      if (
        !definition ||
        !contract?.middle ||
        !globalPointerMiddleEnabled(module, definition, contract) ||
        !globalPointerMatches(module, definition, contract, modifiers, hoveredControlRef.current)
      )
        continue;
      audioRef.current?.triggerAction(module.id, contract.middle.action, true);
      globalPointerMiddleModulesRef.current.add(module.id);
      consumed = true;
    }
    if (!consumed) return;
    event.preventDefault();
    event.stopPropagation();
  });

  const handleGlobalPointerRelease = useStableEvent((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 1 && event.type !== "pointercancel") return;
    const active = globalPointerMiddleModulesRef.current;
    if (!active.size) return;
    for (const moduleId of active) {
      const module = patch.modules.find((item) => item.id === moduleId),
        action = module
          ? getWebPlugin(module.key)?.runtime?.globalPointer?.middle?.action
          : undefined;
      if (action === undefined) continue;
      audioRef.current?.triggerAction(moduleId, action, false);
      window.setTimeout(() => audioRef.current?.snapshotState(moduleId), 20);
    }
    active.clear();
    event.preventDefault();
    event.stopPropagation();
  });

  const resolveModule = useCallback(async (url: string) => {
    const response = await fetch(`/api/library/resolve?url=${encodeURIComponent(url)}`),
      result = (await response.json()) as ResolveResult;
    if (!response.ok || result.error) throw result;
    const runtime = getWebPlugin(result.key);
    return { ...result, compiled: Boolean(runtime), runtime: runtime ?? null };
  }, []);

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
      for (const [id, value] of updates) audioRef.current?.setState(moduleId, id, value);
      commitHistory((current) => updateModuleState(current, moduleId, updates));
    },
    [commitHistory],
  );

  const setModuleData = useCallback(
    (moduleId: string, data: Record<string, unknown>) => {
      const target = patch.modules.find((module) => module.id === moduleId);
      const merged = mergeModuleData(patch, moduleId, data).data;
      const definition = target ? getWebPlugin(target.key) : undefined;
      const next = target
        ? (dataFromState(
            target.key,
            merged,
            target.state,
            target.stateKeys ?? definition?.stateKeys,
          ) ?? merged)
        : merged;
      audioRef.current?.setStateJson(moduleId, next);
      commitHistory((current) => mergeModuleData(current, moduleId, data).patch);
    },
    [commitHistory, patch],
  );

  const applyRackHostControl = useCallback((control: RackHostControl) => {
    if (Number.isFinite(control.opacity))
      setCableOpacity(Math.max(0, Math.min(1, control.opacity!)));
    if (Number.isFinite(control.tension))
      setCableTension(Math.max(0, Math.min(1, control.tension!)));
    const next = applyRackHostViewportControl(
      control,
      {
        pan: viewportControlRef.current.pan,
        zoom: viewportControlRef.current.zoom,
        lockX: undularLockRef.current.x,
        lockY: undularLockRef.current.y,
      },
      {
        modules: audioPatchRef.current.modules,
        width: rackRef.current?.clientWidth ?? 1,
        height: rackRef.current?.clientHeight ?? 1,
      },
    );
    viewportControlRef.current = { pan: next.pan, zoom: next.zoom };
    undularLockRef.current = { x: next.lockX, y: next.lockY };
    setZoom(next.zoom);
    setPan(next.pan);
  }, []);

  const updateVisualSignals = useCallback(
    (updater: (previous: RackVisualSignals) => RackVisualSignals) => {
      if (directInteractingRef.current || cableInteractingRef.current) return;
      const next = updater(visualSignalsRef.current);
      visualSignalsRef.current = next;
      startTransition(() => setVisualSignals(next));
    },
    [],
  );

  const handleDirectInteractionChange = useCallback((active: boolean) => {
    directInteractingRef.current = active;
    setDirectInteractionActive(active);
    audioRef.current?.setVisualUpdatesEnabled(!active && !cableInteractingRef.current);
  }, []);

  useEffect(() => {
    const active = Boolean(cableDrag || cableDraft);
    cableInteractingRef.current = active;
    audioRef.current?.setVisualUpdatesEnabled(!active && !directInteractingRef.current);
  }, [cableDraft, cableDrag]);

  const handleAudioControllerStatus = useCallback((event: RackAudioControllerStatus) => {
    switch (event.type) {
      case "recording-captured":
        setStatus(
          event.format === "midi"
            ? message("status.capture.midiCaptured", {
                file: event.name,
                bytes: message("count.bytes", { count: event.frames }),
              })
            : message("status.capture.audioCaptured", {
                file: event.name,
                duration: event.sampleRate > 0 ? event.frames / event.sampleRate : 0,
                channels: message(event.channels === 2 ? "asset.stereo" : "asset.mono"),
              }),
        );
        return;
      case "midi-learn-target-unavailable":
        setStatus(message("status.midi.learnTargetUnavailable"));
        return;
      case "midi-learned":
        setStatus(
          message("status.midi.learned", {
            input: event.inputName ?? message("midi.defaultInput"),
            cc: event.cc,
            module: event.module,
            parameter:
              event.parameter ?? message("midi.parameterNumber", { number: event.parameterNumber }),
          }),
        );
        return;
      case "automation-complete":
        setStatus(
          message("status.automation.workletComplete", {
            events: message("count.events", { count: event.eventCount }),
          }),
        );
    }
  }, []);

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
        onStatus: handleAudioControllerStatus,
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
      automationBeforeRef,
      automationPlaybackCountRef,
      automationStructureRef,
      checkpointHistory,
      commitHistory,
      handleAudioControllerStatus,
      mutateHistory,
      recordAutomationValue,
      setAutomationPlaying,
      updateVisualSignals,
    ],
  );

  const configureAudioEngine = useStableEvent((engine: RackAudioEngine) => {
    engine.setVisualUpdatesEnabled(!directInteractingRef.current && !cableInteractingRef.current);
    engine.setMonitoredModule(
      selectedIds.size === 1 ? (selectedIds.values().next().value ?? null) : null,
    );
    const hovered = hoveredControlRef.current;
    engine.setHoveredControl(hovered ? { ...hovered, modifiers: hoverModifiersRef.current } : null);
  });
  const isAudioRebuildDeferred = useCallback(() => Boolean(dragRef.current), []);
  const { audioRunning, toggleAudio, toggleCapture } = useRackAudioRuntime({
    audioRef,
    patch,
    structureKey,
    registryState,
    createEngine: createAudioEngine,
    configureEngine: configureAudioEngine,
    isRebuildDeferred: isAudioRebuildDeferred,
    onBusyChange: setBusy,
    onStatus: setStatus,
  });

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
      setStatus(message("status.cable.dragCancelled"));
    };
    window.addEventListener("pointerup", finishOutsideRack);
    window.addEventListener("pointercancel", cancelDraft);
    return () => {
      window.removeEventListener("pointerup", finishOutsideRack);
      window.removeEventListener("pointercancel", cancelDraft);
    };
  }, [cableDraft]);

  const addFromUrl = async () => {
    if (registryState !== "ready") {
      setStatus(
        registryState === "error"
          ? message("errors.registryUnavailable")
          : message("status.registry.wait"),
      );
      return;
    }
    if (modulesLocked) {
      setStatus(message("status.edit.exitPerformToAddModule"));
      return;
    }
    setBusy(true);
    setStatus(message("status.registry.readingModuleMetadata"));
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
      if (result.runtime && !isRegistryModuleDiscoverable(result.runtime)) {
        setStatus(message("status.registry.moduleHidden", { module: result.key }));
        return;
      }
      if (result.runtime) {
        const runtime = result.runtime;
        addRuntime(runtime);
        setStatus(message("status.registry.moduleLoaded", { module: result.key }));
      } else {
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
          };
        history.commit((current) => ({
          ...current,
          modules: [...current.modules, instance],
        }));
        setStatus(message("status.registry.moduleUnavailable", { module: result.key }));
      }
    } catch (error) {
      setStatus(issue(error, "errors.moduleLoadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const openPatch = async (file: File) => {
    if (registryState !== "ready") {
      const registryMessage =
        registryState === "error"
          ? message("errors.registryUnavailable")
          : message("status.registry.wait");
      setPatchOpenFailure({ kind: "invalid", message: registryMessage });
      setStatus(registryMessage);
      return;
    }
    setPatchOpenFailure(null);
    setBusy(true);
    try {
      const raw = parseVcvArchive(await file.arrayBuffer());
      assertVcvPatchModulesLoadable(raw, getWebPlugin);
      resetAutomation();
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
      setStatus(
        message("status.patch.opened", {
          file: file.name,
          modules: message("count.modules", { count: modules.length }),
          cables: message("count.cables", { count: cables.length }),
        }),
      );
    } catch (error) {
      const failure = issue(error, "errors.patchInvalid");
      setPatchOpenFailure(
        error instanceof BlockedVcvPatchError
          ? { kind: "blocked", error }
          : { kind: "invalid", message: failure },
      );
      setStatus(failure);
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
    setPatchUrlError(null);
    setStatus(message("status.patch.loadingPatchStorage"));
    try {
      const response = await fetch(`/api/patchstorage?url=${encodeURIComponent(requested)}`);
      if (!response.ok) throw await decodePatchStorageFailure(response);
      const filename = response.headers.get("x-patch-filename") || "PatchStorage.vcv";
      const file = new File([await response.arrayBuffer()], filename, {
        type: "application/octet-stream",
      });
      patchFileHandleRef.current = null;
      setPatchUrlOpen(false);
      await openPatch(file);
    } catch (error) {
      const failure = issue(error, "errors.patchStorageLoadFailed");
      setPatchUrlError(failure);
      setStatus(failure);
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async (module: ModuleInstance, file: File, slot = 0) => {
    const assetContract = getWebPlugin(module.key)?.runtime?.asset;
    if (!assetContract) {
      setStatus(message("status.asset.notExposed", { module: `${module.plugin}/${module.model}` }));
      return;
    }
    setBusy(true);
    setStatus(message("status.asset.decoding", { file: file.name }));
    try {
      const loaded = await loadBrowserAsset(file, assetContract);
      const { ref } = loaded;
      await putSample({ ref, samples: loaded.samples, source: loaded.source });
      commitHistory((current) => ({
        ...current,
        modules: current.modules.map((item) =>
          item.id === module.id
            ? assetContract.slots && assetContract.slots > 1
              ? {
                  ...item,
                  assets: Array.from({ length: assetContract.slots }, (_, index) =>
                    index === slot ? ref : item.assets?.[index],
                  ),
                }
              : { ...item, asset: ref }
            : item,
        ),
      }));
      const detail =
        loaded.detail.kind === "image"
          ? message("status.assetDetail.image", {
              width: loaded.detail.width,
              height: loaded.detail.height,
            })
          : loaded.detail.kind === "audio"
            ? message("status.assetDetail.audio", {
                seconds: loaded.detail.seconds,
                channels:
                  loaded.detail.channels === 1
                    ? message("asset.mono")
                    : loaded.detail.channels === 2
                      ? message("asset.stereo")
                      : message("status.assetDetail.channels", {
                          count: loaded.detail.channels,
                        }),
              })
            : message("status.assetDetail.bytes", { count: loaded.detail.bytes });
      setStatus(
        assetContract.slots && assetContract.slots > 1
          ? message("status.asset.loadedIntoChannel", {
              file: file.name,
              channel: slot + 1,
              detail,
            })
          : message("status.asset.loaded", { file: file.name, detail }),
      );
    } catch (error) {
      setStatus(issue(error, "errors.assetDecodeFailed"));
    } finally {
      setBusy(false);
    }
  };

  const runClock = async (module: ModuleInstance) => {
    const definition = getWebPlugin(module.key);
    if (!definition) return;
    try {
      let wasm = wasmRef.current.get(module.id);
      if (!wasm) {
        const bytes = await fetchVerifiedWasm(definition),
          wasiHolder: wasmHost.WasmHostState = {},
          result = await WebAssembly.instantiate(bytes, wasmHost.browserWasiImports(wasiHolder));
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
      definition.outputs.forEach((port) => wasm!.rack_web_set_output_connected(port.id, 1));
      if (module.key === "Fundamental/ADSR") input.fill(10, testInput * 128, (testInput + 1) * 128);
      else if (definition.inputs.length) input[testInput * 128] = 10;
      wasm.rack_web_process(128, 48000);
      const peaks = definition.outputs.map((port) => ({
          port: port.name,
          value: Math.max(
            ...Array.from(output.slice(port.id * 128, port.id * 128 + 128), (value) =>
              Math.abs(value),
            ),
          ),
        })),
        activeLights = Array.from(lights).filter((value) => value > 0.5).length;
      setTelemetry((current) => ({
        ...current,
        [module.id]: { peaks, activeLights },
      }));
      setStatus(message("status.wasm.processed", { module: module.key, frames: 128 }));
    } catch (error) {
      setStatus(issue(error, "errors.wasmFailed"));
    }
  };

  const connectPort = (port: PortClick) => {
    if (suppressPortClickRef.current) {
      suppressPortClickRef.current = false;
      return;
    }
    if (modulesLocked) {
      setStatus(message("status.edit.exitPerformToChangeCables"));
      setPending(null);
      return;
    }
    if (!pending) {
      setPending(port);
      return;
    }
    if (pending.direction === port.direction || pending.moduleId === port.moduleId) {
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
      setStatus(message("status.cable.duplicateConnection"));
      return;
    }
    commitHistory(next);
    setSelectedCableIds(new Set());
    setPending(null);
    setStatus(message("status.cable.connected"));
  };

  const connectDraggedPorts = useCallback(
    (first: PortClick, second: PortClick) => {
      if (modulesLocked) {
        setPending(null);
        setStatus(message("status.edit.exitPerformToChangeCables"));
        return;
      }
      if (first.direction === second.direction || first.moduleId === second.moduleId) {
        setPending(null);
        setStatus(message("status.cable.incompatiblePorts"));
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
        setStatus(message("status.cable.duplicateConnection"));
        return;
      }
      commitHistory(next);
      setSelectedCableIds(new Set());
      setStatus(message("status.cable.addedToStack"));
    },
    [commitHistory, modulesLocked, patch],
  );

  const suppressNextPortClick = useCallback(() => {
    suppressPortClickRef.current = true;
    window.setTimeout(() => {
      suppressPortClickRef.current = false;
    }, 0);
  }, []);

  const startCableDrag = useCallback(
    (
      path: ReturnType<typeof layoutPatchCables>[number],
      side: "input" | "output",
      event: React.PointerEvent<Element>,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      if (modulesLocked) {
        setStatus(message("status.edit.exitPerformToChangeCables"));
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        const port =
          side === "input"
            ? { moduleId: path.toModule, direction: "in" as const, portId: path.toPort }
            : { moduleId: path.fromModule, direction: "out" as const, portId: path.fromPort };
        const rack = rackRef.current;
        if (!rack) return;
        const viewport = viewportControlRef.current;
        const rect = rack.getBoundingClientRect();
        const rackOrigin = { left: rect.left, top: rect.top };
        const initialPoint = rackPointFromClient(
          rackOrigin,
          event.clientX,
          event.clientY,
          viewport,
        );
        setCableDraft({
          port,
          color: CABLES[patch.cables.length % CABLES.length],
          initialPoint,
          rackOrigin,
        });
        setStatus(message("status.cable.stacking"));
        return;
      }
      const port =
        side === "input"
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
      setStatus(message("status.cable.draggingEnd"));
    },
    [modulesLocked, patch.cables.length, rackRef],
  );

  const startCableDragFromPort = useCallback(
    (port: PortClick, event: React.PointerEvent<HTMLButtonElement>) => {
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
      setStatus(message("status.cable.draggingNew"));
    },
    [cableTension, modulesLocked, patch, registry, startCableDrag],
  );

  const finishCableDragOnPort = useCallback(
    (target: PortClick, event: React.PointerEvent<HTMLButtonElement>) => {
      if (cableDraft) {
        const samePort =
          cableDraft.port.moduleId === target.moduleId &&
          cableDraft.port.direction === target.direction &&
          cableDraft.port.portId === target.portId;
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
      if (
        cableDrag.port.direction === target.direction ||
        cableDrag.port.moduleId === target.moduleId
      ) {
        setStatus(message("status.cable.oppositePortNeeded"));
        setCableDrag(null);
        setPending(null);
        return true;
      }
      const next = reconnectPatchCableEndpoint(patch, cableDrag.cableId, cableDrag.side, target);
      if (next) {
        commitHistory(next);
        setStatus(message("status.cable.reconnected"));
      } else setStatus(message("status.cable.duplicateConnection"));
      setCableDrag(null);
      setPending(null);
      return true;
    },
    [cableDraft, cableDrag, commitHistory, connectDraggedPorts, patch, suppressNextPortClick],
  );

  const cablePaths = useMemo(
    () => layoutPatchCables(patch, registry, cableTension),
    [cableTension, patch, registry],
  );
  const activeBisetBlank = useMemo(() => {
    for (const module of patch.modules) {
      if (module.bypassed) continue;
      const definition = registry.find((candidate) => candidate.key === module.key),
        visual = definition?.runtime?.visuals?.find(
          (candidate) => candidate.kind === "biset-blank-overlay",
        );
      if (visual?.kind === "biset-blank-overlay") return { module, visual };
    }
    return null;
  }, [patch.modules, registry]);
  const bisetBlankCableReplacement = Boolean(
    activeBisetBlank && (activeBisetBlank.module.params[0] ?? 1) >= 0.5 && cablesVisible,
  );
  const cableDraftPath = useMemo(
    () =>
      cableDraft
        ? layoutRackCableDraft(patch, registry, cableTension, {
            ...cableDraft.port,
            ...cableDraft.initialPoint,
            color: cableDraft.color,
          })
        : undefined,
    [cableDraft, cableTension, patch, registry],
  );
  const cableDragPath = useMemo(
    () =>
      cableDrag ? cablePaths.find((candidate) => candidate.id === cableDrag.cableId) : undefined,
    [cableDrag, cablePaths],
  );
  const cablePreviewSession = useMemo<RackCablePreviewSession | null>(() => {
    if (cableDrag) {
      if (!cableDragPath) return null;
      return {
        movingSide: cableDrag.side,
        anchor:
          cableDrag.side === "input"
            ? { x: cableDragPath.x1, y: cableDragPath.y1 }
            : { x: cableDragPath.x2, y: cableDragPath.y2 },
        initialPoint: cableDrag.initialPoint,
      };
    }
    if (!cableDraft || !cableDraftPath) return null;
    const movingSide = cableDraft.port.direction === "out" ? "input" : "output";
    return {
      movingSide,
      anchor:
        movingSide === "input"
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
      return cableDragPath
        ? {
            ...geometry,
            color: cableDragPath.color,
          }
        : null;
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
  const rackPresentation = useMemo(
    () => rackViewportPresentation({ pan, zoom }, rackViewportSize),
    [pan, rackViewportSize, zoom],
  );
  const visibleCablePaths = useMemo(
    () =>
      cablePaths.filter((path) =>
        rackCableIntersectsViewport(path, { pan, zoom }, rackViewportSize),
      ),
    [cablePaths, pan, rackViewportSize, zoom],
  );
  const deferredModuleQuery = useDeferredValue(moduleQuery);
  const discoverableRegistry = useMemo(() => discoverableRegistryModules(registry), [registry]);
  const filteredModules = useMemo(() => {
    const query = deferredModuleQuery.trim().toLowerCase();
    return query
      ? discoverableRegistry.filter((module) =>
          `${module.key} ${module.name} ${module.brand} ${module.description}`
            .toLowerCase()
            .includes(query),
        )
      : discoverableRegistry;
  }, [deferredModuleQuery, discoverableRegistry]);
  const quickAddQuery = quickAdd?.query ?? "";
  const quickAddMatches = useMemo(() => {
    const query = quickAddQuery.trim().toLowerCase();
    return (
      query
        ? discoverableRegistry.filter((module) =>
            `${module.key} ${module.name} ${module.brand} ${module.description}`
              .toLowerCase()
              .includes(query),
          )
        : discoverableRegistry
    ).slice(0, 12);
  }, [discoverableRegistry, quickAddQuery]);
  const replaceModule = (targetId: string, definition: WebPluginModule) => {
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
        rack: typeof target.rack?.id === "number" ? { id: target.rack.id } : undefined,
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
      result.droppedCables
        ? message("status.module.replacedWithDroppedCables", {
            previousModule: target.key,
            module: definition.key,
            cables: message("count.cables", { count: result.droppedCables }),
          })
        : message("status.module.replaced", {
            previousModule: target.key,
            module: definition.key,
          }),
    );
    return true;
  };

  const addRegistryModule = (definition: WebPluginModule) => {
    if (modulesLocked) {
      setStatus(message("status.edit.exitPerformToAddOrInsertModule"));
      return;
    }
    if (replaceMode && selectedIds.size === 1) {
      const targetId = selectedIds.values().next().value;
      if (targetId && replaceModule(targetId, definition)) return;
      setReplaceMode(false);
      setStatus(message("status.module.replacementUnavailable"));
      return;
    }
    const selectedCableId =
        selectedCableIds.size === 1 ? selectedCableIds.values().next().value : undefined,
      selectedCable = selectedCableId
        ? patch.cables.find((cable) => cable.id === selectedCableId)
        : undefined,
      fromModule = selectedCable
        ? patch.modules.find((module) => module.id === selectedCable.fromModule)
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
            x:
              Math.round(
                ((fromModule!.x + fromModule!.width / 2 + toModule!.x + toModule!.width / 2) / 2 -
                  definition.width / 2) /
                  15,
              ) * 15,
            y: Math.round((fromModule!.y + toModule!.y) / 2 / 380) * 380,
          }
        : {
            x: (-viewport.pan.x + 80) / viewport.zoom,
            y: (-viewport.pan.y + 80) / viewport.zoom,
          },
      position = studioHelpers.findOpenPosition(patch.modules, definition.width, origin),
      instance = studioHelpers.moduleFromDefinition(definition, position.x, position.y);

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
        setStatus(message("status.module.insertedOnCable", { module: definition.key }));
        return;
      }
    }

    commitHistory((current) => ({
      ...current,
      modules: [...current.modules, instance],
    }));
    setSelectedIds(new Set([instance.id]));
    setSelectedCableIds(new Set());
    setStatus(message("status.module.loaded", { module: definition.key }));
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
    setStatus(message("status.module.addedAtPosition", { module: definition.key }));
  };

  const selectModule = (id: string, event: PointerEvent<HTMLElement>) => {
    setReplaceMode(false);
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    if (!additive) setSelectedCableIds(new Set());
    setSelectedIds((current) => {
      if (!additive) return current.size === 1 && current.has(id) ? current : new Set([id]);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectCable = useCallback(
    (
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
        if (!additive) return current.size === 1 && current.has(id) ? current : new Set([id]);
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setPending(null);
    },
    [],
  );

  const openCableContextMenu = useCallback(
    (id: string, event: React.MouseEvent<SVGPathElement>) => {
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
    },
    [],
  );

  const startDragIds = (event: PointerEvent<HTMLElement>, ids: string[]) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSelectedIds(new Set(ids));
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
    handleDirectInteractionChange(true);
  };
  const startDrag = (module: ModuleInstance, event: PointerEvent<HTMLElement>) => {
    const ids = selectedIds.has(module.id) ? [...selectedIds] : [module.id];
    startDragIds(event, ids);
  };

  const copySelection = useCallback(() => {
    if (!selectedIds.size) {
      setStatus(message("status.selection.selectToCopy"));
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
        .filter((cable) => wanted.has(cable.fromModule) && wanted.has(cable.toModule))
        .map((cable) => ({
          ...cable,
          rack: cable.rack ? { ...cable.rack } : undefined,
        }));
    clipboardRef.current = { modules, cables };
    setStatus(
      message("status.selection.copied", {
        modules: message("count.modules", { count: modules.length }),
        cables: message("count.internalCables", { count: cables.length }),
      }),
    );
  }, [patch, selectedIds]);

  const pasteSelection = useCallback(() => {
    const copied = clipboardRef.current;
    if (!copied) {
      setStatus(message("status.selection.copyBeforePasting"));
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
    setStatus(
      message("status.selection.pasted", {
        modules: message("count.modules", { count: modules.length }),
      }),
    );
  }, [commitHistory]);

  const duplicateSelection = useCallback(() => {
    if (!selectedIds.size) {
      setStatus(message("status.selection.selectToDuplicate"));
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
      message("status.selection.duplicated", {
        modules: message("count.modules", { count: result.moduleIds.length }),
        cables: message("count.internalCables", { count: result.cableCount }),
      }),
    );
  }, [commitHistory, patch, selectedIds]);

  const resetControls = useCallback(
    (module: ModuleInstance, definition: WebPluginModule) => {
      const next = resetModuleControls(patch, module.id, definition.params);
      if (!next) return;
      commitHistory(next);
      setStatus(
        message("status.module.controlsReset", { module: `${module.plugin}/${module.model}` }),
      );
    },
    [commitHistory, patch],
  );

  const randomizeControls = useCallback(
    (module: ModuleInstance, definition: WebPluginModule) => {
      const next = randomizeModuleControls(patch, module.id, definition.params);
      if (!next) return;
      commitHistory(next);
      setStatus(
        message("status.module.controlsRandomized", {
          module: `${module.plugin}/${module.model}`,
        }),
      );
    },
    [commitHistory, patch],
  );

  const disconnectModule = useCallback(
    (module: ModuleInstance) => {
      const result = disconnectModuleCables(patch, module.id);
      if (!result) return;
      if (!result.removedCables) {
        setStatus(
          message("status.module.noConnectedCables", {
            module: `${module.plugin}/${module.model}`,
          }),
        );
        return;
      }
      commitHistory(result.patch);
      setSelectedCableIds(new Set());
      setPending(null);
      setStatus(
        message("status.module.cablesDisconnected", {
          cables: message("count.cables", { count: result.removedCables }),
          module: `${module.plugin}/${module.model}`,
        }),
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
      setSelectedIds((current) => new Set([...current].filter((id) => !ids.has(id))));
      setSelectedCableIds(new Set());
      setPending((current) => (current && ids.has(current.moduleId) ? null : current));
      setStatus(
        message("status.selection.modulesRemoved", {
          modules: message("count.modules", { count: ids.size }),
        }),
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
          !cables.has(cable.id) && !modules.has(cable.fromModule) && !modules.has(cable.toModule),
      ),
    }));
    setSelectedIds(new Set());
    setSelectedCableIds(new Set());
    setPending(null);
    setStatus(
      modules.size && cables.size
        ? message("status.selection.modulesAndCablesRemoved", {
            modules: message("count.modules", { count: modules.size }),
            cables: message("count.cables", { count: cables.size }),
          })
        : modules.size
          ? message("status.selection.modulesRemoved", {
              modules: message("count.modules", { count: modules.size }),
            })
          : message("status.selection.cablesRemoved", {
              cables: message("count.cables", { count: cables.size }),
            }),
    );
  }, [commitHistory, selectedCableIds, selectedIds]);

  const healDeleteSelection = useCallback(() => {
    if (selectedIds.size !== 1) {
      setStatus(message("status.selection.healRequiresOne"));
      return;
    }
    const moduleId = selectedIds.values().next().value,
      selectedModule = patch.modules.find((candidate) => candidate.id === moduleId),
      next = moduleId
        ? removeModuleAndHealCable(patch, moduleId, `cable-${crypto.randomUUID()}`)
        : null;
    if (!next) {
      setStatus(message("status.selection.healRequiresPath"));
      return;
    }
    commitHistory(next);
    setSelectedIds(new Set());
    setSelectedCableIds(new Set());
    setPending(null);
    setStatus(
      message("status.selection.healed", {
        module: selectedModule
          ? `${selectedModule.plugin}/${selectedModule.model}`
          : message("common.unknown"),
      }),
    );
  }, [commitHistory, patch, selectedIds]);

  const { startBackgroundGesture, pointerMove, pointerUp, readViewport } = useRackCanvasGestures({
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
    onMarqueeStatus: (added, selected) =>
      setStatus(
        message("status.selection.marquee", {
          modules: message("count.modules", { count: added }),
          selected,
        }),
      ),
    mutatePatch: history.mutate,
    checkpointPatch: history.checkpoint,
    bumpLayoutRevision: () => setLayoutRevision((revision) => revision + 1),
    onDirectInteractionChange: handleDirectInteractionChange,
  });
  const addFromUrlEvent = useStableEvent(() => void addFromUrl());
  const addRegistryModuleEvent = useStableEvent(addRegistryModule);

  const fitPatch = () => {
    const rack = rackRef.current;
    if (!rack || !patch.modules.length) return;
    const fitted = fittedPatchViewport(patch.modules, rack.clientWidth, rack.clientHeight);
    if (!fitted) return;
    setZoom(fitted.zoom);
    setPan(fitted.pan);
    setStatus(
      message("status.patch.fitted", {
        modules: message("count.modules", { count: patch.modules.length }),
        cables: message("count.cables", { count: patch.cables.length }),
      }),
    );
  };

  const adjustZoom = useCallback((delta: number, absoluteZoom?: number) => {
    const rack = rackRef.current;
    if (!rack) return;
    const viewport = viewportControlRef.current,
      nextZoom = Math.min(1.5, Math.max(0.08, absoluteZoom ?? viewport.zoom + delta)),
      anchor = { x: rack.clientWidth / 2, y: rack.clientHeight / 2 },
      nextPan = anchoredViewportPan(viewport.pan, viewport.zoom, nextZoom, anchor);
    viewportControlRef.current = { pan: nextPan, zoom: nextZoom };
    setPan(nextPan);
    setZoom(nextZoom);
  }, []);

  const togglePerformanceMode = useCallback(() => {
    const next = !modulesLocked;
    setModulesLocked(next);
    setPending(null);
    if (next) setLibraryOpen(false);
    setStatus(message(next ? "status.mode.perform" : "status.mode.edit"));
  }, [modulesLocked]);

  const focusModule = (moduleId: string, requestedZoom?: number) => {
    const rack = rackRef.current,
      focusedModule = patch.modules.find((candidate) => candidate.id === moduleId);
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
      x: rack.clientWidth / 2 - (focusedModule.x + focusedModule.width / 2) * nextZoom,
      y: rack.clientHeight / 2 - (focusedModule.y + 190) * nextZoom,
    });
    setStatus(
      message("status.module.focused", {
        module: `${focusedModule.plugin}/${focusedModule.model}`,
      }),
    );
  };

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
              description: t("picker.vcvPatch"),
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
        setStatus(message("status.patch.savedInPlace", { file: handle.name }));
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus(issue(error, "errors.patchSaveFailed"));
      return;
    }
    const blob = new Blob([contents], { type: "application/json" }),
      url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = patchName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus(message("status.patch.downloaded", { file: patchName }));
  };

  const saveStrokePreset = (module: ModuleInstance, asDefault: boolean) => {
    const serialized = JSON.parse(serializeVcvPatch({ modules: [module], cables: [] })) as {
        modules?: unknown[];
      },
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
      message(asDefault ? "status.preset.defaultDownloaded" : "status.preset.downloaded", {
        module: `${module.plugin}/${module.model}`,
      }),
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
      if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
        setStatus(message("errors.presetInvalid"));
        return;
      }
      const targetModule = patch.modules.find((item) => item.id === moduleId),
        definition = targetModule ? getWebPlugin(targetModule.key) : undefined;
      if (!targetModule || !definition) {
        setStatus(message("errors.presetTargetUnavailable"));
        return;
      }
      const next = applyRackModulePreset(
        patch,
        moduleId,
        preset as Record<string, unknown>,
        definition,
      );
      if (!next) {
        setStatus(
          message("errors.presetWrongModel", {
            module: `${targetModule.plugin}/${targetModule.model}`,
          }),
        );
        return;
      }
      commitHistory(next);
      setStatus(
        message("status.preset.loaded", {
          file: file.name,
          module: `${targetModule.plugin}/${targetModule.model}`,
        }),
      );
    } catch (error) {
      setStatus(issue(error, "errors.presetLoadFailed"));
    } finally {
      presetTargetRef.current = null;
    }
  };

  useRackStrokeControls({
    patch,
    audioRef,
    hoveredModuleRef,
    hoveredParamRef,
    selection: {
      moduleIds: selectedIds,
      cableIds: selectedCableIds,
      replaceModuleSelection: setSelectedIds,
      replaceCableSelection: setSelectedCableIds,
      copySelection,
      pasteSelection,
      duplicateSelection,
      deleteSelection,
      healDeleteSelection,
    },
    viewport: {
      controlRef: viewportControlRef,
      adjustZoom,
      fitPatch,
      focusModule,
      setPan,
    },
    editor: {
      cableColors: CABLES,
      cableOpacity,
      cablesVisible,
      modulesLocked,
      contextMenuOpen: Boolean(moduleMenu || cableMenu),
      closeContextMenus: () => {
        setModuleMenu(null);
        setCableMenu(null);
      },
      setCableOpacity,
      setCablesVisible,
      setModulesLocked,
      togglePerformanceMode,
    },
    patchActions: {
      commitPatch: commitHistory,
      undo: undoHistory,
      redo: redoHistory,
      setModuleParam,
      setModuleState,
    },
    automation: {
      toggleRecording: toggleAutomationRecording,
      togglePlayback: toggleAutomationPlayback,
    },
    onSavePreset: saveStrokePreset,
    onStatus: setStatus,
  });

  useEffect(() => {
    if (!moduleMenu && !cableMenu) return;
    const close = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".pw-module-menu,.pw-cable-menu")) return;
      setModuleMenu(null);
      setCableMenu(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [cableMenu, moduleMenu]);
  useEffect(() => {
    audioPatchRef.current = patch;
  }, [patch]);
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
          restored.repaired
            ? message("status.autosave.restoredRepaired", {
                modules: message("count.modules", { count: restoredPatch.modules.length }),
                repaired: restored.repaired,
              })
            : message("status.autosave.restored", {
                modules: message("count.modules", { count: restoredPatch.modules.length }),
              }),
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
    } catch (error) {
      setStatus(issue(error, "errors.autosaveStorageFull"));
    }
  }, [autosaveReady, patch]);
  const selectedId = selectedIds.size === 1 ? selectedIds.values().next().value : undefined;
  const selectedModule = selectedId
      ? patch.modules.find((module) => module.id === selectedId)
      : undefined,
    selectedDefinition = selectedModule ? getWebPlugin(selectedModule.key) : undefined,
    selectedPeaks = portPeaks?.moduleId === selectedId ? portPeaks : undefined,
    selectedTelemetry = selectedId ? telemetry[selectedId] : undefined;
  const telemetryMessage = selectedTelemetry
      ? message("telemetry.signalSummary", {
          ports: selectedTelemetry.peaks.length
            ? selectedTelemetry.peaks
                .map((peak) =>
                  t("telemetry.portPeak", {
                    port: peak.port,
                    value: Math.round(peak.value * 100) / 100,
                  }),
                )
                .join(" · ")
            : message("telemetry.noSignalPorts"),
          lights: message("count.lights", { count: selectedTelemetry.activeLights }),
        })
      : null,
    selectionMessage =
      selectedIds.size && selectedCableIds.size
        ? message("selection.summary.mixed", {
            modules: message("count.modules", { count: selectedIds.size }),
            cables: message("count.cables", { count: selectedCableIds.size }),
          })
        : selectedIds.size
          ? message("selection.summary.modules", {
              modules: message("count.modules", { count: selectedIds.size }),
            })
          : message("selection.summary.cables", {
              cables: message("count.cables", { count: selectedCableIds.size }),
            });
  const contextModule = moduleMenu
      ? patch.modules.find((module) => module.id === moduleMenu.moduleId)
      : undefined,
    contextDefinition = contextModule ? getWebPlugin(contextModule.key) : undefined,
    contextCable = cableMenu
      ? patch.cables.find((cable) => cable.id === cableMenu.cableId)
      : undefined;
  const midiMapModule = patch.modules.find((module) => module.key === "Core/MIDI-Map"),
    selectedLearnParamId = selectedDefinition?.params.some((param) => param.id === midiLearnParamId)
      ? midiLearnParamId
      : (selectedDefinition?.params[0]?.id ?? 0);
  const manualHelpTarget = useMemo<MadzineManualTarget | null>(() => {
    if (!manualHelpHover) return null;
    const targetModule = patch.modules.find((module) => module.id === manualHelpHover.moduleId),
      targetDefinition = targetModule ? getWebPlugin(targetModule.key) : undefined;
    if (
      !targetModule ||
      !targetDefinition ||
      targetDefinition.plugin !== "MADZINE" ||
      targetDefinition.model === "Manual"
    )
      return null;
    if (manualHelpHover.type === "module")
      return { moduleSlug: targetDefinition.model, moduleName: targetDefinition.name };
    const targetName =
      manualHelpHover.type === "param"
        ? targetDefinition.params.find((param) => param.id === manualHelpHover.id)?.name
        : manualHelpHover.type === "in"
          ? targetDefinition.inputs.find((port) => port.id === manualHelpHover.id)?.name
          : targetDefinition.outputs.find((port) => port.id === manualHelpHover.id)?.name;
    return {
      moduleSlug: targetDefinition.model,
      moduleName: targetDefinition.name,
      ...(targetName ? { targetName } : {}),
      targetType:
        manualHelpHover.type === "param"
          ? "param"
          : manualHelpHover.type === "in"
            ? "input"
            : "output",
    };
  }, [manualHelpHover, patch.modules]);
  useEffect(() => {
    midiLearnTargetRef.current = null;
    setMidiLearnArmed(false);
    setInspectorStateOpen(false);
  }, [selectedId]);
  useEffect(() => {
    audioRef.current?.setMonitoredModule(selectedId ?? null);
    if (!selectedId) setPortPeaks(null);
  }, [audioRunning, selectedId, structureKey]);

  const handleNewPatch = () => {
    resetAutomation();
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
    setStatus(message("status.patch.newEmpty"));
  };
  const patchFileInput = (
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
  );
  const presetFileInput = (
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
          setPatchUrlError(null);
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
        <PatchStorageUrlDialog
          value={patchUrl}
          error={patchUrlError}
          busy={busy}
          onChange={(value) => {
            setPatchUrl(value);
            setPatchUrlError(null);
          }}
          onSubmit={() => void openPatchStoragePatch()}
          onDismiss={() => setPatchUrlOpen(false)}
        />
      ) : null}
      {patchOpenFailure ? (
        <PatchOpenFailureDialog
          failure={patchOpenFailure}
          onDismiss={() => setPatchOpenFailure(null)}
        />
      ) : null}
      <output className="pw-status-sr" aria-live="polite">
        {formatUserMessage(t, status)}
      </output>
      <RackStudioLibrary
        moduleUrl={moduleUrl}
        moduleQuery={moduleQuery}
        busy={busy}
        registryState={registryState}
        filteredModules={filteredModules}
        registryCount={discoverableRegistry.length}
        modulesLocked={modulesLocked}
        replaceMode={replaceMode}
        selectedModuleCount={selectedIds.size}
        selectedCableCount={selectedCableIds.size}
        onModuleUrlChange={setModuleUrl}
        onModuleQueryChange={setModuleQuery}
        onAddFromUrl={addFromUrlEvent}
        onAddModule={addRegistryModuleEvent}
        onClose={() => setLibraryOpen(false)}
      />
      <section
        ref={rackRef}
        className={`pw-rack ${modulesLocked ? "modules-locked" : ""} ${directInteractionActive ? "direct-interaction" : ""} ${cableDrag || cableDraft ? "cable-active" : ""}`}
        style={
          {
            "--rack-pan-x": rackPresentation.panX,
            "--rack-pan-y": rackPresentation.panY,
            "--rack-zoom": rackPresentation.zoom,
            "--rack-rail-width": rackPresentation.railWidth,
            "--rack-rail-height": rackPresentation.railHeight,
          } as CSSProperties
        }
        aria-label={t("rack.label")}
        onWheelCapture={handleGlobalPointerWheel}
        onPointerDownCapture={handleGlobalPointerDown}
        onPointerUpCapture={handleGlobalPointerRelease}
        onPointerCancelCapture={handleGlobalPointerRelease}
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
            cablePreviewWriterRef.current?.preview({
              geometry: layoutRackCablePreview(cablePreviewSession, point, cableTension),
              viewport,
              color: cablePreviewLayout?.color ?? "#fff",
            });
          }
          pointerMove(event);
        }}
        onPointerUp={(event) => {
          if (cableDraft) {
            if ((event.target as Element).closest(".pw-ports button")) return;
            setCableDraft(null);
            setPending(null);
            setStatus(message("status.cable.dragCancelled"));
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
            setStatus(message("status.cable.disconnected"));
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
            setStatus(message("status.cable.dragCancelled"));
            return;
          }
          pointerUp(event);
        }}
        onLostPointerCapture={(event) => {
          if (!cableDrag && !cableDraft) pointerUp(event);
        }}
        onPointerDown={(event) => {
          const target = event.target as Element,
            background =
              event.target === event.currentTarget || target.classList.contains("pw-world");
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
              handleDirectInteractionChange(true);
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
            setSelectedIds((current) => (current.size ? new Set() : current));
            setSelectedCableIds((current) => (current.size ? new Set() : current));
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
          if (target.closest(".pw-module,.pw-cables,.pw-inspector,.pw-zoom,.pw-telemetry")) return;
          event.preventDefault();
          if (modulesLocked) {
            setStatus(message("status.edit.exitPerformToAddModule"));
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
                message("status.midi.learnArmed", {
                  module: `${selectedModule.plugin}/${selectedModule.model}`,
                  parameter:
                    selectedDefinition.params.find((param) => param.id === paramId)?.name ??
                    message("common.parameter"),
                }),
              );
            }}
            onSetParam={setModuleParam}
            onSetState={setModuleState}
            onReplace={() => {
              setReplaceMode(true);
              setLibraryOpen(true);
              setStatus(
                message("status.module.chooseReplacement", {
                  module: `${selectedModule.plugin}/${selectedModule.model}`,
                }),
              );
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
            onQueryChange={(query) =>
              setQuickAdd((current) => (current ? { ...current, query } : current))
            }
            onSubmit={() => {
              if (quickAddMatches[0]) addQuickModule(quickAddMatches[0]);
            }}
            onSelect={addQuickModule}
            onDismiss={() => setQuickAdd(null)}
          />
        )}
        <div ref={worldRef} className="pw-world">
          <RackStudioCableLayer
            paths={visibleCablePaths}
            viewport={{ pan, zoom }}
            viewportSize={rackViewportSize}
            visible={cablesVisible}
            replacementActive={bisetBlankCableReplacement}
            opacity={cableOpacity}
            selectedIds={selectedCableIds}
            signalLevels={visualSignals.cables}
            plugSignals={visualSignals.plugs}
            visualUpdatesPaused={directInteractionActive || Boolean(cableDrag || cableDraft)}
            onPlugPointerDown={startCableDrag}
            onSelect={selectCable}
            onContextMenu={openCableContextMenu}
          />
          <RackStudioModuleLayer
            modules={patch.modules}
            viewport={{ pan, zoom }}
            viewportSize={rackViewportSize}
            cables={patch.cables}
            definitions={registry}
            selectedIds={selectedIds}
            pending={pending}
            jackSignalLevels={jackSignalLevels}
            visualSignals={visualSignals}
            visualUpdatesPaused={directInteractionActive || Boolean(cableDrag || cableDraft)}
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
                setStatus(message("status.module.movementLocked"));
                return;
              }
              startDrag(module, event);
            }}
            onModuleHover={(module, hovered) => {
              if (hovered) setManualHelpHover({ moduleId: module.id, type: "module" });
              else {
                setManualHelpHover((current) => (current?.moduleId === module.id ? null : current));
                if (hoveredControlRef.current?.moduleId === module.id) setHoveredControl(null);
              }
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
            onVisualAction={(module, id, active) => {
              audioRef.current?.triggerAction(module.id, id, active);
              if (!active) window.setTimeout(() => audioRef.current?.snapshotState(module.id), 20);
            }}
            onRackRowAction={(module, action) => {
              commitHistory((current) => ({
                ...current,
                modules: rackRowToolAction(current.modules, module.id, action),
              }));
            }}
            onRackRowDragStart={(module, event) => {
              const stripMode = (module.state?.[1] ?? 0) > 0.5 || event.ctrlKey || event.metaKey;
              const ids = rackRowToolDragIds(patch.modules, module.id, stripMode);
              startDragIds(event, ids.length ? ids : [module.id]);
            }}
            onParamHover={(module, paramId) => {
              if (paramId === null) {
                if (
                  hoveredControlRef.current?.moduleId === module.id &&
                  hoveredControlRef.current.type === "param"
                )
                  setHoveredControl(null);
              } else setHoveredControl({ moduleId: module.id, type: "param", id: paramId });
              setManualHelpHover(
                paramId === null
                  ? { moduleId: module.id, type: "module" }
                  : { moduleId: module.id, type: "param", id: paramId },
              );
            }}
            onPortHover={(module, direction, portId) => {
              if (portId === null) {
                if (
                  hoveredControlRef.current?.moduleId === module.id &&
                  hoveredControlRef.current.type === direction
                )
                  setHoveredControl(null);
                setHoveredRackPort((current) =>
                  current?.moduleId === module.id && current.direction === direction
                    ? null
                    : current,
                );
              } else {
                setHoveredControl({ moduleId: module.id, type: direction, id: portId });
                setHoveredRackPort({ moduleId: module.id, direction, portId });
              }
              setManualHelpHover(
                portId === null
                  ? { moduleId: module.id, type: "module" }
                  : { moduleId: module.id, type: direction, id: portId },
              );
            }}
            onState={(module, updates) => setModuleState(module.id, updates)}
            onData={(module, data) => setModuleData(module.id, data)}
            onPolyphony={(module, polyphony) =>
              commitHistory((current) => ({
                ...current,
                modules: current.modules.map((item) =>
                  item.id === module.id ? { ...item, polyphony } : item,
                ),
              }))
            }
            onMidiDevice={(module, deviceName) => {
              const definition = getWebPlugin(module.key);
              const data =
                module.rack?.data && typeof module.rack.data === "object"
                  ? (module.rack.data as Record<string, unknown>)
                  : {};
              const previousMidi =
                data.midi && typeof data.midi === "object" && !Array.isArray(data.midi)
                  ? (data.midi as Record<string, unknown>)
                  : {};
              const nextData = { ...data, midi: { ...previousMidi, deviceName } };
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
                    ? { ...item, rack: { ...(item.rack ?? {}), data: nextData } }
                    : item,
                ),
              }));
              setStatus(
                deviceName
                  ? message("status.midi.routeSelected", {
                      module: `${module.plugin}/${module.model}`,
                      route: deviceName,
                    })
                  : message("status.midi.defaultRouteSelected", {
                      module: `${module.plugin}/${module.model}`,
                    }),
              );
            }}
            onBypass={(module) => {
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
                setStatus(message("status.edit.exitPerformToChangeCables"));
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
            onCapture={(module) => void toggleCapture(module.id, recordingIds.has(module.id))}
            onRemove={(module) => {
              if (modulesLocked) {
                setStatus(message("status.edit.exitPerformToRemoveModule"));
                return;
              }
              deleteModules(new Set([module.id]));
            }}
            onReplaceDrop={(module, key) => {
              if (modulesLocked) {
                setStatus(message("status.edit.exitPerformToReplaceModule"));
                return;
              }
              const definition = getWebPlugin(key);
              if (definition) replaceModule(module.id, definition);
            }}
          />
        </div>
        {activeBisetBlank && (
          <RackBisetBlankOverlay
            module={activeBisetBlank.module}
            visual={activeBisetBlank.visual}
            paths={visibleCablePaths}
            modules={patch.modules}
            definitions={registry}
            viewport={{ pan, zoom }}
            viewportSize={rackViewportSize}
            tension={cableTension}
            opacity={cableOpacity}
            cablesVisible={cablesVisible}
            signals={visualSignals.plugs}
            cableWaves={visualSignals.cableWaves}
            blankScopes={visualSignals.blankScopes}
            hoveredPort={hoveredRackPort}
            modifiers={rackModifiers}
          />
        )}
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
          visualValues={contextModule ? visualSignals.scopes[contextModule.id]?.[0] : undefined}
          cable={contextCable}
          colors={CABLES}
          modulesLocked={modulesLocked}
          onSetParam={setModuleParam}
          onResetParam={resetModuleParam}
          onSetState={setModuleState}
          onSetData={setModuleData}
          onTriggerAction={(moduleId, actionId) => {
            audioRef.current?.triggerAction(moduleId, actionId, true);
            audioRef.current?.triggerAction(moduleId, actionId, false);
            window.setTimeout(() => audioRef.current?.snapshotState(moduleId), 20);
            setModuleMenu(null);
          }}
          onToggleBypass={(module) => {
            const bypassed = !module.bypassed;
            audioRef.current?.setBypassed(module.id, bypassed);
            commitHistory((current) => ({
              ...current,
              modules: current.modules.map((item) =>
                item.id === module.id ? { ...item, bypassed } : item,
              ),
            }));
            setModuleMenu(null);
          }}
          onDuplicate={() => {
            duplicateSelection();
            setModuleMenu(null);
          }}
          onReset={(module, definition) => {
            resetControls(module, definition);
            setModuleMenu(null);
          }}
          onRandomize={(module, definition) => {
            randomizeControls(module, definition);
            setModuleMenu(null);
          }}
          onDisconnect={(module) => {
            disconnectModule(module);
            setModuleMenu(null);
          }}
          onSavePreset={(module) => {
            saveStrokePreset(module, false);
            setModuleMenu(null);
          }}
          onLoadPreset={(module) => {
            requestPresetLoad(module);
            setModuleMenu(null);
          }}
          onReplace={(module) => {
            setReplaceMode(true);
            setLibraryOpen(true);
            setModuleMenu(null);
            setStatus(
              message("status.module.chooseReplacement", {
                module: `${module.plugin}/${module.model}`,
              }),
            );
          }}
          onDeleteModule={(module) => {
            deleteModules(new Set([module.id]));
            setModuleMenu(null);
          }}
          onColor={(color) => {
            if (!contextCable) return;
            commitHistory((current) => ({
              ...current,
              cables: current.cables.map((item) =>
                item.id === contextCable.id ? { ...item, color } : item,
              ),
            }));
            setCableMenu(null);
            setStatus(message("status.cable.colorChanged"));
          }}
          onInsertCable={() => {
            setCableMenu(null);
            setLibraryOpen(true);
            setStatus(message("status.cable.chooseInsert"));
          }}
          onDeleteCable={(cable) => {
            commitHistory((current) => ({
              ...current,
              cables: current.cables.filter((item) => item.id !== cable.id),
            }));
            setSelectedCableIds(new Set());
            setCableMenu(null);
            setStatus(message("status.cable.removed"));
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
          <div className="pw-selection-count">{formatUserMessage(t, selectionMessage)}</div>
        )}
        {!patch.modules.length && (
          <div className="pw-empty">
            <b>{t("rack.emptyTitle")}</b>
            <span>{t("rack.emptyHelp")}</span>
            <button
              disabled={registryState !== "ready" || busy}
              onClick={() => void openPatchStoragePatch(EMPTY_RACK_PATCH_URL)}
            >
              {t("rack.loadMeditation")}
            </button>
          </div>
        )}
        <div className="pw-zoom">
          <button
            type="button"
            onClick={() => adjustZoom(-0.1)}
            aria-label={t("rack.zoomOut")}
            title={t("rack.zoomOut")}
          >
            −
          </button>
          <span>{formatNumber(Math.round(zoom * 100))}%</span>
          <button
            type="button"
            onClick={() => adjustZoom(0.1)}
            aria-label={t("rack.zoomIn")}
            title={t("rack.zoomIn")}
          >
            ＋
          </button>
          <button
            type="button"
            className="pw-zoom-fit"
            onClick={fitPatch}
            disabled={!patch.modules.length}
            aria-label={t("rack.fit")}
            title={t("rack.fit")}
          >
            <Maximize2 aria-hidden="true" size={11} strokeWidth={2.25} />
          </button>
        </div>
        {telemetryMessage && (
          <output className="pw-telemetry">{formatUserMessage(t, telemetryMessage)}</output>
        )}
      </section>
    </main>
  );
}
