import { useEffect, useRef } from "react";
import type { ModuleInstance } from "../../lib/patch-types";
import {
  rackParamResetValue,
  registerRackParamPress,
  type RackParamPress,
} from "../../lib/rack-param-interaction";
import {
  rackParamControlSize,
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
  onParamHover,
  onState,
  onData,
  onPolyphony,
  onMidiDevice,
}: ModulePanelControlsProps) {
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

  useEffect(
    () => () => {
      if (assetPickerTimerRef.current !== null) window.clearTimeout(assetPickerTimerRef.current);
    },
    [],
  );

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

  return (
    <div className={`pw-controls ${hasParamSourceLayout ? "source-layout" : ""}`}>
      {module.key === "Core/Notes" ? (
        <textarea
          className="pw-notes-editor"
          aria-label="Notes text"
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
            label = `${module.model} ${param.name}`,
            resetParam = () =>
              window.requestAnimationFrame(() =>
                onParamReset(param.id, rackParamResetValue(param, module.params)),
              ),
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
              title={`${param.name}: ${module.params[param.id] ?? param.default}`}
              style={hasParamSourceLayout ? rackWidgetStyle(param) : undefined}
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
                      onMomentary(param.id, false);
                      resetParam();
                      return;
                    }
                    suppressAssetPickerRef.current = false;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onParamHover(param.id);
                    onMomentary(param.id, true);
                  }}
                  onPointerUp={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    onMomentary(param.id, false);
                    queueAssetPicker();
                    suppressAssetPickerRef.current = false;
                  }}
                  onPointerCancel={() => {
                    suppressAssetPickerRef.current = false;
                    onMomentary(param.id, false);
                  }}
                  onKeyDown={(event) => {
                    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                      event.preventDefault();
                      onMomentary(param.id, true);
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      onMomentary(param.id, false);
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
                    onMomentary(param.id, false);
                    resetParam();
                  }}
                  onBlur={() => {
                    onParamHover(null);
                    onMomentary(param.id, false);
                  }}
                >
                  {param.name}
                </button>
              ) : interaction === "switch" ? (
                <button
                  type="button"
                  className="pw-param-switch"
                  aria-label={`${label}: ${module.params[param.id] ?? param.default}`}
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
                    const axis = interaction === "selector" ? "x" : "y",
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
                      direction = drag.axis === "x" ? 1 : -1,
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
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                      event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  onPointerCancel={() => {
                    paramDragRef.current = null;
                  }}
                  onPointerEnter={() => onParamHover(param.id)}
                  onPointerLeave={() => onParamHover(null)}
                  onFocus={() => onParamHover(param.id)}
                  onBlur={() => onParamHover(null)}
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
            aria-label="Formula output expression"
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
            aria-label="Formula frequency expression"
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
                  aria-label={`Stroke map ${slot + 1}`}
                  title="Focus, then press a key"
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
                  {strokeKeyLabel(key, mods)}
                </button>
                <select
                  aria-label={`Stroke mode ${slot + 1}`}
                  value={mode}
                  onChange={(event) => onState([[offset + 3, Number(event.target.value)]])}
                >
                  <option value={0}>Off</option>
                  <option value={1}>Trigger</option>
                  <option value={2}>Gate</option>
                  <option value={3}>Toggle</option>
                  <optgroup label="Browser commands">
                    {STROKE_SPECIAL_MODES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                  {mode > 3 && !strokeSpecialModeLabel(mode) && (
                    <option value={mode}>Imported desktop command {mode}</option>
                  )}
                </select>
                <button
                  type="button"
                  aria-label={`Clear Stroke map ${slot + 1}`}
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
          <span>Voices</span>
          <select
            aria-label={`${module.model} polyphony`}
            value={module.polyphony ?? 1}
            onChange={(event) => onPolyphony(Number(event.target.value))}
          >
            {[1, 2, 4, 8, 16].map((channels) => (
              <option key={channels} value={channels}>
                {channels}
              </option>
            ))}
          </select>
        </label>
      )}
      {definition?.runtime?.midi && (
        <label className="pw-midi-device">
          <span>MIDI {definition.runtime.midi.input ? "input" : "output"}</span>
          <select
            aria-label={`${module.model} MIDI device`}
            value={midiDeviceName}
            onChange={(event) => onMidiDevice(event.target.value)}
          >
            <option value="">
              {definition.runtime.midi.input ? "All MIDI inputs" : "First MIDI output"}
            </option>
            {midiOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {!midiOptions.length && <small>Start audio to enumerate</small>}
        </label>
      )}
    </div>
  );
}
