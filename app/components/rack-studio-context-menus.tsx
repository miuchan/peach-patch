import type { PatchCable, ModuleInstance } from "../../lib/patch-types";
import type { WebPluginModule } from "../../lib/web-plugin-registry";

type MenuPosition = { left: number; top: number };

export type RackStudioContextMenusProps = {
  moduleMenu: (MenuPosition & { moduleId: string }) | null;
  cableMenu: (MenuPosition & { cableId: string }) | null;
  module: ModuleInstance | undefined;
  definition: WebPluginModule | undefined;
  cable: PatchCable | undefined;
  colors: string[];
  modulesLocked: boolean;
  onSetParam: (moduleId: string, paramId: number, value: number) => void;
  onResetParam: (moduleId: string, paramId: number, value: number) => void;
  onSetState: (moduleId: string, updates: Array<[number, number]>) => void;
  onSetData: (moduleId: string, data: Record<string, unknown>) => void;
  onToggleBypass: (module: ModuleInstance) => void;
  onDuplicate: () => void;
  onReset: (module: ModuleInstance, definition: WebPluginModule) => void;
  onRandomize: (module: ModuleInstance, definition: WebPluginModule) => void;
  onDisconnect: (module: ModuleInstance) => void;
  onSavePreset: (module: ModuleInstance) => void;
  onLoadPreset: (module: ModuleInstance) => void;
  onReplace: (module: ModuleInstance) => void;
  onDeleteModule: (module: ModuleInstance) => void;
  onColor: (color: string) => void;
  onInsertCable: () => void;
  onDeleteCable: (cable: PatchCable) => void;
};

export function RackStudioContextMenus({
  moduleMenu, cableMenu, module, definition, cable, colors, modulesLocked,
  onSetParam, onResetParam, onSetState, onSetData,
  onToggleBypass, onDuplicate, onReset, onRandomize, onDisconnect, onSavePreset,
  onLoadPreset, onReplace, onDeleteModule, onColor, onInsertCable, onDeleteCable,
}: RackStudioContextMenusProps) {
  if (!moduleMenu && !cableMenu) return null;
  return <>
    {moduleMenu && module && <div className="pw-module-menu" style={{ left: moduleMenu.left, top: moduleMenu.top }} role="menu" aria-label={`${module.plugin}/${module.model} actions`} onPointerDown={(event) => event.stopPropagation()}>
      <header><span>MODULE</span><b>{module.model}</b><small>{module.plugin}</small></header>
      {definition?.params.some((param) => param.contextOnly) && <section className="pw-module-menu-params" aria-label="Module context controls"><small>MODULE CONTROLS</small>{definition.params.filter((param) => param.contextOnly).map((param) => { const value = module.params[param.id] ?? param.default; const options = param.snap ? Array.from({ length: Math.max(0, Math.round(param.max - param.min) + 1) }, (_, index) => param.min + index) : []; return <label key={param.id}><span title={param.name}>{param.name}</span>{param.button ? <button type="button" disabled={modulesLocked} onDoubleClick={() => onResetParam(module.id, param.id, param.default)} onPointerDown={() => onSetParam(module.id, param.id, 1)} onPointerUp={() => onSetParam(module.id, param.id, 0)}>Trigger</button> : param.snap ? <select disabled={modulesLocked} value={Math.round(value)} onDoubleClick={() => onResetParam(module.id, param.id, param.default)} onChange={(event) => onSetParam(module.id, param.id, Number(event.target.value))}>{options.map((option, index) => <option key={option} value={option}>{param.values?.[index] ?? option}</option>)}</select> : <input disabled={modulesLocked} type="range" min={param.min} max={param.max} step="any" value={value} onDoubleClick={() => onResetParam(module.id, param.id, param.default)} onChange={(event) => onSetParam(module.id, param.id, Number(event.target.value))} />}<output>{Number(value).toFixed(param.snap ? 0 : 3)}</output></label>; })}</section>}
      {definition?.runtime?.visuals?.filter((visual) => visual.kind === "scribble-strip").map((visual, index) => { const data = module.rack?.data && typeof module.rack.data === "object" ? module.rack.data as Record<string, unknown> : {}; const value = String(data[visual.dataKey] ?? visual.defaultText); return <section key={`scribble-editor-${index}`} className="pw-module-menu-params" aria-label="Scribble strip label"><small>LABEL</small><label><span>Edit this strip&apos;s label</span><input aria-label={`${module.model} label text`} disabled={modulesLocked} type="text" value={value} onChange={(event) => onSetData(module.id, { [visual.dataKey]: event.target.value })} /><output>{value.length}</output></label></section>; })}
      {definition?.stateKeys?.some((state) => state.contextOnly) && <section className="pw-module-menu-params" aria-label="Module context state controls"><small>MODULE OPTIONS</small>{definition.stateKeys.map((state, id) => ({ state, id })).filter(({ state }) => state.contextOnly).map(({ state, id }) => { const value = Number(module.state?.[id] ?? state.default ?? 0); const label = state.name ?? state.key; const reset = () => onSetState(module.id, [[id, state.default ?? 0]]); return <label key={`state-${id}`}><span title={label}>{label}</span>{state.values?.length ? <select disabled={modulesLocked} value={Math.round(value)} onDoubleClick={reset} onChange={(event) => onSetState(module.id, [[id, Number(event.target.value)]])}>{state.values.map((option, index) => <option key={`${option}-${index}`} value={index}>{option}</option>)}</select> : state.type === "boolean" ? <input disabled={modulesLocked} type="checkbox" checked={Boolean(value)} onDoubleClick={reset} onChange={(event) => onSetState(module.id, [[id, event.target.checked ? 1 : 0]])} /> : <input disabled={modulesLocked} type="number" step={state.type === "integer" ? 1 : "any"} value={value} onDoubleClick={reset} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onSetState(module.id, [[id, next]]); }} />}<output>{state.type === "boolean" ? value ? "On" : "Off" : state.values?.[Math.round(value)] ?? value}</output></label>; })}</section>}
      <button type="button" role="menuitem" onClick={() => onToggleBypass(module)}>{module.bypassed ? "Enable module" : "Bypass module"}</button>
      <button type="button" role="menuitem" disabled={modulesLocked} onClick={onDuplicate}>Duplicate <kbd>⌘D</kbd></button>
      <button type="button" role="menuitem" disabled={modulesLocked || !definition?.params.length} onClick={() => definition && onReset(module, definition)}>Initialize controls</button>
      <button type="button" role="menuitem" disabled={modulesLocked || !definition?.params.length} onClick={() => definition && onRandomize(module, definition)}>Randomize controls</button>
      <button type="button" role="menuitem" disabled={modulesLocked} onClick={() => onDisconnect(module)}>Disconnect cables</button>
      <button type="button" role="menuitem" onClick={() => onSavePreset(module)}>Save .vcvm preset</button>
      <button type="button" role="menuitem" disabled={modulesLocked} onClick={() => onLoadPreset(module)}>Load .vcvm preset…</button>
      <button type="button" role="menuitem" disabled={modulesLocked} onClick={() => onReplace(module)}>Replace from Library…</button>
      <button type="button" role="menuitem" className="danger" disabled={modulesLocked} onClick={() => onDeleteModule(module)}>Delete module</button>
    </div>}
    {cableMenu && cable && <div className="pw-cable-menu" style={{ left: cableMenu.left, top: cableMenu.top }} role="menu" aria-label={`Cable ${cable.id} actions`} onPointerDown={(event) => event.stopPropagation()}>
      <header><span>CABLE</span><b>Signal connection</b></header>
      <div aria-label="Cable color">{colors.map((color) => <button key={color} type="button" role="menuitem" className={cable.color === color ? "active" : ""} aria-label={`Use cable color ${color}`} style={{ backgroundColor: color }} disabled={modulesLocked} onClick={() => onColor(color)} />)}</div>
      <button type="button" role="menuitem" disabled={modulesLocked} onClick={onInsertCable}>Insert module here…</button>
      <button type="button" role="menuitem" className="danger" disabled={modulesLocked} onClick={() => onDeleteCable(cable)}>Delete cable</button>
    </div>}
  </>;
}
