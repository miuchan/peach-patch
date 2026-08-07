export function RackPaletteEngineSelector({
  values,
  positions,
  actionBase,
  width,
  height,
  x,
  y,
  scaleX,
  onAction,
}: {
  values?: number[];
  positions: Array<[number, number]>;
  actionBase: number;
  width: number;
  height: number;
  x: number;
  y: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const baseEngine = Math.max(0, Math.min(15, Math.round(values?.[0] ?? 0)));
  const voices = Math.max(0, Math.min(16, Math.round(values?.[1] ?? 0)));
  const activeEngines = (values ?? [])
    .slice(2, 2 + voices)
    .map((value) => Math.max(0, Math.min(15, Math.round(value))));
  return (
    <svg
      aria-label="Palette engine selector"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        zIndex: 9,
        overflow: "visible",
      }}
    >
      {positions.map(([cx, cy], index) => (
        <g key={index}>
          <circle cx={cx} cy={cy} r={3.5} fill={baseEngine % 8 === index ? "#848484" : "#000"} />
          {activeEngines.map((engine, voice) =>
            engine % 8 === index ? (
              <circle
                key={voice}
                cx={cx}
                cy={cy}
                r={1.5}
                fill={engine < 8 ? "#00b591" : "#ea554e"}
              />
            ) : null,
          )}
          <circle
            cx={cx}
            cy={cy}
            r={3.5}
            fill="transparent"
            role="button"
            tabIndex={0}
            aria-label={`Select engine ${baseEngine - (baseEngine % 8) + index + 1}`}
            style={{ cursor: "pointer" }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAction(actionBase + index, true);
              onAction(actionBase + index, false);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onAction(actionBase + index, true);
              onAction(actionBase + index, false);
            }}
          />
        </g>
      ))}
    </svg>
  );
}
