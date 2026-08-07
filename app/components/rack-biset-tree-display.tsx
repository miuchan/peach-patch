import { useEffect, useRef } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type BisetTreeVisual = Extract<RuntimeVisual, { kind: "biset-tree" }>;

function prepareCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

export function RackBisetTreeDisplay({
  visual,
  values = [],
  scaleX,
}: {
  visual: BisetTreeVisual;
  values?: number[];
  scaleX: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const width = visual.width * scaleX;
    const context = prepareCanvas(element, width, visual.height);
    if (!context) return;

    const available = Math.max(0, Math.floor((values.length - 1) / 5));
    const count = Math.max(0, Math.min(visual.maxBranches, available, Math.round(values[0] ?? 0)));
    context.save();
    context.translate(width * 0.5, visual.height);
    context.rotate(-Math.PI / 2);
    context.strokeStyle = visual.color;
    context.lineCap = "round";
    for (let index = 0; index < count; index += 1) {
      const offset = 1 + index * 5;
      context.lineWidth = Math.max(0, (values[offset + 4] ?? 0) * 0.2);
      context.beginPath();
      context.moveTo(values[offset] ?? 0, values[offset + 1] ?? 0);
      context.lineTo(values[offset + 2] ?? 0, values[offset + 3] ?? 0);
      context.stroke();
    }
    context.restore();
  }, [scaleX, values, visual]);

  return (
    <canvas
      ref={canvas}
      className="pw-rack-biset-tree"
      aria-label="Biset wind-deformed tree display"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        pointerEvents: "none",
      }}
    />
  );
}
