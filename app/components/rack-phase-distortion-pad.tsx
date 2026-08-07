import { useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function RackPhaseDistortionPad({
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
  const activeAction = useRef<number | null>(null);
  const phaseX = clamp01(values?.[0] ?? 0.5);
  const phaseY = clamp01(values?.[1] ?? 0.5);
  const pointX = phaseX * width;
  const pointY = (1 - phaseY) * height;

  const actionAt = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const normalizedX = clamp01((event.clientX - bounds.left) / Math.max(1, bounds.width));
    const normalizedY = clamp01((event.clientY - bounds.top) / Math.max(1, bounds.height));
    const encodedX = Math.round(normalizedX * (actionSteps - 1));
    const encodedY = Math.round(normalizedY * (actionSteps - 1));
    return actionBase + encodedY * actionSteps + encodedX;
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const action = actionAt(event);
    if (activeAction.current === action) return;
    if (activeAction.current !== null) onAction(activeAction.current, false);
    activeAction.current = action;
    onAction(action, true);
  };
  const release = (event: PointerEvent<SVGSVGElement>) => {
    if (activeAction.current !== null) onAction(activeAction.current, false);
    activeAction.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <svg
      className="pw-rack-phase-distortion-pad"
      aria-label={t("display.phaseDistortionPad")}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
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
        move(event);
      }}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <path d={`M 0 ${height / 2} H ${width} M ${width / 2} 0 V ${height}`} stroke="#ffffff80" />
      <path d={`M 0 ${height} L ${pointX} ${pointY} L ${width} 0`} fill="none" stroke="#2a5775" />
    </svg>
  );
}
