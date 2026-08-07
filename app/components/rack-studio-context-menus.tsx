import type { PatchCable, ModuleInstance } from "../../lib/patch-types";
import { editableTextUpdate, editableTextValue } from "../../lib/rack-editable-text-data";
import type { RuntimeVisual, WebPluginModule } from "../../lib/web-plugin-registry";
import { useAlefsbitsPanelPreference } from "../hooks/use-alefsbits-panel-preference";
import { useI18n } from "../i18n/provider";

type MenuPosition = { left: number; top: number };
type EditableMenuVisual = Extract<
  RuntimeVisual,
  { kind: "scribble-strip" | "vertical-label" | "editable-text" }
>;

export type RackStudioContextMenusProps = {
  moduleMenu: (MenuPosition & { moduleId: string }) | null;
  cableMenu: (MenuPosition & { cableId: string }) | null;
  module: ModuleInstance | undefined;
  definition: WebPluginModule | undefined;
  visualValues: number[] | undefined;
  cable: PatchCable | undefined;
  colors: string[];
  modulesLocked: boolean;
  onSetParam: (moduleId: string, paramId: number, value: number) => void;
  onResetParam: (moduleId: string, paramId: number, value: number) => void;
  onSetState: (moduleId: string, updates: Array<[number, number]>) => void;
  onSetData: (moduleId: string, data: Record<string, unknown>) => void;
  onTriggerAction: (moduleId: string, actionId: number) => void;
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
  moduleMenu,
  cableMenu,
  module,
  definition,
  visualValues,
  cable,
  colors,
  modulesLocked,
  onSetParam,
  onResetParam,
  onSetState,
  onSetData,
  onTriggerAction,
  onToggleBypass,
  onDuplicate,
  onReset,
  onRandomize,
  onDisconnect,
  onSavePreset,
  onLoadPreset,
  onReplace,
  onDeleteModule,
  onColor,
  onInsertCable,
  onDeleteCable,
}: RackStudioContextMenusProps) {
  const { formatNumber, t } = useI18n();
  const alefsbitsPanel = definition?.runtime?.visuals?.some(
    (visual) => visual.kind === "alefsbits-panel",
  );
  const alefsbitsPreference = useAlefsbitsPanelPreference(module?.key ?? "");
  if (!moduleMenu && !cableMenu) return null;
  return (
    <>
      {moduleMenu && module && (
        <div
          className="pw-module-menu"
          style={{ left: moduleMenu.left, top: moduleMenu.top }}
          role="menu"
          aria-label={t("moduleMenu.aria", { module: `${module.plugin}/${module.model}` })}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header>
            <span>{t("moduleMenu.header")}</span>
            <b>{module.model}</b>
            <small>{module.plugin}</small>
          </header>
          {definition?.params.some((param) => param.contextOnly) && (
            <section className="pw-module-menu-params" aria-label={t("moduleMenu.controlsAria")}>
              <small>{t("moduleMenu.controlsHeading")}</small>
              {definition.params
                .filter((param) => param.contextOnly)
                .map((param) => {
                  const value = module.params[param.id] ?? param.default;
                  const options = param.snap
                    ? Array.from(
                        { length: Math.max(0, Math.round(param.max - param.min) + 1) },
                        (_, index) => param.min + index,
                      )
                    : [];
                  return (
                    <label key={param.id}>
                      <span title={param.name}>{param.name}</span>
                      {param.button ? (
                        <button
                          type="button"
                          disabled={modulesLocked}
                          onDoubleClick={() => onResetParam(module.id, param.id, param.default)}
                          onPointerDown={() => onSetParam(module.id, param.id, 1)}
                          onPointerUp={() => onSetParam(module.id, param.id, 0)}
                        >
                          {t("moduleMenu.trigger")}
                        </button>
                      ) : param.snap ? (
                        <select
                          disabled={modulesLocked}
                          value={Math.round(value)}
                          onDoubleClick={() => onResetParam(module.id, param.id, param.default)}
                          onChange={(event) =>
                            onSetParam(module.id, param.id, Number(event.target.value))
                          }
                        >
                          {options.map((option, index) => (
                            <option key={option} value={option}>
                              {param.values?.[index] ?? formatNumber(option)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          disabled={modulesLocked}
                          type="range"
                          min={param.min}
                          max={param.max}
                          step="any"
                          value={value}
                          onDoubleClick={() => onResetParam(module.id, param.id, param.default)}
                          onChange={(event) =>
                            onSetParam(module.id, param.id, Number(event.target.value))
                          }
                        />
                      )}
                      <output>
                        {formatNumber(Number(value), {
                          minimumFractionDigits: param.snap ? 0 : 3,
                          maximumFractionDigits: param.snap ? 0 : 3,
                        })}
                      </output>
                    </label>
                  );
                })}
            </section>
          )}
          {alefsbitsPanel && (
            <section className="pw-module-menu-params" aria-label="Panel contrast">
              <small>contrast</small>
              <label>
                <span>use global contrast</span>
                <input
                  type="checkbox"
                  disabled={modulesLocked}
                  checked={alefsbitsPreference.useGlobal}
                  onChange={(event) => alefsbitsPreference.setUseGlobal(event.target.checked)}
                />
              </label>
              <label>
                <span>contrast</span>
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.01}
                  disabled={modulesLocked || alefsbitsPreference.useGlobal}
                  value={alefsbitsPreference.moduleContrast}
                  onChange={(event) =>
                    alefsbitsPreference.setModuleContrast(Number(event.target.value))
                  }
                />
                <output>{formatNumber(alefsbitsPreference.effectiveContrast)}</output>
              </label>
              <label>
                <span>global contrast</span>
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.01}
                  disabled={modulesLocked}
                  value={alefsbitsPreference.globalContrast}
                  onChange={(event) =>
                    alefsbitsPreference.setGlobalContrast(Number(event.target.value))
                  }
                />
                <output>{formatNumber(alefsbitsPreference.globalContrast)}</output>
              </label>
              <button
                type="button"
                disabled={modulesLocked}
                onClick={alefsbitsPreference.setGlobalFromModule}
              >
                set global contrast
              </button>
            </section>
          )}
          {definition?.runtime?.visuals?.some((visual) => visual.kind === "alefsbits-turnt") && (
            <section className="pw-module-menu-params" aria-label="Turnt scope options">
              <small>scope</small>
              <label>
                <span>scope mode</span>
                <select
                  disabled={modulesLocked}
                  value={Math.round(visualValues?.[3] ?? 0)}
                  onChange={(event) =>
                    onTriggerAction(module.id, 1000 + (event.target.value === "0" ? 22 : 23))
                  }
                >
                  <option value={0}>bipolar</option>
                  <option value={1}>unipolar</option>
                </select>
              </label>
              <label>
                <span>time scale</span>
                <select
                  disabled={modulesLocked}
                  value={Math.round(visualValues?.[5] ?? 256)}
                  onChange={(event) => {
                    const size = Number(event.target.value);
                    onTriggerAction(module.id, 1000 + (size === 64 ? 19 : size === 256 ? 20 : 21));
                  }}
                >
                  <option value={64}>low</option>
                  <option value={256}>medium</option>
                  <option value={2048}>high</option>
                </select>
              </label>
            </section>
          )}
          {definition?.runtime?.visuals
            ?.filter(
              (visual): visual is EditableMenuVisual =>
                visual.kind === "scribble-strip" ||
                visual.kind === "vertical-label" ||
                (visual.kind === "editable-text" && visual.contextOnly === true),
            )
            .map((visual, index) => {
              const data =
                module.rack?.data && typeof module.rack.data === "object"
                  ? (module.rack.data as Record<string, unknown>)
                  : {};
              const value =
                visual.kind === "editable-text"
                  ? editableTextValue(data, visual, module.state, module.params)
                  : String(data[visual.dataKey] ?? visual.defaultText ?? "");
              return (
                <section
                  key={`scribble-editor-${index}`}
                  className="pw-module-menu-params"
                  aria-label={t("moduleMenu.scribbleAria")}
                >
                  <small>{t("moduleMenu.labelHeading")}</small>
                  <label>
                    <span>
                      {visual.kind === "editable-text" && visual.title
                        ? visual.title
                        : t("moduleMenu.editLabel")}
                    </span>
                    <input
                      aria-label={t("moduleMenu.labelTextAria", { module: module.model })}
                      disabled={modulesLocked}
                      type="text"
                      maxLength={
                        visual.kind === "vertical-label" || visual.kind === "editable-text"
                          ? visual.maximumLength
                          : undefined
                      }
                      value={value}
                      onChange={(event) => {
                        if (visual.kind !== "editable-text") {
                          onSetData(module.id, { [visual.dataKey]: event.target.value });
                          return;
                        }
                        const updates = editableTextUpdate(
                          data,
                          visual,
                          event.target.value,
                          module.state,
                          module.params,
                        );
                        if (updates) onSetData(module.id, updates);
                      }}
                    />
                    <output>{formatNumber(value.length)}</output>
                  </label>
                </section>
              );
            })}
          {definition?.runtime?.visuals
            ?.filter(
              (visual): visual is Extract<RuntimeVisual, { kind: "editable-text" }> =>
                visual.kind === "editable-text" && visual.styleControls !== false,
            )
            .map((visual, index) => {
              const data =
                module.rack?.data && typeof module.rack.data === "object"
                  ? (module.rack.data as Record<string, unknown>)
                  : {};
              const foreground = String(data[visual.foregroundKey] ?? visual.defaultForeground);
              const background = String(data[visual.backgroundKey] ?? visual.defaultBackground);
              return (
                <section key={`editable-text-color-${index}`} className="pw-module-menu-params">
                  <small>{t("moduleMenu.textColorsHeading")}</small>
                  <label>
                    <span>{t("moduleMenu.foreground")}</span>
                    <input
                      type="color"
                      disabled={modulesLocked}
                      value={foreground.slice(0, 7)}
                      onChange={(event) =>
                        onSetData(module.id, { [visual.foregroundKey]: event.target.value })
                      }
                    />
                    <output>{foreground}</output>
                  </label>
                  <label>
                    <span>{t("moduleMenu.background")}</span>
                    <input
                      type="color"
                      disabled={modulesLocked}
                      value={background.slice(0, 7)}
                      onChange={(event) =>
                        onSetData(module.id, { [visual.backgroundKey]: event.target.value })
                      }
                    />
                    <output>{background}</output>
                  </label>
                </section>
              );
            })}
          {definition?.stateKeys?.some((state) => state.contextOnly) && (
            <section
              className="pw-module-menu-params"
              aria-label={t("moduleMenu.stateControlsAria")}
            >
              <small>{t("moduleMenu.optionsHeading")}</small>
              {definition.stateKeys
                .map((state, id) => ({ state, id }))
                .filter(({ state }) => state.contextOnly)
                .map(({ state, id }) => {
                  const value = Number(module.state?.[id] ?? state.default ?? 0);
                  const label = state.name ?? state.key;
                  const reset = () => onSetState(module.id, [[id, state.default ?? 0]]);
                  if (state.bitmask?.length)
                    return (
                      <div className="pw-module-menu-bitmask" key={`state-${id}`}>
                        <span title={label}>{label}</span>
                        <div>
                          {state.bitmask.map((option) => (
                            <label key={`${id}-${option.bit}`}>
                              <span>{option.name}</span>
                              <input
                                disabled={modulesLocked}
                                type="checkbox"
                                checked={Boolean(Math.round(value) & option.bit)}
                                onDoubleClick={reset}
                                onChange={() =>
                                  onSetState(module.id, [[id, Math.round(value) ^ option.bit]])
                                }
                              />
                              <output>
                                {Math.round(value) & option.bit
                                  ? t("moduleMenu.on")
                                  : t("moduleMenu.off")}
                              </output>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  return (
                    <label key={`state-${id}`}>
                      <span title={label}>{label}</span>
                      {state.values?.length ? (
                        <select
                          disabled={modulesLocked}
                          value={Math.round(value)}
                          onDoubleClick={reset}
                          onChange={(event) =>
                            onSetState(module.id, [[id, Number(event.target.value)]])
                          }
                        >
                          {state.values.map((option, index) => (
                            <option key={`${option}-${index}`} value={index}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : state.type === "boolean" ? (
                        <input
                          disabled={modulesLocked}
                          type="checkbox"
                          checked={Boolean(value)}
                          onDoubleClick={reset}
                          onChange={(event) =>
                            onSetState(module.id, [[id, event.target.checked ? 1 : 0]])
                          }
                        />
                      ) : (
                        <input
                          disabled={modulesLocked}
                          type="number"
                          step={state.type === "integer" ? 1 : "any"}
                          value={value}
                          onDoubleClick={reset}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            if (Number.isFinite(next)) onSetState(module.id, [[id, next]]);
                          }}
                        />
                      )}
                      <output>
                        {state.type === "boolean"
                          ? value
                            ? t("moduleMenu.on")
                            : t("moduleMenu.off")
                          : (state.values?.[Math.round(value)] ?? formatNumber(value))}
                      </output>
                    </label>
                  );
                })}
            </section>
          )}
          {definition?.runtime?.contextActions?.map((action) => (
            <button
              key={`context-action-${action.id}`}
              type="button"
              role="menuitem"
              disabled={modulesLocked}
              onClick={() => onTriggerAction(module.id, action.id)}
            >
              {action.name}
            </button>
          ))}
          <button type="button" role="menuitem" onClick={() => onToggleBypass(module)}>
            {t(module.bypassed ? "moduleMenu.enable" : "moduleMenu.bypass")}
          </button>
          <button type="button" role="menuitem" disabled={modulesLocked} onClick={onDuplicate}>
            {t("moduleMenu.duplicate")} <kbd>⌘D</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={modulesLocked || !definition?.params.length}
            onClick={() => definition && onReset(module, definition)}
          >
            {t("moduleMenu.initializeControls")}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={modulesLocked || !definition?.params.length}
            onClick={() => definition && onRandomize(module, definition)}
          >
            {t("moduleMenu.randomizeControls")}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={modulesLocked}
            onClick={() => onDisconnect(module)}
          >
            {t("moduleMenu.disconnectCables")}
          </button>
          <button type="button" role="menuitem" onClick={() => onSavePreset(module)}>
            {t("moduleMenu.savePreset")}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={modulesLocked}
            onClick={() => onLoadPreset(module)}
          >
            {t("moduleMenu.loadPreset")}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={modulesLocked}
            onClick={() => onReplace(module)}
          >
            {t("moduleMenu.replaceFromLibrary")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            disabled={modulesLocked}
            onClick={() => onDeleteModule(module)}
          >
            {t("moduleMenu.deleteModule")}
          </button>
        </div>
      )}
      {cableMenu && cable && (
        <div
          className="pw-cable-menu"
          style={{ left: cableMenu.left, top: cableMenu.top }}
          role="menu"
          aria-label={t("cableMenu.aria", { id: cable.id })}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header>
            <span>{t("cableMenu.header")}</span>
            <b>{t("cableMenu.signalConnection")}</b>
          </header>
          <div aria-label={t("cableMenu.colorAria")}>
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                role="menuitem"
                className={cable.color === color ? "active" : ""}
                aria-label={t("cableMenu.useColor", { color })}
                style={{ backgroundColor: color }}
                disabled={modulesLocked}
                onClick={() => onColor(color)}
              />
            ))}
          </div>
          <button type="button" role="menuitem" disabled={modulesLocked} onClick={onInsertCable}>
            {t("cableMenu.insertModule")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            disabled={modulesLocked}
            onClick={() => onDeleteCable(cable)}
          >
            {t("cableMenu.deleteCable")}
          </button>
        </div>
      )}
    </>
  );
}
