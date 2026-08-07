import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

export function RackFwCellBarGrid({
  values,
  actionBase,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const initialX = useRef(0);
  const lastCell = useRef(-1);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "rgb(20,30,33)";
    context.fillRect(0, 0, width, height);
    const columns = Math.max(1, Math.round(values?.[0] ?? 128));
    const rows = Math.max(0, Math.round(values?.[1] ?? 0));
    const axis = values?.[2] ?? 0;
    for (let row = 0; row < rows; row += 1) {
      const value = values?.[5 + row] ?? 0;
      const right = value >= axis;
      const gradient = context.createLinearGradient(
        right ? axis : 0,
        0,
        right ? columns : columns - axis,
        0,
      );
      if (right) {
        gradient.addColorStop(0, "rgba(58,163,39,0.12549)");
        gradient.addColorStop(1, "rgb(58,163,39)");
      } else {
        gradient.addColorStop(0, "rgb(58,163,39)");
        gradient.addColorStop(1, "rgba(58,163,39,0.12549)");
      }
      context.fillStyle = gradient;
      context.fillRect(axis + (right ? 0 : 1), row * 8, value + (right ? 1 : -1) - axis, 8);
    }
    if ((values?.[3] ?? 0) > 0) {
      context.strokeStyle = "rgba(26,19,199,0.941176)";
      context.lineWidth = 1;
      const pin = (values?.[4] ?? 0) * (columns - 1) + 1;
      context.beginPath();
      context.moveTo(pin, 0);
      context.lineTo(pin, rows * 8);
      context.stroke();
    }
  }, [height, values, width]);

  const cellAt = (event: PointerEvent<HTMLCanvasElement>, lockX: boolean) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - bounds.left) / bounds.width) * width;
    const localY = ((event.clientY - bounds.top) / bounds.height) * height;
    const columns = Math.max(1, Math.round(values?.[0] ?? 128));
    const rows = Math.max(1, Math.round(values?.[1] ?? height / 8));
    const column = Math.max(
      0,
      Math.min(columns - 1, Math.floor(lockX ? initialX.current : localX)),
    );
    const row = Math.max(0, Math.min(rows - 1, Math.floor(localY / 8)));
    return { column, row, columns };
  };
  const applyCell = (event: PointerEvent<HTMLCanvasElement>, lockX: boolean) => {
    const { column, row, columns } = cellAt(event, lockX);
    const encoded = row * columns + column;
    if (encoded === lastCell.current) return;
    lastCell.current = encoded;
    const action = actionBase + encoded;
    onAction(action, true);
    onAction(action, false);
  };
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    lastCell.current = -1;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <canvas
      ref={canvas}
      className="pw-rack-fw-cell-bar-grid"
      aria-label={t("display.fwCellBarGrid")}
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
        const bounds = event.currentTarget.getBoundingClientRect();
        initialX.current = ((event.clientX - bounds.left) / bounds.width) * width;
        event.currentTarget.setPointerCapture(event.pointerId);
        applyCell(event, false);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        applyCell(event, event.shiftKey);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
