import type { PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

export function RackMorphPadDisplay({
  xParam,
  yParam,
  xValue,
  yValue,
  x,
  y,
  width,
  height,
  scaleX,
  onParam,
}: {
  xParam: number;
  yParam: number;
  xValue: number;
  yValue: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onParam: (id: number, value: number) => void;
}) {
  const { t } = useI18n();
  const selectorWidth = width / 2;
  const selectorHeight = height / 2;

  const updatePosition = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const normalizedX = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.25) * 2;
    const normalizedY = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.25) * 2;
    onParam(xParam, clampUnit(normalizedX));
    onParam(yParam, clampUnit(normalizedY));
  };

  return (
    <svg
      className="pw-rack-morph-pad"
      aria-label={t("display.morphPad")}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        zIndex: 5,
        touchAction: "none",
        cursor: "crosshair",
      }}
      onPointerDown={(event) => {
        if (event.button > 0) return;
        event.preventDefault();
        event.stopPropagation();
        updatePosition(event);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        updatePosition(event);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
    >
      <rect width={width} height={height} fill="transparent" />
      <rect
        x={clampUnit(xValue) * selectorWidth}
        y={clampUnit(yValue) * selectorHeight}
        width={selectorWidth}
        height={selectorHeight}
        fill="none"
        stroke="#999"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
