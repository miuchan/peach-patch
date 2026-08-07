import { useRef, useState, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const SEMITONE_COLORS = [2, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
const QUARTERTONE_COLORS = [4, 1, 0, 3, 2, 1, 0, 3, 2, 3, 2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0, 3, 2, 3];
const KEY_FILL = ["#40404073", "#d5d5d550", "#f6f6f6a0", "#d5d5d550", "#ffccaaa0"];

function bounded(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function RackTouchRibbon({
  actionBase,
  actionSteps,
  octaves,
  showGuides,
  guideType,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  actionBase: number;
  actionSteps: number;
  octaves: number;
  showGuides: boolean;
  guideType: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const lastAction = useRef(actionBase);
  const octaveCount = bounded(Math.round(octaves), 1, 5);
  const normalizedGuideType = bounded(Math.round(guideType), 0, 2);
  const divisions = octaveCount * (normalizedGuideType === 1 ? 24 : 12) + 1;
  const keyWidth = width / divisions;

  const update = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const normalizedX = bounded((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    const normalizedY = bounded((event.clientY - bounds.top) / Math.max(1, bounds.height), 0, 1);
    const xStep = Math.round(normalizedX * (actionSteps - 1));
    const yStep = Math.round(normalizedY * (actionSteps - 1));
    const id = actionBase + xStep + yStep * actionSteps;
    lastAction.current = id;
    setPoint({ x: normalizedX * width, y: normalizedY * height });
    onAction(id, true);
  };

  const release = (event?: PointerEvent<SVGSVGElement>) => {
    if (event?.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    onAction(lastAction.current, false);
    setPoint(null);
  };

  return (
    <svg
      className="pw-rack-touch-ribbon"
      aria-label={t("display.touchRibbon")}
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
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
          return;
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
        if (point) {
          onAction(lastAction.current, false);
          setPoint(null);
        }
      }}
    >
      <rect width={width} height={height} fill="#202020" />
      {showGuides && normalizedGuideType < 2
        ? Array.from({ length: divisions }, (_, index) => {
            const colorIndex =
              normalizedGuideType === 1
                ? QUARTERTONE_COLORS[index % 24]
                : SEMITONE_COLORS[index % 12];
            return (
              <rect
                key={`key-${index}`}
                x={keyWidth * index + 1}
                y="1"
                width={Math.max(0, keyWidth - 1.5)}
                height={height - 25}
                fill={KEY_FILL[colorIndex]}
              />
            );
          })
        : null}
      {showGuides && normalizedGuideType < 2
        ? Array.from({ length: divisions - 1 }, (_, index) => (
            <line
              key={`divider-${index}`}
              x1={keyWidth * (index + 1)}
              y1={height - 25}
              x2={keyWidth * (index + 1)}
              y2="0"
              stroke="#00000040"
              strokeWidth="2"
            />
          ))
        : null}
      {showGuides && normalizedGuideType === 2
        ? Array.from({ length: octaveCount + 1 }, (_, octave) => {
            const marker = keyWidth * octave * 12 + keyWidth / 2;
            return (
              <line
                key={`octave-${octave}`}
                x1={marker}
                y1={height - 25}
                x2={marker}
                y2="0"
                stroke="#ffffff40"
              />
            );
          })
        : null}
      {point ? (
        <g fill="#ffccaaa0" stroke="#ffccaaa0" strokeWidth="2">
          <line x1={point.x} y1={height - 5} x2={point.x} y2={point.y + 22} />
          <circle cx={point.x} cy={point.y} r="20" stroke="none" />
        </g>
      ) : null}
      <line x1="0" y1={height - 24} x2={width} y2={height - 24} stroke="#ffccaa" />
    </svg>
  );
}
