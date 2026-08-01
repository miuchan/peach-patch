export function RackRkdDividers({
  values,
  scaleX,
}: {
  values?: number[];
  scaleX: number;
}) {
  const labels = Array.from({ length: 8 }, (_, row) => {
    const first = Math.round(values?.[row * 2] ?? 45);
    const second = Math.round(values?.[row * 2 + 1] ?? 45);
    return String.fromCharCode(first || 32, second || 32);
  });
  return (
    <span
      aria-label={`Dividers ${labels.join(", ")}`}
      style={{
        position: "absolute",
        zIndex: 7,
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {labels.map((label, row) => (
        <b
          key={row}
          style={{
            position: "absolute",
            left: 16 * scaleX,
            top: 102 + row * 30,
            width: 17 * scaleX,
            height: 18,
            color: "#6cffff",
            filter: "drop-shadow(0 0 3px #6cffffaa)",
            font: `${14 * scaleX}px var(--mono)`,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
            letterSpacing: -1,
            lineHeight: "18px",
            whiteSpace: "pre",
          }}
        >
          {label}
        </b>
      ))}
    </span>
  );
}
