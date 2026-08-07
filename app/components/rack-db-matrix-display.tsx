import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const HEADER_SIZE = 4;
const CHANNEL_COLORS = [
  "#ff0000",
  "#00ff00",
  "#3737ff",
  "#ffff00",
  "#ff00ff",
  "#00ffff",
  "#800000",
  "#c45537",
  "#808050",
  "#ff8000",
  "#ff0080",
  "#0080ff",
  "#804280",
  "#80ff00",
  "#8080ff",
  "#80ffff",
] as const;
const PALETTES = [
  [
    "#000066",
    "#002299",
    "#3344aa",
    "#0077bb",
    "#2277bb",
    "#4477bb",
    "#5566bb",
    "#6644ff",
    "#7744ff",
    "#884488",
    "#994455",
  ],
  ["#222266", "#44dd44", "#aaaa44"],
  ["#228855", "#9f4b0b", "#83b855", "#dddd99"],
] as const;

type MatrixMode = "continuous" | "binary" | "ant";

function rgb(color: string) {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff] as const;
}

function mixed(left: string, right: string, amount: number) {
  const a = rgb(left);
  const b = rgb(right);
  const channel = (index: number) => Math.round(a[index] + (b[index] - a[index]) * amount);
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
}

function paletteColor(palette: readonly string[], value: number) {
  const scaled = Math.max(0, Math.min(1, value)) * (palette.length - 1);
  const index = Math.min(palette.length - 1, Math.floor(scaled));
  if (index === palette.length - 1) return palette[index];
  return mixed(palette[index], palette[index + 1], scaled - index);
}

function cellColor(mode: MatrixMode, value: number, colorMode: number, selected: number) {
  if (mode === "binary") {
    if (selected >= 16) return value > 0.5 ? "#ffffff" : "#4444aa";
    if (selected >= 0)
      return value > 0.5
        ? CHANNEL_COLORS[selected]
        : mixed("#222222", CHANNEL_COLORS[selected], 0.5);
    return value > 0.5 ? "#a2d6c6" : "#222222";
  }
  const normalized = mode === "ant" && value > 0 ? 0.1 + value * 0.9 : value;
  let color =
    colorMode > 0
      ? paletteColor(PALETTES[Math.min(PALETTES.length - 1, colorMode - 1)], normalized)
      : `rgb(${Math.round(normalized * 255)},${Math.round(normalized * 255)},${Math.round(normalized * 255)})`;
  if (selected >= 16) color = "#ffffff";
  else if (selected >= 0) color = mixed(color, CHANNEL_COLORS[selected], 0.5);
  return color;
}

export function RackDbMatrixDisplay({
  values,
  actionBase,
  maxRows,
  mode,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  maxRows: number;
  mode: MatrixMode;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const lastCell = useRef(-1);
  const dragButton = useRef(-1);
  const dragErase = useRef(false);

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
    const rows = Math.max(1, Math.min(maxRows, Math.round(values?.[0] ?? maxRows)));
    const currentRow = Math.round(values?.[1] ?? -1);
    const currentColumn = Math.round(values?.[2] ?? -1);
    const colorMode = Math.round(values?.[3] ?? 0);
    const cellCount = maxRows * maxRows;
    const selectedOffset = HEADER_SIZE + cellCount;
    const markerOffset = selectedOffset + cellCount;
    const pitchX = width / rows;
    const pitchY = height / rows;
    const cellWidth = pitchX - 2;
    const cellHeight = pitchY - 2;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < rows; column += 1) {
        const index = row * maxRows + column;
        const value = values?.[HEADER_SIZE + index] ?? 0;
        const selected = Math.round(values?.[selectedOffset + index] ?? -1);
        const left = 1 + column * pitchX;
        const top = 1 + row * pitchY;
        context.fillStyle = cellColor(mode, value, colorMode, selected);
        context.fillRect(left, top, cellWidth, cellHeight);
        context.lineWidth = 2;
        context.strokeStyle =
          row === currentRow && column === currentColumn
            ? mode === "binary"
              ? "#ffffff"
              : "#ffff64"
            : mode === "binary"
              ? "#404040"
              : "#404028";
        context.strokeRect(left, top, cellWidth, cellHeight);
        const direction = Math.round(values?.[markerOffset + index] ?? -1);
        if (direction < 0 || direction > 3) continue;
        context.beginPath();
        if (direction === 0) {
          context.moveTo(left + cellWidth * 0.25, top + cellHeight);
          context.lineTo(left + cellWidth * 0.75, top + cellHeight);
          context.lineTo(left + cellWidth * 0.5, top);
        } else if (direction === 1) {
          context.moveTo(left, top + cellHeight * 0.25);
          context.lineTo(left, top + cellHeight * 0.75);
          context.lineTo(left + cellWidth, top + cellHeight * 0.5);
        } else if (direction === 2) {
          context.moveTo(left + cellWidth * 0.25, top);
          context.lineTo(left + cellWidth * 0.75, top);
          context.lineTo(left + cellWidth * 0.5, top + cellHeight);
        } else {
          context.moveTo(left + cellWidth, top + cellHeight * 0.25);
          context.lineTo(left + cellWidth, top + cellHeight * 0.75);
          context.lineTo(left, top + cellHeight * 0.5);
        }
        context.closePath();
        context.fillStyle = "#ffffff";
        context.fill();
      }
    }
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height);
    context.strokeStyle = "#505050";
    context.lineWidth = 2;
    context.stroke();
  }, [height, maxRows, mode, values, width]);

  const cellAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const rows = Math.max(1, Math.min(maxRows, Math.round(values?.[0] ?? maxRows)));
    const column = Math.max(
      0,
      Math.min(rows - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * rows)),
    );
    const row = Math.max(
      0,
      Math.min(rows - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * rows)),
    );
    return row * maxRows + column;
  };
  const send = (cell: number) => {
    if (cell === lastCell.current) return;
    lastCell.current = cell;
    const cellCount = maxRows * maxRows;
    if (dragButton.current === 2) onAction(actionBase + 2 * cellCount + cell, true);
    else if (mode !== "continuous")
      onAction(actionBase + (dragErase.current ? cellCount : 0) + cell, true);
  };
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    dragButton.current = -1;
    lastCell.current = -1;
  };
  return (
    <canvas
      ref={canvas}
      className="pw-rack-db-matrix-display"
      aria-label={t("display.dbMatrix")}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: "none",
      }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.button !== 0 && event.button !== 2) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragButton.current = event.button;
        dragErase.current =
          event.shiftKey ||
          (mode === "binary" &&
            event.button === 0 &&
            (values?.[HEADER_SIZE + cellAt(event)] ?? 0) > 0.5);
        lastCell.current = -1;
        send(cellAt(event));
      }}
      onPointerMove={(event) => {
        if (dragButton.current < 0) return;
        event.preventDefault();
        send(cellAt(event));
      }}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
