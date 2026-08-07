import { useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

export function RackVerticalPosition({
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
  const lastAction = useRef(actionBase);
  const position = Math.max(0, Math.min(1, values?.[0] ?? 1));
  const actionAt = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const normalized = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    return actionBase + Math.round(normalized * (actionSteps - 1));
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const action = actionAt(event);
    if (lastAction.current === action) return;
    lastAction.current = action;
    onAction(action, true);
  };
  const release = (event: PointerEvent<SVGSVGElement>) => {
    onAction(lastAction.current, false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <svg
      className="pw-rack-vertical-position"
      aria-label={t("display.verticalPosition")}
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
        lastAction.current = actionAt(event);
        onAction(lastAction.current, true);
      }}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <ellipse cx={width / 2} cy={position * height} rx={width / 2} ry="7" fill="#00ff008c" />
      <line x1="0" y1={position * height} x2={width} y2={position * height} stroke="#ffffff8c" />
    </svg>
  );
}
