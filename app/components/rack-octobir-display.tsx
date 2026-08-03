type Props = {
  values?: number[];
  filenames: [string | undefined, string | undefined];
  dynamic: boolean;
  threshold: number;
  range: number;
  scaleX: number;
  onLoad: (slot: number) => void;
};

const MM = 75 / 25.4;
const SEGMENTS = 19;

function LcdFile({
  slot,
  filename,
  scaleX,
  onLoad,
}: {
  slot: number;
  filename?: string;
  scaleX: number;
  onLoad: (slot: number) => void;
}) {
  const x = (slot ? 104 : 3) * MM * scaleX;
  const width = (slot ? 96.2 : 97) * MM * scaleX;
  const label = filename
    ? filename.length > 24
      ? `${filename.slice(0, 21)}...`
      : filename
    : "<No IR selected>";
  return (
    <button
      type="button"
      aria-label={`Load IR ${slot ? "B" : "A"}: ${label}`}
      title={`IR ${slot ? "B" : "A"} · click to load`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => onLoad(slot)}
      style={{
        position: "absolute",
        zIndex: 8,
        left: x,
        top: 16 * MM,
        width,
        height: 8 * MM,
        overflow: "hidden",
        padding: `0 ${4 * scaleX}px`,
        border: "1px solid #24231b",
        borderRadius: 2,
        background: "linear-gradient(180deg,#d8a63b 0%,#f6cc5f 18%,#e0b34a 78%,#a97720 100%)",
        boxShadow: "inset 0 2px 3px #3a2b16aa,inset 0 -1px #fff4,0 1px 1px #0008",
        color: "#1c1c30",
        cursor: "pointer",
        font: `${Math.max(5, 7 * scaleX)}px var(--mono)`,
        textAlign: "left",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

export function RackOctobirDisplay({
  values,
  filenames,
  dynamic,
  threshold,
  range,
  scaleX,
  onLoad,
}: Props) {
  const levelDb = Number.isFinite(values?.[0]) ? Number(values?.[0]) : -60;
  const blend = Number.isFinite(values?.[1]) ? Number(values?.[1]) : 0;
  const litInput = Math.max(0, Math.min(SEGMENTS, Math.ceil(((levelDb + 60) / 60) * SEGMENTS)));
  const blendNorm = Math.max(0, Math.min(1, (blend + 1) / 2));
  const blendPosition = blendNorm * SEGMENTS;
  const thresholdX = 8 + Math.max(0, Math.min(1, (threshold + 60) / 60)) * 554;
  const rangeX = 8 + Math.max(0, Math.min(1, (threshold + range + 60) / 60)) * 554;
  return (
    <>
      <LcdFile slot={0} filename={filenames[0]} scaleX={scaleX} onLoad={onLoad} />
      <LcdFile slot={1} filename={filenames[1]} scaleX={scaleX} onLoad={onLoad} />
      <svg
        aria-label={`OctobIR input ${levelDb.toFixed(1)} dB, blend ${blend.toFixed(2)}`}
        role="img"
        viewBox="0 0 570.472 59.055"
        style={{
          position: "absolute",
          zIndex: 7,
          left: 5 * MM * scaleX,
          top: 38 * MM,
          width: 193.2 * MM * scaleX,
          height: 20 * MM,
          borderRadius: 3,
          filter: "drop-shadow(0 1px 1px #0008)",
          pointerEvents: "none",
        }}
      >
        <defs>
          <linearGradient id="octobir-lcd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d8a63b" />
            <stop offset=".18" stopColor="#f6cc5f" />
            <stop offset=".78" stopColor="#e0b34a" />
            <stop offset="1" stopColor="#a97720" />
          </linearGradient>
        </defs>
        <rect width="570.472" height="59.055" rx="3" fill="url(#octobir-lcd)" stroke="#24231b" />
        <text x="8" y="13" fill="#1c1c30" fontFamily="monospace" fontSize="7" fontWeight="700">
          INPUT
        </text>
        <text x="8" y="42" fill="#1c1c30" fontFamily="monospace" fontSize="7" fontWeight="700">
          BLEND
        </text>
        {[0, 1].map((row) => (
          <g key={row}>
            <rect
              x="8"
              y={row ? 44 : 15}
              width="554"
              height="11"
              rx="2"
              fill="none"
              stroke="#1c1c30"
            />
            {Array.from({ length: SEGMENTS }, (_, index) => {
              const lit =
                row === 0
                  ? index < litInput
                  : index === 9 ||
                    (blendNorm < 0.5
                      ? index < 9 && index + 1 > blendPosition
                      : index > 9 && index < blendPosition);
              return (
                <rect
                  key={index}
                  x={10 + index * 29}
                  y={row ? 46 : 17}
                  width="26"
                  height="7"
                  rx=".5"
                  fill={lit ? "#1c1c30" : "#1c1c3014"}
                />
              );
            })}
          </g>
        ))}
        {dynamic && (
          <>
            <rect x={thresholdX} y="12" width="2" height="17" fill="#1c1c30" />
            <rect x={rangeX} y="12" width="2" height="17" fill="#1c1c30" />
          </>
        )}
      </svg>
    </>
  );
}
