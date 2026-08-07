import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/provider";

const MM = 75 / 25.4;
const EPOCH = 946727935.816;
const TIME_CHUNK = 131072;
const CENTER = { x: 60, y: 71 };
const BODY_NAMES = [
  "SUN",
  "MOON",
  "MERCURY",
  "VENUS",
  "MARS",
  "JUPITER",
  "SATURN",
  "URANUS",
  "NEPTUNE",
];
const ASPECT_NAMES = ["CNJ", "SXT", "SQR", "TRI", "OPP"];
const ASPECT_COLORS = [
  [255, 237, 184],
  [94, 173, 158],
  [217, 92, 74],
  [156, 140, 217],
  [255, 196, 99],
] as const;
const ACCENT = "rgb(255,196,100)";
const DIM = "rgb(156,106,59)";

const mm = (value: number) => value * MM;
const finite = (value: number | undefined, fallback = 0) =>
  Number.isFinite(value) ? Number(value) : fallback;

function wheelPosition(longitude: number, radius: number) {
  return {
    x: mm(CENTER.x - radius * Math.cos(longitude)),
    y: mm(CENTER.y + radius * Math.sin(longitude)),
  };
}

function prepareGlyph(
  context: CanvasRenderingContext2D,
  position: { x: number; y: number },
  size: number,
  color: string,
) {
  context.save();
  context.translate(position.x, position.y);
  context.scale(size, size);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = mm(0.32) / size;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
}

function drawPlanetGlyph(
  context: CanvasRenderingContext2D,
  body: number,
  position: { x: number; y: number },
  size: number,
  color: string,
) {
  prepareGlyph(context, position, size, color);
  switch (body) {
    case 0:
      context.arc(0, 0, 0.4, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(0, 0, 0.09, 0, Math.PI * 2);
      context.fill();
      break;
    case 1:
      context.moveTo(0, -0.42);
      context.bezierCurveTo(-0.55, -0.42, -0.55, 0.42, 0, 0.42);
      context.bezierCurveTo(-0.25, 0.42, -0.25, -0.42, 0, -0.42);
      context.stroke();
      break;
    case 2:
      context.arc(0, 0.02, 0.22, 0, Math.PI * 2);
      context.moveTo(0, 0.24);
      context.lineTo(0, 0.5);
      context.moveTo(-0.13, 0.37);
      context.lineTo(0.13, 0.37);
      context.moveTo(-0.2, -0.48);
      context.bezierCurveTo(-0.2, -0.18, 0.2, -0.18, 0.2, -0.48);
      context.stroke();
      break;
    case 3:
      context.arc(0, -0.12, 0.26, 0, Math.PI * 2);
      context.moveTo(0, 0.14);
      context.lineTo(0, 0.5);
      context.moveTo(-0.15, 0.32);
      context.lineTo(0.15, 0.32);
      context.stroke();
      break;
    case 4:
      context.arc(-0.08, 0.1, 0.26, 0, Math.PI * 2);
      context.moveTo(0.11, -0.09);
      context.lineTo(0.36, -0.34);
      context.moveTo(0.16, -0.34);
      context.lineTo(0.36, -0.34);
      context.lineTo(0.36, -0.14);
      context.stroke();
      break;
    case 5:
      context.moveTo(-0.35, -0.18);
      context.bezierCurveTo(-0.35, -0.48, 0.05, -0.48, 0.05, -0.18);
      context.lineTo(-0.38, 0.2);
      context.lineTo(0.38, 0.2);
      context.moveTo(0.18, -0.02);
      context.lineTo(0.18, 0.5);
      context.stroke();
      break;
    case 6:
      context.moveTo(-0.15, -0.45);
      context.lineTo(-0.15, 0.12);
      context.moveTo(-0.32, -0.3);
      context.lineTo(0.05, -0.3);
      context.moveTo(-0.15, 0.12);
      context.bezierCurveTo(0.2, -0.15, 0.35, 0.25, 0, 0.45);
      context.stroke();
      break;
    case 7:
      context.arc(0, 0.3, 0.13, 0, Math.PI * 2);
      context.moveTo(-0.2, -0.5);
      context.lineTo(-0.2, 0);
      context.moveTo(0.2, -0.5);
      context.lineTo(0.2, 0);
      context.moveTo(-0.2, -0.25);
      context.lineTo(0.2, -0.25);
      context.moveTo(0, -0.25);
      context.lineTo(0, 0.17);
      context.stroke();
      break;
    case 8:
      context.moveTo(-0.28, -0.42);
      context.bezierCurveTo(-0.28, 0.08, 0.28, 0.08, 0.28, -0.42);
      context.moveTo(0, -0.45);
      context.lineTo(0, 0.5);
      context.moveTo(-0.15, 0.32);
      context.lineTo(0.15, 0.32);
      context.stroke();
      break;
  }
  context.restore();
}

function drawSignGlyph(
  context: CanvasRenderingContext2D,
  sign: number,
  position: { x: number; y: number },
  size: number,
  color: string,
) {
  prepareGlyph(context, position, size, color);
  switch (sign) {
    case 0:
      context.moveTo(0, 0.45);
      context.bezierCurveTo(0, -0.2, -0.1, -0.5, -0.32, -0.33);
      context.moveTo(0, 0.45);
      context.bezierCurveTo(0, -0.2, 0.1, -0.5, 0.32, -0.33);
      break;
    case 1:
      context.arc(0, 0.16, 0.28, 0, Math.PI * 2);
      context.moveTo(-0.3, -0.45);
      context.bezierCurveTo(-0.12, -0.1, 0.12, -0.1, 0.3, -0.45);
      break;
    case 2:
      context.moveTo(-0.15, -0.3);
      context.lineTo(-0.15, 0.3);
      context.moveTo(0.15, -0.3);
      context.lineTo(0.15, 0.3);
      context.moveTo(-0.32, -0.4);
      context.bezierCurveTo(-0.1, -0.26, 0.1, -0.26, 0.32, -0.4);
      context.moveTo(-0.32, 0.4);
      context.bezierCurveTo(-0.1, 0.26, 0.1, 0.26, 0.32, 0.4);
      break;
    case 3:
      context.arc(-0.2, -0.16, 0.12, 0, Math.PI * 2);
      context.moveTo(-0.08, -0.2);
      context.bezierCurveTo(0.12, -0.36, 0.3, -0.3, 0.36, -0.12);
      context.arc(0.2, 0.16, 0.12, 0, Math.PI * 2);
      context.moveTo(0.08, 0.2);
      context.bezierCurveTo(-0.12, 0.36, -0.3, 0.3, -0.36, 0.12);
      break;
    case 4:
      context.arc(-0.22, 0.08, 0.12, 0, Math.PI * 2);
      context.moveTo(-0.12, 0);
      context.bezierCurveTo(-0.05, -0.5, 0.3, -0.45, 0.28, -0.1);
      context.bezierCurveTo(0.26, 0.15, 0.08, 0.22, 0.18, 0.42);
      break;
    case 5:
      context.moveTo(-0.4, 0.32);
      context.lineTo(-0.4, -0.18);
      context.bezierCurveTo(-0.4, -0.4, -0.14, -0.4, -0.14, -0.18);
      context.lineTo(-0.14, 0.32);
      context.moveTo(-0.14, -0.18);
      context.bezierCurveTo(-0.14, -0.4, 0.12, -0.4, 0.12, -0.18);
      context.lineTo(0.12, 0.2);
      context.bezierCurveTo(0.16, 0.45, 0.36, 0.4, 0.34, 0.1);
      break;
    case 6:
      context.moveTo(-0.38, 0.32);
      context.lineTo(0.38, 0.32);
      context.moveTo(-0.38, 0.05);
      context.lineTo(-0.13, 0.05);
      context.bezierCurveTo(-0.13, -0.35, 0.13, -0.35, 0.13, 0.05);
      context.lineTo(0.38, 0.05);
      break;
    case 7:
      context.moveTo(-0.4, 0.32);
      context.lineTo(-0.4, -0.18);
      context.bezierCurveTo(-0.4, -0.4, -0.16, -0.4, -0.16, -0.18);
      context.lineTo(-0.16, 0.32);
      context.moveTo(-0.16, -0.18);
      context.bezierCurveTo(-0.16, -0.4, 0.08, -0.4, 0.08, -0.18);
      context.lineTo(0.08, 0.14);
      context.bezierCurveTo(0.08, 0.32, 0.24, 0.34, 0.34, 0.22);
      context.moveTo(0.26, 0.14);
      context.lineTo(0.36, 0.2);
      context.lineTo(0.3, 0.32);
      break;
    case 8:
      context.moveTo(-0.32, 0.32);
      context.lineTo(0.34, -0.34);
      context.moveTo(0.08, -0.36);
      context.lineTo(0.34, -0.34);
      context.lineTo(0.36, -0.08);
      context.moveTo(-0.24, -0.04);
      context.lineTo(0.04, 0.24);
      break;
    case 9:
      context.moveTo(-0.42, -0.32);
      context.lineTo(-0.22, 0.1);
      context.lineTo(-0.04, -0.32);
      context.moveTo(-0.04, -0.32);
      context.lineTo(-0.04, 0.14);
      context.bezierCurveTo(-0.04, 0.42, 0.3, 0.42, 0.3, 0.16);
      context.bezierCurveTo(0.3, -0.04, 0.08, 0, 0.05, 0.14);
      break;
    case 10:
      context.moveTo(-0.38, -0.04);
      context.lineTo(-0.19, -0.24);
      context.lineTo(0, -0.04);
      context.lineTo(0.19, -0.24);
      context.lineTo(0.38, -0.04);
      context.moveTo(-0.38, 0.26);
      context.lineTo(-0.19, 0.06);
      context.lineTo(0, 0.26);
      context.lineTo(0.19, 0.06);
      context.lineTo(0.38, 0.26);
      break;
    case 11:
      context.moveTo(-0.16, -0.42);
      context.bezierCurveTo(-0.4, -0.2, -0.4, 0.2, -0.16, 0.42);
      context.moveTo(0.16, -0.42);
      context.bezierCurveTo(0.4, -0.2, 0.4, 0.2, 0.16, 0.42);
      context.moveTo(-0.34, 0);
      context.lineTo(0.34, 0);
      break;
  }
  context.stroke();
  context.restore();
}

function civilFromDays(days: number) {
  const z = days + 719468;
  const era = Math.trunc((z >= 0 ? z : z - 146096) / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.trunc(
    (dayOfEra -
      Math.trunc(dayOfEra / 1460) +
      Math.trunc(dayOfEra / 36524) -
      Math.trunc(dayOfEra / 146096)) /
      365,
  );
  let year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.trunc(yearOfEra / 4) - Math.trunc(yearOfEra / 100));
  const monthPart = Math.trunc((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.trunc((153 * monthPart + 2) / 5) + 1;
  const month = monthPart < 10 ? monthPart + 3 : monthPart - 9;
  year += month <= 2 ? 1 : 0;
  return { year, month, day };
}

const pad = (value: number) => Math.max(0, Math.trunc(value)).toString().padStart(2, "0");

export function RackCosmicClockDisplay({
  values,
  width,
  height,
  scaleX,
}: {
  values?: number[];
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
    const simUnix = EPOCH + finite(values?.[0]) * TIME_CHUNK + finite(values?.[1]);
    const sunSign = Math.max(0, Math.min(11, Math.trunc(finite(values?.[2]))));
    const strongA = Math.trunc(finite(values?.[3], -1));
    const strongB = Math.trunc(finite(values?.[4], -1));
    const strongType = Math.trunc(finite(values?.[5], -1));
    const strongDelta = finite(values?.[6]);
    const activeCount = Math.max(0, Math.min(64, Math.trunc(finite(values?.[7]))));
    const longitudes = Array.from({ length: 9 }, (_, index) => finite(values?.[8 + index]));
    const weights = Array.from({ length: 9 }, (_, index) => finite(values?.[17 + index], 0.4));
    for (let index = 0; index < activeCount; index++) {
      const offset = 26 + index * 4;
      const a = Math.max(0, Math.min(8, Math.trunc(finite(values?.[offset]))));
      const b = Math.max(0, Math.min(8, Math.trunc(finite(values?.[offset + 1]))));
      const type = Math.max(0, Math.min(4, Math.trunc(finite(values?.[offset + 2]))));
      const intensity = Math.max(0, Math.min(1, finite(values?.[offset + 3])));
      const color = ASPECT_COLORS[type];
      context.beginPath();
      const first = wheelPosition(longitudes[a], 31.5);
      const second = wheelPosition(longitudes[b], 31.5);
      context.moveTo(first.x, first.y);
      context.lineTo(second.x, second.y);
      context.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${0.15 + 0.75 * intensity})`;
      context.lineWidth = mm(0.4 * (1 + intensity));
      context.lineCap = "round";
      context.stroke();
    }
    for (let sign = 0; sign < 12; sign++) {
      const middle = ((sign * 30 + 15) * Math.PI) / 180;
      drawSignGlyph(
        context,
        sign,
        wheelPosition(middle, 49.25),
        mm(4.5),
        sign === sunSign ? ACCENT : DIM,
      );
    }
    for (let body = 0; body < 9; body++) {
      const alpha = 0.45 + 0.55 * Math.max(0, Math.min(1, (weights[body] - 0.4) / 1.6));
      const base = body === 0 ? [255, 196, 100] : [255, 238, 184];
      const color = `rgba(${base[0]},${base[1]},${base[2]},${alpha})`;
      const outer = wheelPosition(longitudes[body], 44.5);
      const inner = wheelPosition(longitudes[body], 42.3);
      context.beginPath();
      context.moveTo(outer.x, outer.y);
      context.lineTo(inner.x, inner.y);
      context.strokeStyle = color;
      context.lineWidth = mm(0.35);
      context.stroke();
      drawPlanetGlyph(context, body, wheelPosition(longitudes[body], 38), mm(3.8), color);
    }
    const days = Math.floor(simUnix / 86400);
    const seconds = Math.trunc(simUnix - days * 86400);
    const date = civilFromDays(days);
    const readout = { x: mm(118), y: mm(18), width: mm(44), height: mm(16) };
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "12px 'Share Tech Mono', monospace";
    context.fillStyle = ACCENT;
    context.fillText(
      `${date.year}-${pad(date.month)}-${pad(date.day)}`,
      readout.x + readout.width / 2,
      readout.y + readout.height * 0.19,
    );
    context.fillText(
      `${pad(seconds / 3600)}:${pad((seconds / 60) % 60)} UTC`,
      readout.x + readout.width / 2,
      readout.y + readout.height * 0.5,
    );
    context.font = "9px 'Share Tech Mono', monospace";
    if (
      strongType >= 0 &&
      strongType < 5 &&
      strongA >= 0 &&
      strongA < 9 &&
      strongB >= 0 &&
      strongB < 9
    ) {
      const color = ASPECT_COLORS[strongType];
      context.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      context.fillText(
        `${BODY_NAMES[strongA]} ${ASPECT_NAMES[strongType]} ${BODY_NAMES[strongB]} ${strongDelta.toFixed(1)}°`,
        readout.x + readout.width / 2,
        readout.y + readout.height * 0.81,
      );
    } else {
      context.fillStyle = DIM;
      context.fillText("-", readout.x + readout.width / 2, readout.y + readout.height * 0.81);
    }
  }, [height, values, width]);
  return (
    <canvas
      ref={canvasRef}
      className="pw-rack-cosmic-clock"
      aria-label={t("display.cosmicClock")}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: width * scaleX, height }}
    />
  );
}
