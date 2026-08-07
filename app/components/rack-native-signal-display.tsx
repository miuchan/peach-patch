import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/provider";

type NativeSignalMode = "scope" | "xy" | "spectrum" | "meter";

function finite(values: number[] | undefined) {
  return (values ?? []).map((value) => (Number.isFinite(value) ? value : 0));
}

function spectrum(values: number[]) {
  const count = Math.min(128, values.length);
  if (count < 2) return [];
  const bins = Math.floor(count / 2);
  return Array.from({ length: bins }, (_, bin) => {
    let real = 0,
      imaginary = 0;
    for (let index = 0; index < count; index++) {
      const window = 0.5 - 0.5 * Math.cos((Math.PI * 2 * index) / Math.max(1, count - 1)),
        angle = (-Math.PI * 2 * bin * index) / count,
        sample = values[index] * window;
      real += sample * Math.cos(angle);
      imaginary += sample * Math.sin(angle);
    }
    return Math.sqrt(real * real + imaginary * imaginary) / count;
  });
}

export function RackNativeSignalDisplay({
  samples,
  mode,
  colors,
  strokeWidths,
  backgroundColor = "transparent",
  gridColor = "transparent",
  range = 10,
  stacked = false,
  bipolar = true,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  samples?: number[][];
  mode: NativeSignalMode;
  colors: string[];
  strokeWidths: number[];
  backgroundColor?: string;
  gridColor?: string;
  range?: number;
  stacked?: boolean;
  bipolar?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null),
    scaledX = x * scaleX,
    scaledWidth = width * scaleX;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const pixelRatio = Math.max(1, Math.min(3, window.devicePixelRatio || 1)),
      context = canvas.getContext("2d");
    canvas.width = Math.max(1, Math.round(scaledWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, scaledWidth, height);
    if (backgroundColor !== "transparent") {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, scaledWidth, height);
    }
    if (gridColor !== "transparent") {
      context.strokeStyle = gridColor;
      context.lineWidth = 0.5;
      for (let index = 1; index < 4; index++) {
        const px = (scaledWidth * index) / 4,
          py = (height * index) / 4;
        context.beginPath();
        context.moveTo(px, 0);
        context.lineTo(px, height);
        context.moveTo(0, py);
        context.lineTo(scaledWidth, py);
        context.stroke();
      }
    }

    const tracks = (samples ?? []).map(finite);
    if (mode === "meter") {
      const count = Math.max(1, tracks.length),
        gap = Math.min(2, scaledWidth / Math.max(4, count * 4)),
        barWidth = Math.max(1, (scaledWidth - gap * (count - 1)) / count);
      tracks.forEach((track, index) => {
        const peak = Math.min(1, Math.max(0, ...track.map((value) => Math.abs(value) / range))),
          barHeight = peak * height;
        context.fillStyle = colors[index % Math.max(1, colors.length)] ?? "#00ff80";
        context.fillRect(index * (barWidth + gap), height - barHeight, barWidth, barHeight);
      });
      return;
    }

    if (mode === "xy") {
      const horizontal = tracks[0] ?? [],
        vertical = tracks[1] ?? [],
        count = Math.min(horizontal.length, vertical.length);
      if (count < 2) return;
      context.beginPath();
      for (let index = 0; index < count; index++) {
        const px = scaledWidth * (0.5 + horizontal[index] / (range * 2)),
          py = height * (0.5 - vertical[index] / (range * 2));
        if (index) context.lineTo(px, py);
        else context.moveTo(px, py);
      }
      context.strokeStyle = colors[0] ?? "#00ff80";
      context.lineWidth = (strokeWidths[0] ?? 1) * scaleX;
      context.stroke();
      return;
    }

    tracks.forEach((rawTrack, trackIndex) => {
      const track = mode === "spectrum" ? spectrum(rawTrack) : rawTrack;
      if (track.length < 2) return;
      const trackHeight = stacked ? height / Math.max(1, tracks.length) : height,
        top = stacked ? trackIndex * trackHeight : 0,
        center = top + trackHeight / 2,
        maximum = mode === "spectrum" ? Math.max(1e-6, ...track) : range;
      context.beginPath();
      track.forEach((value, index) => {
        const px = (index / Math.max(1, track.length - 1)) * scaledWidth,
          normalized = mode === "spectrum" ? value / maximum : value / range,
          py = bipolar
            ? center - normalized * trackHeight * 0.5
            : top + trackHeight * (1 - normalized);
        if (index) context.lineTo(px, py);
        else context.moveTo(px, py);
      });
      context.strokeStyle = colors[trackIndex % Math.max(1, colors.length)] ?? "#00ff80";
      context.lineWidth =
        (strokeWidths[trackIndex % Math.max(1, strokeWidths.length)] ?? 1) * scaleX;
      context.stroke();
    });
  }, [
    backgroundColor,
    bipolar,
    colors,
    gridColor,
    height,
    mode,
    range,
    samples,
    scaleX,
    scaledWidth,
    stacked,
    strokeWidths,
  ]);

  return (
    <canvas
      ref={ref}
      className="pw-rack-native-signal"
      style={{ left: scaledX, top: y, width: scaledWidth, height }}
      aria-label={t("display.rackOscilloscope")}
    />
  );
}
