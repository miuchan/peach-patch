import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type JoystickVisual = Extract<RuntimeVisual, { kind: "kilpatrick-joystick" }>;
type Point = { x: number; y: number };

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/** Exact browser counterpart of KilpatrickJoystick: movement is relative,
 * while holding P turns a press near an edge into one of its eight snaps. */
export function RackKilpatrickJoystick({
  visual,
  values,
  reset,
  scaleX,
  onAction,
}: {
  visual: JoystickVisual;
  values?: number[];
  reset: boolean;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const [local, setLocal] = useState<Point | null>(null);
  const drag = useRef<{ pointerId: number; start: Point; value: Point } | null>(null);
  const snap = useRef(false);
  const telemetry = reset
    ? { x: 0, y: 0 }
    : { x: clamp(values?.[0] ?? 0), y: clamp(values?.[1] ?? 0) };
  const point = local ?? telemetry;

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "p") snap.current = event.type === "keydown";
    };
    const clear = () => (snap.current = false);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", clear);
    };
  }, []);

  const normalized = (event: PointerEvent<SVGSVGElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1),
      y: clamp(1 - ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2),
    };
  };
  const emit = (next: Point) => {
    const x = Math.round(((clamp(next.x) + 1) / 2) * (visual.actionSteps - 1));
    const y = Math.round(((clamp(next.y) + 1) / 2) * (visual.actionSteps - 1));
    onAction(visual.actionBase + x, true);
    onAction(visual.actionBase + visual.actionSteps + y, true);
  };
  const snapped = (press: Point): Point | null => {
    if (!snap.current) return null;
    const edgeX = press.x < -0.5 ? -1 : press.x > 0.5 ? 1 : Math.abs(press.x) < 0.25 ? 0 : null;
    const edgeY = press.y > 0.5 ? 1 : press.y < -0.5 ? -1 : Math.abs(press.y) < 0.25 ? 0 : null;
    if (edgeX === null || edgeY === null || (edgeX === 0 && edgeY === 0)) return null;
    if (edgeY === 0 && edgeX === 0) return null;
    return { x: edgeX, y: edgeY };
  };

  return (
    <svg
      className="pw-kilpatrick-joystick"
      role="slider"
      aria-label="Quad panner joystick"
      aria-valuemin={-1}
      aria-valuemax={1}
      aria-valuenow={point.x}
      aria-valuetext={`${point.x.toFixed(2)}, ${point.y.toFixed(2)}`}
      viewBox={`0 0 ${visual.width} ${visual.height}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        touchAction: "none",
        cursor: "crosshair",
        zIndex: 11,
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const press = normalized(event);
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, start: press, value: telemetry };
        const next = snapped(press);
        if (next) {
          drag.current.value = next;
          setLocal(next);
          emit(next);
        }
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const current = normalized(event);
        const next = {
          x: clamp(active.value.x + current.x - active.start.x),
          y: clamp(active.value.y + current.y - active.start.y),
        };
        active.start = current;
        active.value = next;
        setLocal(next);
        emit(next);
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        setLocal(null);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setLocal(null);
      }}
    >
      <ellipse
        cx={visual.width / 2 + (point.x * visual.controlAreaScale * visual.width) / 2}
        cy={visual.height / 2 - (point.y * visual.controlAreaScale * visual.height) / 2}
        rx={visual.knobRadius}
        ry={visual.knobRadius}
        fill={visual.knobColor}
      />
    </svg>
  );
}
