import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/provider";

function radius(equation: number, a: number, b: number, theta: number) {
  switch (equation) {
    case 0:
      return Math.sin(a * theta) * Math.cos(b * theta);
    case 1:
      return Math.sin(a * Math.cos(b * theta));
    case 2:
      return Math.cos(a * Math.cos(b * theta));
    default:
      return Math.sin((a / b) * theta);
  }
}

function rackNumber(value: number) {
  return value.toFixed(6).slice(0, 3);
}

function equationText(equation: number, a: number, b: number) {
  const roundedA = rackNumber(Math.floor(a * 2 + 0.5) / 2);
  const roundedB = rackNumber(Math.floor(b * 2 + 0.5) / 2);
  switch (equation) {
    case 0:
      return `f = ${roundedA}sin(Ø) + ${roundedB}cos(Ø)`;
    case 1:
      return `f = sin(${roundedA}cos(${roundedB} Ø))`;
    case 2:
      return `f = cos(${roundedA}cos(${roundedB} Ø))`;
    default:
      return `f = sin(${roundedA}/${roundedB} Ø)`;
  }
}

export function RackPolarCvDisplay({
  values,
  points,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  points: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);

    const a = values?.[0] ?? 0.5;
    const b = values?.[1] ?? 0.5;
    const equation = Math.max(0, Math.min(3, Math.trunc(values?.[2] ?? 1)));
    const timeIndex = Math.max(0, Math.min(2, Math.trunc(values?.[3] ?? 1)));
    const currentTheta = values?.[4] ?? 0.1;
    const currentRadius = values?.[5] ?? radius(equation, a, b, currentTheta);
    const plotTop = 15;
    const plotHeight = height - 30;

    context.strokeStyle = "rgba(255,255,255,0.063)";
    context.lineWidth = 1;
    for (let index = 0; index < 5; index += 1) {
      const lineY = plotTop + (index / 4) * plotHeight;
      context.beginPath();
      context.moveTo(0, lineY);
      context.lineTo(width, lineY);
      context.stroke();
    }

    context.save();
    context.beginPath();
    context.rect(0, plotTop, width, plotHeight);
    context.clip();
    context.globalCompositeOperation = "lighter";
    context.strokeStyle = "#c9f2ff";
    context.lineWidth = 0.3;
    context.beginPath();
    let theta = 0;
    let r = radius(equation, a, b, theta);
    const repeat = (equation === 0 ? 8 : equation === 3 ? 16 : 4) * Math.PI;
    for (let index = 0; index < points; index += 1) {
      const plotX = (r * Math.sin(theta) * 0.5 + 0.5) * width;
      const plotY = plotTop + (r * Math.cos(theta) * 0.5 + 0.5) * plotHeight;
      if (index === 0) context.moveTo(plotX, plotY);
      else context.lineTo(plotX, plotY);
      theta = repeat * (index / (points - 1)) * Math.PI;
      r = radius(equation, a, b, theta);
    }
    context.stroke();

    const cursorX = (currentRadius * Math.sin(currentTheta) * 0.5 + 0.5) * width;
    const cursorY = plotTop + (currentRadius * Math.cos(currentTheta) * 0.5 + 0.5) * plotHeight;
    context.strokeStyle = "#ff0000";
    context.fillStyle = "#ff0000";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(cursorX, cursorY - 0.12);
    context.lineTo(cursorX - 0.08, cursorY - 0.12);
    context.lineTo(cursorX - 0.12, cursorY);
    context.lineTo(cursorX - 0.04, cursorY + 0.12);
    context.lineTo(cursorX + 0.04, cursorY + 0.12);
    context.lineTo(cursorX + 0.12, cursorY);
    context.lineTo(cursorX + 0.04, cursorY - 0.12);
    context.lineTo(cursorX, cursorY - 0.12);
    context.stroke();
    context.fill();
    context.restore();

    context.font = '13px "Share Tech Mono", ui-monospace, monospace';
    context.letterSpacing = "-2px";
    context.fillStyle = "rgba(255,255,255,0.251)";
    context.fillText("1", 6, 12);
    context.fillStyle = "rgba(255,255,255,0.502)";
    context.fillText(`${rackNumber([0.5, 1, 2][timeIndex] ?? 1)}x`, 22, 12);
    context.fillText(equationText(equation, a, b), 62, 12);
  }, [values, points, width, height]);

  return (
    <canvas
      ref={canvas}
      className="pw-rack-polar-cv-display"
      aria-label={t("display.polarCv")}
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
