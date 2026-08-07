import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const TRACKS = 4;
const STEPS = 16;
const HEADER = 6;
const VALUE_COUNT = 17;

export function RackFillingStationDisplay({
  values,
  actionBase,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ track: number; step: number; initial: number; clientY: number } | null>(
    null,
  );
  const lastValue = useRef(-1);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.font = "14px monospace";
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.lineWidth = 0.5;
    for (let track = 0; track < TRACKS; track += 1) {
      for (let step = 0; step < STEPS; step += 1) {
        const value = Math.round(values?.[HEADER + track * STEPS + step] ?? 0);
        if (value <= 0) break;
        const current = Math.round(values?.[2 + track] ?? -1) + 1 === step;
        const color = current ? "rgb(47,240,0)" : "rgb(239,224,0)";
        context.strokeStyle = color;
        context.fillStyle = color;
        context.strokeRect(step * 20, track * 25, 20, 25);
        context.fillText(String(value), step * 20 + 10, track * 25 + 16);
      }
    }
    context.font = "32px monospace";
    context.fillStyle = "rgb(74,195,39)";
    context.letterSpacing = "-1px";
    context.fillText(String(Math.round(values?.[0] ?? 0)), 90, 155);
  }, [height, values, width]);

  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    drag.current = null;
    lastValue.current = -1;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-filling-station-display"
      aria-label={t("display.fillingStation")}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: "none",
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const bounds = event.currentTarget.getBoundingClientRect();
        const localX = ((event.clientX - bounds.left) / bounds.width) * width;
        const localY = ((event.clientY - bounds.top) / bounds.height) * height;
        const track = Math.floor(localY / 25);
        const step = Math.floor(localX / 20);
        if (track < 0 || track >= TRACKS || step < 0 || step >= STEPS) return;
        drag.current = {
          track,
          step,
          initial: Math.round(values?.[HEADER + track * STEPS + step] ?? 0),
          clientY: event.clientY,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        const designDelta = ((current.clientY - event.clientY) / bounds.height) * height;
        const value = Math.max(0, Math.min(16, Math.trunc(current.initial + designDelta / 20)));
        if (value === lastValue.current) return;
        lastValue.current = value;
        const action = actionBase + (current.track * STEPS + current.step) * VALUE_COUNT + value;
        onAction(action, true);
        onAction(action, false);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
