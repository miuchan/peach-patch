import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const HEADER = 22;
const POSITION_COUNT = 16;

export function RackCellularAutoDisplay({
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
  const geometry = useRef({
    frameX: 0,
    frameY: 0,
    frameW: columns,
    frameH: rows,
    offsetX: 14,
    offsetY: 15,
    stepX: 6,
    stepY: 1,
  });
  const fieldBase = HEADER + columns;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    element.width = Math.max(1, Math.round(width * ratio));
    element.height = Math.max(1, Math.round(height * ratio));
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);

    const frameX = Math.round(values?.[0] ?? 0),
      frameY = Math.round(values?.[1] ?? 0),
      frameW = Math.max(0, Math.round(values?.[2] ?? columns)),
      frameH = Math.max(0, Math.round(values?.[3] ?? rows)),
      clockChannels = Math.max(0, Math.min(POSITION_COUNT, Math.round(values?.[4] ?? 0))),
      rule = Math.round(values?.[5] ?? 0);

    context.lineWidth = 1;
    for (let state = 0; state < 8; state += 1) {
      for (let bit = 0; bit < 3; bit += 1) {
        const active = (state & (1 << bit)) !== 0;
        context.strokeStyle = "rgba(64,200,255,0.5)";
        context.strokeRect(541 + bit * 13, 14 + state * 35, 11, 11);
        if (active) {
          context.fillStyle = "rgba(64,200,255,0.5)";
          context.fillRect(541 + bit * 13, 14 + state * 35, 11, 11);
        }
      }
      context.fillStyle = (rule & (1 << state)) !== 0 ? "rgba(0,255,0,0.667)" : "#000000";
      context.fillRect(541, 27 + state * 35, 37, 5);
    }

    for (let column = 0; column < columns; column += 1) {
      const initial = Math.round(values?.[HEADER + column] ?? 0);
      if (initial === 1) context.fillStyle = "rgba(255,255,0,0.471)";
      else if (initial === 2) context.fillStyle = "#ffffff";
      else context.fillStyle = "transparent";
      if (initial) context.fillRect(4 + column * 9, 2, 7, 7);
      context.strokeStyle = "rgba(255,255,0,0.588)";
      context.strokeRect(4 + column * 9, 2, 7, 7);
    }

    context.strokeStyle = "rgba(0,255,0,0.588)";
    context.strokeRect(4, 14, columns * 2 + 7, rows + 6);
    context.strokeRect(13 + columns * 2, 14, columns * 6 + 7, rows + 6);
    for (let column = 0; column < columns; column += 1)
      for (let row = 0; row < rows; row += 1) {
        context.fillStyle =
          (values?.[fieldBase + row * columns + column] ?? 0) > 0.5 ? "#80ff40" : "#000080";
        context.fillRect(8 + column * 2, 17 + row, 1, 1);
      }

    if (frameW <= 0 || frameH <= 0) return;
    context.strokeStyle = "rgba(255,255,255,0.784)";
    context.strokeRect(8 + frameX * 2, 17 + frameY, frameW * 2, frameH);
    const sizeX = Math.floor(columns / frameW) * 5,
      stepX = sizeX === 1 ? 1 : sizeX + 1,
      originalSizeY = Math.floor(rows / frameH),
      stepY = originalSizeY,
      sizeY = originalSizeY > 3 ? originalSizeY - 1 : originalSizeY,
      offsetX = Math.floor((columns * 6 - frameW * stepX) / 2) + 14,
      offsetY = Math.floor((rows - frameH * stepY) / 2) + 15;
    geometry.current = { frameX, frameY, frameW, frameH, offsetX, offsetY, stepX, stepY };
    for (let column = 0; column < frameW; column += 1)
      for (let row = 0; row < frameH; row += 1) {
        const active =
          (values?.[fieldBase + (row + frameY) * columns + column + frameX] ?? 0) > 0.5;
        context.fillStyle = active ? "#40c040" : "rgba(0,0,128,0.5)";
        context.fillRect(
          offsetX + 4 + columns * 2 + column * stepX,
          offsetY + 2 + row * stepY,
          sizeX,
          sizeY,
        );
      }
    for (let channel = 0; channel < clockChannels; channel += 1) {
      const position = Math.round(values?.[6 + channel] ?? 0),
        column = position % frameW,
        row = Math.floor(position / frameW);
      context.fillStyle = "#ff8040";
      context.fillRect(
        offsetX + 4 + columns * 2 + column * stepX,
        offsetY + 2 + row * stepY,
        sizeX,
        sizeY,
      );
    }
  }, [columns, fieldBase, height, rows, values, width]);

  const trigger = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect(),
      localX = ((event.clientX - bounds.left) / bounds.width) * width,
      localY = ((event.clientY - bounds.top) / bounds.height) * height,
      shiftedX = localX - 4,
      shiftedY = localY - 2;
    let encoded = -1;
    const initialColumn = Math.floor(shiftedX / 9),
      initialRow = Math.floor(shiftedY / 9);
    if (initialRow === 0 && initialColumn >= 0 && initialColumn < columns) encoded = initialColumn;
    else {
      const { frameX, frameY, frameW, frameH, offsetX, offsetY, stepX, stepY } = geometry.current;
      const column = Math.floor((shiftedX - offsetX - columns * 2) / stepX) + frameX,
        row = Math.floor((shiftedY - offsetY) / stepY) + frameY;
      if (column >= frameX && column < frameX + frameW && row >= frameY && row < frameY + frameH)
        encoded = columns + row * columns + column;
    }
    if (encoded < 0) return;
    event.preventDefault();
    event.stopPropagation();
    onAction(actionBase + encoded, true);
    onAction(actionBase + encoded, false);
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-cellular-auto-display"
      aria-label={t("display.cellularAuto")}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: "none",
      }}
      onPointerDown={trigger}
    />
  );
}
