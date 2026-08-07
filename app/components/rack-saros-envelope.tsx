import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const HEADER = 7;
const SHAPES = 16;
const MARGIN_X = (75 / 25.4) * 1.5;
const MARGIN_Y = (75 / 25.4) * 2;

function bell(position: number, center: number, width: number) {
  const distance = (position - center) / width;
  return Math.exp(-0.5 * distance * distance);
}

function shapeValue(index: number, position: number) {
  switch (index) {
    case 0:
      return (Math.exp(-9 * position) - 1.2341e-4) / (1 - 1.2341e-4);
    case 1:
      return 1 - position;
    case 2:
      return position < 0.08 ? position / 0.08 : 1 - (position - 0.08) / 0.92;
    case 3:
      return 1 - Math.abs(2 * position - 1);
    case 4:
      return Math.sin(Math.PI * position);
    case 5:
      return bell(position, 0.5, 0.15);
    case 6:
      return position;
    case 7:
      return position ** 3;
    case 8:
      return Math.max(bell(position, 0.28, 0.1), 0.75 * bell(position, 0.7, 0.1));
    case 9:
      return (1 - position) * (0.6 + 0.4 * Math.cos(Math.PI * 8 * position));
    case 10:
      return (1 - position) ** 1.5 * Math.abs(Math.cos(Math.PI * 3.5 * position));
    case 11:
      return Math.min(Math.trunc(position * 5), 4) / 4;
    case 12:
      return 1 - Math.min(Math.trunc(position * 5), 4) / 4;
    case 13:
      return (position * 6) % 1 < 0.5 ? 1 - position : 0;
    case 14:
      return 0.5 + 0.5 * Math.sin(Math.PI * 6 * position) * Math.exp(-2 * position);
    default:
      return Math.max(
        0,
        Math.min(
          1,
          0.5 +
            0.35 * Math.sin(Math.PI * 3.4 * position + 1) +
            0.25 * Math.sin(Math.PI * 6.2 * position + 2) +
            0.15 * Math.sin(Math.PI * 10.6 * position + 4),
        ),
      );
  }
}

function envelope(
  table: number[] | null,
  shape: number,
  warp: number,
  flux: number,
  position: number,
) {
  const warped = position ** (2 ** (2.5 * warp));
  let value: number;
  if (table) {
    const location = warped * (table.length - 1),
      first = Math.min(Math.trunc(location), table.length - 2),
      fraction = location - first;
    value = (table[first] ?? 0) * (1 - fraction) + (table[first + 1] ?? 0) * fraction;
  } else {
    const location = shape * (SHAPES - 1),
      first = Math.max(0, Math.min(SHAPES - 1, Math.trunc(location))),
      second = Math.min(first + 1, SHAPES - 1),
      fraction = location - first;
    value = shapeValue(first, warped) * (1 - fraction) + shapeValue(second, warped) * fraction;
  }
  const ripple = 0.5 - 0.5 * Math.cos(Math.PI * 16 * warped);
  return Math.max(0, Math.min(1, value * (1 - flux * ripple)));
}

function formatTime(seconds: number) {
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 60) return `${seconds.toFixed(2)} s`;
  const minutes = Math.trunc(seconds / 60);
  return `${minutes}m ${String(Math.trunc(seconds - minutes * 60)).padStart(2, "0")}s`;
}

export function RackSarosEnvelope({
  values,
  actionBase,
  actionSteps,
  tableSize,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  actionSteps: number;
  tableSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const previous = useRef<{ index: number; value: number } | null>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    element.width = Math.max(1, Math.round(width * ratio));
    element.height = Math.max(1, Math.round(height * ratio));
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#070302";
    context.fillRect(0, 0, width, height);
    const contentWidth = width - 2 * MARGIN_X,
      contentHeight = height - 2 * MARGIN_Y;
    context.strokeStyle = "rgba(56,33,16,0.69)";
    context.lineWidth = (75 / 25.4) * 0.15;
    for (let index = 0; index <= 4; index += 1) {
      const lineX = MARGIN_X + (contentWidth * index) / 4;
      context.beginPath();
      context.moveTo(lineX, MARGIN_Y);
      context.lineTo(lineX, MARGIN_Y + contentHeight);
      context.stroke();
    }
    context.beginPath();
    context.moveTo(MARGIN_X, MARGIN_Y + contentHeight / 2);
    context.lineTo(MARGIN_X + contentWidth, MARGIN_Y + contentHeight / 2);
    context.stroke();

    const shape = values?.[0] ?? 0,
      warp = values?.[1] ?? 0,
      flux = values?.[2] ?? 0,
      phase = Math.max(0, Math.min(1, values?.[3] ?? 1)),
      duration = values?.[4] ?? 3,
      loop = (values?.[5] ?? 0) > 0.5,
      drawn = (values?.[6] ?? 0) > 0.5,
      table = drawn ? (values ?? []).slice(HEADER, HEADER + tableSize) : null;
    context.beginPath();
    for (let index = 0; index <= 128; index += 1) {
      const position = index / 128,
        value = envelope(table, shape, warp, flux, position),
        pointX = MARGIN_X + position * contentWidth,
        pointY = MARGIN_Y + (1 - value) * contentHeight;
      if (index) context.lineTo(pointX, pointY);
      else context.moveTo(pointX, pointY);
    }
    context.strokeStyle = "rgba(255,196,100,0.902)";
    context.lineWidth = (75 / 25.4) * 0.3;
    context.stroke();
    context.lineTo(MARGIN_X + contentWidth, MARGIN_Y + contentHeight);
    context.lineTo(MARGIN_X, MARGIN_Y + contentHeight);
    context.closePath();
    context.fillStyle = "rgba(255,196,100,0.157)";
    context.fill();

    const playheadX = MARGIN_X + phase * contentWidth,
      playheadY = MARGIN_Y + (1 - envelope(table, shape, warp, flux, phase)) * contentHeight;
    context.beginPath();
    context.moveTo(playheadX, MARGIN_Y);
    context.lineTo(playheadX, MARGIN_Y + contentHeight);
    context.strokeStyle = "rgba(255,238,184,0.565)";
    context.lineWidth = (75 / 25.4) * 0.2;
    context.stroke();
    context.beginPath();
    context.arc(playheadX, playheadY, (75 / 25.4) * 0.7, 0, Math.PI * 2);
    context.fillStyle = "#ffeeb8";
    context.fill();
    context.fillStyle = "#ffeeb8";
    context.font = `${(75 / 25.4) * 2.6}px monospace`;
    context.textBaseline = "bottom";
    context.textAlign = "left";
    context.fillText(
      formatTime(duration),
      MARGIN_X + (75 / 25.4) * 0.5,
      height - (75 / 25.4) * 0.6,
    );
    if (loop) {
      context.textAlign = "right";
      context.fillText("LOOP", width - MARGIN_X - (75 / 25.4) * 0.5, height - (75 / 25.4) * 0.6);
    }
    if (drawn) {
      context.textBaseline = "top";
      context.textAlign = "right";
      context.fillText("DRAW", width - MARGIN_X - (75 / 25.4) * 0.5, MARGIN_Y + (75 / 25.4) * 0.3);
    }
  }, [height, tableSize, values, width]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect(),
      localX = ((event.clientX - bounds.left) / bounds.width) * width,
      localY = ((event.clientY - bounds.top) / bounds.height) * height;
    return {
      index: Math.round(
        Math.max(0, Math.min(1, (localX - MARGIN_X) / (width - 2 * MARGIN_X))) * (tableSize - 1),
      ),
      value: Math.max(0, Math.min(1, 1 - (localY - MARGIN_Y) / (height - 2 * MARGIN_Y))),
    };
  };
  const send = (from: { index: number; value: number }, to: { index: number; value: number }) => {
    const start = Math.min(from.index, to.index),
      end = Math.max(from.index, to.index);
    for (let index = start; index <= end; index += 1) {
      const fraction = end > start ? (index - start) / (end - start) : 0,
        value =
          from.index <= to.index
            ? from.value * (1 - fraction) + to.value * fraction
            : to.value * (1 - fraction) + from.value * fraction,
        id = actionBase + index * actionSteps + Math.round(value * (actionSteps - 1));
      onAction(id, true);
      onAction(id, false);
    }
  };
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    previous.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-saros-envelope"
      aria-label={t("display.sarosEnvelope")}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: "none",
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const current = point(event);
        previous.current = current;
        event.currentTarget.setPointerCapture(event.pointerId);
        send(current, current);
      }}
      onPointerMove={(event) => {
        if (!previous.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        const current = point(event);
        send(previous.current, current);
        previous.current = current;
      }}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
