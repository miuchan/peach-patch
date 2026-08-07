import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

function decodedColor(color: string) {
  const value = color.startsWith("#") ? color.slice(1) : color;
  const expanded = value.length === 3 ? [...value].map((digit) => digit + digit).join("") : value;
  const numeric = Number.parseInt(expanded.slice(0, 6), 16);
  return {
    red: (numeric >> 16) & 0xff,
    green: (numeric >> 8) & 0xff,
    blue: numeric & 0xff,
  };
}

export function RackCellGrid({
  values,
  actionBase,
  actionSteps,
  maxCells,
  packedWordBits,
  cellScale,
  onColor,
  antColor = "#14ff32",
  shadowColor = "#004600",
  monitorFuzz = false,
  reflection = false,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  actionSteps: number;
  maxCells: number;
  packedWordBits: number;
  cellScale: number;
  onColor: string;
  antColor?: string;
  shadowColor?: string;
  monitorFuzz?: boolean;
  reflection?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
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

    const sideLength = Math.max(1, Math.min(Math.sqrt(maxCells), Math.round(values?.[0] ?? 1)));
    const antIndex = Math.round(values?.[1] ?? -1);
    const shadowIndex = Math.round(values?.[2] ?? -1);
    const shadowVisible = (values?.[3] ?? 0) > 0.5;
    const packedOffset = 4;
    const cellSize = (cellScale * width) / sideLength;
    const color = decodedColor(onColor);
    for (let index = 0; index < sideLength * sideLength; index += 1) {
      const word = Math.round(values?.[packedOffset + Math.floor(index / packedWordBits)] ?? 0);
      if (((word >> (index % packedWordBits)) & 1) === 0) continue;
      const alpha =
        (index + Math.round(values?.[packedOffset + Math.ceil(maxCells / packedWordBits)] ?? 0)) % 2
          ? 145
          : 140;
      context.fillStyle = `rgba(${color.red},${color.green},${color.blue},${alpha / 255})`;
      context.fillRect(
        (index % sideLength) * cellSize,
        Math.floor(index / sideLength) * cellSize,
        cellSize,
        cellSize,
      );
    }
    if (shadowVisible && shadowIndex >= 0) {
      context.fillStyle = shadowColor;
      context.fillRect(
        (shadowIndex % sideLength) * cellSize,
        Math.floor(shadowIndex / sideLength) * cellSize,
        cellSize,
        cellSize,
      );
    }
    if (antIndex >= 0) {
      context.fillStyle = antColor;
      context.fillRect(
        (antIndex % sideLength) * cellSize,
        Math.floor(antIndex / sideLength) * cellSize,
        cellSize,
        cellSize,
      );
    }
    if (monitorFuzz) {
      const fuzzSize = 2.2;
      for (let index = 0; index < 55 * 55; index += 1) {
        if ((index * 1103515245 + Math.round(values?.at(-1) ?? 0)) & 1) continue;
        context.fillStyle = "rgba(255,255,255,0.0313725)";
        context.fillRect(
          (index % 55) * fuzzSize,
          Math.floor(index / 55) * fuzzSize,
          fuzzSize,
          fuzzSize,
        );
      }
    }
    if (reflection) {
      for (const [cx, cy, radius, alpha] of [
        [68, 54, 60, 7],
        [77, 48, 40, 7],
        [82, 43, 20, 7],
        [87, 40, 8, 5],
      ] as const) {
        context.fillStyle = `rgba(255,255,255,${alpha / 255})`;
        context.beginPath();
        context.arc(cx, cy, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }, [
    values,
    maxCells,
    packedWordBits,
    cellScale,
    onColor,
    antColor,
    shadowColor,
    monitorFuzz,
    reflection,
    width,
    height,
  ]);

  const encodedPosition = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
    const py = Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height)));
    const xStep = Math.round(px * (actionSteps - 1));
    const yStep = Math.round(py * (actionSteps - 1));
    const id = actionBase + xStep + yStep * actionSteps;
    lastAction.current = id;
    return id;
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-cell-grid"
      aria-label={t("display.cellGrid")}
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
        onAction(encodedPosition(event), true);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        onAction(encodedPosition(event), true);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        onAction(lastAction.current, false);
      }}
      onPointerCancel={() => onAction(lastAction.current, false)}
    />
  );
}
