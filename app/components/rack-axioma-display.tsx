import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/provider";

type AxiomaMode = "ikeda" | "rhodonea" | "tesseract" | "bifurcation" | "cobweb";

const TESSERACT_COLORS = [
  "rgb(255,0,0)",
  "rgb(255,102,0)",
  "rgb(200,113,55)",
  "rgb(255,204,0)",
  "rgb(212,255,42)",
  "rgb(102,255,0)",
  "rgb(55,200,113)",
  "rgb(85,255,221)",
  "rgb(55,200,171)",
  "rgb(0,170,212)",
  "rgb(44,137,160)",
  "rgb(0,102,255)",
  "rgb(44,90,160)",
  "rgb(44,44,160)",
  "rgb(127,42,255)",
  "rgb(212,42,255)",
];

function circle(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function bifurcationValue(type: number, input: number, rValue: number) {
  if (type === 1) {
    const r = 1 + rValue * 0.99;
    return input < 0.5 ? r * input : r * (1 - input);
  }
  if (type === 2) {
    const r = 1 + rValue * 0.99;
    return (r * (input - 0.5)) ** 2;
  }
  const r = 2.5 + rValue * 1.49;
  return r * (input - input ** 2);
}

export function RackAxiomaDisplay({
  mode,
  values,
  points,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  mode: AxiomaMode;
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
    context.clearRect(0, 0, width, height);

    if (mode === "ikeda") {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      context.fillStyle = "rgb(250,250,250)";
      const count = Math.min(points, Math.max(0, Math.round(values?.[2] ?? points)));
      for (let index = 0; index < count; index += 1) {
        const pointX = values?.[3 + index] ?? 0;
        const pointY = values?.[3 + points + index] ?? 0;
        if (pointX !== 0 && pointY !== 0)
          circle(
            context,
            (3 * centerX) / 4 + (pointX * height) / 4,
            1.25 * centerY + (pointY * height) / 4,
            1,
          );
      }
      context.fillStyle = "rgb(0,250,0)";
      circle(
        context,
        (3 * centerX) / 4 + ((values?.[0] ?? 0) * height) / 4,
        1.25 * centerY + ((values?.[1] ?? 0) * height) / 4,
        2,
      );
    } else if (mode === "rhodonea") {
      const n = values?.[0] ?? 2;
      const d = values?.[1] ?? 1;
      const a = values?.[2] ?? 0;
      const angle = values?.[3] ?? 0;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const k = n / d;
      const scale = 0.45;
      const deltaTheta = (d * 2 * Math.PI) / points;
      let theta = angle;
      context.strokeStyle = "rgba(224,224,224,0.88)";
      context.lineWidth = 1;
      context.beginPath();
      for (let index = 0; index < points; index += 1) {
        const radial = a - (1 - a) * Math.cos(k * 2 * Math.PI * (theta - angle));
        const pointX = centerX + scale * width * radial * Math.cos(2 * Math.PI * theta);
        const pointY = centerY - scale * height * radial * Math.sin(2 * Math.PI * theta);
        if (index === 0) context.moveTo(pointX, pointY);
        else context.lineTo(pointX, pointY);
        theta += deltaTheta;
      }
      context.closePath();
      context.stroke();
    } else if (mode === "tesseract") {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const scale = width / 2;
      const point = (index: number) => ({
        x: centerX + scale * (values?.[index * 2] ?? 0),
        y: centerY - scale * (values?.[index * 2 + 1] ?? 0),
      });
      context.strokeStyle = "rgb(102,102,102)";
      context.lineWidth = 1;
      context.beginPath();
      const line = (from: number, to: number) => {
        const first = point(from);
        const second = point(to);
        context.moveTo(first.x, first.y);
        context.lineTo(second.x, second.y);
      };
      for (let index = 0; index < 4; index += 1) {
        for (let offset = 0; offset < 16; offset += 8) {
          line(offset + index, offset + ((index + 1) % 4));
          line(offset + index + 4, offset + ((index + 1) % 4) + 4);
          line(offset + index, offset + index + 4);
        }
      }
      for (let index = 0; index < 8; index += 1) line(index, index + 8);
      context.stroke();
      for (let index = 0; index < 16; index += 1) {
        const current = point(index);
        context.fillStyle = TESSERACT_COLORS[index] ?? "#ffffff";
        circle(context, current.x, current.y, 2);
      }
    } else if (mode === "bifurcation") {
      const current = values?.[0] ?? 0.5;
      const plotIndex = Math.max(0, Math.min(points, Math.round(values?.[1] ?? 0)));
      const lines = 2 ** Math.max(0, Math.min(3, Math.round(values?.[2] ?? 3)));
      if (lines >= 2) {
        context.strokeStyle = "rgb(153,153,153)";
        context.lineWidth = 1;
        context.beginPath();
        for (let index = 1; index < lines; index += 1) {
          context.moveTo(width, (height * index) / lines);
          context.lineTo(0, (height * index) / lines);
        }
        context.stroke();
      }
      context.fillStyle = "rgb(230,230,230)";
      for (let index = 0; index < plotIndex; index += 1)
        circle(context, index, (values?.[11 + index] ?? 0) * (height - 1), 1);
      context.fillStyle = "rgb(0,255,0)";
      circle(context, plotIndex, current * (height - 1), 3);
    } else {
      const rValue = Math.max(0, Math.min(1, values?.[3] ?? 0.5));
      const type = Math.max(0, Math.min(2, Math.round(values?.[4] ?? 0)));
      const iterations = Math.max(1, Math.min(7, Math.round(values?.[5] ?? 1)));
      context.strokeStyle = "rgb(230,230,230)";
      context.lineWidth = 1;
      context.beginPath();
      for (let index = 0; index < width - 1; index += 1) {
        let pointX = index / (width - 1);
        let nextX = (index + 1) / (width - 1);
        let pointY = 0;
        let nextY = 0;
        for (let iteration = 0; iteration < iterations; iteration += 1) {
          pointY = bifurcationValue(type, pointX, rValue);
          nextY = bifurcationValue(type, nextX, rValue);
          pointX = pointY;
          nextX = nextY;
        }
        context.moveTo(index, (1 - pointY) * (height - 1));
        context.lineTo(index + 1, (1 - nextY) * (height - 1));
      }
      context.stroke();
      context.fillStyle = "rgb(0,255,0)";
      circle(context, (values?.[9] ?? 0) * width, (1 - (values?.[0] ?? 0.5)) * height, 3);
      context.strokeStyle = "rgb(217,217,217)";
      context.lineWidth = 0.35;
      context.beginPath();
      for (let index = 0; index < 4; index += 1) {
        const current = values?.[6 + index] ?? 0;
        const next = values?.[7 + index] ?? 0;
        context.moveTo(width * current, height);
        context.lineTo(width * current, height * (1 - next));
        context.moveTo(width * current, height * (1 - next));
        context.lineTo(width * next, height * (1 - next));
      }
      context.stroke();
    }
  }, [mode, values, points, x, y, width, height]);

  return (
    <canvas
      ref={canvas}
      className={`pw-rack-axioma-display pw-rack-axioma-${mode}`}
      aria-label={t("display.axioma")}
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
