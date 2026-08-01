import { useEffect, useRef } from "react";

export function RackNesScreenDisplay({
  values,
  bufferWidth,
  bufferHeight,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  bufferWidth: number;
  bufferHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current,
      context = canvas?.getContext("2d");
    if (!canvas || !context || !values?.length) return;
    const expected = bufferWidth * bufferHeight * 4,
      pixels = new Uint8ClampedArray(expected);
    for (let index = 0; index < expected; index++)
      pixels[index] = Math.round(Math.max(0, Math.min(1, values[index] ?? 0)) * 255);
    context.putImageData(new ImageData(pixels, bufferWidth, bufferHeight), 0, 0);
  }, [bufferHeight, bufferWidth, values]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="RackNES live screen"
      width={bufferWidth}
      height={bufferHeight}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        background: "#000",
        pointerEvents: "none",
      }}
    />
  );
}
