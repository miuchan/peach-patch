import { useEffect, useState, type PointerEvent, type WheelEvent } from "react";
import type { RuntimeInteractionCommand, RuntimeVisual } from "../../lib/web-plugin-registry";
import rackMonoUrl from "../../assets/rack/fonts/ShareTechMono-Regular.ttf?url";

type NativeInteractionVisual = Extract<RuntimeVisual, { kind: "native-interaction" }>;

let rackMonoPromise: Promise<void> | undefined;

function loadRackMono(): Promise<void> {
  if (typeof FontFace === "undefined") return Promise.resolve();
  if (!rackMonoPromise)
    rackMonoPromise = new FontFace("RackShareTechMono", `url(${rackMonoUrl})`)
      .load()
      .then((font) => {
        document.fonts.add(font);
      });
  return rackMonoPromise;
}

function nextValue(
  current: number,
  command: Extract<RuntimeInteractionCommand, { target: "param" | "state" }>,
) {
  if (command.operation === "set") return command.value ?? 0;
  if (command.operation === "toggle")
    return current === (command.value ?? 1) ? (command.alternateValue ?? 0) : (command.value ?? 1);
  const minimum = command.minimum ?? 0;
  const maximum = command.maximum ?? 1;
  const step = command.step ?? 1;
  const candidate = current + step;
  if (command.wrap !== false && candidate > maximum) return minimum;
  if (command.wrap !== false && candidate < minimum) return maximum;
  return Math.max(minimum, Math.min(maximum, candidate));
}

/** Invisible hit regions for Rack widgets whose appearance is already in the
 * canonical panel image. The registry supplies source-derived geometry and the
 * exact parameter/state/action mutation, so these do not invent controls. */
export function RackNativeInteraction({
  visual,
  params,
  state,
  values,
  scaleX,
  onParam,
  onState,
  onAction,
  onLoadAsset,
}: {
  visual: NativeInteractionVisual;
  params: number[];
  state: number[];
  values?: number[];
  scaleX: number;
  onParam: (id: number, value: number) => void;
  onState: (updates: Array<[id: number, value: number]>) => void;
  onAction: (id: number, active: boolean) => void;
  onLoadAsset: () => void;
}) {
  const [menu, setMenu] = useState<
    | {
        command: Extract<RuntimeInteractionCommand, { target: "menu" }>;
        x: number;
        y: number;
      }
    | undefined
  >();
  useEffect(() => {
    if (visual.regions.some((region) => region.display?.fontFamily === "RackShareTechMono"))
      void loadRackMono().catch(() => undefined);
    if (!visual.assetBase || !visual.font || typeof FontFace === "undefined") return;
    const face = new FontFace(
      visual.font.family,
      `url(${JSON.stringify(`${visual.assetBase}${visual.font.file}`)})`,
    );
    void face
      .load()
      .then((loaded) => document.fonts.add(loaded))
      .catch(() => undefined);
  }, [visual.assetBase, visual.font, visual.regions]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(undefined);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  const run = (
    command: RuntimeInteractionCommand | undefined,
    origin?: { clientX: number; clientY: number },
  ) => {
    if (!command) return;
    if (command.target === "commands") {
      for (const child of command.commands) run(child, origin);
      return;
    }
    if (command.target === "condition") {
      const source =
        command.source === "param" ? params : command.source === "state" ? state : values;
      run(
        (source?.[command.id] ?? 0) === command.equals ? command.command : command.otherwise,
        origin,
      );
      return;
    }
    if (command.target === "menu") {
      if (origin) setMenu({ command, x: origin.clientX, y: origin.clientY });
      return;
    }
    if (command.target === "asset") {
      onLoadAsset();
      return;
    }
    if (command.target === "action") {
      onAction(command.id, true);
      onAction(command.id, false);
      return;
    }
    const targetValues = command.target === "param" ? params : state;
    const value = nextValue(targetValues[command.id] ?? 0, command);
    if (command.target === "param") onParam(command.id, value);
    else onState([[command.id, value]]);
  };
  const stop = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const wheel = (
    event: WheelEvent<HTMLButtonElement>,
    region: NativeInteractionVisual["regions"][number],
  ) => {
    const command = event.shiftKey
      ? event.deltaY < 0
        ? (region.shiftWheelUp ?? region.wheelUp)
        : (region.shiftWheelDown ?? region.wheelDown)
      : event.deltaY < 0
        ? region.wheelUp
        : region.wheelDown;
    if (!command) return;
    event.preventDefault();
    event.stopPropagation();
    run(command, event);
  };
  const selected = (command: RuntimeInteractionCommand) => {
    if (command.target !== "param" && command.target !== "state") return false;
    if (command.operation !== "set") return false;
    const values = command.target === "param" ? params : state;
    return values[command.id] === (command.value ?? 0);
  };
  const displayValue = (region: NativeInteractionVisual["regions"][number]) => {
    const display = region.display;
    if (!display) return undefined;
    const source =
      display.source === "param" ? params : display.source === "state" ? state : values;
    return source?.[display.id] ?? display.defaultValue ?? 0;
  };
  const sourceValue = (source: "param" | "state" | "visual", id: number) =>
    (source === "param" ? params : source === "state" ? state : values)?.[id] ?? 0;
  const displayInvalid = (region: NativeInteractionVisual["regions"][number]) => {
    const display = region.display;
    if (!display) return false;
    const value = displayValue(region) ?? 0;
    return (
      (display.invalidWhenNonFinite === true && !Number.isFinite(value)) ||
      (display.invalidAtOrBelow !== undefined && value <= display.invalidAtOrBelow)
    );
  };
  const displayClipped = (region: NativeInteractionVisual["regions"][number]) => {
    const display = region.display;
    if (!display || displayInvalid(region)) return false;
    const value = displayValue(region) ?? 0;
    if (display.clippedAtOrAbove !== undefined && value >= display.clippedAtOrAbove) return true;
    const comparison = display.clippedAgainst;
    return comparison !== undefined && value >= sourceValue(comparison.source, comparison.id);
  };
  const displayText = (region: NativeInteractionVisual["regions"][number]) => {
    const display = region.display;
    if (!display || display.hideValue || displayInvalid(region)) return "";
    if (display.text !== undefined) return display.text;
    const value = displayValue(region) ?? 0;
    if (display.activeText) {
      const active = display.activeText;
      if (sourceValue(active.source, active.id) === active.equals) return active.text;
    }
    if (display.condition) {
      const condition = display.condition;
      if (sourceValue(condition.source, condition.id) !== condition.equals)
        return condition.otherwiseText;
    }
    const label = display.labels?.[Math.round(value)];
    if (label !== undefined) return label;
    const integer = Math.round(value);
    const digits = Math.max(1, display.digits ?? 1);
    if (display.format === "midi-channel-any")
      return integer < 0 ? "ALL" : `CH ${String(integer + 1).padStart(digits, "0")}`;
    if (display.format === "midi-channel") return `CH ${String(integer + 1).padStart(digits, "0")}`;
    if (display.format === "integer") return String(integer).padStart(digits, "0");
    if (display.format === "signed-integer")
      return integer === 0
        ? "0"
        : `${integer > 0 ? "+" : "-"}${String(Math.abs(integer)).padStart(Math.max(1, digits - 1), "0")}`;
    if (display.format === "midi-map") {
      const secondary = display.secondary;
      const output = secondary ? Math.round(sourceValue(secondary.source, secondary.id)) : -1;
      return integer < 0 || output < 0
        ? "--- ---"
        : `${String(integer).padStart(3, "0")}>${String(output).padStart(3, "0")}`;
    }
    if (display.format === "ascii") {
      const length = Math.max(
        0,
        Math.min(1024, Math.round(sourceValue("visual", display.asciiLengthId ?? 0))),
      );
      let text = "";
      for (let index = 0; index < length; index++)
        text += String.fromCharCode(
          Math.max(0, Math.min(255, Math.round(sourceValue("visual", display.id + index)))),
        );
      return text;
    }
    const scaled = value * (display.scale ?? 1);
    const text =
      display.precision === undefined ? String(scaled) : scaled.toFixed(display.precision);
    return `${display.prefix ?? ""}${text}${display.suffix ?? ""}`;
  };

  return (
    <div
      className="pw-native-interaction"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 10,
        pointerEvents: "none",
      }}
      aria-hidden="false"
    >
      {visual.regions.map((region, index) => (
        <button
          key={`${region.label}-${index}`}
          type="button"
          className={`pw-native-interaction-region${region.display ? " pw-native-interaction-region--display" : ""}`}
          aria-label={region.label}
          title={region.title}
          style={{
            left: region.x * scaleX,
            top: region.y,
            width: region.width * scaleX,
            height: region.height,
            cursor: region.interactive === false ? "default" : (region.cursor ?? "pointer"),
            pointerEvents: region.interactive === false && !region.hoverOnly ? "none" : "auto",
            color:
              (displayClipped(region) ? region.display?.clippedColor : undefined) ??
              region.display?.colors?.[
                Math.round(
                  region.display.colorId === undefined
                    ? (displayValue(region) ?? 0)
                    : (values?.[region.display.colorId] ?? 0),
                )
              ] ??
              region.display?.color,
            background: region.display?.background,
            borderColor:
              region.display?.activeId !== undefined &&
              (values?.[region.display.activeId] ?? 0) > 0.5
                ? region.display.activeBorderColor
                : region.display?.borderColor,
            borderRadius: region.display?.borderRadius,
            fontSize: region.display?.fontSize,
            fontFamily: region.display?.fontFamily,
            fontWeight: region.display?.fontWeight,
            lineHeight: region.display?.lineHeight,
            whiteSpace: region.display?.format === "ascii" ? "pre-line" : undefined,
            alignItems: region.display?.format === "ascii" ? "start" : undefined,
            textAlign: region.display?.textAlign,
            justifyItems:
              region.display?.textAlign === "left"
                ? "start"
                : region.display?.textAlign === "right"
                  ? "end"
                  : undefined,
            padding: region.display?.padding,
          }}
          onPointerDown={(event) => {
            if (region.hoverOnly) return;
            stop(event);
            if (region.dragSelect) run(region.click, event);
          }}
          onPointerEnter={(event) => {
            if (!region.dragSelect || (event.buttons & 1) === 0) return;
            event.preventDefault();
            event.stopPropagation();
            run(region.click, event);
          }}
          onClick={(event) => {
            if (region.hoverOnly) return;
            event.preventDefault();
            event.stopPropagation();
            if (!region.dragSelect) run(region.click, event);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            run(region.doubleClick, event);
          }}
          onContextMenu={(event) => {
            if (!region.rightClick) return;
            event.preventDefault();
            event.stopPropagation();
            run(region.rightClick, event);
          }}
          onWheel={(event) => wheel(event, region)}
        >
          {region.display?.indicator && (
            <span
              className="pw-native-interaction-indicator"
              aria-hidden="true"
              style={{
                width: region.display.indicator.width * scaleX,
                height: region.display.indicator.height,
                borderRadius: region.display.indicator.borderRadius,
                background:
                  region.display.indicator.colors?.[Math.round(displayValue(region) ?? 0)] ??
                  region.display.indicator.color,
              }}
            />
          )}
          {displayInvalid(region) && region.display?.dash && (
            <span
              aria-hidden="true"
              style={{
                display: "block",
                width: region.display.dash.width * scaleX,
                borderTop: `${region.display.dash.strokeWidth}px solid ${region.display.dash.color ?? region.display.color}`,
              }}
            />
          )}
          {displayText(region)}
        </button>
      ))}
      {menu && (
        <div
          className="pw-native-interaction-menu"
          role="menu"
          aria-label={menu.command.title}
          style={{
            position: "fixed",
            left: menu.x,
            top: menu.y,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header>{menu.command.title}</header>
          {menu.command.choices.map((choice) => (
            <button
              key={choice.label}
              type="button"
              role="menuitemradio"
              aria-checked={selected(choice.command)}
              className={selected(choice.command) ? "selected" : undefined}
              onClick={() => {
                run(choice.command);
                setMenu(undefined);
              }}
            >
              <span>{choice.label}</span>
              <i aria-hidden="true">{selected(choice.command) ? "✓" : ""}</i>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
