export function RackPanelColor({
  values,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  width: number;
  height: number;
  scaleX: number;
}) {
  const red = Math.max(0, Math.min(1, values?.[0] ?? 0.75));
  const green = Math.max(0, Math.min(1, values?.[1] ?? 1));
  const blue = Math.max(0, Math.min(1, values?.[2] ?? 0.5));
  const hsl = Math.round(values?.[3] ?? 1) === 1;
  const color = hsl
    ? `hsl(${red * 360} ${green * 100}% ${blue * 100}%)`
    : `rgb(${red * 255} ${green * 255} ${blue * 255})`;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: width * scaleX,
        height,
        background: color,
        pointerEvents: "none",
      }}
    />
  );
}
