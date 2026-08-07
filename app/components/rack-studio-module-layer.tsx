import { memo, useMemo, type MutableRefObject } from "react";
import type { MadzineManualTarget } from "./rack-madzine-manual";
import { ModulePanel } from "./module-panel";
import type { ModuleInstance, PatchDocument } from "../../lib/patch-types";
import type { WebPluginModule } from "../../lib/web-plugin-registry";
import type { LintBuddyTarget } from "./rack-lint-buddy";
import { rackModuleIntersectsViewport, type RackViewport } from "../../lib/rack-viewport-transform";

export type RackStudioPortClick = {
  moduleId: string;
  direction: "in" | "out";
  portId: number;
};

type SignalState = {
  scopes: Record<string, number[][]>;
  lights: Record<string, number[]>;
};

export type RackStudioModuleLayerProps = {
  modules: ModuleInstance[];
  viewport: RackViewport;
  viewportSize: { width: number; height: number };
  cables: PatchDocument["cables"];
  definitions: readonly WebPluginModule[];
  selectedIds: ReadonlySet<string>;
  pending: RackStudioPortClick | null;
  jackSignalLevels: ReadonlyMap<string, number>;
  visualSignals: SignalState;
  visualUpdatesPaused: boolean;
  audioRunning: boolean;
  recordingIds: ReadonlySet<string>;
  midiDevices: { inputs: string[]; outputs: string[] };
  manualHelpTarget: MadzineManualTarget | null;
  modulesLocked: boolean;
  hoveredModuleRef: MutableRefObject<string | null>;
  hoveredParamRef: MutableRefObject<{ moduleId: string; paramId: number } | null>;
  onSelect: (module: ModuleInstance, event: React.PointerEvent<HTMLElement>) => void;
  onContextMenu: (module: ModuleInstance, event: React.MouseEvent<HTMLElement>) => void;
  onDragStart: (module: ModuleInstance, event: React.PointerEvent<HTMLElement>) => void;
  onModuleHover: (module: ModuleInstance, hovered: boolean) => void;
  onFocus: (module: ModuleInstance) => void;
  onParam: (module: ModuleInstance, id: number, value: number) => void;
  onParamReset: (module: ModuleInstance, id: number, value: number) => void;
  onMomentary: (module: ModuleInstance, id: number, active: boolean) => void;
  onVisualAction: (module: ModuleInstance, id: number, active: boolean) => void;
  onRackRowAction: (module: ModuleInstance, action: 0 | 1 | 3 | 4) => void;
  onRackRowDragStart: (
    module: ModuleInstance,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onParamHover: (module: ModuleInstance, id: number | null) => void;
  onPortHover: (module: ModuleInstance, direction: "in" | "out", id: number | null) => void;
  onState: (module: ModuleInstance, updates: Array<[number, number]>) => void;
  onData: (module: ModuleInstance, data: Record<string, unknown>) => void;
  onPolyphony: (module: ModuleInstance, channels: number) => void;
  onMidiDevice: (module: ModuleInstance, deviceName: string) => void;
  onBypass: (module: ModuleInstance) => void;
  onPort: (port: RackStudioPortClick) => void;
  onPortPointerDown: (
    port: RackStudioPortClick,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onClock: (module: ModuleInstance) => void;
  onSample: (module: ModuleInstance, file: File, slot?: number) => void;
  onCapture: (module: ModuleInstance) => void;
  onRemove: (module: ModuleInstance) => void;
  onReplaceDrop: (module: ModuleInstance, key: string) => void;
};

const EMPTY_CONNECTED_INPUT_IDS: ReadonlySet<number> = new Set();

function RackStudioModuleLayerView({
  modules,
  viewport,
  viewportSize,
  cables,
  definitions,
  selectedIds,
  pending,
  jackSignalLevels,
  visualSignals,
  audioRunning,
  recordingIds,
  midiDevices,
  manualHelpTarget,
  hoveredModuleRef,
  hoveredParamRef,
  onSelect,
  onContextMenu,
  onDragStart,
  onModuleHover,
  onFocus,
  onParam,
  onParamReset,
  onMomentary,
  onVisualAction,
  onRackRowAction,
  onRackRowDragStart,
  onParamHover,
  onPortHover,
  onState,
  onData,
  onPolyphony,
  onMidiDevice,
  onBypass,
  onPort,
  onPortPointerDown,
  onClock,
  onSample,
  onCapture,
  onRemove,
  onReplaceDrop,
}: RackStudioModuleLayerProps) {
  const definitionsByKey = useMemo(
    () => new Map(definitions.map((definition) => [definition.key, definition])),
    [definitions],
  );
  const connectedInputIdsByModule = useMemo(() => {
    const connected = new Map<string, Set<number>>();
    for (const cable of cables) {
      let ports = connected.get(cable.toModule);
      if (!ports) {
        ports = new Set();
        connected.set(cable.toModule, ports);
      }
      ports.add(cable.toPort);
    }
    return connected;
  }, [cables]);
  const inputCableColorsByModule = useMemo(() => {
    const colors = new Map<string, Record<number, string>>();
    for (const cable of cables) {
      let ports = colors.get(cable.toModule);
      if (!ports) {
        ports = {};
        colors.set(cable.toModule, ports);
      }
      ports[cable.toPort] = cable.color;
    }
    return colors;
  }, [cables]);
  const lintBuddyTargetsByModule = useMemo(() => {
    const modulesById = new Map(modules.map((module) => [module.id, module]));
    const targets = new Map<string, LintBuddyTarget>();
    for (const module of modules) {
      if (module.key !== "BaconMusic/LintBuddy") continue;
      const outgoing = cables.find(
        (cable) => cable.fromModule === module.id && cable.fromPort === 0,
      );
      const incoming = cables.find((cable) => cable.toModule === module.id && cable.toPort === 0);
      const targetId = outgoing?.toModule ?? incoming?.fromModule;
      const target = targetId ? modulesById.get(targetId) : undefined;
      if (target)
        targets.set(module.id, { module: target, definition: definitionsByKey.get(target.key) });
    }
    return targets;
  }, [cables, definitionsByKey, modules]);
  const visibleModules = useMemo(
    () =>
      modules.filter(
        (module) =>
          selectedIds.has(module.id) ||
          recordingIds.has(module.id) ||
          pending?.moduleId === module.id ||
          rackModuleIntersectsViewport(module, viewport, viewportSize),
      ),
    [modules, pending?.moduleId, recordingIds, selectedIds, viewport, viewportSize],
  );
  const trackerModules = useMemo(
    () => modules.filter((module) => module.key === "Biset/Biset-Tracker"),
    [modules],
  );

  return (
    <div className="pw-module-layer">
      {visibleModules.map((module) => {
        const definition = definitionsByKey.get(module.key);
        const trackerModule = module.key.startsWith("Biset/Biset-Tracker-")
          ? trackerModules.reduce<ModuleInstance | undefined>((nearest, candidate) => {
              if (!nearest) return candidate;
              const distance = Math.abs(candidate.x - module.x) + Math.abs(candidate.y - module.y),
                nearestDistance = Math.abs(nearest.x - module.x) + Math.abs(nearest.y - module.y);
              return distance < nearestDistance ? candidate : nearest;
            }, undefined)
          : undefined;
        const inputSignalLevels: Record<number, number> = {};
        for (const port of definition?.inputs ?? []) {
          const level = jackSignalLevels.get(`${module.id}:in:${port.id}`);
          if (level !== undefined) inputSignalLevels[port.id] = level;
        }
        const outputSignalLevels: Record<number, number> = {};
        for (const port of definition?.outputs ?? []) {
          const level = jackSignalLevels.get(`${module.id}:out:${port.id}`);
          if (level !== undefined) outputSignalLevels[port.id] = level;
        }
        return (
          <ModulePanel
            key={module.id}
            module={module}
            definition={definition}
            selected={selectedIds.has(module.id)}
            pending={pending}
            inputSignalLevels={inputSignalLevels}
            connectedInputIds={
              connectedInputIdsByModule.get(module.id) ?? EMPTY_CONNECTED_INPUT_IDS
            }
            inputCableColors={inputCableColorsByModule.get(module.id)}
            outputSignalLevels={outputSignalLevels}
            scopeSamples={visualSignals.scopes[module.id]}
            relatedScopeSamples={trackerModule ? visualSignals.scopes[trackerModule.id] : undefined}
            lightValues={visualSignals.lights[module.id]}
            audioRunning={audioRunning}
            onSelect={(event) => onSelect(module, event)}
            onContextMenu={(event) => onContextMenu(module, event)}
            onDragStart={(event) => onDragStart(module, event)}
            onModuleHover={(hovered) => {
              if (hovered) hoveredModuleRef.current = module.id;
              else if (hoveredModuleRef.current === module.id) hoveredModuleRef.current = null;
              onModuleHover(module, hovered);
            }}
            onFocus={() => onFocus(module)}
            onParam={(id, value) => onParam(module, id, value)}
            onParamReset={(id, value) => onParamReset(module, id, value)}
            onMomentary={(id, active) => onMomentary(module, id, active)}
            onVisualAction={(id, active) => onVisualAction(module, id, active)}
            onRackRowAction={(action) => onRackRowAction(module, action)}
            onRackRowDragStart={(event) => onRackRowDragStart(module, event)}
            onParamHover={(id) => {
              if (id === null && hoveredParamRef.current?.moduleId === module.id)
                hoveredParamRef.current = null;
              else if (id !== null) hoveredParamRef.current = { moduleId: module.id, paramId: id };
              onParamHover(module, id);
            }}
            onPortHover={(direction, id) => onPortHover(module, direction, id)}
            manualHelpTarget={manualHelpTarget}
            lintBuddyTarget={lintBuddyTargetsByModule.get(module.id)}
            onState={(updates) => onState(module, updates)}
            onData={(data) => onData(module, data)}
            onPolyphony={(channels) => onPolyphony(module, channels)}
            midiDevices={midiDevices}
            onMidiDevice={(deviceName) => onMidiDevice(module, deviceName)}
            onBypass={() => onBypass(module)}
            onPort={onPort}
            onPortPointerDown={onPortPointerDown}
            onClock={() => onClock(module)}
            onSample={(file, slot) => onSample(module, file, slot)}
            recording={recordingIds.has(module.id)}
            onCapture={() => onCapture(module)}
            onRemove={() => onRemove(module)}
            onReplaceDrop={(key) => onReplaceDrop(module, key)}
          />
        );
      })}
    </div>
  );
}

function moduleLayerPropsEqual(
  previous: RackStudioModuleLayerProps,
  next: RackStudioModuleLayerProps,
) {
  return (
    previous.modules === next.modules &&
    previous.viewport.pan.x === next.viewport.pan.x &&
    previous.viewport.pan.y === next.viewport.pan.y &&
    previous.viewport.zoom === next.viewport.zoom &&
    previous.viewportSize.width === next.viewportSize.width &&
    previous.viewportSize.height === next.viewportSize.height &&
    previous.cables === next.cables &&
    previous.definitions === next.definitions &&
    previous.selectedIds === next.selectedIds &&
    previous.pending === next.pending &&
    (next.visualUpdatesPaused ||
      (previous.jackSignalLevels === next.jackSignalLevels &&
        previous.visualSignals === next.visualSignals)) &&
    previous.audioRunning === next.audioRunning &&
    previous.recordingIds === next.recordingIds &&
    previous.midiDevices === next.midiDevices &&
    previous.manualHelpTarget === next.manualHelpTarget &&
    previous.modulesLocked === next.modulesLocked &&
    previous.hoveredModuleRef === next.hoveredModuleRef &&
    previous.hoveredParamRef === next.hoveredParamRef
  );
}

/**
 * Viewport-only parent renders must not reconcile hundreds of full module
 * panels. Event callbacks intentionally stay attached until one of the data
 * dependencies above changes. The immutable definitions snapshot makes a
 * completed Registry load invalidate panels restored before metadata arrived;
 * modulesLocked covers the only external mode that changes their behavior
 * without changing the patch itself.
 */
export const RackStudioModuleLayer = memo(RackStudioModuleLayerView, moduleLayerPropsEqual);
