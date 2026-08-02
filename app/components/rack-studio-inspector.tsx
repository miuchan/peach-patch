import type { MutableRefObject } from "react";
import { PortScope } from "./port-scope";
import type { ModuleInstance } from "../../lib/patch-types";
import type { ParamSpec, WebPluginModule } from "../../lib/web-plugin-registry";
import { rackLegacyUi } from "../../lib/rack-module-compatibility";

type Peaks = {
  inputs: number[];
  outputs: number[];
  inputScopes: number[][];
  outputScopes: number[][];
};

export type RackStudioInspectorProps = {
  module: ModuleInstance;
  definition: WebPluginModule;
  peaks?: Peaks;
  audioRunning: boolean;
  modulesLocked: boolean;
  inspectorStateOpen: boolean;
  setInspectorStateOpen: (open: boolean) => void;
  hoveredParamRef: MutableRefObject<{ moduleId: string; paramId: number } | null>;
  midiLearnArmed: boolean;
  selectedLearnParamId: number;
  midiMapAvailable: boolean;
  setMidiLearnParamId: (id: number) => void;
  onArmMidiLearn: (paramId: number) => void;
  onSetParam: (moduleId: string, paramId: number, value: number) => void;
  onSetState: (moduleId: string, updates: Array<[number, number]>) => void;
  onReplace: () => void;
  onDuplicate: () => void;
  onReset: () => void;
  onRandomize: () => void;
  onDisconnect: () => void;
  onSavePreset: () => void;
  onLoadPreset: () => void;
};

export function RackStudioInspector({
  module,
  definition,
  peaks,
  audioRunning,
  modulesLocked,
  inspectorStateOpen,
  setInspectorStateOpen,
  hoveredParamRef,
  midiLearnArmed,
  selectedLearnParamId,
  midiMapAvailable,
  setMidiLearnParamId,
  onArmMidiLearn,
  onSetParam,
  onSetState,
  onReplace,
  onDuplicate,
  onReset,
  onRandomize,
  onDisconnect,
  onSavePreset,
  onLoadPreset,
}: RackStudioInspectorProps) {
  const compatibilityUi = rackLegacyUi(module),
    hiddenParamIds = new Set(compatibilityUi.hiddenParamIds),
    hiddenStateIds = new Set(compatibilityUi.hiddenStateIds),
    compatibleParams = definition.params.filter((param) => !hiddenParamIds.has(param.id)),
    visibleParams = compatibleParams.filter((param) => !param.hidden && !param.button),
    stateKeys = (definition.stateKeys ?? [])
      .map((stateKey, id) => ({ stateKey, id }))
      .filter(({ id }) => !hiddenStateIds.has(id));
  const renderStateInput = (stateKey: NonNullable<WebPluginModule["stateKeys"]>[number], id: number) => {
    const value = Number(module.state?.[id] ?? 0);
    const suffix = stateKey.path?.length
      ? `.${stateKey.path.join(".")}`
      : stateKey.index === undefined ? "" : `[${stateKey.index}]`;
    const label = `${stateKey.key}${suffix}`;
    if (stateKey.type === "boolean") {
      return <input aria-label={`${module.model} ${label} state`} type="checkbox" checked={Boolean(value)} onChange={(event) => onSetState(module.id, [[id, event.target.checked ? 1 : 0]])} />;
    }
    if (stateKey.type === "string-enum") {
      return <select aria-label={`${module.model} ${label} state`} value={Math.round(value)} onChange={(event) => onSetState(module.id, [[id, Number(event.target.value)]])}>
        {(stateKey.values ?? []).map((option, index) => <option key={`${option}-${index}`} value={index}>{option || `(empty ${index})`}</option>)}
      </select>;
    }
    return <input aria-label={`${module.model} ${label} state`} type="number" step={stateKey.type === "integer" ? 1 : "any"} value={value} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onSetState(module.id, [[id, next]]); }} />;
  };

  return (
    <aside className="pw-inspector" aria-label={`Live inspector for ${module.plugin}/${module.model}`}>
      <header><span>{audioRunning ? "LIVE PORTS" : "MODULE INSPECTOR"}</span><b>{module.model}</b><small>{module.plugin}</small></header>
      <div className="pw-inspector-ports">
        {definition.inputs.map((port) => <label key={`in-${port.id}`}><span>IN · {port.name}</span><PortScope samples={peaks?.inputScopes[port.id] ?? []} label={`${port.name} input waveform`} /><em>{(peaks?.inputs[port.id] ?? 0).toFixed(2)}V</em></label>)}
        {definition.outputs.map((port) => <label key={`out-${port.id}`}><span>OUT · {port.name}</span><PortScope samples={peaks?.outputScopes[port.id] ?? []} label={`${port.name} output waveform`} /><em>{(peaks?.outputs[port.id] ?? 0).toFixed(2)}V</em></label>)}
      </div>
      {visibleParams.length > 0 && <details className="pw-inspector-params"><summary>PARAMETERS · {visibleParams.length}</summary><div>
        {visibleParams.map((param: ParamSpec) => { const value = module.params[param.id] ?? param.default; return <label key={param.id}><span title={param.name}>{param.name}</span><input aria-label={`${module.model} ${param.name} inspector control`} type="range" min={param.min} max={param.max} step={param.snap ? 1 : "any"} value={value} onPointerEnter={() => { hoveredParamRef.current = { moduleId: module.id, paramId: param.id }; }} onPointerLeave={() => { if (hoveredParamRef.current?.moduleId === module.id && hoveredParamRef.current.paramId === param.id) hoveredParamRef.current = null; }} onChange={(event) => onSetParam(module.id, param.id, Number(event.target.value))} /><output>{Number(value).toFixed(param.snap ? 0 : 3)}</output></label>; })}
      </div></details>}
      {stateKeys.length > 0 && <details className="pw-inspector-state" open={inspectorStateOpen} onToggle={(event) => setInspectorStateOpen(event.currentTarget.open)}><summary>MODULE STATE · {stateKeys.length}</summary>{inspectorStateOpen && <div>{stateKeys.map(({ stateKey, id }) => { const suffix = stateKey.path?.length ? `.${stateKey.path.join(".")}` : stateKey.index === undefined ? "" : `[${stateKey.index}]`; const label = `${stateKey.key}${suffix}`; return <label key={`${label}-${id}`}><span title={label}>{label}</span>{renderStateInput(stateKey, id)}</label>; })}</div>}</details>}
      {compatibleParams.length > 0 && <div className="pw-midi-learn"><label><span>MIDI LEARN TARGET</span><select aria-label={`${module.model} MIDI learn parameter`} value={hiddenParamIds.has(selectedLearnParamId) ? compatibleParams[0].id : selectedLearnParamId} onChange={(event) => setMidiLearnParamId(Number(event.target.value))}>{compatibleParams.map((param) => <option key={param.id} value={param.id}>{param.name}</option>)}</select></label><button type="button" className={midiLearnArmed ? "active" : ""} disabled={!audioRunning || !midiMapAvailable} title={!midiMapAvailable ? "Add a Core MIDI-Map module first" : !audioRunning ? "Start audio to receive Web MIDI" : "Move the next MIDI CC to create a mapping"} onClick={() => onArmMidiLearn(hiddenParamIds.has(selectedLearnParamId) ? compatibleParams[0].id : selectedLearnParamId)}>{midiLearnArmed ? "Waiting for CC…" : "Map next MIDI CC"}</button></div>}
      <div className="pw-inspector-actions">
        {module.sourceUrl && <a href={module.sourceUrl} target="_blank" rel="noreferrer">Original source</a>}
        <button type="button" disabled={modulesLocked} onClick={onReplace}>Replace from Library…</button>
        <button type="button" disabled={modulesLocked} onClick={onDuplicate} title="⌘/Ctrl+D">Duplicate</button>
        <button type="button" disabled={modulesLocked || !definition.params.length} onClick={onReset}>Initialize controls</button>
        <button type="button" disabled={modulesLocked || !definition.params.length} onClick={onRandomize}>Randomize controls</button>
        <button type="button" disabled={modulesLocked} onClick={onDisconnect}>Disconnect cables</button>
        <button type="button" onClick={onSavePreset}>Save .vcvm preset</button>
        <button type="button" disabled={modulesLocked} onClick={onLoadPreset}>Load .vcvm preset…</button>
      </div>
    </aside>
  );
}
