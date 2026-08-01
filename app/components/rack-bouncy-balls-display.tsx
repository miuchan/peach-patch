import { type PointerEvent } from "react";

const BALL_COLORS = ["#ff9709", "#fff309", "#901afc", "#1996fc"];

export function RackBouncyBallsDisplay({
  values,
  x,
  y,
  width,
  height,
  displayWidth,
  displayHeight,
  actionBase,
  paddleXState,
  paddleYState,
  scaleX,
  onState,
  onMomentary,
}: {
  values?: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  actionBase: number;
  paddleXState: number;
  paddleYState: number;
  scaleX: number;
  onState: (updates: Array<[id: number, value: number]>) => void;
  onMomentary: (id: number, active: boolean) => void;
}) {
  const fallback = [176, 181.2, 206, 181.2, 236, 181.2, 266, 181.2, 174, 346, 1, 1],
    visual = values?.length === 12 ? values : fallback,
    locked = visual[11] >= 0.5;

  const movePaddle = (event: PointerEvent<SVGSVGElement>) => {
    if (locked) return;
    const rect = event.currentTarget.getBoundingClientRect(),
      px = (event.clientX - rect.left) * displayWidth / Math.max(1, rect.width),
      py = (event.clientY - rect.top) * displayHeight / Math.max(1, rect.height);
    onState([
      [paddleXState, Math.max(0, Math.min(displayWidth - 100, px - 50))],
      [paddleYState, Math.max(0, Math.min(displayHeight - 10, py))],
    ]);
  };

  const toggleLock = (event: PointerEvent<SVGSVGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onMomentary(actionBase, true);
    onMomentary(actionBase, false);
  };

  return (
    <svg
      className="pw-rack-bouncy-balls"
      aria-label={`Bouncy Balls animated display, paddle ${locked ? "locked" : "unlocked"}`}
      viewBox={`0 0 ${displayWidth} ${displayHeight}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", left: x * scaleX, top: y, width: width * scaleX, height }}
      onPointerMove={movePaddle}
      onPointerDown={toggleLock}
    >
      <rect width={displayWidth} height={displayHeight} fill="#000" />
      {visual[10] >= 0.5 ? <rect x={visual[8]} y={visual[9]} width="100" height="10" fill="#fff" /> : null}
      {BALL_COLORS.map((color, index) => (
        <circle
          key={color}
          cx={visual[index * 2]}
          cy={visual[index * 2 + 1]}
          r="10"
          fill={color}
          stroke={color}
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
