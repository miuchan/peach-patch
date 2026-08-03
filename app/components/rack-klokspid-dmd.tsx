function text(values: number[] | undefined, offset: number, length: number) {
  return String.fromCharCode(
    ...Array.from({ length }, (_, index) => Math.round(values?.[offset + index] ?? 0)),
  ).replace(/\0.*$/, "");
}

export function RackKlokSpidDmd({ values, scaleX }: { values?: number[]; scaleX: number }) {
  const main1 = text(values, 0, 24);
  const main2 = text(values, 24, 24);
  const outputs = Array.from({ length: 4 }, (_, index) => text(values, 48 + index * 4, 4));
  const offsets = Array.from({ length: 5 }, (_, index) => values?.[64 + index] ?? 0);
  const theme = Math.round(values?.[69] ?? 0);
  const color =
    ["#080808", "#f2b42f", "#1b1b09", "#e8bd37", "#7de7ff", "#262626"][theme] ?? "#080808";
  const labelStyle = {
    position: "absolute",
    zIndex: 7,
    color,
    filter: theme === 2 ? "none" : `drop-shadow(0 0 2px ${color}88)`,
    fontFamily: "var(--mono)",
    fontWeight: 500,
    whiteSpace: "pre",
    pointerEvents: "none",
  } as const;
  return (
    <>
      <span
        style={{
          ...labelStyle,
          left: 14 * scaleX,
          top: 46,
          fontSize: 16 * scaleX,
          letterSpacing: -2 * scaleX,
        }}
      >
        {main1}
      </span>
      <span
        style={{
          ...labelStyle,
          left: (12 + offsets[0]) * scaleX,
          top: 67,
          fontSize: 20 * scaleX,
          letterSpacing: -scaleX,
        }}
      >
        {main2}
      </span>
      {outputs.map((value, index) => {
        const left = (index % 2 ? 62.5 : 35) + offsets[index + 1],
          top = index < 2 ? 282 : 296;
        return (
          <span
            key={index}
            style={{
              ...labelStyle,
              left: left * scaleX,
              top,
              fontSize: 14 * scaleX,
              letterSpacing: -scaleX,
            }}
          >
            {value}
          </span>
        );
      })}
    </>
  );
}
