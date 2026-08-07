export function RackValueLabel({
  value,
  x,
  y,
  width,
  height,
  color,
  background,
  borderColor,
  fontSize,
  scaleX,
}: {
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  background: string;
  borderColor?: string;
  fontSize: number;
  scaleX: number;
}) {
  return (
    <div
      role="img"
      aria-label={String(Math.round(value))}
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        display: "grid",
        placeItems: "center",
        boxSizing: "border-box",
        color,
        background,
        border: borderColor ? `1px solid ${borderColor}` : undefined,
        font: `${fontSize}px ui-sans-serif, system-ui, sans-serif`,
        lineHeight: 1,
        pointerEvents: "none",
      }}
    >
      {Math.round(value)}
    </div>
  );
}
