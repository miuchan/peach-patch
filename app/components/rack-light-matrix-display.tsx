import { memo, useEffect, useRef } from "react";

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export const RackLightMatrixDisplay = memo(function RackLightMatrixDisplay({
  values,
  lightStart,
  columns,
  rows,
  channels,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values: number[];
  lightStart: number;
  columns: number;
  rows: number;
  channels: 1 | 2 | 3;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || columns < 1 || rows < 1) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1),
      pixelWidth = Math.max(1, Math.round(width * scaleX * ratio)),
      pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    const cellWidth = pixelWidth / columns,
      cellHeight = pixelHeight / rows,
      radius = Math.max(0.55, Math.min(cellWidth, cellHeight) * 0.34);
    for (let row = 0; row < rows; row++)
      for (let column = 0; column < columns; column++) {
        const index = lightStart + (row * columns + column) * channels,
          r = clamp(values[index] ?? 0),
          g = channels > 1 ? clamp(values[index + 1] ?? 0) : r,
          b = channels > 2 ? clamp(values[index + 2] ?? 0) : r,
          peak = Math.max(r, g, b);
        if (peak < 0.002) continue;
        const cx = (column + 0.5) * cellWidth,
          cy = (row + 0.5) * cellHeight;
        context.beginPath();
        context.arc(cx, cy, radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${Math.max(0.18, peak)})`;
        context.shadowColor = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
        context.shadowBlur = radius * 1.6;
        context.fill();
      }
    context.shadowBlur = 0;
  }, [values, lightStart, columns, rows, channels, width, height, scaleX]);
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        pointerEvents: "none",
        zIndex: 4,
      }}
    />
  );
});
