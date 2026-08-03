import { useId, useMemo } from "react";
import { useI18n } from "../i18n/provider";

export function RackMadzineScopeDisplay({
  values,
  points,
  tracks,
  range,
  colors,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  points: number;
  tracks: number;
  range: number;
  colors: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { t } = useI18n();
  const clipPrefix = useId().replaceAll(":", ""),
    trackHeight = height / Math.max(1, tracks),
    paths = useMemo(
      () =>
        Array.from({ length: tracks }, (_, track) =>
          Array.from({ length: points }, (_, index) => {
            const raw = values?.[track * points + index] ?? 0,
              value = Number.isFinite(raw) ? raw : 0,
              px = points > 1 ? (index / (points - 1)) * width : 0,
              py = track * trackHeight + trackHeight * 0.5 * (1 - value / Math.max(range, 1e-6));
            return `${index ? "L" : "M"}${px.toFixed(3)},${py.toFixed(3)}`;
          }).join(" "),
        ),
      [points, range, trackHeight, tracks, values, width],
    );

  return (
    <svg
      className="pw-rack-madzine-scope"
      aria-label={t("display.madzineOscilloscope", { tracks })}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        pointerEvents: "none",
      }}
    >
      <defs>
        {Array.from({ length: tracks }, (_, track) => (
          <clipPath id={`${clipPrefix}-${track}`} key={track}>
            <rect x="0" y={track * trackHeight} width={width} height={trackHeight} />
          </clipPath>
        ))}
      </defs>
      <rect width={width} height={height} fill="#141414" />
      {Array.from({ length: Math.max(0, tracks - 1) }, (_, index) => (
        <line
          key={index}
          x1="0"
          x2={width}
          y1={(index + 1) * trackHeight}
          y2={(index + 1) * trackHeight}
          stroke="rgba(255,255,255,.118)"
          strokeWidth=".5"
        />
      ))}
      {paths.map((path, track) => (
        <path
          key={track}
          d={path}
          fill="none"
          stroke={colors[track] ?? "#fff"}
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeWidth="1"
          clipPath={`url(#${clipPrefix}-${track})`}
        />
      ))}
      <rect
        x=".5"
        y=".5"
        width={Math.max(0, width - 1)}
        height={Math.max(0, height - 1)}
        fill="none"
        stroke="#646464"
        strokeWidth="1"
      />
    </svg>
  );
}
