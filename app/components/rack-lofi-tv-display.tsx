import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/provider";

export function RackLofiTvDisplay({
  values,
  columns,
  rows,
  cellSize,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  columns: number;
  rows: number;
  cellSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(columns, rows);
    const channelSize = columns * rows;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const source = column * rows + row;
        const pixel = (row * columns + column) * 4;
        image.data[pixel] = Math.floor(Math.max(0, Math.min(255, (values?.[source] ?? 0) * 256)));
        image.data[pixel + 1] = Math.floor(
          Math.max(0, Math.min(255, (values?.[channelSize + source] ?? 0) * 256)),
        );
        image.data[pixel + 2] = Math.floor(
          Math.max(0, Math.min(255, (values?.[channelSize * 2 + source] ?? 0) * 256)),
        );
        image.data[pixel + 3] = 255;
      }
    }
    const offscreen = document.createElement("canvas");
    offscreen.width = columns;
    offscreen.height = rows;
    offscreen.getContext("2d")?.putImageData(image, 0, 0);
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = false;
    context.drawImage(offscreen, 0, 0, columns * cellSize, rows * cellSize);
  }, [cellSize, columns, height, rows, values, width]);
  return (
    <canvas
      ref={canvasRef}
      className="pw-rack-lofi-tv"
      aria-label={t("display.lofiTv")}
      width={width}
      height={height}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        imageRendering: "pixelated",
      }}
    />
  );
}
