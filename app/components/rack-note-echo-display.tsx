function decimalText(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 0.9975) return "   1";
  if (absolute < 0.005) return "   0";
  return `0.${String(Math.round(absolute * 100)).padStart(2, "0")}`;
}

function displayText({
  tap,
  params,
  wetOnly,
  notifiedParam,
  tapParam,
  semiParam,
  cv2Param,
  probabilityParam,
  randomSemiParam,
  cv2ModeParam,
  polyParam,
}: {
  tap: number;
  params: number[];
  wetOnly: boolean;
  notifiedParam: number | null;
  tapParam: number;
  semiParam: number;
  cv2Param: number;
  probabilityParam: number;
  randomSemiParam: number;
  cv2ModeParam: number;
  polyParam: number;
}) {
  if (notifiedParam === semiParam) {
    const value = Math.round(params[semiParam] ?? 0);
    return value === 0
      ? "   0"
      : `${value > 0 ? "+" : "-"} ${String(Math.abs(value)).padStart(2, " ")}`;
  }
  if (notifiedParam === cv2Param) {
    const value = params[cv2Param] ?? 0;
    if ((params[cv2ModeParam] ?? 1) >= 0.5) {
      const offset = Math.abs(value) * 10;
      if (offset > 9.975) return "  10";
      if (offset < 0.025) return "   0";
      return offset.toFixed(2).slice(0, 4);
    }
    return decimalText(value);
  }
  if (notifiedParam === probabilityParam) return decimalText(params[probabilityParam] ?? 0);
  if (notifiedParam === randomSemiParam)
    return `  ${String(Math.abs(Math.round(params[randomSemiParam] ?? 0))).padStart(2, " ")}`;
  const delay = Math.round(params[tapParam] ?? 0);
  if (delay < 1) return "  - ";
  const activeTaps = [0, 1, 2, 3].filter((index) => (params[index] ?? 0) >= 0.5).length,
    lastTapAllowed = (params[polyParam] ?? 1) < 4 || activeTaps < 4 || wetOnly;
  if (tap === 3 && !lastTapAllowed) return "O VF";
  return `D ${String(delay).padStart(2, " ")}`;
}

export function RackNoteEchoDisplay({
  params,
  wetOnly,
  notifiedParam,
  scaleX = 1,
  ...visual
}: {
  params: number[];
  wetOnly: boolean;
  notifiedParam: number | null;
  tapParam: number;
  semiParam: number;
  cv2Param: number;
  probabilityParam: number;
  randomSemiParam: number;
  cv2ModeParam: number;
  polyParam: number;
  tap: number;
  width: number;
  height: number;
  x: number;
  y: number;
  scaleX?: number;
}) {
  const text = displayText({ ...visual, params, wetOnly, notifiedParam });
  return (
    <div
      className="pw-note-echo-display"
      style={{
        left: (visual.x - visual.width / 2) * scaleX,
        top: visual.y - visual.height / 2,
        width: visual.width * scaleX,
        height: visual.height,
      }}
      aria-label={`Note Echo tap ${visual.tap + 1}: ${text.trim()}`}
    >
      <span aria-hidden="true">~~~~</span>
      <b>{text}</b>
    </div>
  );
}
