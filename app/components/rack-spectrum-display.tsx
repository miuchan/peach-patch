import { memo, useEffect, useRef } from "react";

const SAMPLE_RATE = 48_000,
  FFT_SIZE = 512,
  CHANNEL_COLORS = ["#ff1f26", "#19e94d", "#287dff", "#ffef28"];

function finiteSamples(samples: number[] | undefined) {
  return (samples ?? []).map((value) => (Number.isFinite(value) ? value : 0));
}

function spectrum(samples: number[], gain = 1) {
  const source = samples.slice(-FFT_SIZE),
    result = new Float32Array(FFT_SIZE / 2);
  if (source.length < FFT_SIZE) return result;
  const real = new Float64Array(FFT_SIZE),
    imaginary = new Float64Array(FFT_SIZE);
  for (let index = 0; index < FFT_SIZE; index++)
    real[index] =
      source[index] * gain * (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (FFT_SIZE - 1)));
  for (let index = 1, j = 0; index < FFT_SIZE; index++) {
    let bit = FFT_SIZE >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (index < j) [real[index], real[j]] = [real[j], real[index]];
  }
  for (let length = 2; length <= FFT_SIZE; length <<= 1) {
    const angle = (-2 * Math.PI) / length,
      phaseReal = Math.cos(angle),
      phaseImaginary = Math.sin(angle);
    for (let offset = 0; offset < FFT_SIZE; offset += length) {
      let twiddleReal = 1,
        twiddleImaginary = 0;
      for (let index = 0; index < length / 2; index++) {
        const even = offset + index,
          odd = even + length / 2,
          oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary,
          oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextReal = twiddleReal * phaseReal - twiddleImaginary * phaseImaginary;
        twiddleImaginary = twiddleReal * phaseImaginary + twiddleImaginary * phaseReal;
        twiddleReal = nextReal;
      }
    }
  }
  for (let bin = 1; bin < result.length; bin++)
    result[bin] = Math.hypot(real[bin], imaginary[bin]) / (FFT_SIZE * 0.5);
  return result;
}

function frequencyLabel(value: number) {
  if (value >= 1000) return `${Number((value / 1000).toPrecision(2))}k`;
  return String(Math.round(value));
}

function magnitudeY(value: number, scale: number, height: number) {
  if (scale < 0.5) return height * (1 - Math.min(1, value * 0.25));
  const floor = scale < 1.5 ? -60 : -120,
    db = 20 * Math.log10(Math.max(1e-8, value));
  return height * (1 - Math.max(0, Math.min(1, (db - floor) / (12 - floor))));
}

function heatColor(value: number, map: number) {
  const t = Math.max(0, Math.min(1, value)),
    stops =
      map % 3 === 1
        ? [
            [0, 0, 0],
            [0, 42, 88],
            [0, 190, 196],
            [255, 246, 84],
          ]
        : map % 3 === 2
          ? [
              [0, 0, 0],
              [64, 0, 100],
              [220, 40, 70],
              [255, 239, 120],
            ]
          : [
              [0, 0, 4],
              [65, 9, 104],
              [187, 55, 84],
              [249, 142, 9],
              [252, 255, 164],
            ],
    scaled = t * (stops.length - 1),
    left = Math.min(stops.length - 2, Math.floor(scaled)),
    mix = scaled - left,
    a = stops[left],
    b = stops[left + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * mix)} ${Math.round(a[1] + (b[1] - a[1]) * mix)} ${Math.round(a[2] + (b[2] - a[2]) * mix)})`;
}

function drawAxes(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: "spectrum-analyzer" | "spectrogram",
  frequencyScale: number,
  low: number,
  high: number,
  magnitudeScale: number,
) {
  const left = kind === "spectrogram" ? 40 : 35,
    right = 15,
    top = 20,
    bottom = 50,
    plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#1a1a1a";
  context.lineWidth = 1;
  context.font = "8px Arial,sans-serif";
  context.fillStyle = "#fff";
  context.textAlign = kind === "spectrogram" ? "right" : "center";
  context.textBaseline = kind === "spectrogram" ? "middle" : "top";
  for (let tick = 1; tick < 10; tick++) {
    const normalized = tick / 10,
      frequency =
        low + (high - low) * (frequencyScale > 0.5 ? normalized * normalized : normalized);
    if (kind === "spectrum-analyzer") {
      const x = left + normalized * plotWidth;
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, top + plotHeight);
      context.stroke();
      context.fillText(frequencyLabel(frequency), x, top + plotHeight + 4);
    } else {
      const y = top + (1 - normalized) * plotHeight;
      context.fillText(frequencyLabel(frequency), left - 3, y);
    }
  }
  if (kind === "spectrum-analyzer") {
    const levels =
      magnitudeScale < 0.5
        ? [0, 1, 2, 3, 4]
        : magnitudeScale < 1.5
          ? [-60, -48, -24, -12, 0, 12]
          : [-120, -96, -60, -48, -24, -12, 0, 12];
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (const level of levels) {
      const normalized =
          magnitudeScale < 0.5
            ? level / 4
            : (level - (magnitudeScale < 1.5 ? -60 : -120)) /
              (12 - (magnitudeScale < 1.5 ? -60 : -120)),
        y = top + (1 - normalized) * plotHeight;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(left + plotWidth, y);
      context.stroke();
      context.fillText(magnitudeScale < 0.5 ? `${level * 100}%` : `${level}`, left - 3, y);
    }
  }
  context.strokeRect(left + 0.5, top + 0.5, plotWidth - 1, plotHeight - 1);
  return { left, right, top, bottom, plotWidth, plotHeight };
}

type RackSpectrumDisplayProps = {
  kind: "spectrum-analyzer" | "spectrogram";
  samples?: number[][];
  params: number[];
  state?: number[];
  running: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const RackSpectrumDisplay = memo(function RackSpectrumDisplay({
  kind,
  samples,
  params,
  state,
  running,
  x,
  y,
  width,
  height,
}: RackSpectrumDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    historiesRef = useRef<number[][]>([]),
    columnsRef = useRef<Float32Array[]>([]);
  useEffect(() => {
    const channelCount = kind === "spectrum-analyzer" ? 4 : 1;
    while (historiesRef.current.length < channelCount) historiesRef.current.push([]);
    if (running)
      for (let channel = 0; channel < channelCount; channel++) {
        const history = historiesRef.current[channel],
          incoming = finiteSamples(samples?.[channel]);
        history.push(...incoming);
        if (history.length > FFT_SIZE * 2) history.splice(0, history.length - FFT_SIZE * 2);
      }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    const frequencyScale = kind === "spectrum-analyzer" ? (params[8] ?? 1) : (params[3] ?? 1),
      magnitudeScale = kind === "spectrum-analyzer" ? (params[9] ?? 1) : 1,
      low = Math.max(0, kind === "spectrum-analyzer" ? (params[12] ?? 0) : (params[6] ?? 0)),
      high = Math.max(
        low + 1,
        Math.min(
          SAMPLE_RATE / 2,
          kind === "spectrum-analyzer"
            ? (params[13] ?? SAMPLE_RATE / 2)
            : (params[7] ?? SAMPLE_RATE / 2),
        ),
      ),
      slope = kind === "spectrum-analyzer" ? (params[14] ?? 0) : (params[8] ?? 0),
      axes = drawAxes(context, width, height, kind, frequencyScale, low, high, magnitudeScale);
    context.save();
    context.beginPath();
    context.rect(axes.left, axes.top, axes.plotWidth, axes.plotHeight);
    context.clip();
    if (kind === "spectrum-analyzer") {
      historiesRef.current.slice(0, 4).forEach((history, channel) => {
        const bins = spectrum(history, params[channel] ?? 1);
        if (!bins.some(Boolean)) return;
        context.beginPath();
        let started = false;
        for (let bin = 1; bin < bins.length; bin++) {
          const frequency = (bin * SAMPLE_RATE) / FFT_SIZE;
          if (frequency < low || frequency > high) continue;
          const normalizedFrequency = (frequency - low) / (high - low),
            normalizedX =
              frequencyScale > 0.5 ? Math.sqrt(normalizedFrequency) : normalizedFrequency,
            compensated = bins[bin] * Math.pow(Math.max(frequency, 1) / 1000, slope / 20),
            px = axes.left + normalizedX * axes.plotWidth,
            py = axes.top + magnitudeY(compensated, magnitudeScale, axes.plotHeight);
          if (started) context.lineTo(px, py);
          else {
            context.moveTo(px, py);
            started = true;
          }
        }
        if (!started) return;
        context.lineTo(axes.left + axes.plotWidth, axes.top + axes.plotHeight);
        context.lineTo(axes.left, axes.top + axes.plotHeight);
        context.closePath();
        context.fillStyle = `${CHANNEL_COLORS[channel]}59`;
        context.fill();
        context.strokeStyle = CHANNEL_COLORS[channel];
        context.lineWidth = 1.5;
        context.stroke();
      });
    } else {
      const bins = spectrum(historiesRef.current[0], params[0] ?? 1);
      if (running && bins.some(Boolean)) {
        columnsRef.current.push(bins);
        if (columnsRef.current.length > 256) columnsRef.current.shift();
      }
      const columns = columnsRef.current,
        map = Math.round(state?.[2] ?? 2);
      for (let column = 0; column < columns.length; column++) {
        const px = axes.left + (column / Math.max(1, columns.length)) * axes.plotWidth,
          nextX = axes.left + ((column + 1) / Math.max(1, columns.length)) * axes.plotWidth;
        for (let row = 0; row < Math.ceil(axes.plotHeight); row++) {
          const normalized = 1 - row / axes.plotHeight,
            frequency =
              low + (high - low) * (frequencyScale > 0.5 ? normalized * normalized : normalized),
            bin = Math.max(
              1,
              Math.min(
                columns[column].length - 1,
                Math.round((frequency * FFT_SIZE) / SAMPLE_RATE),
              ),
            ),
            compensated =
              columns[column][bin] * Math.pow(Math.max(frequency, 1) / 1000, slope / 20),
            intensity = Math.max(
              0,
              Math.min(1, (20 * Math.log10(Math.max(1e-8, compensated)) + 84) / 84),
            );
          context.fillStyle = heatColor(intensity, map);
          context.fillRect(px, axes.top + row, Math.max(1, nextX - px + 0.5), 1.1);
        }
      }
    }
    context.restore();
  }, [height, kind, params, running, samples, state, width]);
  return (
    <canvas
      ref={canvasRef}
      className="pw-rack-spectrum"
      style={{ left: x, top: y, width, height }}
      aria-label={kind === "spectrogram" ? "Live Rack spectrogram" : "Live Rack spectrum analyzer"}
    />
  );
});
