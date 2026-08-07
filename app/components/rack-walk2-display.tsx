import { useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const TRACE_COLORS = ["#00ff00", "#ff8000", "#ff0000", "#00ddff"];

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

export function RackWalk2Display({
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
  const historyPoints = Math.max(1, Math.min(100, Math.round(values?.[0] ?? 100)));
  const zoomOut = (values?.[1] ?? 0) > 0.5;
  const drawGrid = (values?.[2] ?? 1) > 0.5;
  const traceColor = TRACE_COLORS[clamp(Math.round(values?.[3] ?? 0), 0, 3)];
  const offsetX = clamp(values?.[4] ?? 0, -5, 5);
  const offsetY = clamp(values?.[5] ?? 0, -5, 5);
  const points = Array.from({ length: historyPoints }, (_, index) => ({
    x: values?.[6 + index] ?? 0,
    y: values?.[6 + historyPoints + index] ?? 0,
  }));
  const inset = 4;
  const drawWidth = 2 * (width - 2 * inset);
  const drawHeight = 2 * (height - 2 * inset);
  const midX = inset + drawWidth / 2;
  const midY = inset + drawHeight / 2;
  const transform = zoomOut
    ? "scale(.5)"
    : `translate(${(-(1 + offsetX / 5) * drawWidth) / 4} ${(-(1 - offsetY / 5) * drawHeight) / 4})`;
  const px = (voltage: number) => midX + 0.05 * drawWidth * voltage;
  const py = (voltage: number) => midY - 0.05 * drawHeight * voltage;

  const actionAt = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const normalizedX = clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    const normalizedY = clamp((event.clientY - bounds.top) / Math.max(1, bounds.height), 0, 1);
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
  const ticks = Array.from({ length: 10 }, (_, index) => index + 1);

  return (
    <svg
      className="pw-rack-walk2-display"
      aria-label={t("display.walk2")}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: "none",
        background: "#000",
        border: "1px solid #505050",
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
      <defs>
        <clipPath id={`walk2-${width}-${height}`}>
          <rect x={inset} y={inset} width={drawWidth / 2} height={drawHeight / 2} />
        </clipPath>
      </defs>
      <g clipPath={`url(#walk2-${width}-${height})`} transform={transform} stroke="#ffffff70">
        <path
          d={`M ${inset} ${midY} H ${inset + drawWidth} M ${midX} ${inset} V ${inset + drawHeight}`}
        />
        {ticks.map((tick) => {
          const amountX = tick * 0.05 * drawWidth;
          const amountY = tick * 0.05 * drawHeight;
          const size = tick % 5 === 0 ? 8 : 4;
          return (
            <g key={tick}>
              <path
                d={`M ${midX + amountX} ${midY - size} v ${size * 2} M ${midX - amountX} ${midY - size} v ${size * 2} M ${midX - size} ${midY + amountY} h ${size * 2} M ${midX - size} ${midY - amountY} h ${size * 2}`}
              />
              {drawGrid
                ? ticks.map((row) => {
                    const gridY = row * 0.05 * drawHeight;
                    return (
                      <path
                        key={`${tick}-${row}`}
                        d={`M ${midX + amountX - 0.5} ${midY + gridY} h 1 M ${midX - amountX - 0.5} ${midY + gridY} h 1 M ${midX - amountX - 0.5} ${midY - gridY} h 1 M ${midX + amountX - 0.5} ${midY - gridY} h 1`}
                      />
                    );
                  })
                : null}
            </g>
          );
        })}
        <g stroke={traceColor} fill={traceColor}>
          {points.slice(1).map((point, index) => {
            const recency = 1 - index / Math.max(1, historyPoints - 1);
            return (
              <line
                key={index}
                x1={px(points[index].x)}
                y1={py(points[index].y)}
                x2={px(point.x)}
                y2={py(point.y)}
                strokeOpacity={0.1 + 0.833 * recency}
                strokeWidth={0.5 + 2.5 * recency}
              />
            );
          })}
          <circle cx={px(points[0].x)} cy={py(points[0].y)} r="1.5" />
        </g>
      </g>
    </svg>
  );
}
