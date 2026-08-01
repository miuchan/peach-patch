import { memo, useEffect, useRef } from "react";

const SAMPLE_RATE = 48_000;

export const RackSpeckSpectrumDisplay = memo(function RackSpeckSpectrumDisplay({
  values,
  params,
  linLog,
  bins,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  params: number[];
  linLog: boolean;
  bins: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixelRatio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(2, 5, 6, .94)";
    context.fillRect(0, 0, width, height);
    const top = 15,
      plotHeight = height - 30,
      nyquist = SAMPLE_RATE / 2,
      zoom = Math.max(1, params[4] ?? 1),
      frequencyOffset = Math.max(0, Math.min(1, params[6] ?? 0));
    context.strokeStyle = "rgba(255,255,255,.07)";
    context.lineWidth = 1;
    for (let row = 0; row < plotHeight; row += 20) {
      context.beginPath();
      context.moveTo(0, top + row + .5);
      context.lineTo(width, top + row + .5);
      context.stroke();
    }
    if (!linLog) {
      const range = nyquist / zoom,
        start = frequencyOffset * (nyquist - range),
        first = Math.ceil(start / 1000) * 1000;
      for (let frequency = first; frequency < first + range; frequency += 1000) {
        const px = ((frequency - start) / range) * width;
        context.beginPath();
        context.moveTo(px + .5, top);
        context.lineTo(px + .5, top + plotHeight);
        context.stroke();
      }
    }
    const lanes = [values?.slice(0, bins), values?.slice(bins, bins * 2)],
      colors = ["rgba(244,81,0,.78)", "rgba(14,153,0,.78)"];
    context.save();
    context.beginPath();
    context.rect(0, top, width, plotHeight);
    context.clip();
    lanes.forEach((lane, channel) => {
      if (!lane?.length) return;
      const gain = Math.pow(2, Math.round(params[channel ? 2 : 0] ?? -2)) / 12,
        offset = params[channel ? 3 : 1] ?? -1;
      context.beginPath();
      let started = false;
      if (linLog) {
        const lowest = Math.max(1, Math.ceil(10 * bins / nyquist)),
          logMaximum = Math.log10(nyquist),
          lowX = Math.log10(lowest * nyquist / bins) * width / logMaximum,
          highX = Math.log10((bins - 1) * nyquist / bins) * width / logMaximum,
          residual = highX - highX / zoom,
          negativeOffset = -.8 * frequencyOffset * residual;
        for (let index = lowest; index < bins; index++) {
          const logarithmic = Math.log10(index * nyquist / bins) * width / logMaximum,
            px = zoom * (logarithmic - lowX + negativeOffset),
            py = top + plotHeight * (1 - (lane[index] * gain + offset)) / 2;
          if (started) context.lineTo(px, py);
          else { context.moveTo(px, py); started = true; }
        }
      } else {
        const visible = Math.max(2, Math.floor(bins / zoom)),
          start = Math.floor(frequencyOffset * (bins - visible));
        for (let index = 0; index < visible; index++) {
          const px = index * width / (visible - 1),
            py = top + plotHeight * (1 - ((lane[index + start] ?? 0) * gain + offset)) / 2;
          if (started) context.lineTo(px, py);
          else { context.moveTo(px, py); started = true; }
        }
      }
      context.strokeStyle = colors[channel];
      context.lineWidth = 1.75;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.globalCompositeOperation = "lighter";
      context.stroke();
      context.globalCompositeOperation = "source-over";
    });
    context.restore();
    context.fillStyle = "rgba(255,255,255,.58)";
    context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    const stats = lanes.map((lane) => {
      let index = 0, peak = 0;
      lane?.forEach((value, candidate) => {
        if (value > peak) { peak = value; index = candidate; }
      });
      return { frequency: SAMPLE_RATE / 4 * index / bins, peak };
    });
    context.fillText(`IN1:  Peak f: ${stats[0].frequency.toFixed(1).padStart(7)} - amp: ${stats[0].peak.toFixed(1).padStart(6)}`, 5, 10);
    context.fillText(`IN2:  Peak f: ${stats[1].frequency.toFixed(1).padStart(7)} - amp: ${stats[1].peak.toFixed(1).padStart(6)}`, 5, height - 4);
  }, [bins, height, linLog, params, values, width]);

  return (
    <canvas
      ref={canvasRef}
      className="pw-rack-spectrum"
      style={{ left: x * scaleX, top: y, width: width * scaleX, height }}
      aria-label="Speck live FFT spectrum"
    />
  );
});
