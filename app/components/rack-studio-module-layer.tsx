import type { MutableRefObject } from "react";
import type { MadzineManualTarget } from "./rack-madzine-manual";
import { ModulePanel } from "./module-panel";
import type { ModuleInstance, PatchDocument } from "../../lib/patch-types";
import type { WebPluginModule } from "../../lib/web-plugin-registry";

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
  cables: PatchDocument["cables"];
  getDefinition: (key: string) => WebPluginModule | undefined;
  selectedIds: ReadonlySet<string>;
  pending: RackStudioPortClick | null;
  jackSignalLevels: ReadonlyMap<string, number>;
  visualSignals: SignalState;
  audioRunning: boolean;
  recordingIds: ReadonlySet<string>;
  midiDevices: { inputs: string[]; outputs: string[] };
  manualHelpTarget: MadzineManualTarget | null;
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
  onParamHover: (module: ModuleInstance, id: number | null) => void;
  onPortHover: (module: ModuleInstance, direction: "in" | "out", id: number | null) => void;
  onState: (module: ModuleInstance, updates: Array<[number, number]>) => void;
  onData: (module: ModuleInstance, data: Record<string, unknown>) => void;
  onPolyphony: (module: ModuleInstance, channels: number) => void;
  onMidiDevice: (module: ModuleInstance, deviceName: string) => void;
  onBypass: (module: ModuleInstance) => void;
  onPort: (port: RackStudioPortClick) => void;
  onPortDragStart: (port: RackStudioPortClick) => void;
  onPortDrop: (from: RackStudioPortClick, to: RackStudioPortClick) => void;
  onPortDragEnd: () => void;
  onPortPointerDown: (port: RackStudioPortClick, event: React.PointerEvent<HTMLButtonElement>) => void;
  onPortPointerUp: (port: RackStudioPortClick, event: React.PointerEvent<HTMLButtonElement>) => void;
  onClock: (module: ModuleInstance) => void;
  onSample: (module: ModuleInstance, file: File, slot?: number) => void;
  onCapture: (module: ModuleInstance) => void;
  onRemove: (module: ModuleInstance) => void;
  onReplaceDrop: (module: ModuleInstance, key: string) => void;
};

export function RackStudioModuleLayer({
  modules,
  cables,
  getDefinition,
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
  onParamHover,
  onPortHover,
  onState,
  onData,
  onPolyphony,
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
  onCapture,
  onRemove,
  onReplaceDrop,
}: RackStudioModuleLayerProps) {
  return <>
    {modules.map((module) => {
      const definition = getDefinition(module.key);
      const inputSignalLevels = Object.fromEntries(
        (definition?.inputs ?? []).flatMap((port) => {
          const key = `${module.id}:in:${port.id}`;
          return jackSignalLevels.has(key)
            ? [[port.id, jackSignalLevels.get(key) ?? 0]]
            : [];
        }),
      );
      const outputSignalLevels = Object.fromEntries(
        (definition?.outputs ?? []).flatMap((port) => {
          const key = `${module.id}:out:${port.id}`;
          return jackSignalLevels.has(key)
            ? [[port.id, jackSignalLevels.get(key) ?? 0]]
            : [];
        }),
      );
      const connectedInputIds = new Set(
        cables
          .filter((cable) => cable.toModule === module.id)
          .map((cable) => cable.toPort),
      );
      return <ModulePanel
        key={module.id}
        module={module}
        definition={definition}
        selected={selectedIds.has(module.id)}
        pending={pending}
        inputSignalLevels={inputSignalLevels}
        connectedInputIds={connectedInputIds}
        outputSignalLevels={outputSignalLevels}
        scopeSamples={visualSignals.scopes[module.id]}
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
        onParamHover={(id) => {
          if (id === null && hoveredParamRef.current?.moduleId === module.id) hoveredParamRef.current = null;
          else if (id !== null) hoveredParamRef.current = { moduleId: module.id, paramId: id };
          onParamHover(module, id);
        }}
        onPortHover={(direction, id) => onPortHover(module, direction, id)}
        manualHelpTarget={manualHelpTarget}
        onState={(updates) => onState(module, updates)}
        onData={(data) => onData(module, data)}
        onPolyphony={(channels) => onPolyphony(module, channels)}
        midiDevices={midiDevices}
        onMidiDevice={(deviceName) => onMidiDevice(module, deviceName)}
        onBypass={() => onBypass(module)}
        onPort={onPort}
        onPortDragStart={onPortDragStart}
        onPortDrop={onPortDrop}
        onPortDragEnd={onPortDragEnd}
        onPortPointerDown={onPortPointerDown}
        onPortPointerUp={onPortPointerUp}
        onClock={() => onClock(module)}
        onSample={(file, slot) => onSample(module, file, slot)}
        recording={recordingIds.has(module.id)}
        onCapture={() => onCapture(module)}
        onRemove={() => onRemove(module)}
        onReplaceDrop={(key) => onReplaceDrop(module, key)}
      />;
    })}
  </>;
}
