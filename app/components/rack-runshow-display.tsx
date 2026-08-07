import { useRef, type PointerEvent } from "react";
import { useI18n } from "../i18n/provider";

const BAR_WIDTH = 20;
const BAR_SPACING = 4;
const BAR_COUNT = 6;
const BARS_WIDTH = 150;
const BARS_HEIGHT = 200;
const FIRST_BAR_X = (BARS_WIDTH - (BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_SPACING)) / 2;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const finite = (value: number | undefined, fallback = 0) =>
  Number.isFinite(value) ? Number(value) : fallback;

function padded(value: number, digits: number) {
  return Math.max(0, Math.trunc(value)).toString().padStart(digits, "0");
}

function segmentedFill(x: number, fillHeight: number, divisions: number) {
  if (!(fillHeight > 0)) return null;
  const segmentHeight = BARS_HEIGHT / divisions;
  const fillTop = BARS_HEIGHT - fillHeight;
  return Array.from({ length: divisions }, (_, segment) => {
    let top = BARS_HEIGHT - (segment + 1) * segmentHeight;
    let bottom = BARS_HEIGHT - segment * segmentHeight;
    if (segment > 0) bottom -= 0.5;
    if (segment < divisions - 1) top += 0.5;
    const actualTop = Math.max(fillTop, top);
    if (fillTop >= bottom || actualTop >= bottom) return null;
    return (
      <rect
        key={segment}
        x={x + 1}
        y={actualTop}
        width={BAR_WIDTH - 2}
        height={bottom - actualTop}
        fill="rgb(255,255,255)"
      />
    );
  });
}

export function RackRunshowDisplay({
  values,
  maxParam,
  time,
  bars,
  scaleX,
  onParam,
  onParamReset,
}: {
  values?: number[];
  maxParam: number;
  time: { x: number; y: number; width: number; height: number };
  bars: { x: number; y: number; width: number; height: number };
  scaleX: number;
  onParam: (id: number, value: number) => void;
  onParamReset: (id: number, value: number) => void;
}) {
  const { t } = useI18n();
  const dragging = useRef<{ pointerId: number; value: number; lastY: number } | null>(null);
  const elapsedSeconds = Math.max(0, finite(values?.[0]));
  const currentBarCount = Math.max(0, Math.trunc(finite(values?.[1])));
  const clockCount = Math.max(0, Math.trunc(finite(values?.[2])));
  const running = finite(values?.[3]) !== 0;
  const maxMinutes = clamp(Math.round(finite(values?.[4], 5)), 1, 60);
  const barLengths = [5, 6, 7, 8].map((offset) => clamp(finite(values?.[offset], 16), 1, 16));
  const minutes = Math.trunc(elapsedSeconds / 60) % 1000;
  const seconds = Math.trunc(elapsedSeconds) % 60;
  const hundredths = Math.trunc((elapsedSeconds - Math.floor(elapsedSeconds)) * 100);
  const timeString = `${minutes}:${padded(seconds, 2)}:${padded(hundredths, 2)}`;
  const barString = `${padded(currentBarCount + 1, 3)}:${(Math.trunc(clockCount / 4) % 4) + 1}:${(clockCount % 4) + 1}`;
  const fixedCurrentBar = Math.trunc((clockCount % 64) / 16);
  const totalCycleClocks = Math.max(
    1,
    Math.trunc(barLengths.reduce((sum, value) => sum + value, 0)),
  );
  const clocksInCycle = clockCount % totalCycleClocks;
  let cycleBar = 0;
  let clocksInCurrentBar = clocksInCycle;
  const firstEnd = barLengths[0];
  const secondEnd = firstEnd + barLengths[1];
  const thirdEnd = secondEnd + barLengths[2];
  if (clocksInCycle < firstEnd) {
    cycleBar = 0;
  } else if (clocksInCycle < secondEnd) {
    cycleBar = 1;
    clocksInCurrentBar -= firstEnd;
  } else if (clocksInCycle < thirdEnd) {
    cycleBar = 2;
    clocksInCurrentBar -= secondEnd;
  } else {
    cycleBar = 3;
    clocksInCurrentBar -= thirdEnd;
  }
  const fills = Array.from({ length: BAR_COUNT }, (_, index) => {
    if (index === 0) return BARS_HEIGHT * Math.min(elapsedSeconds / 60 / maxMinutes, 1);
    if (index === 1) return BARS_HEIGHT * Math.min(elapsedSeconds / 60 / 15, 1);
    const barIndex = index - 2;
    const length = barLengths[barIndex];
    if (barIndex === cycleBar) return BARS_HEIGHT * (clocksInCurrentBar / length) * (length / 16);
    if (
      barIndex < cycleBar ||
      (cycleBar === 0 && barIndex > 0 && clocksInCycle >= totalCycleClocks - 1)
    )
      return BARS_HEIGHT * (length / 16);
    return 0;
  });
  const maxLineY = BARS_HEIGHT * (1 - maxMinutes / 60);

  const point = (event: { currentTarget: SVGSVGElement; clientX: number; clientY: number }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: rect.width ? ((event.clientX - rect.left) / rect.width) * BARS_WIDTH : 0,
      y: rect.height ? ((event.clientY - rect.top) / rect.height) * BARS_HEIGHT : 0,
    };
  };
  const isMaxLine = ({ x, y }: { x: number; y: number }) =>
    x >= FIRST_BAR_X && x <= FIRST_BAR_X + BAR_WIDTH && Math.abs(y - maxLineY) <= 8;
  const release = (event: PointerEvent<SVGSVGElement>) => {
    if (dragging.current?.pointerId !== event.pointerId) return;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <>
      <svg
        className="pw-rack-runshow-timecode"
        aria-label={t("display.runshowTimecode")}
        viewBox={`0 0 ${time.width} ${time.height}`}
        style={{
          position: "absolute",
          left: time.x * scaleX,
          top: time.y,
          width: time.width * scaleX,
          height: time.height,
        }}
      >
        <rect width={time.width} height={time.height} fill="rgb(20,20,20)" />
        <rect
          x="0.5"
          y="0.5"
          width={time.width - 1}
          height={time.height - 1}
          fill="none"
          stroke="rgb(60,60,60)"
          strokeWidth="1"
        />
        <text
          x={time.width / 2}
          y="12"
          fill="rgb(0,255,100)"
          fontFamily="Arial, sans-serif"
          fontSize="14"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {timeString}
        </text>
        <text
          x={time.width / 2}
          y="28"
          fill="rgb(255,200,0)"
          fontFamily="Arial, sans-serif"
          fontSize="14"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {barString}
        </text>
      </svg>
      <svg
        className="pw-rack-runshow-progress"
        aria-label={t("display.runshowProgress")}
        viewBox={`0 0 ${BARS_WIDTH} ${BARS_HEIGHT}`}
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: bars.x * scaleX,
          top: bars.y,
          width: bars.width * scaleX,
          height: bars.height,
          overflow: "visible",
          touchAction: "none",
        }}
        onPointerDown={(event) => {
          if (event.button > 0 || !isMaxLine(point(event))) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = {
            pointerId: event.pointerId,
            value: maxMinutes,
            lastY: event.clientY,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragging.current;
          if (drag?.pointerId !== event.pointerId) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const sourceDeltaY = rect.height
            ? ((event.clientY - drag.lastY) / rect.height) * BARS_HEIGHT
            : 0;
          drag.lastY = event.clientY;
          drag.value = clamp(drag.value - sourceDeltaY * 0.25, 1, 60);
          onParam(maxParam, Math.round(drag.value));
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onDoubleClick={(event) => {
          if (!isMaxLine(point(event))) return;
          event.preventDefault();
          event.stopPropagation();
          onParamReset(maxParam, 5);
        }}
      >
        <rect width={BARS_WIDTH} height={BARS_HEIGHT} fill="rgb(20,20,20)" />
        {Array.from({ length: BAR_COUNT }, (_, index) => {
          const x = FIRST_BAR_X + index * (BAR_WIDTH + BAR_SPACING);
          return (
            <g key={index}>
              <rect
                x={x}
                y="0"
                width={BAR_WIDTH}
                height={BARS_HEIGHT}
                fill="none"
                stroke="rgb(60,60,60)"
                strokeWidth="1"
              />
              {segmentedFill(x, fills[index], index === 0 ? 6 : index === 1 ? 15 : 4)}
              {index >= 2 && index - 2 === fixedCurrentBar && running ? (
                <rect
                  x={x}
                  y={BARS_HEIGHT - fills[index] - 1}
                  width={BAR_WIDTH}
                  height="2"
                  fill="rgb(255,133,133)"
                />
              ) : null}
              <text
                x={x + BAR_WIDTH / 2}
                y={BARS_HEIGHT + 2}
                fill="rgb(255,255,255)"
                fontFamily="Arial, sans-serif"
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="hanging"
              >
                {index === 0 ? `${maxMinutes}m` : index === 1 ? "1m" : String(index - 1)}
              </text>
            </g>
          );
        })}
        <line
          className="pw-rack-runshow-max-line"
          x1={FIRST_BAR_X}
          x2={FIRST_BAR_X + BAR_WIDTH}
          y1={maxLineY}
          y2={maxLineY}
          stroke="rgb(255,255,0)"
          strokeWidth="2"
        />
      </svg>
    </>
  );
}
