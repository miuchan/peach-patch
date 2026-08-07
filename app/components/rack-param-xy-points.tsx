import { useState, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

type PointSpec = {
  xParam: number;
  yParam: number;
  label: string;
  shape: "circle" | "square";
  color: string;
};

export function RackParamXyPoints({
  params,
  samples,
  points,
  widthParam,
  heightParam,
  gridSize,
  pointSize,
  gridColor,
  x,
  y,
  width,
  height,
  scaleX,
  onParam,
}: {
  params: number[];
  samples?: number[][];
  points: PointSpec[];
  widthParam: number;
  heightParam: number;
  gridSize: number;
  pointSize: number;
  gridColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onParam: (id: number, value: number) => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(-1);
  const widthCv = samples?.[0]?.at(-1) ?? 0;
  const heightCv = samples?.[1]?.at(-1) ?? 0;
  const boundWidth = Math.max(0.02, Math.min(1, (params[widthParam] ?? 0.9) + widthCv / 10));
  const boundHeight = Math.max(0.02, Math.min(1, (params[heightParam] ?? 0.9) + heightCv / 10));
  const rendered = points.map((point) => ({
    ...point,
    x: ((params[point.xParam] ?? 0) + 1) * width * 0.5,
    y: (1 - (params[point.yParam] ?? 0)) * height * 0.5,
  }));

  const pointerPosition = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) * width) / Math.max(1, bounds.width),
      y: ((event.clientY - bounds.top) * height) / Math.max(1, bounds.height),
    };
  };
  const hitTest = (event: PointerEvent<SVGSVGElement>) => {
    const pointer = pointerPosition(event);
    for (let index = rendered.length - 1; index >= 0; index--)
      if (
        Math.abs(pointer.x - rendered[index].x) < pointSize &&
        Math.abs(pointer.y - rendered[index].y) < pointSize
      )
        return index;
    return -1;
  };
  const moveSelected = (event: PointerEvent<SVGSVGElement>) => {
    if (selected < 0) return;
    const pointer = pointerPosition(event);
    const relativeX = Math.max(-boundWidth, Math.min(boundWidth, (pointer.x / width) * 2 - 1));
    const relativeY = Math.max(-boundHeight, Math.min(boundHeight, (pointer.y / height) * 2 - 1));
    onParam(points[selected].xParam, relativeX);
    onParam(points[selected].yParam, -relativeY);
  };

  const boundLeft = ((1 - boundWidth) * width) / 2;
  const boundTop = ((1 - boundHeight) * height) / 2;
  return (
    <svg
      className="pw-rack-param-xy-points"
      aria-label={t("display.paramXyPoints")}
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
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) moveSelected(event);
        else setSelected(hitTest(event));
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const hit = hitTest(event);
        if (hit < 0) return;
        event.preventDefault();
        event.stopPropagation();
        setSelected(hit);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        setSelected(-1);
      }}
      onPointerLeave={() => setSelected(-1)}
    >
      <rect
        x={boundLeft}
        y={boundTop}
        width={boundWidth * width}
        height={boundHeight * height}
        fill="none"
        stroke={gridColor}
      />
      <g stroke={gridColor} opacity="0.2">
        {Array.from({ length: gridSize - 1 }, (_, index) => {
          const offsetX = ((index + 1) * width) / gridSize;
          const offsetY = ((index + 1) * height) / gridSize;
          return (
            <g key={`grid-${index}`}>
              <line x1={offsetX} y1="0" x2={offsetX} y2={height} />
              <line x1="0" y1={offsetY} x2={width} y2={offsetY} />
              <line x1={offsetX} y1={boundTop} x2={offsetX} y2={boundTop + boundHeight * height} />
              <line x1={boundLeft} y1={offsetY} x2={boundLeft + boundWidth * width} y2={offsetY} />
            </g>
          );
        })}
      </g>
      {rendered.map((point, index) =>
        index === selected ? (
          <g key={point.label}>
            {point.shape === "circle" ? (
              <circle
                cx={point.x}
                cy={point.y}
                r={pointSize / 2}
                fill={point.color}
                stroke={point.color}
                strokeOpacity="0.4"
                strokeWidth="2"
              />
            ) : (
              <rect
                x={point.x - pointSize / 2}
                y={point.y - pointSize / 2}
                width={pointSize}
                height={pointSize}
                fill={point.color}
                stroke={point.color}
                strokeOpacity="0.4"
                strokeWidth="2"
              />
            )}
            <text
              x={point.x}
              y={point.y - 0.4}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#191413"
              fontSize="12"
            >
              {point.label}
            </text>
          </g>
        ) : (
          <text
            key={point.label}
            x={point.x}
            y={point.y - 0.4}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={point.color}
            fontSize="12"
          >
            {point.label}
          </text>
        ),
      )}
    </svg>
  );
}
