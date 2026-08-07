import { useRef, useState, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

export function RackLinearRibbon({
  actionBase,
  actionSteps,
  margin,
  radius,
  color,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  actionBase: number;
  actionSteps: number;
  margin: number;
  radius: number;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const [position, setPosition] = useState<number | null>(null);
  const lastAction = useRef(actionBase);
  const update = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawX = ((event.clientX - bounds.left) * width) / Math.max(1, bounds.width);
    const normalized = Math.max(0, Math.min(1, (rawX - margin) / Math.max(1, width - 2 * margin)));
    const step = Math.round(normalized * (actionSteps - 1));
    lastAction.current = actionBase + step;
    setPosition(margin + normalized * (width - 2 * margin));
    onAction(lastAction.current, true);
  };
  const release = (event?: PointerEvent<SVGSVGElement>) => {
    if (event?.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    onAction(lastAction.current, false);
    setPosition(null);
  };
  return (
    <svg
      className="pw-rack-linear-ribbon"
      aria-label={t("display.linearRibbon")}
      viewBox={`0 0 ${width} ${height}`}
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
        update(event);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        update(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => {
        if (position !== null) release();
      }}
    >
      {position === null ? null : <circle cx={position} cy={height / 2} r={radius} fill={color} />}
    </svg>
  );
}
