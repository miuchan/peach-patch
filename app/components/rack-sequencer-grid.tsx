import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const HEADER_VALUES = 5;

export function RackSequencerGrid({
  values,
  actionBase,
  rows,
  columns,
  trackRows,
  colors,
  gridColor,
  markerColor,
  majorEvery,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  rows: number;
  columns: number;
  trackRows: number;
  colors: string[];
  gridColor: string;
  markerColor: string;
  majorEvery: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointerMode = useRef(0);
  const lastAction = useRef(actionBase);
  const trackCount = Math.max(1, Math.ceil(rows / Math.max(1, trackRows)));
  const trackOffset = HEADER_VALUES;
  const cellOffset = trackOffset + trackCount * 3;
  const cellCount = rows * columns;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);
    const cellWidth = width / columns;
    const cellHeight = height / rows;

    for (let row = 0; row < rows; row += 1) {
      const track = Math.min(colors.length - 1, Math.floor(row / trackRows));
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        if ((values?.[cellOffset + index * 2] ?? 0) <= 0.5) continue;
        const shade = Math.max(0, Math.min(1, values?.[cellOffset + index * 2 + 1] ?? 0));
        context.globalAlpha = 0.35 + shade * 0.65;
        context.fillStyle = colors[Math.max(0, track)] ?? "#ffffff";
        context.fillRect(column * cellWidth, row * cellHeight, cellWidth, cellHeight);
      }
    }
    context.globalAlpha = 1;
    context.strokeStyle = gridColor;
    for (let column = 1; column < columns; column += 1) {
      context.lineWidth = column % majorEvery === 0 ? 2 : 1;
      context.beginPath();
      context.moveTo(column * cellWidth, 0);
      context.lineTo(column * cellWidth, height);
      context.stroke();
    }
    for (let row = 1; row < rows; row += 1) {
      context.lineWidth = row % trackRows === 0 ? 2 : 1;
      context.beginPath();
      context.moveTo(0, row * cellHeight);
      context.lineTo(width, row * cellHeight);
      context.stroke();
    }

    context.strokeStyle = markerColor;
    context.lineWidth = 2;
    for (let track = 0; track < trackCount; track += 1) {
      const start = Math.max(0, Math.round(values?.[trackOffset + track * 3] ?? 0));
      const length = Math.max(1, Math.round(values?.[trackOffset + track * 3 + 1] ?? 1));
      const end = Math.max(start, start + length - 1);
      const startColumn = start % columns;
      const startRow = track * trackRows + Math.floor(start / columns);
      const endColumn = end % columns;
      const endRow = track * trackRows + Math.floor(end / columns);
      context.beginPath();
      context.moveTo(startColumn * cellWidth, startRow * cellHeight);
      context.lineTo(startColumn * cellWidth, (startRow + 1) * cellHeight);
      context.stroke();
      context.beginPath();
      context.moveTo((endColumn + 1) * cellWidth, endRow * cellHeight);
      context.lineTo((endColumn + 1) * cellWidth, (endRow + 1) * cellHeight);
      context.stroke();
      const rawPosition = Math.round(values?.[trackOffset + track * 3 + 2] ?? start);
      const position = rawPosition < start || rawPosition > end ? start : rawPosition;
      const playheadRow = track * trackRows + Math.floor(position / columns);
      context.strokeRect(
        (position % columns) * cellWidth,
        playheadRow * cellHeight,
        cellWidth,
        cellHeight,
      );
    }

    const selectedX = Math.max(0, Math.min(columns - 1, Math.round(values?.[2] ?? 0)));
    const selectedY = Math.max(0, Math.min(rows - 1, Math.round(values?.[3] ?? 0)));
    context.lineWidth = 4;
    context.strokeRect(
      selectedX * cellWidth - 2,
      selectedY * cellHeight - 2,
      cellWidth + 3,
      cellHeight + 3,
    );
  }, [
    values,
    rows,
    columns,
    trackRows,
    colors,
    gridColor,
    markerColor,
    majorEvery,
    width,
    height,
    trackCount,
    cellOffset,
    trackOffset,
  ]);

  const cellAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const column = Math.max(
      0,
      Math.min(columns - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * columns)),
    );
    const row = Math.max(
      0,
      Math.min(rows - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * rows)),
    );
    return row * columns + column;
  };
  const send = (event: PointerEvent<HTMLCanvasElement>, mode: number) => {
    const id = actionBase + mode * cellCount + cellAt(event);
    lastAction.current = id;
    onAction(id, true);
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-sequencer-grid"
      aria-label={t("display.sequencerGrid")}
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
        pointerMode.current = event.shiftKey ? 2 : event.detail >= 2 ? 1 : 0;
        send(event, pointerMode.current);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        send(event, pointerMode.current === 2 ? 2 : 0);
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
