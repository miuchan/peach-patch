import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/provider";

const HEADER_VALUES = 11;
const TARGET_FREQUENCIES = [100, 997, 9973];
const BENCHMARK_LABELS = ["100 Hz", " 1K Hz", "10K Hz"];

function scoreText(value: number) {
  if (!Number.isFinite(value)) return "-inf";
  const text = `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
  return text.padStart(6, " ");
}

export function RackAliasDisplay({
  values,
  steps,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  steps: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [workingFrame, setWorkingFrame] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setWorkingFrame((frame) => (frame + 1) % 4), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "rgb(0,16,0)";
    context.fillRect(0, 0, width, height);

    const state = Math.round(values?.[0] ?? 0);
    const mode = (values?.[1] ?? 0) > 0.5;
    const sampleRate = values?.[2] ?? 0;
    const settle = values?.[3] ?? 0.05;
    const graphVisible = state !== 0 && state !== 1;
    const status =
      state === 0
        ? "NOT READY"
        : state === 1
          ? "READY"
          : state === 6
            ? "FINISHED"
            : `WORKING${".".repeat(workingFrame)}`;

    context.font = '12px "Share Tech Mono", ui-monospace, monospace';
    context.fillStyle = "rgb(0,255,0)";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText(`STATUS: ${status}`, 0, 10);
    if (graphVisible) {
      for (let index = 0; index < 3; index += 1) {
        const recorded = (values?.[8 + index] ?? 0) > 0.5;
        const score = values?.[5 + index] ?? -210;
        context.fillText(
          recorded
            ? `${BENCHMARK_LABELS[index]} ${scoreText(score)} dB`
            : `${BENCHMARK_LABELS[index]}    --- dB`,
          0,
          25 + index * 12,
        );
      }
    }
    context.textBaseline = "top";
    context.textAlign = "right";
    context.fillText(mode ? "VCO" : "FX", width, 55);
    context.textAlign = "left";
    const rate = (Math.round(sampleRate * 0.01) * 0.1).toFixed(1);
    context.fillText(`${rate}K Hz  ${settle.toPrecision(2)}s`, 0, 55);

    if (graphVisible) {
      const graphY = 65;
      const graphHeight = 45;
      context.fillStyle = "rgb(0,34,0)";
      context.fillRect(0, graphY, width, graphHeight);
      const effectiveRate = sampleRate > 0 ? sampleRate : 44_100;
      const binResolution = effectiveRate / 32_768;
      const startFrequency = Math.round(50 / binResolution) * binResolution;
      context.strokeStyle = "rgb(0,85,0)";
      context.lineWidth = 0.5;
      context.beginPath();
      for (const frequency of TARGET_FREQUENCIES) {
        const logPosition =
          Math.log(frequency / startFrequency) / Math.log(20_000 / startFrequency);
        context.moveTo(logPosition * width, graphY);
        context.lineTo(logPosition * width, graphY + graphHeight);
      }
      for (const decibels of [-60, -120]) {
        const normalized = (decibels + 144) / 144;
        const lineY = graphY + graphHeight - normalized * graphHeight;
        context.moveTo(0, lineY);
        context.lineTo(width, lineY);
      }
      context.stroke();

      context.save();
      context.beginPath();
      context.rect(0, graphY, width, graphHeight);
      context.clip();
      context.strokeStyle = "rgb(68,255,68)";
      context.lineWidth = 0.8;
      context.beginPath();
      for (let index = 0; index < steps; index += 1) {
        const xPosition = (index / (steps - 1)) * width;
        const decibels = values?.[HEADER_VALUES + index] ?? -210;
        const normalized = Math.max(-100, Math.min(1, (decibels + 144) / 144));
        const yPosition = graphY + graphHeight - normalized * graphHeight;
        if (index === 0) context.moveTo(xPosition, yPosition);
        else context.lineTo(xPosition, yPosition);
      }
      context.stroke();
      context.restore();
    }
  }, [values, steps, width, height, workingFrame]);

  return (
    <canvas
      ref={canvas}
      className="pw-rack-alias-display"
      aria-label={t("display.alias")}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        pointerEvents: "none",
      }}
    />
  );
}
