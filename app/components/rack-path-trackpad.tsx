import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

type Point = { x: number; y: number };

export function RackPathTrackpad({
  values,
  actionBase,
  actionSteps,
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
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const tail = useRef<Point[]>([]);
  const dragging = useRef(false);
  const lastAction = useRef(actionBase);
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
    const point = { x: (values?.[0] ?? 0.5) * width, y: (1 - (values?.[1] ?? 0.5)) * height };
    const red = Math.round((values?.[2] ?? 1) * 255);
    const green = Math.round((values?.[3] ?? 0.84) * 255);
    const blue = Math.round((values?.[4] ?? 0) * 255);
    tail.current.unshift(point);
    if (tail.current.length > 50) tail.current.length = 50;
    tail.current.forEach((tailPoint, index) => {
      const inverse = 1 - index / 49;
      const gradient = context.createRadialGradient(
        tailPoint.x,
        tailPoint.y,
        0,
        tailPoint.x,
        tailPoint.y,
        8 * inverse,
      );
      gradient.addColorStop(0, `rgba(${red},${green},${blue},${inverse})`);
      gradient.addColorStop(1, `rgba(${red},${green},${blue},0)`);
      context.beginPath();
      context.arc(tailPoint.x, tailPoint.y, 8, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.fill();
    });
    context.beginPath();
    context.arc(point.x, point.y, 8, 0, Math.PI * 2);
    context.fillStyle = `rgb(${red},${green},${blue})`;
    context.fill();
  }, [height, values, width]);
  const actionAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const column = Math.max(
      0,
      Math.min(
        actionSteps - 1,
        Math.round(((event.clientX - bounds.left) / bounds.width) * (actionSteps - 1)),
      ),
    );
    const row = Math.max(
      0,
      Math.min(
        actionSteps - 1,
        Math.round(((event.clientY - bounds.top) / bounds.height) * (actionSteps - 1)),
      ),
    );
    return actionBase + row * actionSteps + column;
  };
  const update = (event: PointerEvent<HTMLCanvasElement>) => {
    const action = actionAt(event);
    if (action === lastAction.current) return;
    lastAction.current = action;
    onAction(action, true);
  };
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    onAction(lastAction.current, false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <canvas
      ref={canvas}
      className="pw-rack-path-trackpad"
      aria-label={t("display.pathTrackpad")}
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
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        lastAction.current = -1;
        update(event);
      }}
      onPointerMove={(event) => {
        if (dragging.current) update(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
