import { useEffect, useRef, useState } from "react";
import type { ModuleInstance } from "../../lib/patch-types";
import {
  rackParamResetValue,
  registerRackParamPress,
  type RackParamPress,
} from "../../lib/rack-param-interaction";
import {
  rackParamControlSize,
  rackParamDragAxis,
  rackParamDragDirection,
  rackParamInteraction,
  rackParamPlacementStyle,
  rackParamSwitchFrames,
} from "../../lib/rack-param-visual-data";
import {
  rackKeyFromModuleEvent as rackKeyFromEvent,
  rackModifiersFromModuleEvent as rackModifiersFromEvent,
  strokeKeyLabel,
} from "../../lib/rack-module-panel-data";
import { STROKE_SPECIAL_MODES, strokeSpecialModeLabel } from "../../lib/stroke-host";
import type { ParamSpec, WebPluginModule } from "../../lib/web-plugin-registry";
import { useI18n } from "../i18n/provider";

type ModulePanelControlsProps = {
  module: ModuleInstance;
  definition?: WebPluginModule;
  params: ParamSpec[];
  hasSourceLayout: boolean;
  midiDevices: { inputs: string[]; outputs: string[] };
  onOpenAssetPicker: () => void;
  onParam: (id: number, value: number) => void;
  onParamReset: (id: number, value: number) => void;
  onMomentary: (id: number, active: boolean) => void;
  onVisualAction: (id: number, active: boolean) => void;
  onParamHover: (id: number | null) => void;
  onState: (updates: Array<[id: number, value: number]>) => void;
  onData: (data: Record<string, unknown>) => void;
  onPolyphony: (channels: number) => void;
  onMidiDevice: (deviceName: string) => void;
};

export function ModulePanelControls({
  module,
  definition,
  params: panelParams,
  hasSourceLayout: hasParamSourceLayout,
  midiDevices,
  onOpenAssetPicker,
  onParam: updateParam,
  onParamReset,
  onMomentary,
  onVisualAction,
  onParamHover,
  onState,
  onData,
  onPolyphony,
  onMidiDevice,
}: ModulePanelControlsProps) {
  const { formatNumber, t } = useI18n();
  const paramDragRef = useRef<{
    pointerId: number;
    paramId: number;
    startCoordinate: number;
    startValue: number;
    min: number;
    max: number;
    snap: boolean;
    unbounded: boolean;
    axis: "x" | "y";
  } | null>(null);
  const lastParamPressRef = useRef<RackParamPress | null>(null);
  const assetPickerTimerRef = useRef<number | null>(null);
  const suppressAssetPickerRef = useRef(false);
  const [paramMenu, setParamMenu] = useState<{
    param: ParamSpec;
    x: number;
    y: number;
  } | null>(null);

  useEffect(
    () => () => {
      if (assetPickerTimerRef.current !== null) window.clearTimeout(assetPickerTimerRef.current);
    },
    [],
  );
  useEffect(() => {
    if (!paramMenu) return;
    const close = () => setParamMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [paramMenu]);

  const rackData =
      module.rack?.data && typeof module.rack.data === "object"
        ? (module.rack.data as Record<string, unknown>)
        : {},
    midiData =
      rackData.midi && typeof rackData.midi === "object" && !Array.isArray(rackData.midi)
        ? (rackData.midi as Record<string, unknown>)
        : {},
    midiDeviceName = String(midiData.deviceName || ""),
    midiOptions = definition?.runtime?.midi?.input ? midiDevices.inputs : midiDevices.outputs;

  const rackWidgetStyle = (param: ParamSpec) => {
    if (!param.position || !definition) return undefined;
    const size = rackParamControlSize(param);
    return {
      ...rackParamPlacementStyle(param.position, definition.width, size.width, size.height),
      width: size.width * (module.width / definition.width),
      height: size.height,
    };
  };
  const strokeCommandLabel = (value: number, fallback: string) => {
    switch (value) {
      case 9:
        return t("stroke.command.randomizeHoveredParameter");
      case 10:
        return t("stroke.command.copyHoveredParameter");
      case 11:
        return t("stroke.command.pasteHoveredParameter");
      case 12:
        return t("stroke.command.focusModule90");
      case 14:
        return t("stroke.command.focusModule30");
      case 13:
        return t("stroke.command.fitPatch");
      case 15:
        return t("stroke.command.toggleFocusFit");
      case 20:
        return t("stroke.command.toggleCableOpacity");
      case 21:
        return t("stroke.command.nextCableColor");
      case 22:
        return t("stroke.command.rotateCableLayer");
      case 23:
        return t("stroke.command.toggleCableVisibility");
      case 33:
        return t("stroke.command.toggleModuleLock");
      case 38:
        return t("stroke.command.addRandomModule");
      case 36:
        return t("stroke.command.saveModulePreset");
      case 37:
        return t("stroke.command.saveDefaultPreset");
      case 40:
        return t("stroke.command.panLeft");
      case 41:
        return t("stroke.command.panRight");
      case 42:
        return t("stroke.command.panUp");
      case 43:
        return t("stroke.command.panDown");
      default:
        return fallback;
    }
  };

  return (
    <div className={`pw-controls ${hasParamSourceLayout ? "source-layout" : ""}`}>
      {module.key === "Core/Notes" ? (
        <textarea
          className="pw-notes-editor"
          aria-label={t("module.notesText")}
          value={String(
            module.rack?.data && typeof module.rack.data === "object"
              ? ((module.rack.data as Record<string, unknown>).text ?? "")
              : "",
          )}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onData({ text: event.target.value })}
        />
      ) : (
        panelParams.map((param) => {
          const interaction = rackParamInteraction(param),
            label = t("module.controlLabel", {
              module: module.model,
              control: param.name,
            }),
            formattedValue = formatNumber(module.params[param.id] ?? param.default),
            resetParam = () =>
              window.requestAnimationFrame(() =>
                onParamReset(param.id, rackParamResetValue(param, module.params)),
              ),
            setMomentary = (active: boolean) => {
              onMomentary(param.id, active);
              if (param.actionId !== undefined) onVisualAction(param.actionId, active);
            },
            opensAssetPicker = Boolean(
              definition?.runtime?.asset && param.position?.widget === "LoadButton",
            ),
            queueAssetPicker = () => {
              if (!opensAssetPicker || suppressAssetPickerRef.current) return;
              if (assetPickerTimerRef.current !== null)
                window.clearTimeout(assetPickerTimerRef.current);
              assetPickerTimerRef.current = window.setTimeout(() => {
                assetPickerTimerRef.current = null;
                onOpenAssetPicker();
              }, 220);
            };
          return (
            <label
              key={param.id}
              className={`rack-control-${interaction} ${param.position?.control === "selector" ? "rack-selector" : ""}`}
              title={t("module.controlValue", {
                control: param.name,
                value: formattedValue,
              })}
              style={hasParamSourceLayout ? rackWidgetStyle(param) : undefined}
              onContextMenu={
                param.contextActions?.length
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setParamMenu({ param, x: event.clientX, y: event.clientY });
                    }
                  : undefined
              }
            >
              <span>{param.name}</span>
              {interaction === "button" ? (
                <button
                  type="button"
                  className="pw-param-button"
                  aria-label={label}
                  onPointerDown={(event) => {
                    if (event.button > 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const press = registerRackParamPress(
                      lastParamPressRef.current,
                      param.id,
                      event.pointerType,
                      performance.now(),
                    );
                    lastParamPressRef.current = press.next;
                    if (event.detail > 1 || press.doubleClick) {
                      if (assetPickerTimerRef.current !== null) {
                        window.clearTimeout(assetPickerTimerRef.current);
                        assetPickerTimerRef.current = null;
                      }
                      suppressAssetPickerRef.current = true;
                      setMomentary(false);
                      resetParam();
                      return;
                    }
                    suppressAssetPickerRef.current = false;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onParamHover(param.id);
                    setMomentary(true);
                  }}
                  onPointerUp={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    setMomentary(false);
                    queueAssetPicker();
                    suppressAssetPickerRef.current = false;
                  }}
                  onPointerCancel={() => {
                    suppressAssetPickerRef.current = false;
                    setMomentary(false);
                  }}
                  onKeyDown={(event) => {
                    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                      event.preventDefault();
                      setMomentary(true);
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      setMomentary(false);
                      if (opensAssetPicker) onOpenAssetPicker();
                    }
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (assetPickerTimerRef.current !== null) {
                      window.clearTimeout(assetPickerTimerRef.current);
                      assetPickerTimerRef.current = null;
                    }
                    suppressAssetPickerRef.current = true;
                    setMomentary(false);
                    resetParam();
                  }}
                  onBlur={() => {
                    onParamHover(null);
                    setMomentary(false);
                  }}
                >
                  {param.name}
                </button>
              ) : interaction === "switch" ? (
                <button
                  type="button"
                  className="pw-param-switch"
                  aria-label={t("module.controlValueLabel", {
                    module: module.model,
                    control: param.name,
                    value: formattedValue,
                  })}
                  onPointerDown={(event) => {
                    if (event.button > 0) return;
                    event.stopPropagation();
                    const press = registerRackParamPress(
                      lastParamPressRef.current,
                      param.id,
                      event.pointerType,
                      performance.now(),
                    );
                    lastParamPressRef.current = press.next;
                    if (event.detail > 1 || press.doubleClick) {
                      event.preventDefault();
                      resetParam();
                    }
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    resetParam();
                  }}
                  onClick={(event) => {
                    if (event.detail > 1) return;
                    const frames = rackParamSwitchFrames(param),
                      current = module.params[param.id] ?? param.default,
                      normalized =
                        param.max === param.min
                          ? 0
                          : (current - param.min) / (param.max - param.min),
                      nextFrame = (Math.round(normalized * (frames - 1)) + 1) % frames;
                    updateParam(
                      param.id,
                      param.min + (nextFrame / (frames - 1)) * (param.max - param.min),
                    );
                  }}
                >
                  {param.name}
                </button>
              ) : (
                <input
                  aria-label={label}
                  type="range"
                  min={Math.min(param.min, param.max)}
                  max={Math.max(param.min, param.max)}
                  step={param.snap ? 1 : "any"}
                  value={module.params[param.id] ?? param.default}
                  onPointerDown={(event) => {
                    if (event.button > 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const press = registerRackParamPress(
                      lastParamPressRef.current,
                      param.id,
                      event.pointerType,
                      performance.now(),
                    );
                    lastParamPressRef.current = press.next;
                    if (event.detail > 1 || press.doubleClick) {
                      paramDragRef.current = null;
                      resetParam();
                      return;
                    }
                    const axis = rackParamDragAxis(param),
                      startCoordinate = axis === "x" ? event.clientX : event.clientY;
                    paramDragRef.current = {
                      pointerId: event.pointerId,
                      paramId: param.id,
                      startCoordinate,
                      startValue: module.params[param.id] ?? param.default,
                      min: param.min,
                      max: param.max,
                      snap: Boolean(param.snap),
                      unbounded: Boolean(param.unbounded),
                      axis,
                    };
                    if (param.dragActionId !== undefined) onVisualAction(param.dragActionId, true);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onParamHover(param.id);
                  }}
                  onMouseDown={(event) => {
                    if (event.button > 0) return;
                    // A real mouse press dispatches pointerdown before its compatibility
                    // mousedown. The pointer handler already owns this drag, so do not
                    // register the same press twice and accidentally classify it as a
                    // double-click/reset.
                    if (paramDragRef.current?.paramId === param.id) return;
                    const press = registerRackParamPress(
                      lastParamPressRef.current,
                      param.id,
                      "mouse",
                      performance.now(),
                    );
                    lastParamPressRef.current = press.next;
                    if (event.detail > 1 || press.doubleClick) {
                      event.preventDefault();
                      event.stopPropagation();
                      paramDragRef.current = null;
                      resetParam();
                    }
                  }}
                  onPointerMove={(event) => {
                    const drag = paramDragRef.current;
                    if (!drag || drag.pointerId !== event.pointerId || drag.paramId !== param.id)
                      return;
                    event.preventDefault();
                    const coordinate = drag.axis === "x" ? event.clientX : event.clientY,
                      direction = rackParamDragDirection(param),
                      sensitivity = event.shiftKey ? 600 : 140,
                      raw =
                        drag.startValue +
                        ((coordinate - drag.startCoordinate) * direction * (drag.max - drag.min)) /
                          sensitivity,
                      stepped = drag.snap ? Math.round(raw) : raw,
                      next = drag.unbounded
                        ? stepped
                        : Math.min(
                            Math.max(drag.min, drag.max),
                            Math.max(Math.min(drag.min, drag.max), stepped),
                          );
                    updateParam(param.id, next);
                  }}
                  onPointerUp={(event) => {
                    const drag = paramDragRef.current;
                    if (!drag || drag.pointerId !== event.pointerId || drag.paramId !== param.id)
                      return;
                    paramDragRef.current = null;
                    if (param.dragActionId !== undefined) onVisualAction(param.dragActionId, false);
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                      event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  onPointerCancel={() => {
                    paramDragRef.current = null;
                    if (param.dragActionId !== undefined) onVisualAction(param.dragActionId, false);
                  }}
                  onPointerEnter={() => onParamHover(param.id)}
                  onPointerLeave={() => onParamHover(null)}
                  onFocus={() => onParamHover(param.id)}
                  onBlur={() => {
                    if (param.dragActionId !== undefined) onVisualAction(param.dragActionId, false);
                    onParamHover(null);
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    paramDragRef.current = null;
                    resetParam();
                  }}
                  onKeyDown={(event) => {
                    const current = module.params[param.id] ?? param.default;
                    if (event.key === "Home" || event.key === "End") {
                      event.preventDefault();
                      updateParam(param.id, event.key === "Home" ? param.min : param.max);
                      return;
                    }
                    const direction =
                      event.key === "ArrowLeft" || event.key === "ArrowDown"
                        ? -1
                        : event.key === "ArrowRight" || event.key === "ArrowUp"
                          ? 1
                          : 0;
                    if (!direction) return;
                    event.preventDefault();
                    const increment = param.snap
                      ? 1
                      : (param.max - param.min) / (event.shiftKey ? 1000 : 100);
                    const next = current + direction * increment;
                    updateParam(
                      param.id,
                      param.unbounded
                        ? next
                        : Math.min(
                            Math.max(param.min, param.max),
                            Math.max(Math.min(param.min, param.max), next),
                          ),
                    );
                  }}
                  onChange={(event) => updateParam(param.id, Number(event.target.value))}
                />
              )}
            </label>
          );
        })
      )}
      {module.key === "FrankBuss/Formula" && (
        <div className="pw-formula-editors">
          <textarea
            aria-label={t("module.formulaOutputExpression")}
            spellCheck={false}
            value={String(
              module.rack?.data && typeof module.rack.data === "object"
                ? ((module.rack.data as Record<string, unknown>).text ?? "")
                : "",
            )}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onData({ text: event.target.value })}
          />
          <input
            aria-label={t("module.formulaFrequencyExpression")}
            spellCheck={false}
            value={String(
              module.rack?.data && typeof module.rack.data === "object"
                ? ((module.rack.data as Record<string, unknown>).freq ?? "")
                : "",
            )}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onData({ freq: event.target.value })}
          />
        </div>
      )}
      {module.key === "Stoermelder-P1/Stroke" && (
        <div className="pw-stroke-map">
          {Array.from({ length: 10 }, (_, slot) => {
            const offset = 1 + slot * 5,
              key = Number(module.state?.[offset + 1] ?? -1),
              mods = Number(module.state?.[offset + 2] ?? 0),
              mode = Number(module.state?.[offset + 3] ?? 1);
            return (
              <div key={slot}>
                <span>{slot + 1}</span>
                <button
                  type="button"
                  aria-label={t("stroke.mapLabel", { slot: slot + 1 })}
                  title={t("stroke.mapHint")}
                  onKeyDown={(event) => {
                    const next = rackKeyFromEvent(event);
                    if (next < 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onState([
                      [offset, -1],
                      [offset + 1, next],
                      [offset + 2, rackModifiersFromEvent(event)],
                    ]);
                  }}
                >
                  {key < 0 ? t("stroke.mapKey") : strokeKeyLabel(key, mods)}
                </button>
                <select
                  aria-label={t("stroke.modeLabel", { slot: slot + 1 })}
                  value={mode}
                  onChange={(event) => onState([[offset + 3, Number(event.target.value)]])}
                >
                  <option value={0}>{t("stroke.mode.off")}</option>
                  <option value={1}>{t("stroke.mode.trigger")}</option>
                  <option value={2}>{t("stroke.mode.gate")}</option>
                  <option value={3}>{t("stroke.mode.toggle")}</option>
                  <optgroup label={t("stroke.browserCommands")}>
                    {STROKE_SPECIAL_MODES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {strokeCommandLabel(option.value, option.label)}
                      </option>
                    ))}
                  </optgroup>
                  {mode > 3 && !strokeSpecialModeLabel(mode) && (
                    <option value={mode}>
                      {t("stroke.importedDesktopCommand", { command: mode })}
                    </option>
                  )}
                </select>
                <button
                  type="button"
                  aria-label={t("stroke.clearMap", { slot: slot + 1 })}
                  onClick={() =>
                    onState([
                      [offset, -1],
                      [offset + 1, -1],
                      [offset + 2, 0],
                      [offset + 4, 0],
                    ])
                  }
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
      {definition?.polyphonic && (
        <label>
          <span>{t("module.voices")}</span>
          <select
            aria-label={t("module.polyphonyLabel", { module: module.model })}
            value={module.polyphony ?? 1}
            onChange={(event) => onPolyphony(Number(event.target.value))}
          >
            {[1, 2, 4, 8, 16].map((channels) => (
              <option key={channels} value={channels}>
                {formatNumber(channels)}
              </option>
            ))}
          </select>
        </label>
      )}
      {definition?.runtime?.midi && (
        <label className="pw-midi-device">
          <span>{definition.runtime.midi.input ? t("midi.input") : t("midi.output")}</span>
          <select
            aria-label={t("midi.deviceLabel", { module: module.model })}
            value={midiDeviceName}
            onChange={(event) => onMidiDevice(event.target.value)}
          >
            <option value="">
              {definition.runtime.midi.input ? t("midi.allInputs") : t("midi.firstOutput")}
            </option>
            {midiOptions.map((name) => (
              <option key={name} value={name}>
                {name === "Unnamed input"
                  ? t("midi.unnamedInput")
                  : name === "Unnamed output"
                    ? t("midi.unnamedOutput")
                    : name}
              </option>
            ))}
          </select>
          {!midiOptions.length && <small>{t("midi.startAudioToEnumerate")}</small>}
        </label>
      )}
      {paramMenu ? (
        <div
          className="pw-native-interaction-menu"
          role="menu"
          aria-label={paramMenu.param.name}
          style={{ left: paramMenu.x, top: paramMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <small>{paramMenu.param.name}</small>
          {paramMenu.param.contextActions?.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onVisualAction(action.id, true);
                onVisualAction(action.id, false);
                setParamMenu(null);
              }}
            >
              {action.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
