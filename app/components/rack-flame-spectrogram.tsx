import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const HEADER_SIZE = 8;

function color(scheme: number, row: number, fill: boolean) {
  const alpha = Math.max(0, 255 - row * 1.2) / 255;
  if (scheme === 1)
    return `rgba(${Math.min(255, (fill ? 46 : 0) + row)},${Math.min(255, (fill ? 87 : 233) + row)},${Math.min(255, (fill ? 228 : 255) + row)},${alpha})`;
  if (scheme === 2)
    return `rgba(${Math.min(255, (fill ? 46 : 150) + row)},${Math.min(255, (fill ? 228 : 255) + row)},${Math.min(255, (fill ? 46 : 150) + row)},${alpha})`;
  return `rgba(${Math.min(255, (fill ? 228 : 255) + row)},${Math.min(255, (fill ? 87 : 233) + row)},${Math.min(255, (fill ? 46 : 0) + row)},${alpha})`;
}

export function RackFlameSpectrogram({
  values,
  actionBase,
  columns,
  rows,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  columns: number;
  rows: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const lastAction = useRef(actionBase);
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
    context.imageSmoothingEnabled = false;
    const scheme = Math.round(values?.[0] ?? 0);
    const connected = (values?.[7] ?? 0) > 0.5;
    if (connected) {
      for (let row = rows - 1; row > 0; row -= 1) {
        const baseline = height * (1 - row / rows);
        context.beginPath();
        context.moveTo(0, baseline);
        for (let column = 0; column < columns; column += 1) {
          const magnitude = values?.[HEADER_SIZE + row * columns + column] ?? 0;
          context.lineTo(column, baseline - magnitude * height);
        }
        context.lineTo(width, baseline);
        context.closePath();
        context.lineWidth = 1;
        context.strokeStyle = color(scheme, row, false);
        context.fillStyle = color(scheme, row, true);
        context.stroke();
        context.fill();
      }
      const sumOffset = HEADER_SIZE + rows * columns;
      context.beginPath();
      context.moveTo(width, 0);
      for (let row = rows - 1; row > 0; row -= 1) {
        const baseline = height * (1 - row / rows);
        context.lineTo(width - (values?.[sumOffset + row] ?? 0), baseline);
      }
      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = "rgba(0,0,0,0.470588)";
      context.fill();
    }
    context.fillStyle = "rgba(0,0,0,0.313725)";
    context.fillRect(values?.[1] ?? 0, values?.[2] ?? 0, values?.[3] ?? 0, values?.[4] ?? 0);
  }, [columns, height, rows, values, width]);
  const actionAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const column = Math.max(
      0,
      Math.min(
        columns - 1,
        Math.round(((event.clientX - bounds.left) / bounds.width) * (columns - 1)),
      ),
    );
    const row = Math.max(
      0,
      Math.min(rows - 1, Math.round(((event.clientY - bounds.top) / bounds.height) * (rows - 1))),
    );
    return actionBase + row * columns + column;
  };
  const update = (event: PointerEvent<HTMLCanvasElement>) => {
    const action = actionAt(event);
    if (action === lastAction.current && dragging.current) return;
    lastAction.current = action;
    onAction(action, true);
  };
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    onAction(lastAction.current, false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <canvas
      ref={canvas}
      className="pw-rack-flame-spectrogram"
      aria-label={t("display.flameSpectrogram")}
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
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        lastAction.current = -1;
        update(event);
      }}
      onPointerMove={(event) => {
        if (dragging.current) update(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
