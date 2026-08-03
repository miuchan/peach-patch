import type { MutableRefObject } from "react";
import { PortScope } from "./port-scope";
import type { ModuleInstance } from "../../lib/patch-types";
import type { ParamSpec, WebPluginModule } from "../../lib/web-plugin-registry";
import { rackLegacyUi } from "../../lib/rack-module-compatibility";
import { useI18n } from "../i18n/provider";

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
  const { formatNumber, t } = useI18n();
  const compatibilityUi = rackLegacyUi(module),
    hiddenParamIds = new Set(compatibilityUi.hiddenParamIds),
    hiddenStateIds = new Set(compatibilityUi.hiddenStateIds),
    compatibleParams = definition.params.filter((param) => !hiddenParamIds.has(param.id)),
    visibleParams = compatibleParams.filter((param) => !param.hidden && !param.button),
    stateKeys = (definition.stateKeys ?? [])
      .map((stateKey, id) => ({ stateKey, id }))
      .filter(({ id }) => !hiddenStateIds.has(id));
  const renderStateInput = (
    stateKey: NonNullable<WebPluginModule["stateKeys"]>[number],
    id: number,
  ) => {
    const value = Number(module.state?.[id] ?? 0);
    const suffix = stateKey.path?.length
      ? `.${stateKey.path.join(".")}`
      : stateKey.index === undefined
        ? ""
        : `[${stateKey.index}]`;
    const label = `${stateKey.key}${suffix}`;
    if (stateKey.type === "boolean") {
      return (
        <input
          aria-label={t("inspector.stateLabel", { module: module.model, state: label })}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onSetState(module.id, [[id, event.target.checked ? 1 : 0]])}
        />
      );
    }
    if (stateKey.type === "string-enum") {
      return (
        <select
          aria-label={t("inspector.stateLabel", { module: module.model, state: label })}
          value={Math.round(value)}
          onChange={(event) => onSetState(module.id, [[id, Number(event.target.value)]])}
        >
          {(stateKey.values ?? []).map((option, index) => (
            <option key={`${option}-${index}`} value={index}>
              {option || t("inspector.emptyOption", { index })}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        aria-label={t("inspector.stateLabel", { module: module.model, state: label })}
        type="number"
        step={stateKey.type === "integer" ? 1 : "any"}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onSetState(module.id, [[id, next]]);
        }}
      />
    );
  };

  return (
    <aside
      className="pw-inspector"
      aria-label={t("inspector.aria", { module: `${module.plugin}/${module.model}` })}
    >
      <header>
        <span>{t(audioRunning ? "inspector.livePorts" : "inspector.moduleInspector")}</span>
        <b>{module.model}</b>
        <small>{module.plugin}</small>
      </header>
      <div className="pw-inspector-ports">
        {definition.inputs.map((port) => (
          <label key={`in-${port.id}`}>
            <span>
              {t("inspector.input")} · {port.name}
            </span>
            <PortScope
              samples={peaks?.inputScopes[port.id] ?? []}
              label={t("inspector.inputWaveform", { port: port.name })}
            />
            <em>
              {formatNumber(peaks?.inputs[port.id] ?? 0, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              V
            </em>
          </label>
        ))}
        {definition.outputs.map((port) => (
          <label key={`out-${port.id}`}>
            <span>
              {t("inspector.output")} · {port.name}
            </span>
            <PortScope
              samples={peaks?.outputScopes[port.id] ?? []}
              label={t("inspector.outputWaveform", { port: port.name })}
            />
            <em>
              {formatNumber(peaks?.outputs[port.id] ?? 0, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              V
            </em>
          </label>
        ))}
      </div>
      {visibleParams.length > 0 && (
        <details className="pw-inspector-params">
          <summary>{t("inspector.parameters", { count: visibleParams.length })}</summary>
          <div>
            {visibleParams.map((param: ParamSpec) => {
              const value = module.params[param.id] ?? param.default;
              return (
                <label key={param.id}>
                  <span title={param.name}>{param.name}</span>
                  <input
                    aria-label={t("inspector.parameterControl", {
                      module: module.model,
                      parameter: param.name,
                    })}
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.snap ? 1 : "any"}
                    value={value}
                    onPointerEnter={() => {
                      hoveredParamRef.current = { moduleId: module.id, paramId: param.id };
                    }}
                    onPointerLeave={() => {
                      if (
                        hoveredParamRef.current?.moduleId === module.id &&
                        hoveredParamRef.current.paramId === param.id
                      )
                        hoveredParamRef.current = null;
                    }}
                    onChange={(event) =>
                      onSetParam(module.id, param.id, Number(event.target.value))
                    }
                  />
                  <output>
                    {formatNumber(Number(value), {
                      minimumFractionDigits: param.snap ? 0 : 3,
                      maximumFractionDigits: param.snap ? 0 : 3,
                    })}
                  </output>
                </label>
              );
            })}
          </div>
        </details>
      )}
      {stateKeys.length > 0 && (
        <details
          className="pw-inspector-state"
          open={inspectorStateOpen}
          onToggle={(event) => setInspectorStateOpen(event.currentTarget.open)}
        >
          <summary>{t("inspector.moduleState", { count: stateKeys.length })}</summary>
          {inspectorStateOpen && (
            <div>
              {stateKeys.map(({ stateKey, id }) => {
                const suffix = stateKey.path?.length
                  ? `.${stateKey.path.join(".")}`
                  : stateKey.index === undefined
                    ? ""
                    : `[${stateKey.index}]`;
                const label = `${stateKey.key}${suffix}`;
                return (
                  <label key={`${label}-${id}`}>
                    <span title={label}>{label}</span>
                    {renderStateInput(stateKey, id)}
                  </label>
                );
              })}
            </div>
          )}
        </details>
      )}
      {compatibleParams.length > 0 && (
        <div className="pw-midi-learn">
          <label>
            <span>{t("inspector.midiLearnTarget")}</span>
            <select
              aria-label={t("inspector.midiLearnParameter", { module: module.model })}
              value={
                hiddenParamIds.has(selectedLearnParamId)
                  ? compatibleParams[0].id
                  : selectedLearnParamId
              }
              onChange={(event) => setMidiLearnParamId(Number(event.target.value))}
            >
              {compatibleParams.map((param) => (
                <option key={param.id} value={param.id}>
                  {param.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={midiLearnArmed ? "active" : ""}
            disabled={!audioRunning || !midiMapAvailable}
            title={
              !midiMapAvailable
                ? t("inspector.midiMapRequired")
                : !audioRunning
                  ? t("inspector.startAudioForMidi")
                  : t("inspector.moveNextCc")
            }
            onClick={() =>
              onArmMidiLearn(
                hiddenParamIds.has(selectedLearnParamId)
                  ? compatibleParams[0].id
                  : selectedLearnParamId,
              )
            }
          >
            {t(midiLearnArmed ? "inspector.waitingForCc" : "inspector.mapNextCc")}
          </button>
        </div>
      )}
      <div className="pw-inspector-actions">
        {module.sourceUrl && (
          <a href={module.sourceUrl} target="_blank" rel="noreferrer">
            {t("inspector.originalSource")}
          </a>
        )}
        <button type="button" disabled={modulesLocked} onClick={onReplace}>
          {t("inspector.replaceFromLibrary")}
        </button>
        <button type="button" disabled={modulesLocked} onClick={onDuplicate} title="⌘/Ctrl+D">
          {t("inspector.duplicate")}
        </button>
        <button
          type="button"
          disabled={modulesLocked || !definition.params.length}
          onClick={onReset}
        >
          {t("inspector.initializeControls")}
        </button>
        <button
          type="button"
          disabled={modulesLocked || !definition.params.length}
          onClick={onRandomize}
        >
          {t("inspector.randomizeControls")}
        </button>
        <button type="button" disabled={modulesLocked} onClick={onDisconnect}>
          {t("inspector.disconnectCables")}
        </button>
        <button type="button" onClick={onSavePreset}>
          {t("inspector.savePreset")}
        </button>
        <button type="button" disabled={modulesLocked} onClick={onLoadPreset}>
          {t("inspector.loadPreset")}
        </button>
      </div>
    </aside>
  );
}
