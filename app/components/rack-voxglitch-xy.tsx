import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

type Point = { x: number; y: number };

export function RackVoxglitchXy({
  values,
  tabletMode,
  actionBase,
  hoverActionBase,
  actionSteps,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  tabletMode: boolean;
  actionBase: number;
  hoverActionBase: number;
  actionSteps: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const [localPoint, setLocalPoint] = useState<Point | null>(null);
  const [trail, setTrail] = useState<Point[]>([]);
  const lastAction = useRef(actionBase);
  const telemetryX = Math.max(0, Math.min(width, values?.[0] ?? 0));
  const telemetryY = Math.max(0, Math.min(height, values?.[1] ?? 0));
  const telemetryPoint = { x: telemetryX, y: telemetryY };
  const point = localPoint ?? telemetryPoint;

  useEffect(() => {
    setTrail((current) => [...current, { x: telemetryX, y: telemetryY }].slice(-10));
  }, [telemetryX, telemetryY]);

  const encodedPosition = (event: PointerEvent<SVGSVGElement>, base: number) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = Math.max(
      0,
      Math.min(width, ((event.clientX - bounds.left) * width) / Math.max(1, bounds.width)),
    );
    const py = Math.max(
      0,
      Math.min(height, ((event.clientY - bounds.top) * height) / Math.max(1, bounds.height)),
    );
    const xStep = Math.round((px / width) * (actionSteps - 1));
    const yStep = Math.round((py / height) * (actionSteps - 1));
    const id = base + xStep + yStep * actionSteps;
    setLocalPoint({ x: px, y: py });
    lastAction.current = id;
    return id;
  };

  return (
    <svg
      className="pw-rack-voxglitch-xy"
      aria-label={t("display.voxglitchXy")}
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
        onAction(encodedPosition(event, actionBase), true);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.preventDefault();
          onAction(encodedPosition(event, actionBase), true);
        } else if (tabletMode) {
          onAction(encodedPosition(event, hoverActionBase), true);
        }
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        onAction(lastAction.current, false);
        setLocalPoint(null);
      }}
      onPointerCancel={() => {
        onAction(lastAction.current, false);
        setLocalPoint(null);
      }}
    >
      {trail.map((position, index) => {
        const alpha = index === 9 ? 1 : Math.max(0, (30 - index * 3) / 255);
        return (
          <rect
            key={`${index}-${position.x}-${position.y}`}
            x="0"
            y={position.y}
            width={position.x}
            height={height - position.y}
            fill={`rgba(255,255,255,${alpha})`}
          />
        );
      })}
      <g stroke="#dddddd" strokeWidth="0.5">
        <line x1={point.x} y1="0" x2={point.x} y2={height} />
        <line x1="0" y1={point.y} x2={width} y2={point.y} />
      </g>
    </svg>
  );
}
