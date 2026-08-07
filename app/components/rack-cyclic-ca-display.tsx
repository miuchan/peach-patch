import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/provider";

const HEADER_SIZE = 5;
const COLOR_COUNT = 32;

export function RackCyclicCaDisplay({
  values,
  cellsPerWord,
  bitsPerCell,
  pixelWidth,
  pixelHeight,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  cellsPerWord: number;
  bitsPerCell: number;
  pixelWidth: number;
  pixelHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    element.width = pixelWidth;
    element.height = pixelHeight;
    const context = element.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    const image = context.createImageData(pixelWidth, pixelHeight);
    if (!values?.length) {
      context.putImageData(image, 0, 0);
      return;
    }
    const cellSize = Math.max(1, Math.round(values[0] ?? 2));
    const columns = Math.max(1, Math.min(pixelWidth, Math.round(values[1] ?? 1)));
    const rows = Math.max(1, Math.min(pixelHeight, Math.round(values[2] ?? 1)));
    const colorOffset = HEADER_SIZE;
    const wordOffset = colorOffset + COLOR_COUNT;
    for (let py = 0; py < pixelHeight; py += 1) {
      const row = Math.min(rows - 1, Math.floor(py / cellSize));
      for (let px = 0; px < pixelWidth; px += 1) {
        const column = Math.min(columns - 1, Math.floor(px / cellSize));
        const cell = row * columns + column;
        const packed = Math.round(values[wordOffset + Math.floor(cell / cellsPerWord)] ?? 0);
        const state = (packed >> ((cell % cellsPerWord) * bitsPerCell)) & ((1 << bitsPerCell) - 1);
        const rgb = Math.max(0, Math.round(values[colorOffset + state] ?? 0));
        const offset = (py * pixelWidth + px) * 4;
        image.data[offset] = (rgb >> 16) & 0xff;
        image.data[offset + 1] = (rgb >> 8) & 0xff;
        image.data[offset + 2] = rgb & 0xff;
        image.data[offset + 3] = 0xff;
      }
    }
    context.putImageData(image, 0, 0);
  }, [bitsPerCell, cellsPerWord, pixelHeight, pixelWidth, values]);
  return (
    <canvas
      ref={canvas}
      className="pw-rack-cyclic-ca-display"
      aria-label={t("display.cyclicCa")}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        imageRendering: "pixelated",
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    />
  );
}
