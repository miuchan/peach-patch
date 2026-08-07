import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/provider";

const HEADER = 8;
const POINT_OFFSET = HEADER;
const VALUE_OFFSET = POINT_OFFSET + 3 * 5;
const SCOPE_OFFSET = VALUE_OFFSET + 18 * 2;
const MESSAGE_OFFSET = SCOPE_OFFSET + 4 * 512;
const LOG_OFFSET = MESSAGE_OFFSET + 128;

const COLORS = {
  orange2: "rgb(254,208,133)",
  orange4: "rgb(255,227,187)",
  yellow3: "rgb(237,254,160)",
  blue3: "rgb(166,203,255)",
  green2: "rgb(159,254,134)",
  green3: "rgb(176,255,161)",
  red2: "rgb(255,137,135)",
  red3: "rgb(255,159,160)",
  yellow2: "rgb(227,255,134)",
  blue2: "rgb(139,188,255)",
  purple2: "rgb(230,137,254)",
};

const POINT_COLORS = [COLORS.red2, COLORS.green2, COLORS.yellow2];
const SCOPE_COLORS = [COLORS.red2, COLORS.green2, COLORS.yellow2, COLORS.blue2];

function decode(values: number[] | undefined, offset: number, maximum: number) {
  const bytes: number[] = [];
  for (let index = 0; index < maximum; index++) {
    const byte = Math.max(0, Math.min(255, Math.round(values?.[offset + index] ?? 0)));
    if (!byte) break;
    bytes.push(byte);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function setMono(context: CanvasRenderingContext2D) {
  context.font = "12px 'Share Tech Mono', monospace";
  (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "-2px";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
}

function textBox(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maximumWidth: number,
) {
  const words = text.split(/(\s+)/);
  let line = "";
  let lineY = y;
  for (const word of words) {
    const next = line + word;
    if (line && context.measureText(next).width > maximumWidth) {
      context.fillText(line.trimEnd(), x, lineY);
      line = word.trimStart();
      lineY += 13;
    } else line = next;
  }
  if (line) context.fillText(line.trimEnd(), x, lineY);
}

export function RackLuaDisplay({
  values,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, width, height);
    setMono(context);
    const loaded = (values?.[0] ?? 0) !== 0;
    const mode = Math.round(values?.[1] ?? 0);
    const logCount = Math.max(0, Math.min(9, Math.round(values?.[3] ?? 0)));
    const scopeScale = values?.[5] ?? 0.05;
    const scopePosition = values?.[6] ?? 0;
    const triggerThreshold = values?.[7] ?? 0;
    context.fillStyle = loaded ? COLORS.blue3 : COLORS.red3;
    textBox(context, decode(values, MESSAGE_OFFSET, 128), 6, 13, width - 10);
    if (!loaded) return;
    context.strokeStyle = COLORS.yellow3;
    context.lineWidth = 0.5;
    context.beginPath();
    context.moveTo(0, 18.5);
    context.lineTo(width, 18.5);
    context.stroke();
    if (mode === 1) {
      context.fillStyle = COLORS.green3;
      for (let line = 0; line < logCount; line++)
        context.fillText(decode(values, LOG_OFFSET + line * 28, 28), 7, 34 + 13 * line);
      return;
    }
    if (mode === 2) {
      const display = { x: 7, y: 29, width: 105, height: 105 };
      context.strokeStyle = COLORS.orange2;
      context.lineWidth = 0.3;
      context.strokeRect(display.x, display.y, display.width, display.height);
      context.strokeStyle = COLORS.purple2;
      context.beginPath();
      context.moveTo(display.x + display.width / 2, display.y);
      context.lineTo(display.x + display.width / 2, display.y + display.height);
      context.moveTo(display.x, display.y + display.height / 2);
      context.lineTo(display.x + display.width, display.y + display.height / 2);
      context.stroke();
      context.textAlign = "right";
      context.textBaseline = "top";
      for (let point = 0; point < 3; point++) {
        const offset = POINT_OFFSET + point * 5;
        if (!(values?.[offset] ?? 0)) continue;
        const px = values?.[offset + 1] ?? 0;
        const py = values?.[offset + 2] ?? 0;
        const directionEnabled = (values?.[offset + 3] ?? 0) !== 0;
        const direction = values?.[offset + 4] ?? 0;
        const drawX = (px + 10) * (display.width / 20) + display.x;
        const drawY = (-py + 10) * (display.height / 20) + display.y;
        context.fillStyle = POINT_COLORS[point];
        context.strokeStyle = POINT_COLORS[point];
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(drawX, drawY, 1.5, 0, Math.PI * 2);
        context.fill();
        if (directionEnabled) {
          const angle = (direction * Math.PI) / 180;
          context.beginPath();
          context.moveTo(drawX, drawY);
          context.lineTo(drawX + Math.sin(angle) * 5, drawY - Math.cos(angle) * 5);
          context.stroke();
        }
        context.fillText(px.toFixed(2), width - 1, 24 + 39 * point);
        context.fillText(py.toFixed(2), width - 1, 37 + 39 * point);
        context.fillText(direction.toFixed(1), width - 1, 50 + 39 * point);
      }
      return;
    }
    if (mode === 3) {
      context.textAlign = "right";
      context.textBaseline = "top";
      for (let index = 0; index < 18; index++) {
        const shown = (values?.[VALUE_OFFSET + index * 2] ?? 0) !== 0;
        const value = values?.[VALUE_OFFSET + index * 2 + 1] ?? 0;
        if (!shown) continue;
        const drawX = index < 9 ? width / 2 - 10 : width - 7;
        const drawY = 24 + 13 * (index < 9 ? index : index - 9);
        context.fillStyle = "rgb(154,154,154)";
        context.fillText(`${index}: `, drawX - 42, drawY);
        context.fillStyle = value === 0 ? COLORS.orange4 : value > 0 ? COLORS.green3 : COLORS.red3;
        context.fillText(value.toFixed(5), drawX, drawY);
      }
      return;
    }
    if (mode !== 4) return;
    const scope = { x: 0, y: 33, width, height: height - 47 };
    const divisionX = scope.width / 4;
    const divisionY = scope.height / 4;
    context.strokeStyle = COLORS.orange2;
    context.lineWidth = 0.3;
    for (let column = 1; column < 4; column++) {
      context.beginPath();
      context.moveTo(scope.x + divisionX * column, scope.y);
      context.lineTo(scope.x + divisionX * column, scope.y + scope.height);
      context.stroke();
    }
    context.strokeStyle = COLORS.purple2;
    for (let row = 0; row < 5; row++) {
      context.beginPath();
      context.moveTo(scope.x, scope.y + divisionY * row);
      context.lineTo(scope.x + scope.width, scope.y + divisionY * row);
      context.stroke();
    }
    context.save();
    context.beginPath();
    context.rect(scope.x, scope.y, scope.width, scope.height);
    context.clip();
    context.globalCompositeOperation = "lighter";
    context.lineWidth = 1.5;
    context.lineCap = "round";
    context.lineJoin = "miter";
    for (let trace = 0; trace < 4; trace++) {
      const shown = (values?.[VALUE_OFFSET + trace * 2] ?? 0) !== 0;
      if (!shown) continue;
      context.strokeStyle = SCOPE_COLORS[trace];
      context.beginPath();
      for (let sample = 0; sample < 512; sample++) {
        const value = values?.[SCOPE_OFFSET + trace * 512 + sample] ?? 0;
        const normalizedY = (value + scopePosition) * scopeScale * 0.5 + 0.5;
        const drawX = scope.x + (sample / 511) * scope.width;
        const drawY = scope.y + scope.height * (1 - normalizedY);
        if (sample === 0) context.moveTo(drawX, drawY);
        else context.lineTo(drawX, drawY);
      }
      context.stroke();
    }
    context.restore();
    context.globalCompositeOperation = "source-over";
    context.textAlign = "right";
    context.textBaseline = "top";
    for (let trace = 0; trace < 4; trace++) {
      if (!(values?.[VALUE_OFFSET + trace * 2] ?? 0)) continue;
      const value = values?.[VALUE_OFFSET + trace * 2 + 1] ?? 0;
      const drawX = trace < 2 ? (width / 2) * (trace + 1) - 20 : (width / 2) * (trace - 1) - 20;
      const drawY = trace < 2 ? 21 : height - 12;
      context.fillStyle = SCOPE_COLORS[trace];
      context.fillText(value.toFixed(5), drawX, drawY);
    }
    const trigger = (triggerThreshold + scopePosition) * scopeScale;
    const triggerY = scope.y + scope.height * (1 - (trigger / 2 + 0.5));
    context.save();
    context.beginPath();
    context.rect(scope.x, scope.y, scope.width, scope.height);
    context.clip();
    context.strokeStyle = "rgba(255,255,255,0.063)";
    context.beginPath();
    context.moveTo(scope.width - 10, triggerY);
    context.lineTo(0, triggerY);
    context.closePath();
    context.stroke();
    context.fillStyle = "rgba(255,255,255,0.376)";
    context.beginPath();
    context.moveTo(scope.width - 2, triggerY - 3);
    context.lineTo(scope.width - 7, triggerY - 3);
    context.lineTo(scope.width - 10, triggerY);
    context.lineTo(scope.width - 7, triggerY + 3);
    context.lineTo(scope.width - 2, triggerY + 3);
    context.closePath();
    context.fill();
    context.restore();
  }, [height, values, width]);
  return (
    <canvas
      ref={canvasRef}
      className="pw-rack-lua-display"
      aria-label={t("display.lua")}
      width={width}
      height={height}
      style={{ position: "absolute", left: x * scaleX, top: y, width: width * scaleX, height }}
    />
  );
}
