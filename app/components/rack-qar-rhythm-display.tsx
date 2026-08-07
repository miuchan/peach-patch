import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const HEADER = 8;
const TRACK_HEADER = 8;
const STEP_STRIDE = 11;
const TRACKS = 4;
const CENTER_X = 119;
const CENTER_Y = 120;
const ROTATE = Math.PI / 2;

const COLORS = ["#efe000", "#00e0ef", "#10cf20", "#e07000", "#e000ef", "#e0e0ef", "#1a13c7"];

function rgba(color: string, alpha: number) {
  const red = Number.parseInt(color.slice(1, 3), 16),
    green = Number.parseInt(color.slice(3, 5), 16),
    blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function RackQarRhythmDisplay({
  values,
  actionBase,
  accentActionBase,
  maxSteps,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  accentActionBase: number;
  maxSteps: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const stepAngles = useRef<number[][]>(Array.from({ length: TRACKS }, () => []));
  const trackStride = TRACK_HEADER + maxSteps * STEP_STRIDE;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    element.width = Math.max(1, Math.round(width * ratio));
    element.height = Math.max(1, Math.round(height * ratio));
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    stepAngles.current = Array.from({ length: TRACKS }, () => []);

    for (let track = 0; track < TRACKS; track += 1) {
      const trackBase = HEADER + track * trackStride;
      const algorithm = Math.round(values?.[trackBase] ?? 0);
      const steps = Math.max(1, Math.min(maxSteps, Math.round(values?.[trackBase + 2] ?? 1)));
      const currentStep = Math.round(values?.[trackBase + 3] ?? -1);
      const running = (values?.[trackBase + 4] ?? 0) > 0.5;
      const swingRandomness = Math.max(0, values?.[trackBase + 5] ?? 0);
      const wellFormedDuration = Math.max(1e-6, values?.[trackBase + 6] ?? steps);
      const baseRadius = 100 - track * 20;
      let runningWidth = 0;
      const starts: number[] = [];

      for (let step = 0; step < steps; step += 1) {
        const offset = trackBase + TRACK_HEADER + step * STEP_STRIDE;
        const nextOffset = trackBase + TRACK_HEADER + ((step + 1) % steps) * STEP_STRIDE;
        const beat = (values?.[offset] ?? 0) > 0.5;
        const accent = (values?.[offset + 1] ?? 0) > 0.5;
        const probability = Math.max(0, Math.min(1, values?.[offset + 2] ?? 0));
        const swing = values?.[offset + 6] ?? 0;
        const nextSwing = values?.[nextOffset + 6] ?? 0;
        const beatWarp = (values?.[offset + 7] ?? 1) * (values?.[offset + 8] ?? 1);
        const wellFormedStep = values?.[offset + 9] ?? 1;
        const wellFormedAdjustment = steps / wellFormedDuration;
        const modifier = algorithm === 2 ? wellFormedStep * wellFormedAdjustment : 1;
        const start = (Math.PI * 2 * (runningWidth + swing)) / steps - ROTATE;
        const end = Math.max(
          start,
          start + (Math.PI * 2 * (modifier * beatWarp - swing + nextSwing)) / steps,
        );
        starts.push(start);

        const current = running && currentStep === step;
        const color = current ? "#2ff000" : (COLORS[algorithm] ?? COLORS[0]);
        context.strokeStyle = color;
        context.lineWidth = 1;
        context.beginPath();
        context.arc(CENTER_X, CENTER_Y, baseRadius + 20, start, end);
        context.arc(CENTER_X, CENTER_Y, baseRadius, end, start, true);
        context.closePath();
        context.stroke();

        if (beat) {
          const outer = baseRadius + 20 * probability;
          const opacity = accent ? 1 : 0.5;
          context.beginPath();
          context.arc(CENTER_X, CENTER_Y, outer, start, end);
          context.arc(CENTER_X, CENTER_Y, baseRadius, end, start, true);
          context.closePath();
          const gradient = context.createRadialGradient(
            CENTER_X,
            CENTER_Y,
            baseRadius,
            CENTER_X,
            CENTER_Y,
            Math.max(baseRadius + 0.01, outer),
          );
          gradient.addColorStop(0, rgba(color, 0.19));
          gradient.addColorStop(1, rgba(color, opacity));
          context.fillStyle = gradient;
          context.fill();

          if (swingRandomness > 0) {
            const randomEnd = start + ((end - start) * swingRandomness) / 2;
            context.beginPath();
            context.arc(CENTER_X, CENTER_Y, outer, start, randomEnd);
            context.arc(CENTER_X, CENTER_Y, baseRadius, randomEnd, start, true);
            context.closePath();
            context.fillStyle = "rgba(255,0,0,0.25)";
            context.fill();
          }
        }
        runningWidth += beatWarp * (algorithm === 2 ? wellFormedStep * wellFormedAdjustment : 1);
      }
      stepAngles.current[track] = starts;
    }
  }, [height, maxSteps, trackStride, values, width]);

  const trigger = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - bounds.left) / bounds.width) * width;
    const localY = ((event.clientY - bounds.top) / bounds.height) * height;
    const deltaX = localX - CENTER_X,
      deltaY = localY - CENTER_Y,
      distance = Math.hypot(deltaX, deltaY);
    if (distance < 40 || distance >= 120) return;
    const track = 3 - Math.floor((distance - 40) / 20);
    const starts = stepAngles.current[track] ?? [];
    if (track < 0 || track >= TRACKS || !starts.length) return;
    let theta = Math.atan2(deltaY, deltaX);
    if (theta <= -ROTATE) theta += Math.PI * 2;
    let step = starts.length - 1;
    for (let index = 1; index < starts.length; index += 1)
      if (theta < starts[index]) {
        step = index - 1;
        break;
      }
    event.preventDefault();
    event.stopPropagation();
    const id = (event.shiftKey ? accentActionBase : actionBase) + track * maxSteps + step;
    onAction(id, true);
    onAction(id, false);
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-qar-rhythm-display"
      aria-label={t("display.qarRhythm")}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: "none",
      }}
      onPointerDown={trigger}
    />
  );
}
