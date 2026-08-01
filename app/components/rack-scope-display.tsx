import { useEffect, useRef } from "react";

function finite(samples: number[] | undefined) {
  return (samples ?? []).map((value) => (Number.isFinite(value) ? value : 0));
}

export function RackScopeDisplay({
  x,
  y,
  lissajous,
  gainX,
  gainY,
  offsetX,
  offsetY,
  threshold,
  triggerEnabled,
  width=195,
  height=165,
  left=0,
  top=38.5,
}: {
  x?: number[];
  y?: number[];
  lissajous: boolean;
  gainX: number;
  gainY: number;
  offsetX: number;
  offsetY: number;
  threshold: number;
  triggerEnabled: boolean;
  width?:number;
  height?:number;
  left?:number;
  top?:number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scale = Math.max(1, Math.min(3, window.devicePixelRatio || 1)),
      pixelWidth = width,
      pixelHeight = height;
    canvas.width = Math.round(pixelWidth * scale);
    canvas.height = Math.round(pixelHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    context.fillStyle = "#11191b";
    context.fillRect(0, 0, pixelWidth, pixelHeight);
    context.strokeStyle = "rgba(255,255,255,.075)";
    context.lineWidth = 1;
    for (let line = 0; line < 5; line++) {
      const row = 15 + (pixelHeight - 30) * (line / 4);
      context.beginPath();
      context.moveTo(0, row + .5);
      context.lineTo(pixelWidth, row + .5);
      context.stroke();
    }
    const xs = finite(x), ys = finite(y), count = Math.max(xs.length, ys.length);
    const normalizedX = (value: number) =>
      pixelWidth * (.5 + (value + offsetX) * Math.pow(2, Math.round(gainX)) / 20);
    const normalizedY = (value: number, gain: number, offset: number) =>
      15 + (pixelHeight - 30) * (.5 - (value + offset) * Math.pow(2, Math.round(gain)) / 20);
    const drawWave = (samples: number[], color: string, gain: number, offset: number) => {
      if (samples.length < 2) return;
      context.beginPath();
      samples.forEach((value, index) => {
        const px = index / (samples.length - 1) * pixelWidth,
          py = normalizedY(value, gain, offset);
        if (index) context.lineTo(px, py);
        else context.moveTo(px, py);
      });
      context.strokeStyle = color;
      context.lineWidth = 2.2;
      context.shadowColor = color;
      context.shadowBlur = 5;
      context.stroke();
      context.shadowBlur = 0;
    };
    if (lissajous && count > 1) {
      context.beginPath();
      for (let index = 0; index < count; index++) {
        const px = normalizedX(xs[index % Math.max(1, xs.length)] ?? 0),
          py = normalizedY(ys[index % Math.max(1, ys.length)] ?? 0, gainY, offsetY);
        if (index) context.lineTo(px, py);
        else context.moveTo(px, py);
      }
      context.strokeStyle = "#f3d34a";
      context.lineWidth = 1.8;
      context.shadowColor = "#f3d34a";
      context.shadowBlur = 5;
      context.stroke();
    } else {
      drawWave(ys, "#f0c64e", gainY, offsetY);
      drawWave(xs, "#f0c64e", gainX, offsetX);
      if (triggerEnabled) {
        const triggerY = normalizedY(threshold, gainX, offsetX);
        context.strokeStyle = "rgba(255,255,255,.12)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, triggerY + .5);
        context.lineTo(pixelWidth - 12, triggerY + .5);
        context.stroke();
        context.fillStyle = "rgba(255,255,255,.46)";
        context.beginPath();
        context.moveTo(pixelWidth - 12, triggerY);
        context.lineTo(pixelWidth - 5, triggerY - 4);
        context.lineTo(pixelWidth - 1, triggerY - 4);
        context.lineTo(pixelWidth - 1, triggerY + 4);
        context.lineTo(pixelWidth - 5, triggerY + 4);
        context.closePath();
        context.fill();
        context.fillStyle = "#1e282b";
        context.font = "7px ui-monospace, monospace";
        context.fillText("T", pixelWidth - 8, triggerY + 2.5);
      }
    }
    const statLine = (label: string, samples: number[], baseline: number) => {
      const maximum = samples.length ? Math.max(...samples) : 0,
        minimum = samples.length ? Math.min(...samples) : 0,
        peakToPeak = maximum - minimum,
        format = (value: number) => value.toFixed(2).padStart(6, " ");
      context.font = "7px ui-monospace, monospace";
      context.fillStyle = "rgba(255,255,255,.28)";
      context.fillText(label, 4, baseline);
      context.fillStyle = "rgba(255,255,255,.52)";
      context.fillText(
        `pp ${format(peakToPeak)}  max ${format(maximum)}  min ${format(minimum)}`,
        17,
        baseline,
      );
    };
    statLine("1", xs, 9);
    statLine("2", ys, pixelHeight - 3);
  }, [gainX, gainY, height, lissajous, offsetX, offsetY, threshold, triggerEnabled, width, x, y]);
  return <canvas ref={ref} className="pw-rack-scope" style={{left,top,width,height}} aria-label="Live Rack oscilloscope" />;
}
