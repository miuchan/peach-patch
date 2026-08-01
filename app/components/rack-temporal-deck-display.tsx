import { memo } from "react";

const CARTRIDGES = ["CLEAN", "M44-7", "SCRATCH", "680 HP", "Q.BERT", "LO-FI"];

export const RackTemporalDeckDisplay = memo(function RackTemporalDeckDisplay({
  values,
  lights,
  offset,
  lightStart,
  redLightStart,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  lights: number[];
  offset: number;
  lightStart: number;
  redLightStart: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const displayWidth = width * scaleX;
  const cx = displayWidth / 2;
  const cy = height / 2;
  const radius = Math.min(displayWidth, height) * .42;
  const angle = values?.[offset] ?? 0;
  const playhead = Math.max(0, values?.[offset + 1] ?? 0);
  const frames = Math.max(0, values?.[offset + 2] ?? 0);
  const sampleMode = (values?.[offset + 3] ?? 0) > .5;
  const loaded = (values?.[offset + 4] ?? 0) > .5;
  const playing = (values?.[offset + 5] ?? 0) > .5;
  const cartridge = Math.max(0, Math.min(5, Math.round(values?.[offset + 6] ?? 0)));

  return (
    <div
      aria-label={`Temporal Deck platter, ${loaded ? playing ? "playing" : "paused" : "live buffer"}, ${CARTRIDGES[cartridge]} cartridge`}
      style={{ position: "absolute", left: x * scaleX, top: y, width: displayWidth, height, pointerEvents: "none", zIndex: 4 }}
    >
      <svg width={displayWidth} height={height} viewBox={`0 0 ${displayWidth} ${height}`}>
        <defs>
          <radialGradient id="temporal-deck-vinyl">
            <stop offset="0" stopColor="#203445" />
            <stop offset=".22" stopColor="#0b1118" />
            <stop offset=".27" stopColor="#273a47" />
            <stop offset=".31" stopColor="#070a0d" />
            <stop offset="1" stopColor="#14191e" />
          </radialGradient>
          <filter id="temporal-deck-glow"><feGaussianBlur stdDeviation="1.8" /></filter>
        </defs>
        <circle cx={cx} cy={cy} r={radius + 8} fill="#05080a" stroke="#56616b" strokeWidth="1.2" />
        {Array.from({ length: 31 }, (_, index) => {
          const theta = Math.PI * (.7 + 1.6 * index / 30);
          const ledRadius = radius + 12;
          const lx = cx + Math.cos(theta) * ledRadius;
          const ly = cy + Math.sin(theta) * ledRadius;
          const yellow = lights[lightStart + index] ?? 0;
          const red = lights[redLightStart + index] ?? 0;
          const color = red > .05 ? `rgba(255,46,51,${Math.max(.14, red)})` : `rgba(255,199,45,${Math.max(.1, yellow)})`;
          return <g key={index}><circle cx={lx} cy={ly} r={2.6} fill={color} filter={(red || yellow) > .45 ? "url(#temporal-deck-glow)" : undefined} /><circle cx={lx} cy={ly} r={1.25} fill={color} /></g>;
        })}
        <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${angle}rad)` }}>
          <circle cx={cx} cy={cy} r={radius} fill="url(#temporal-deck-vinyl)" stroke="#81919d" strokeWidth=".7" />
          {Array.from({ length: 11 }, (_, index) => <circle key={index} cx={cx} cy={cy} r={radius * (.35 + index * .055)} fill="none" stroke="rgba(145,177,190,.12)" strokeWidth=".45" />)}
          <path d={`M ${cx} ${cy - radius * .93} L ${cx + 4} ${cy - radius * .72} L ${cx - 4} ${cy - radius * .72} Z`} fill="#00c6e4" />
          <circle cx={cx} cy={cy} r={radius * .24} fill="#132c36" stroke="#c5a857" strokeWidth="1.1" />
          <circle cx={cx} cy={cy} r={3.2} fill="#a9bcc8" />
        </g>
        <g transform={`rotate(${24 + (sampleMode && frames ? Math.min(32, playhead / frames * 32) : 0)} ${cx + radius * .87} ${cy - radius * .58})`}>
          <circle cx={cx + radius * .87} cy={cy - radius * .58} r="5.5" fill="#87929a" stroke="#242b30" />
          <path d={`M ${cx + radius * .87} ${cy - radius * .58} L ${cx + radius * .2} ${cy + radius * .55}`} stroke="#aeb6ba" strokeWidth="4" strokeLinecap="round" />
          <path d={`M ${cx + radius * .23} ${cy + radius * .51} l -8 9`} stroke="#efc768" strokeWidth="6" strokeLinecap="round" />
        </g>
        <rect x={cx - 25} y={cy + radius * .55} width="50" height="12" rx="2.5" fill="rgba(3,8,10,.88)" stroke="#3b5961" />
        <text x={cx} y={cy + radius * .55 + 8.5} textAnchor="middle" fontSize="6.5" fontFamily="ui-monospace, monospace" fill={loaded ? "#56e0a4" : "#7ba1ad"}>
          {loaded ? `${playing ? "PLAY" : "HOLD"} · ${CARTRIDGES[cartridge]}` : `LIVE · ${CARTRIDGES[cartridge]}`}
        </text>
      </svg>
    </div>
  );
});
