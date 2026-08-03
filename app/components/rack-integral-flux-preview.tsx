import { memo, useEffect, useMemo, useRef } from "react";
import { useI18n } from "../i18n/provider";

const POINT_COUNT = 128;
const LUT_SIZE = 512;
const TRAIL_FADE_MS = 333;
const MAX_TRAILS = 6;
const LINE_WIDTH = 1.4;
const EDGE_PAD = 1;

type Point = { x: number; y: number };
type Trail = { born: number; points: Point[] };

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function slopeWarp(value: number, shape: number) {
  const x = clamp(value);
  const amount = Math.abs(shape);
  if (amount < 1e-6) return 1;
  const k = 40 * amount * x * x;
  return shape < 0 ? 1 / (1 + k) : 1 + k;
}

function segmentLut(curve: number, rising: boolean, shapeMode: number) {
  const signed = shapeMode === 1 ? (rising ? -curve : curve) : curve;
  let scale = 0;
  for (let index = 0; index < 16; index += 1) {
    scale += 1 / slopeWarp((index + 0.5) / 16, signed);
  }
  scale /= 16;
  const result = new Float32Array(LUT_SIZE);
  const step = 1 / (LUT_SIZE - 1);
  let value = rising ? 0 : 1;
  result[0] = value;
  for (let index = 1; index < LUT_SIZE; index += 1) {
    const first = slopeWarp(value, signed) * scale;
    const middle = clamp(value + (rising ? 1 : -1) * 0.5 * step * first);
    value = clamp(value + (rising ? 1 : -1) * step * slopeWarp(middle, signed) * scale);
    result[index] = value;
  }
  result[0] = rising ? 0 : 1;
  result[LUT_SIZE - 1] = rising ? 1 : 0;
  return result;
}

function sampleLut(lut: Float32Array, position: number) {
  const index = clamp(position) * (LUT_SIZE - 1);
  const first = Math.floor(index);
  const second = Math.min(first + 1, LUT_SIZE - 1);
  return lut[first] + (lut[second] - lut[first]) * (index - first);
}

function previewPoints(
  width: number,
  height: number,
  riseTime: number,
  fallTime: number,
  curve: number,
  shapeMode: number,
) {
  const pad = 0.5 * LINE_WIDTH + EDGE_PAD;
  const left = pad;
  const top = pad;
  const right = Math.max(left + 1, width - pad);
  const bottom = Math.max(top + 1, height - pad);
  const drawWidth = right - left;
  const drawHeight = bottom - top;
  const total = Math.max(riseTime + fallTime, 1e-6);
  const riseRatio = riseTime / total;
  const peakX = left + riseRatio * drawWidth;
  const riseWidth = Math.max(peakX - left, 1e-4);
  const fallWidth = Math.max(right - peakX, 1e-4);
  const rise = segmentLut(curve, true, shapeMode);
  const fall = segmentLut(curve, false, shapeMode);
  const points = Array.from({ length: POINT_COUNT }, (_, index) => {
    const x = left + (index / (POINT_COUNT - 1)) * drawWidth;
    const value =
      x <= peakX
        ? sampleLut(rise, (x - left) / riseWidth)
        : sampleLut(fall, (x - peakX) / fallWidth);
    return { x, y: clamp(top + (1 - value) * drawHeight, top, bottom) };
  });
  const peakIndex = clamp(Math.round(riseRatio * (POINT_COUNT - 1)), 1, POINT_COUNT - 2);
  points[peakIndex] = { x: peakX, y: top };
  points[0] = { x: left, y: bottom };
  points[POINT_COUNT - 1] = { x: right, y: bottom };
  return points;
}

function strokePoints(context: CanvasRenderingContext2D, points: Point[]) {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();
}

export const RackIntegralFluxPreview = memo(function RackIntegralFluxPreview({
  values,
  channel,
  offset,
  x,
  y,
  width,
  height,
  scaleX,
  label,
}: {
  values?: number[];
  channel: 1 | 4;
  offset: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  label?: string;
}) {
  const { locale, t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailsRef = useRef<Trail[]>([]);
  const previousPointsRef = useRef<Point[] | null>(null);
  const previousVersionRef = useRef<number | null>(null);
  const displayWidth = width * scaleX;
  const riseTime = Math.max(values?.[offset] ?? 0.01, 1e-6);
  const fallTime = Math.max(values?.[offset + 1] ?? 0.01, 1e-6);
  const curve = clamp(values?.[offset + 2] ?? 0, -1, 1);
  const dotX = clamp(values?.[offset + 3] ?? 0);
  const dotY = clamp(values?.[offset + 4] ?? 0);
  const dotVisible = (values?.[offset + 5] ?? 0) > 0.5;
  const shapeMode = Math.round(values?.[offset + 6] ?? 0);
  const version = Math.round(values?.[offset + 8] ?? 0);
  const frequency = 1 / Math.max(riseTime + fallTime, 1e-6);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixelRatio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(displayWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const now = performance.now();
    const points = previewPoints(displayWidth, height, riseTime, fallTime, curve, shapeMode);
    if (
      previousVersionRef.current !== null &&
      previousVersionRef.current !== version &&
      previousPointsRef.current
    ) {
      trailsRef.current.push({ born: now, points: previousPointsRef.current });
      trailsRef.current = trailsRef.current.slice(-MAX_TRAILS);
    }
    previousVersionRef.current = version;
    previousPointsRef.current = points;
    trailsRef.current = trailsRef.current.filter((trail) => now - trail.born < TRAIL_FADE_MS);

    context.clearRect(0, 0, displayWidth, height);
    context.fillStyle = "rgba(0, 0, 0, .96)";
    context.fillRect(0, 0, displayWidth, height);
    const majorColumns = Math.max(3, Math.round(displayWidth / 16));
    const majorRows = Math.max(3, Math.round(height / 16));
    const majorX = displayWidth / majorColumns;
    const majorY = height / majorRows;
    context.lineWidth = 0.38;
    context.strokeStyle = "rgba(28, 204, 217, .118)";
    context.beginPath();
    for (let column = 0; column < majorColumns; column += 1) {
      for (let subdivision = 1; subdivision < 4; subdivision += 1) {
        const px = column * majorX + majorX * subdivision * 0.25;
        context.moveTo(px, 0);
        context.lineTo(px, height);
      }
    }
    for (let row = 0; row < majorRows; row += 1) {
      for (let subdivision = 1; subdivision < 4; subdivision += 1) {
        const py = row * majorY + majorY * subdivision * 0.25;
        context.moveTo(0, py);
        context.lineTo(displayWidth, py);
      }
    }
    context.stroke();
    context.lineWidth = 0.55;
    context.strokeStyle = "rgba(114, 141, 255, .18)";
    context.beginPath();
    for (let column = 1; column < majorColumns; column += 1) {
      context.moveTo(column * majorX, 0);
      context.lineTo(column * majorX, height);
    }
    for (let row = 1; row < majorRows; row += 1) {
      context.moveTo(0, row * majorY);
      context.lineTo(displayWidth, row * majorY);
    }
    context.stroke();

    context.lineCap = "butt";
    context.lineJoin = "round";
    context.lineWidth = 1.15;
    trailsRef.current.forEach((trail) => {
      context.strokeStyle = `rgba(255, 190, 80, ${0.463 * (1 - (now - trail.born) / TRAIL_FADE_MS)})`;
      strokePoints(context, trail.points);
    });
    context.lineWidth = LINE_WIDTH;
    context.strokeStyle = "rgb(230, 230, 220)";
    strokePoints(context, points);

    if (dotVisible) {
      const pad = 0.5 * LINE_WIDTH + EDGE_PAD;
      const targetX = pad + dotX * Math.max(1, displayWidth - 2 * pad);
      const targetY = pad + (1 - dotY) * Math.max(1, height - 2 * pad);
      let first = 0;
      while (first + 1 < points.length && points[first + 1].x < targetX) first += 1;
      const second = Math.min(first + 1, points.length - 1);
      const distance = Math.max(points[second].x - points[first].x, 1e-6);
      const curveY =
        points[first].y +
        (points[second].y - points[first].y) * clamp((targetX - points[first].x) / distance);
      const renderedY = 0.9 * curveY + 0.1 * targetY;
      context.beginPath();
      context.arc(targetX, renderedY, 2.65, 0, Math.PI * 2);
      context.fillStyle = "rgba(0, 0, 0, .86)";
      context.fill();
      context.beginPath();
      context.arc(targetX, renderedY, 2.1, 0, Math.PI * 2);
      context.fillStyle = "rgb(255, 232, 72)";
      context.fill();
    }
  }, [curve, displayWidth, dotVisible, dotX, dotY, fallTime, height, riseTime, shapeMode, version]);

  const frequencyLabel = useMemo(() => {
    const digits = frequency < 1 ? 0 : frequency >= 1000 ? 2 : 1,
      value = frequency < 1 ? frequency * 1000 : frequency >= 1000 ? frequency / 1000 : frequency,
      unit = frequency < 1 ? "mHz" : frequency >= 1000 ? "kHz" : "Hz";
    return `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value)} ${unit}`;
  }, [frequency, locale]);

  const accessibleLabel = label ?? t("display.integralFluxChannel", { channel });

  return (
    <div
      aria-label={t("display.waveformPreview", {
        label: accessibleLabel,
        frequency: frequencyLabel,
      })}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: displayWidth,
        height,
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: displayWidth, height }} />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: height + 1.5,
          left: "50%",
          transform: "translateX(-50%)",
          color: "#fff",
          font: "11.5px/1 ui-sans-serif, system-ui, sans-serif",
          whiteSpace: "pre",
        }}
      >
        {frequencyLabel}
      </span>
    </div>
  );
});
