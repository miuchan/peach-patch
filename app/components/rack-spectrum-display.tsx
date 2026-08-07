import { memo, useEffect, useRef, useState, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

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
  axisColor: string,
  textColor: string,
  frequencyExponent = frequencyScale > 0.5 ? 0.5 : 1,
  exactInsets = false,
) {
  const left = exactInsets ? 14 : kind === "spectrogram" ? 40 : 35,
    right = exactInsets ? 4 : 15,
    top = exactInsets ? 15 : 20,
    bottom = exactInsets ? 11 : 50,
    plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = axisColor;
  context.lineWidth = 1;
  context.font = "8px Arial,sans-serif";
  context.fillStyle = textColor;
  context.textAlign = kind === "spectrogram" ? "right" : "center";
  context.textBaseline = kind === "spectrogram" ? "middle" : "top";
  for (let tick = 1; tick < 10; tick++) {
    const normalized = tick / 10,
      frequency = low + (high - low) * Math.pow(normalized, 1 / frequencyExponent);
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
  colors?: string[];
  axisColor?: string;
  textColor?: string;
  lineWidth?: number;
  fillAlpha?: number;
  freeze?: boolean;
  profile?: "bogaudio";
  rangeMode?: "analyzer" | "analyzer-xl";
  stateKeys?: { frequencyPlot: number; range: number; amplitudePlot: number };
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
  colors = CHANNEL_COLORS,
  axisColor = "#1a1a1a",
  textColor = "#ffffff",
  lineWidth = 1.5,
  fillAlpha = 0.35,
  freeze = false,
  profile,
  rangeMode,
  stateKeys,
  x,
  y,
  width,
  height,
}: RackSpectrumDisplayProps) {
  const { t } = useI18n();
  const visualColors = colors.length ? colors : CHANNEL_COLORS;
  const canvasRef = useRef<HTMLCanvasElement>(null),
    historiesRef = useRef<number[][]>([]),
    columnsRef = useRef<Float32Array[]>([]),
    latestBinsRef = useRef<Float32Array[]>([]),
    frozenBinsRef = useRef<Float32Array[] | null>(null),
    freezeXRef = useRef(0),
    [interactionFrame, setInteractionFrame] = useState(0);
  useEffect(() => {
    const channelCount =
      kind === "spectrum-analyzer"
        ? profile === "bogaudio"
          ? Math.max(1, Math.min(8, samples?.length ?? 4))
          : 4
        : 1;
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
    const frequencyScale =
        profile === "bogaudio"
          ? Number(state?.[stateKeys?.frequencyPlot ?? -1] ?? 0) < 0.5
            ? 1
            : 0
          : kind === "spectrum-analyzer"
            ? (params[8] ?? 1)
            : (params[3] ?? 1),
      magnitudeScale =
        profile === "bogaudio"
          ? ([1, 2, 0][Math.round(state?.[stateKeys?.amplitudePlot ?? -1] ?? 0)] ?? 1)
          : kind === "spectrum-analyzer"
            ? (params[9] ?? 1)
            : 1,
      rackRange =
        rangeMode === "analyzer" ? (params[5] ?? 0) : Number(state?.[stateKeys?.range ?? -1] ?? 0),
      sourceLow =
        profile === "bogaudio" && rackRange > 0
          ? (rangeMode === "analyzer" ? rackRange * rackRange * 0.8 : rackRange) * (SAMPLE_RATE / 2)
          : 0,
      sourceHigh =
        profile === "bogaudio" && rackRange < 0
          ? (1 + (rangeMode === "analyzer" ? rackRange * 0.9 : rackRange)) * (SAMPLE_RATE / 2)
          : SAMPLE_RATE / 2,
      low = Math.max(
        0,
        profile === "bogaudio"
          ? sourceLow
          : kind === "spectrum-analyzer"
            ? (params[12] ?? 0)
            : (params[6] ?? 0),
      ),
      high = Math.max(
        low + 1,
        Math.min(
          SAMPLE_RATE / 2,
          profile === "bogaudio"
            ? sourceHigh
            : kind === "spectrum-analyzer"
              ? (params[13] ?? SAMPLE_RATE / 2)
              : (params[7] ?? SAMPLE_RATE / 2),
        ),
      ),
      frequencyExponent =
        profile === "bogaudio"
          ? frequencyScale < 0.5
            ? 1
            : 1 - ((high - low) / high) * (1 - 1 / 3.321)
          : frequencyScale > 0.5
            ? 0.5
            : 1,
      slope = kind === "spectrum-analyzer" ? (params[14] ?? 0) : (params[8] ?? 0),
      axes = drawAxes(
        context,
        width,
        height,
        kind,
        frequencyScale,
        low,
        high,
        magnitudeScale,
        axisColor,
        textColor,
        frequencyExponent,
        profile === "bogaudio",
      );
    context.save();
    context.beginPath();
    context.rect(axes.left, axes.top, axes.plotWidth, axes.plotHeight);
    context.clip();
    if (kind === "spectrum-analyzer") {
      const liveBins = historiesRef.current
        .slice(0, channelCount)
        .map((history, channel) => spectrum(history, params[channel] ?? 1));
      latestBinsRef.current = liveBins;
      const displayedBins = frozenBinsRef.current ?? liveBins;
      displayedBins.forEach((bins, channel) => {
        if (!bins.some(Boolean)) return;
        context.beginPath();
        let started = false;
        for (let bin = 1; bin < bins.length; bin++) {
          const frequency = (bin * SAMPLE_RATE) / FFT_SIZE;
          if (frequency < low || frequency > high) continue;
          const normalizedFrequency = (frequency - low) / (high - low),
            normalizedX = Math.pow(normalizedFrequency, frequencyExponent),
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
        if (fillAlpha > 0) {
          context.lineTo(axes.left + axes.plotWidth, axes.top + axes.plotHeight);
          context.lineTo(axes.left, axes.top + axes.plotHeight);
          context.closePath();
          context.save();
          context.globalAlpha = Math.max(0, Math.min(1, fillAlpha));
          context.fillStyle = visualColors[channel % visualColors.length] ?? "#ffffff";
          context.fill();
          context.restore();
        }
        context.strokeStyle = visualColors[channel % visualColors.length] ?? "#ffffff";
        context.lineWidth = lineWidth;
        context.stroke();
      });
      if (frozenBinsRef.current) {
        const normalized = Math.max(0, Math.min(1, freezeXRef.current));
        const frequency = low + (high - low) * Math.pow(normalized, 1 / frequencyExponent);
        const bin = Math.max(
          1,
          Math.min(FFT_SIZE / 2 - 1, Math.round((frequency * FFT_SIZE) / SAMPLE_RATE)),
        );
        const px = axes.left + normalized * axes.plotWidth;
        context.strokeStyle = textColor;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(px, axes.top);
        context.lineTo(px, axes.top + axes.plotHeight);
        context.stroke();
        context.font = "10px Arial,sans-serif";
        context.textAlign = px > width * 0.65 ? "right" : "left";
        context.textBaseline = "top";
        const amplitudes = frozenBinsRef.current
          .map((bins) => bins[bin] ?? 0)
          .map((value) => `${(20 * Math.log10(Math.max(1e-8, value))).toFixed(1)} dB`)
          .join("  ");
        context.fillStyle = "#000000cc";
        const label = `${frequencyLabel(frequency)} Hz  ${amplitudes}`;
        const labelWidth = context.measureText(label).width + 8;
        const labelX = px > width * 0.65 ? px - labelWidth : px;
        context.fillRect(labelX, axes.top, labelWidth, 16);
        context.fillStyle = textColor;
        context.fillText(label, px > width * 0.65 ? px - 4 : px + 4, axes.top + 3);
      }
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
            frequency = low + (high - low) * Math.pow(normalized, 1 / frequencyExponent),
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
  }, [
    axisColor,
    fillAlpha,
    height,
    interactionFrame,
    kind,
    lineWidth,
    params,
    profile,
    rangeMode,
    running,
    samples,
    state,
    stateKeys,
    textColor,
    width,
    visualColors,
  ]);
  const updateFreezeX = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const leftInset = profile === "bogaudio" ? 14 : 35;
    const rightInset = profile === "bogaudio" ? 4 : 15;
    freezeXRef.current = Math.max(
      0,
      Math.min(
        1,
        (event.clientX - bounds.left - leftInset) / (bounds.width - leftInset - rightInset),
      ),
    );
    setInteractionFrame((frame) => frame + 1);
  };
  return (
    <canvas
      ref={canvasRef}
      className="pw-rack-spectrum"
      style={{ left: x, top: y, width, height, touchAction: freeze ? "none" : undefined }}
      aria-label={t(
        kind === "spectrogram" ? "display.rackSpectrogram" : "display.rackSpectrumAnalyzer",
      )}
      tabIndex={freeze && kind === "spectrum-analyzer" ? 0 : undefined}
      onPointerDown={(event) => {
        if (!freeze || kind !== "spectrum-analyzer" || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        frozenBinsRef.current = latestBinsRef.current.map((bins) => bins.slice());
        updateFreezeX(event);
        event.currentTarget.focus();
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        updateFreezeX(event);
      }}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        frozenBinsRef.current = null;
        setInteractionFrame((frame) => frame + 1);
      }}
      onPointerCancel={() => {
        frozenBinsRef.current = null;
        setInteractionFrame((frame) => frame + 1);
      }}
      onKeyDown={(event) => {
        if (!frozenBinsRef.current || (event.key !== "ArrowLeft" && event.key !== "ArrowRight"))
          return;
        event.preventDefault();
        freezeXRef.current = Math.max(
          0,
          Math.min(1, freezeXRef.current + (event.key === "ArrowLeft" ? -1 : 1) / (FFT_SIZE / 2)),
        );
        setInteractionFrame((frame) => frame + 1);
      }}
    />
  );
});
