import { useEffect, useRef, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type SortStepVisual = Extract<RuntimeVisual, { kind: "sort-step" }>;

const COLORS = {
  idle: "#ffffff",
  read: "#fada47",
  write: "#d13a52",
  other: "#1919e1",
};

export function RackSortStepDisplay({
  visual,
  values = [],
  scaleX,
  onAction,
}: {
  visual: SortStepVisual;
  values?: number[];
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const size = Math.max(0, Math.min(1000, Math.round(values[0] ?? 0)));

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(visual.width * ratio);
    element.height = Math.round(visual.height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, visual.width, visual.height);
    if (!size) return;
    const cellWidth = visual.width / size;
    for (let index = 0; index < size; index += 1) {
      const value = Math.max(0, Math.min(size, values[4 + index] ?? 0));
      const event = Math.round(values[4 + size + index] ?? 0);
      context.fillStyle =
        event === 1
          ? COLORS.read
          : event === 2
            ? COLORS.write
            : event === 3
              ? "transparent"
              : event
                ? COLORS.other
                : COLORS.idle;
      if (event === 3) continue;
      const barHeight = (value / size) * visual.height;
      context.fillRect(index * cellWidth, visual.height - barHeight, cellWidth + 0.1, barHeight);
    }
  }, [size, values, visual.height, visual.width]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * visual.width,
      y: ((event.clientY - bounds.top) / bounds.height) * visual.height,
    };
  };
  const write = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (!size) return;
    let first = Math.max(0, Math.min(size - 1, Math.floor((from.x / visual.width) * size)));
    let last = Math.max(0, Math.min(size - 1, Math.floor((to.x / visual.width) * size)));
    let firstValue = Math.max(0, Math.min(size, Math.floor((1 - from.y / visual.height) * size)));
    let lastValue = Math.max(0, Math.min(size, Math.floor((1 - to.y / visual.height) * size)));
    if (last < first) {
      [first, last] = [last, first];
      [firstValue, lastValue] = [lastValue, firstValue];
    }
    for (let index = first; index <= last; index += 1) {
      const mix = first === last ? 1 : (index - first) / (last - first);
      const value = Math.max(
        0,
        Math.min(size, Math.floor(firstValue + mix * (lastValue - firstValue))),
      );
      const action = visual.actionBase + index * (visual.valueSteps + 1) + value;
      onAction(action, true);
      onAction(action, false);
    }
  };
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-sort-step-display"
      aria-label="SortStep array editor"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        touchAction: "none",
        cursor: "crosshair",
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || event.ctrlKey) return;
        event.preventDefault();
        event.stopPropagation();
        drag.current = point(event);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const previous = drag.current;
        if (!previous || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        const next = point(event);
        write(previous, next);
        drag.current = next;
      }}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
