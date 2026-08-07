import { type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import { useI18n } from "../i18n/provider";

const BLUE = "#0097de";
const ORANGE = "#ec652e";
const PURPLE = "#35354d";
const BACKGROUND = "#1a1a2e";
const DIM = "rgba(53,53,77,.7)";
const TEXT = "rgba(220,220,235,.9)";
const BAND_COLORS = [BLUE, "#1fbc17", "#dd6400", "#692fbc"];
const HARMONIC_COLORS = [
  "rgb(100,180,255)",
  "rgb(255,140,80)",
  "rgb(100,255,140)",
  "rgb(255,100,180)",
  "rgb(180,140,255)",
  "rgb(255,220,80)",
  "rgb(80,220,220)",
  "rgb(220,180,140)",
];

function bounded(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ascii(values: number[] | undefined, offset: number, length: number) {
  return Array.from({ length }, (_, index) => Math.round(values?.[offset + index] ?? 0))
    .filter(Boolean)
    .map((value) => String.fromCharCode(value))
    .join("");
}

function ScreenGrid({
  width,
  height,
  rows = 4,
  columns = 8,
}: {
  width: number;
  height: number;
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows + 1 }, (_, row) => (
        <line
          key={`r-${row}`}
          x1="0"
          y1={(row / rows) * height}
          x2={width}
          y2={(row / rows) * height}
          stroke={DIM}
          strokeWidth=".5"
        />
      ))}
      {Array.from({ length: columns + 1 }, (_, column) => (
        <line
          key={`c-${column}`}
          x1={(column / columns) * width}
          y1="0"
          x2={(column / columns) * width}
          y2={height}
          stroke={DIM}
          strokeWidth=".5"
        />
      ))}
    </>
  );
}

function BandDisplay({ values, width, height }: DisplayProps) {
  const f0 = Math.max(1, values?.[0] ?? 110),
    sampleRate = Math.max(1, values?.[1] ?? 48_000),
    displayWidth = Math.max(0.05, values?.[2] ?? 1),
    spectrumMax = Math.max(1e-6, values?.[3] ?? 1),
    autoLocked = (values?.[16] ?? 0) > 0.5,
    plotLeft = 6,
    plotRight = width - 6,
    plotTop = 6,
    plotBottom = height - 12,
    plotWidth = plotRight - plotLeft,
    plotHeight = plotBottom - plotTop,
    harmonicX = (harmonic: number) => plotLeft + (bounded(harmonic, 0, 33) / 33) * plotWidth,
    spectrumBins = bounded(Math.floor((33 * f0 * 4096) / sampleRate), 1, 2047),
    spectrum = Array.from({ length: spectrumBins }, (_, index) => {
      const bin = index + 1,
        harmonic = (bin * sampleRate) / 4096 / f0,
        x = harmonicX(harmonic),
        magnitude = bounded((values?.[17 + bin] ?? 0) / spectrumMax, 0, 1),
        y = plotBottom - Math.pow(magnitude, 0.6) * plotHeight;
      return [x, y] as const;
    }).filter(([x]) => x <= plotRight),
    spectrumPath = spectrum.length
      ? `M${spectrum[0][0]} ${plotBottom} ${spectrum.map(([x, y]) => `L${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")} L${spectrum.at(-1)?.[0]} ${plotBottom} Z`
      : "";
  return (
    <>
      <rect
        x=".5"
        y=".5"
        width={width - 1}
        height={height - 1}
        rx="3"
        fill={BACKGROUND}
        stroke={PURPLE}
        strokeWidth="1"
      />
      <path d={spectrumPath} fill="rgba(108,176,144,.333)" />
      {Array.from({ length: 32 }, (_, index) => {
        const harmonic = index + 1,
          emphasized = harmonic % 4 === 1;
        return (
          <line
            key={harmonic}
            x1={harmonicX(harmonic)}
            y1={plotTop}
            x2={harmonicX(harmonic)}
            y2={plotBottom}
            stroke={PURPLE}
            strokeOpacity={emphasized ? 0.8 : 0.267}
            strokeWidth={emphasized ? 1 : 0.6}
          />
        );
      })}
      <line
        x1={plotLeft}
        y1={plotBottom}
        x2={plotRight}
        y2={plotBottom}
        stroke={PURPLE}
        strokeWidth="1"
      />
      {BAND_COLORS.map((color, band) => {
        const center = values?.[4 + band * 3] ?? 4 + band * 7,
          level = bounded(values?.[5 + band * 3] ?? 0.7, 0, 1),
          enabled = (values?.[6 + band * 3] ?? 1) > 0.5,
          middle = harmonicX(center),
          spread = bounded(displayWidth, 0.05, 4) * (plotWidth / 33) * 1.2,
          left = middle - spread,
          right = middle + spread,
          y = plotBottom - level * plotHeight;
        return (
          <g key={color} opacity={enabled ? 1 : 0.26}>
            <path
              d={`M${left} ${plotBottom} C${middle - spread * 0.4} ${plotBottom} ${middle - spread * 0.4} ${y} ${middle} ${y} C${middle + spread * 0.4} ${y} ${middle + spread * 0.4} ${plotBottom} ${right} ${plotBottom} Z`}
              fill={color}
              fillOpacity=".33"
            />
            <line x1={middle} y1={plotBottom} x2={middle} y2={y} stroke={color} strokeWidth="1.6" />
            <circle cx={middle} cy={y} r="2.4" fill={color} />
            <text
              x={middle}
              y={Math.max(8.5, y - 4)}
              textAnchor="middle"
              fill={color}
              fontSize="8.5"
              fontFamily="ui-monospace, monospace"
            >
              {String.fromCharCode(65 + band)}
              {Math.round(center)}
            </text>
          </g>
        );
      })}
      <text
        x={plotLeft + 2}
        y={height - 2}
        fill="rgba(240,192,96,.75)"
        fontSize="8"
        fontFamily="ui-monospace, monospace"
      >
        f0 {f0.toFixed(1)} Hz{autoLocked ? "  AUTO" : ""}
      </text>
      <text
        x={plotRight - 2}
        y={height - 2}
        textAnchor="end"
        fill="rgba(128,144,176,.75)"
        fontSize="8"
        fontFamily="ui-monospace, monospace"
      >
        harmonics →
      </text>
    </>
  );
}

function lfo(shape: number, phase: number, steps: number, random: number[]) {
  const p = phase - Math.floor(phase),
    sine = Math.sin(p * Math.PI * 2),
    triangle = p < 0.5 ? 4 * p - 1 : 3 - 4 * p,
    saw = 2 * p - 1,
    square = p < 0.5 ? 1 : -1,
    count = Math.max(1, Math.round(steps)),
    stair = (Math.floor(p * count) / count) * 2 - 1,
    randomValue = random[bounded(Math.floor(p * count), 0, count - 1)] ?? 0,
    wrappedShape = shape - Math.floor(shape),
    segment = wrappedShape * 6,
    mix = (left: number, right: number, fraction: number) => left + (right - left) * fraction;
  if (segment < 1) return mix(sine, triangle, segment);
  if (segment < 2) return mix(triangle, saw, segment - 1);
  if (segment < 3) return mix(saw, square, segment - 2);
  if (segment < 4) return mix(square, stair, segment - 3);
  if (segment < 5) return mix(stair, randomValue, segment - 4);
  return mix(randomValue, sine, segment - 5);
}

function CycleDisplay({ values, width, height }: DisplayProps) {
  const random = values?.slice(26) ?? [],
    plotLeft = 18,
    plotRight = width - 20,
    plotTop = 5,
    plotBottom = height - 12,
    plotWidth = plotRight - plotLeft,
    plotHeight = plotBottom - plotTop,
    middle = plotTop + plotHeight * 0.5,
    clocked = (values?.[4] ?? 0) > 0.5,
    bars = values?.[5] ?? 0,
    beatFraction = values?.[9] ?? 0,
    steps = values?.[8] ?? 4;
  return (
    <>
      <rect
        x=".5"
        y=".5"
        width={width - 1}
        height={height - 1}
        rx="3"
        fill={BACKGROUND}
        stroke={PURPLE}
        strokeWidth="1"
      />
      {clocked && bars >= 1
        ? Array.from({ length: Math.max(0, Math.round(bars) - 1) }, (_, index) => {
            const x = plotLeft + ((index + 1) / Math.round(bars)) * plotWidth;
            return (
              <line
                key={index}
                x1={x}
                y1={plotTop}
                x2={x}
                y2={plotBottom}
                stroke={PURPLE}
                strokeWidth=".8"
              />
            );
          })
        : null}
      {beatFraction > 0.02
        ? Array.from({ length: Math.max(0, Math.ceil(1 / beatFraction) - 1) }, (_, index) => {
            const position = (index + 1) * beatFraction;
            return position < 0.999 ? (
              <line
                key={index}
                x1={plotLeft + position * plotWidth}
                y1={plotBottom - 3}
                x2={plotLeft + position * plotWidth}
                y2={plotBottom}
                stroke="rgba(80,90,112,.8)"
                strokeWidth=".7"
              />
            ) : null;
          })
        : null}
      <line
        x1={plotLeft}
        y1={middle}
        x2={plotRight}
        y2={middle}
        stroke={PURPLE}
        strokeOpacity=".667"
        strokeWidth=".8"
      />
      {Array.from({ length: 4 }, (_, channel) => {
        const shape = values?.[10 + channel * 4] ?? channel,
          amplitude = values?.[11 + channel * 4] ?? 1,
          scale = values?.[12 + channel * 4] ?? 1,
          offset = values?.[13 + channel * 4] ?? 0,
          path = Array.from({ length: 129 }, (_, index) => {
            const time = index / 128,
              x = plotLeft + time * plotWidth,
              y =
                middle -
                bounded(lfo(shape, time + offset, steps, random) * amplitude * scale, -1, 1) *
                  plotHeight *
                  0.5;
            return `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
          }).join(" ");
        return (
          <g key={channel}>
            <path
              d={path}
              fill="none"
              stroke={BAND_COLORS[channel]}
              strokeOpacity=".8"
              strokeWidth="1.3"
            />
          </g>
        );
      })}
      <line
        x1={plotLeft + bounded(values?.[0] ?? 0, 0, 1) * plotWidth}
        y1={plotTop}
        x2={plotLeft + bounded(values?.[0] ?? 0, 0, 1) * plotWidth}
        y2={plotBottom}
        stroke="rgba(255,255,255,.8)"
        strokeWidth="1"
      />
      <text
        x={plotLeft - 3}
        y={plotTop + 5}
        textAnchor="end"
        fill="rgba(128,144,176,.8)"
        fontSize="5"
      >
        +5
      </text>
      <text
        x={plotLeft - 3}
        y={middle + 2}
        textAnchor="end"
        fill="rgba(128,144,176,.8)"
        fontSize="5"
      >
        0
      </text>
      <text
        x={plotLeft - 3}
        y={plotBottom}
        textAnchor="end"
        fill="rgba(128,144,176,.8)"
        fontSize="5"
      >
        -5
      </text>
      <text x={plotRight + 3} y={plotTop + 5} fill="rgba(128,144,176,.8)" fontSize="5">
        5
      </text>
      <text x={plotRight + 3} y={middle + 2} fill="rgba(128,144,176,.8)" fontSize="5">
        2.5
      </text>
      <text x={plotRight + 3} y={plotBottom} fill="rgba(128,144,176,.8)" fontSize="5">
        0
      </text>
      <text
        x={plotLeft - 3}
        y={plotTop - 0.5}
        textAnchor="end"
        fill="rgba(96,108,136,.8)"
        fontSize="4"
      >
        BI
      </text>
      <text x={plotRight + 3} y={plotTop - 0.5} fill="rgba(96,108,136,.8)" fontSize="4">
        UNI
      </text>
      <text
        x={plotLeft + 2}
        y={height - 2}
        fill={clocked ? "rgba(240,192,96,.82)" : "rgba(128,144,176,.82)"}
        fontSize="8"
      >
        {clocked
          ? bars >= 1
            ? `BAR ${Math.round(values?.[6] ?? 0) + 1}/${Math.round(bars)}`
            : `${Math.round(1 / Math.max(0.001, bars))}x / bar`
          : `FREE ${(values?.[1] ?? 0).toFixed(2)} Hz`}
      </text>
      {clocked && bars >= 1 ? (
        <text
          x={plotRight - 2}
          y={height - 2}
          textAnchor="end"
          fill="rgba(128,144,176,.75)"
          fontSize="8"
        >
          {Math.round(bars) - Math.round(values?.[6] ?? 0)} left
        </text>
      ) : null}
    </>
  );
}

function IntoneDisplay({ values, width, height }: DisplayProps) {
  const colors = [
      "rgba(100,180,255,.31)",
      "rgba(100,255,180,.31)",
      "rgba(255,220,100,.31)",
      "rgba(255,140,100,.31)",
      "rgba(255,100,180,.31)",
    ],
    curves = Array.from({ length: 5 }, (_, formant) =>
      Array.from({ length: 121 }, (_, point) => {
        const frequency = 50 * Math.pow(100, point / 120),
          center = Math.max(1, values?.[formant * 3] ?? 300 * (formant + 1)),
          bandwidth = Math.max(1, values?.[formant * 3 + 1] ?? 100),
          amplitude = Math.max(0, values?.[formant * 3 + 2] ?? 0.5),
          response = amplitude / (1 + Math.pow((frequency - center) / (bandwidth * 0.5), 2));
        return response;
      }),
    ),
    pathFor = (curve: number[]) =>
      curve
        .map(
          (value, index) =>
            `${index ? "L" : "M"}${(index / 120) * width} ${height - 2 - bounded(value, 0, 1) * (height - 4)}`,
        )
        .join(" "),
    composite = Array.from({ length: 121 }, (_, point) =>
      bounded(
        curves.reduce((sum, curve) => sum + curve[point], 0),
        0,
        1,
      ),
    );
  return (
    <>
      <rect width={width} height={height} fill={BACKGROUND} />
      {curves.map((curve, formant) => (
        <path
          key={formant}
          d={`${pathFor(curve)} L${width} ${height} L0 ${height} Z`}
          fill={colors[formant]}
        />
      ))}
      <path d={pathFor(composite)} fill="none" stroke="rgba(220,220,255,.86)" strokeWidth="1.2" />
    </>
  );
}

function OvertoneDisplay({ values, width, height }: DisplayProps) {
  const points = 256,
    compositeOffset = points * 9,
    wavePath = (offset: number) =>
      Array.from({ length: points }, (_, index) => {
        const x = (index / points) * width,
          sample = bounded(values?.[offset + index] ?? 0, -1, 1),
          y = height * 0.5 - sample * height * 0.5 * 0.9;
        return `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(" ");
  return (
    <>
      <rect width={width} height={height} fill={BACKGROUND} />
      <path d={wavePath(0)} fill="none" stroke="rgba(255,255,255,.137)" strokeWidth="1" />
      {HARMONIC_COLORS.map((color, harmonic) =>
        (values?.[compositeOffset + points + harmonic] ?? 1) > 0.5 ? (
          <path
            key={color}
            d={wavePath(points * (harmonic + 1))}
            fill="none"
            stroke={color}
            strokeOpacity=".157"
            strokeWidth="1"
          />
        ) : null,
      )}
      <path
        d={wavePath(compositeOffset)}
        fill="none"
        stroke="rgba(100,180,255,.86)"
        strokeWidth="1.5"
      />
    </>
  );
}

function SwellDisplay({ values, width, height }: DisplayProps) {
  const plotLeft = 2,
    plotRight = width - 2,
    plotTop = 2,
    plotBottom = height - 2,
    yAt = (value: number) => plotBottom - bounded(value / 10, 0, 1) * (plotBottom - plotTop),
    xAt = (point: number) => plotLeft + (point / 120) * (plotRight - plotLeft),
    past = Array.from(
      { length: 60 },
      (_, point) => `${point ? "L" : "M"}${xAt(point)} ${yAt(values?.[5 + point] ?? 0)}`,
    ).join(" "),
    current = values?.[0] ?? 0,
    future = Array.from(
      { length: 60 },
      (_, point) => `L${xAt(61 + point)} ${yAt(values?.[65 + point] ?? current)}`,
    ).join(" ");
  return (
    <>
      <rect width={width} height={height} fill={BACKGROUND} />
      {[0, 5, 10].map((volts) => (
        <line
          key={volts}
          x1={plotLeft}
          y1={yAt(volts)}
          x2={plotRight}
          y2={yAt(volts)}
          stroke={PURPLE}
          strokeWidth=".5"
        />
      ))}
      <path d={`${past} L${xAt(60)} ${yAt(current)}`} fill="none" stroke={BLUE} strokeWidth="1.2" />
      <path
        d={`M${xAt(60)} ${yAt(current)} ${future}`}
        fill="none"
        stroke={BLUE}
        strokeOpacity=".42"
        strokeWidth="1.2"
      />
      <line
        x1={xAt(60)}
        y1={plotTop}
        x2={xAt(60)}
        y2={plotBottom}
        stroke={PURPLE}
        strokeWidth=".6"
      />
    </>
  );
}

function WaveDisplay({ values, width, height }: DisplayProps) {
  const mini = 64,
    liveOffset = 11,
    slotOffset = liveOffset + mini,
    slotStride = mini + 1,
    snapCount = Math.round(values?.[0] ?? 0),
    play = Math.round(values?.[1] ?? -1),
    stripHeight = Math.max(14, height * 0.3),
    stripY = height - stripHeight,
    waveHeight = stripY - 2,
    slotWidth = (width - 2) / 8,
    drawMini = (
      offset: number,
      x: number,
      y: number,
      w: number,
      h: number,
      color: string,
      strokeWidth: number,
    ) => {
      const path = Array.from({ length: mini }, (_, point) => {
        const px = x + (point / (mini - 1)) * w,
          py = y + h * 0.5 - bounded(values?.[offset + point] ?? 0, -1, 1) * h * 0.4;
        return `${point ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`;
      }).join(" ");
      return <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} />;
    };
  return (
    <>
      <rect width={width} height={height} fill="#0a0a18" />
      <line
        x1="2"
        y1={waveHeight * 0.5 + 1}
        x2={width - 2}
        y2={waveHeight * 0.5 + 1}
        stroke={PURPLE}
        strokeOpacity=".5"
        strokeWidth=".5"
      />
      {drawMini(liveOffset, 2, 2, width - 4, waveHeight - 2, BLUE, 1.4)}
      {Array.from({ length: 8 }, (_, position) => {
        const x = 1 + position * slotWidth,
          slot = bounded(Math.round(values?.[3 + position] ?? position), 0, 7),
          ready = position < snapCount && (values?.[slotOffset + slot * slotStride] ?? 0) > 0.5,
          active = position === play;
        return (
          <g key={position}>
            <rect
              x={x}
              y={stripY}
              width={slotWidth - 1}
              height={stripHeight - 2}
              fill={active ? "rgba(236,101,46,.251)" : "#141428"}
              stroke={ready ? "none" : "rgba(53,53,77,.5)"}
              strokeWidth=".5"
            />
            {ready
              ? drawMini(
                  slotOffset + slot * slotStride + 1,
                  x + 1,
                  stripY + 1,
                  slotWidth - 3,
                  stripHeight - 4,
                  active ? ORANGE : PURPLE,
                  1,
                )
              : null}
          </g>
        );
      })}
      {snapCount > 0 ? (
        <path
          d={`M${1 + ((values?.[1] ?? 0) / snapCount) * slotWidth * snapCount} ${stripY - 4} l-2.5 3 h5 Z`}
          fill={ORANGE}
        />
      ) : null}
      <text x="4" y="10" fill="rgba(0,151,222,.376)" fontSize="8">
        LIVE
      </text>
      <text x={width - 4} y="10" textAnchor="end" fill="rgba(236,101,46,.251)" fontSize="8">
        {snapCount}/8
      </text>
    </>
  );
}

function TabBar({ selected, labels, y = 8 }: { selected: number; labels: string[]; y?: number }) {
  return (
    <>
      {labels.map((label, index) => (
        <g key={label}>
          <rect
            x={7 + index * 40}
            y={y}
            width="38"
            height="18"
            rx="1.5"
            fill={selected === index ? BLUE : "rgba(53,53,77,.65)"}
          />
          <text
            x={26 + index * 40}
            y={y + 12}
            textAnchor="middle"
            fill={selected === index ? "#fff" : TEXT}
            fontSize="7"
          >
            {label}
          </text>
        </g>
      ))}
    </>
  );
}

function BeatDisplay({ values }: DisplayProps) {
  const edit = bounded(Math.round(values?.[0] ?? 0), 0, 7),
    playPattern = Math.round(values?.[1] ?? 0),
    playStep = Math.round(values?.[2] ?? 0),
    mode = bounded(Math.round(values?.[3] ?? 0), 0, 3),
    offset = 5 + edit * 67,
    length = bounded(Math.round(values?.[offset + 1] ?? 8), 1, 16),
    repeats = bounded(Math.round(values?.[offset + 2] ?? 1), 1, 8);
  return (
    <>
      <rect width="174" height="155" fill={BACKGROUND} />
      <TabBar selected={mode} labels={["STEP", "VEL", "ACC", "PROB"]} />
      {Array.from({ length: 16 }, (_, step) => {
        const column = step % 8,
          row = Math.floor(step / 8),
          x = 7 + column * 20,
          y = 35 + row * 20,
          on = (values?.[offset + 3 + step * 4] ?? 0) > 0.5,
          value =
            mode === 1
              ? (values?.[offset + 4 + step * 4] ?? 1)
              : mode === 3
                ? (values?.[offset + 6 + step * 4] ?? 1)
                : 1,
          accent = (values?.[offset + 5 + step * 4] ?? 0) > 0.5,
          current = playPattern === edit && playStep === step;
        return (
          <g key={step} opacity={step < length ? 1 : 0.24}>
            <rect
              x={x}
              y={y}
              width="18"
              height="18"
              rx="1.5"
              fill={on ? (accent ? ORANGE : BLUE) : "rgba(53,53,77,.8)"}
              stroke={current ? "#fff" : PURPLE}
              strokeWidth={current ? 1.4 : 0.5}
            />
            {(mode === 1 || mode === 3) && on ? (
              <rect
                x={x + 2}
                y={y + 16 - bounded(value, 0, 1) * 14}
                width="14"
                height={bounded(value, 0, 1) * 14}
                fill={mode === 3 ? ORANGE : "#fff"}
                opacity=".75"
              />
            ) : null}
          </g>
        );
      })}
      {Array.from({ length: 16 }, (_, step) => (
        <rect
          key={step}
          x={7 + step * 10}
          y="75"
          width="8"
          height="8"
          fill={step < length ? BLUE : PURPLE}
        />
      ))}
      {Array.from({ length: 8 }, (_, pattern) => {
        const active = (values?.[5 + pattern * 67] ?? 0) > 0.5;
        return (
          <rect
            key={pattern}
            x={7 + pattern * 20}
            y="111"
            width="18"
            height="18"
            rx="1.5"
            fill={pattern === edit ? BLUE : active ? ORANGE : PURPLE}
            stroke={pattern === playPattern ? "#fff" : "none"}
          />
        );
      })}
      {Array.from({ length: 8 }, (_, repeat) => (
        <rect
          key={repeat}
          x={7 + repeat * 20}
          y="137"
          width="18"
          height="8"
          fill={repeat < repeats ? ORANGE : PURPLE}
        />
      ))}
    </>
  );
}

function NoteDisplay({ values }: DisplayProps) {
  const edit = bounded(Math.round(values?.[0] ?? 0), 0, 7),
    mode = bounded(Math.round(values?.[4] ?? 0), 0, 3),
    offset = 8 + edit * 43,
    length = bounded(Math.round(values?.[offset + 1] ?? 8), 1, 8),
    repeats = bounded(Math.round(values?.[offset + 2] ?? 1), 1, 8),
    playPattern = Math.round(values?.[1] ?? 0),
    playStep = Math.round(values?.[2] ?? 0);
  return (
    <>
      <rect width="174" height="228" fill={BACKGROUND} />
      <TabBar selected={mode} labels={["NOTE", "VEL", "ACC", "PROB"]} />
      {Array.from({ length: 13 }, (_, row) => (
        <line
          key={row}
          x1="7"
          y1={35 + row * 9}
          x2="165"
          y2={35 + row * 9}
          stroke={row === 12 ? PURPLE : "rgba(53,53,77,.7)"}
          strokeWidth=".5"
        />
      ))}
      {Array.from({ length: 8 }, (_, step) => {
        const x = 7 + step * 20,
          pitch = Math.round(values?.[offset + 3 + step * 5] ?? -1),
          velocity = values?.[offset + 4 + step * 5] ?? 1,
          accent = (values?.[offset + 5 + step * 5] ?? 0) > 0.5,
          probability = values?.[offset + 6 + step * 5] ?? 1,
          legato = (values?.[offset + 7 + step * 5] ?? 0) > 0.5,
          current = edit === playPattern && playStep === step;
        return (
          <g key={step} opacity={step < length ? 1 : 0.24}>
            <rect
              x={x}
              y="35"
              width="18"
              height="117"
              fill="rgba(53,53,77,.22)"
              stroke={current ? "#fff" : PURPLE}
              strokeWidth={current ? 1.3 : 0.45}
            />
            {mode === 0 && pitch >= 0 ? (
              <rect
                x={x + 1}
                y={35 + (12 - pitch) * 9 + 1}
                width="16"
                height="7"
                rx="1"
                fill={accent ? ORANGE : BLUE}
              />
            ) : null}
            {mode !== 0 ? (
              <rect
                x={x + 2}
                y={
                  150 -
                  bounded(mode === 1 ? velocity : mode === 3 ? probability : accent ? 1 : 0, 0, 1) *
                    111
                }
                width="14"
                height={
                  bounded(mode === 1 ? velocity : mode === 3 ? probability : accent ? 1 : 0, 0, 1) *
                  111
                }
                fill={mode === 3 ? ORANGE : BLUE}
                opacity=".72"
              />
            ) : null}
            {legato ? (
              <path d={`M${x + 13} 38 l4 4 -4 4`} fill="none" stroke="#fff" strokeWidth="1.2" />
            ) : null}
          </g>
        );
      })}
      {Array.from({ length: 8 }, (_, step) => (
        <rect
          key={step}
          x={7 + step * 20}
          y="156"
          width="18"
          height="8"
          fill={step < length ? BLUE : PURPLE}
        />
      ))}
      {Array.from({ length: 8 }, (_, pattern) => (
        <rect
          key={pattern}
          x={7 + pattern * 20}
          y="190"
          width="18"
          height="18"
          rx="1.5"
          fill={pattern === edit ? BLUE : (values?.[8 + pattern * 43] ?? 0) > 0.5 ? ORANGE : PURPLE}
          stroke={pattern === playPattern ? "#fff" : "none"}
        />
      ))}
      {Array.from({ length: 8 }, (_, repeat) => (
        <rect
          key={repeat}
          x={7 + repeat * 20}
          y="216"
          width="18"
          height="8"
          fill={repeat < repeats ? ORANGE : PURPLE}
        />
      ))}
    </>
  );
}

function ChanceDisplay({ values }: DisplayProps) {
  const edit = bounded(Math.round(values?.[0] ?? 0), 0, 7),
    play = Math.round(values?.[1] ?? 0),
    currentNode = Math.round(values?.[3] ?? 0),
    gateOffset = 51 + 8 * 12;
  return (
    <>
      <rect width="400" height="178" fill={BACKGROUND} />
      {Array.from({ length: 8 }, (_, pattern) => {
        const x = 4 + pattern * 49,
          offset = 51 + pattern * 12,
          active = (values?.[offset] ?? 0) > 0.5,
          repeats = bounded(Math.round(values?.[offset + 1] ?? 1), 1, 8),
          reseed = (values?.[offset + 2] ?? 0) > 0.5;
        return (
          <g key={pattern}>
            <rect
              x={x}
              y="19"
              width="47"
              height="35"
              rx="2"
              fill={
                pattern === edit
                  ? "rgba(0,151,222,.32)"
                  : active
                    ? "rgba(236,101,46,.19)"
                    : "rgba(53,53,77,.4)"
              }
              stroke={pattern === play ? "#fff" : pattern === edit ? BLUE : PURPLE}
              strokeWidth={pattern === play ? 1.5 : 0.8}
            />
            <text x={x + 7} y="31" fill={active ? TEXT : "rgba(220,220,235,.35)"} fontSize="8">
              {pattern + 1}
            </text>
            <circle cx={x + 39} cy="26" r="3.2" fill={reseed ? ORANGE : PURPLE} />
            {Array.from({ length: 8 }, (_, repeat) => (
              <rect
                key={repeat}
                x={x + repeat * 5.75}
                y="49"
                width="4.75"
                height="5"
                fill={repeat < repeats ? ORANGE : PURPLE}
              />
            ))}
          </g>
        );
      })}
      {Array.from({ length: 8 }, (_, node) => {
        const x = 4 + node * 49,
          gate = Math.round(values?.[gateOffset + edit * 8 + node] ?? 0),
          playing = currentNode === node;
        return (
          <g key={node}>
            <rect
              x={x}
              y="62"
              width="47"
              height="18"
              rx="2"
              fill={gate === 2 ? ORANGE : gate === 1 ? BLUE : PURPLE}
              stroke={playing ? "#fff" : "none"}
            />
            <text x={x + 23.5} y="74" textAnchor="middle" fill="#fff" fontSize="7">
              {gate === 2 ? "H" : gate === 1 ? "G" : "–"}
            </text>
          </g>
        );
      })}
      <g transform="translate(0 90)">
        <ScreenGrid width={400} height={88} rows={4} columns={16} />
      </g>
      <polyline
        points={Array.from(
          { length: 8 },
          (_, node) =>
            `${12 + node * 54},${158 - bounded((values?.[11 + node] ?? 0) / 12, -1, 1) * 28}`,
        ).join(" ")}
        fill="none"
        stroke={BLUE}
        strokeWidth="1.4"
      />
      <polyline
        points={Array.from(
          { length: 8 },
          (_, node) =>
            `${12 + node * 54},${158 - bounded((values?.[19 + node] ?? 0) / 12, -1, 1) * 28}`,
        ).join(" ")}
        fill="none"
        stroke={ORANGE}
        strokeWidth="1"
      />
    </>
  );
}

function MeterDisplay({ values, width, height }: DisplayProps) {
  const bpm = values?.[0] ?? 120,
    sixteenth = Math.round(values?.[1] ?? 0),
    numerator = Math.max(1, Math.round(values?.[2] ?? 4)),
    denominator = Math.max(1, Math.round(values?.[3] ?? 4)),
    cells = Math.max(1, Math.round((numerator * 16) / denominator)),
    beatBoundary = Math.max(1, Math.round(16 / denominator)),
    bars = Math.max(0, Math.round(values?.[6] ?? 0)),
    trackerY = height * 0.78,
    trackerHeight = height * 0.18,
    trackerWidth = width - 6,
    cellSpacing = trackerWidth / cells,
    cellWidth = cellSpacing * 0.85,
    indicatorTop = height * 0.42,
    indicatorBottom = trackerY - 1,
    rowHeight = (indicatorBottom - indicatorTop) / 6,
    hitSpacing = [cells, 4, 2, 1, 4 / 3, 2 / 3],
    tickColor = (output: number, tick: number) => {
      const flash = bounded(values?.[14 + output] ?? 0, 0, 1),
        flashIndex = Math.round(values?.[20 + output] ?? -1);
      if (flash <= 0 || tick !== flashIndex) return BLUE;
      return `rgb(${Math.round(236 * flash)},${Math.round(151 + (101 - 151) * flash)},${Math.round(222 + (46 - 222) * flash)})`;
    };
  return (
    <>
      <rect width={width} height={height} fill={BACKGROUND} />
      <text x="5" y={height * 0.22 + 3} fill="#808080" fontSize="8">
        {bpm.toFixed(1)} BPM
      </text>
      {(values?.[5] ?? 0) > 0.5 ? (
        <circle
          cx="53"
          cy={height * 0.22}
          r="1.8"
          fill={ORANGE}
          opacity={0.24 + bounded(values?.[7] ?? 0, 0, 1) * 0.76}
        />
      ) : null}
      <text x={width * 0.5} y={height * 0.22 + 5} textAnchor="middle" fill="#fff" fontSize="14">
        {numerator}/{denominator}
      </text>
      <text x={width - 5} y={height * 0.22 + 3} textAnchor="end" fill="#808080" fontSize="8">
        BAR {bars + 1}
      </text>
      {Array.from({ length: 6 }, (_, output) => {
        const y = indicatorTop + (output + 0.5) * rowHeight,
          spacing = hitSpacing[output],
          swing = values?.[8 + output] ?? 0,
          ticks: Array<{ position: number; base: number; index: number }> = [];
        if (output === 0) ticks.push({ position: 0, base: 0, index: 0 });
        else {
          let position = 0,
            pulse = 0;
          while (position < cells - 0.0001 && pulse < 256) {
            ticks.push({ position, base: pulse * spacing, index: pulse });
            position += spacing * (1 + (pulse % 2 === 0 ? swing : -swing));
            pulse += 1;
          }
        }
        return (
          <g key={output}>
            <line x1="3" y1={y} x2={width - 3} y2={y} stroke="rgba(53,53,77,.5)" strokeWidth=".5" />
            {ticks.map((tick) => {
              const actualX = 3 + (tick.position + 0.5) * cellSpacing,
                baseX = 3 + (tick.base + 0.5) * cellSpacing,
                swung = output > 0 && Math.abs(tick.base - tick.position) > 0.01;
              return (
                <g key={tick.index}>
                  {swung && tick.base < cells ? (
                    <>
                      <line
                        x1={baseX}
                        y1={y}
                        x2={actualX}
                        y2={y}
                        stroke="rgba(0,151,222,.43)"
                        strokeWidth=".7"
                      />
                      <rect
                        x={baseX - 0.7}
                        y={y - Math.max(rowHeight * 0.75, 1.5) * 0.35}
                        width="1.4"
                        height={Math.max(rowHeight * 0.75, 1.5) * 0.7}
                        fill="rgba(0,151,222,.27)"
                      />
                    </>
                  ) : null}
                  <rect
                    x={actualX - 0.7}
                    y={y - Math.max(rowHeight * 0.75, 1.5) * 0.5}
                    width="1.4"
                    height={Math.max(rowHeight * 0.75, 1.5)}
                    fill={tickColor(output, tick.index)}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
      {Array.from({ length: cells }, (_, cell) => (
        <rect
          key={cell}
          x={3 + cell * cellSpacing + (cellSpacing - cellWidth) * 0.5}
          y={trackerY}
          width={cellWidth}
          height={trackerHeight}
          rx="1"
          fill={cell === sixteenth ? ORANGE : cell % beatBoundary === 0 ? "#4a4a66" : PURPLE}
        />
      ))}
    </>
  );
}

function MuseDisplay({ values, width, height, scope }: DisplayProps & { scope: boolean }) {
  if (scope) {
    const filled = bounded(Math.round(values?.[8] ?? 0), 0, 128),
      shown = Math.min(filled, 32),
      offset = 59,
      start = 128 - shown,
      labelWidth = 14,
      plotWidth = width - labelWidth - 2,
      columnWidth = plotWidth / 32,
      gap = 2,
      topHeight = (height - gap) * 0.72,
      bottomTop = 1 + topHeight + gap,
      bottomHeight = (height - gap) * 0.28,
      pitchPath = Array.from({ length: shown }, (_, index) => {
        const x0 = labelWidth + (32 - shown + index) * columnWidth,
          x1 = x0 + columnWidth,
          y = 1 + (1 - bounded((values?.[offset + start + index] ?? 0) / 15, 0, 1)) * topHeight;
        return `${index ? "L" : "M"}${x0} ${y} H${x1}`;
      }).join(" ");
    return (
      <>
        <rect width={width} height={height} fill={BACKGROUND} />
        <text x="2" y={1 + topHeight * 0.55} fill="#707080" fontSize="5.5">
          PITCH
        </text>
        <text x="2" y={bottomTop + bottomHeight * 0.62} fill="#707080" fontSize="5.5">
          B1
        </text>
        <line
          x1={labelWidth - 0.5}
          y1="1"
          x2={labelWidth - 0.5}
          y2={height - 1}
          stroke="#2a2a40"
          strokeWidth=".5"
        />
        <line
          x1={labelWidth}
          y1={1 + topHeight * 0.5}
          x2={width - 2}
          y2={1 + topHeight * 0.5}
          stroke="#2a2a40"
          strokeWidth=".4"
        />
        <path d={pitchPath} fill="none" stroke={ORANGE} strokeWidth="1" />
        {Array.from({ length: shown }, (_, index) => {
          const column = 32 - shown + index,
            inset = Math.min(columnWidth * 0.18, 0.6),
            x = labelWidth + column * columnWidth + inset,
            barWidth = Math.max(columnWidth - inset * 2, 0.8),
            active = (values?.[offset + 128 + start + index] ?? 0) > 0.5;
          return (
            <rect
              key={column}
              x={x}
              y={active ? bottomTop + 1 : bottomTop + bottomHeight - 1.5}
              width={barWidth}
              height={active ? bottomHeight - 2 : 0.6}
              fill={BLUE}
              opacity={active ? 1 : 0.25}
            />
          );
        })}
      </>
    );
  }
  const tapLabels = [
      "OFF",
      "ON",
      "C ½",
      "C1",
      "C2",
      "C4",
      "C8",
      "C3",
      "C6",
      ...Array.from({ length: 31 }, (_, index) => `B${index + 1}`),
    ],
    headerHeight = 9,
    statusHeight = 16,
    gridBottom = height - statusHeight,
    rowHeight = (gridBottom - headerHeight) / 40,
    sliderColumns = [0.05, 0.1, 0.15, 0.2, 0.3, 0.35, 0.4, 0.45].map(
      (fraction) => fraction * width,
    ),
    sliderTaps = [
      ...Array.from({ length: 4 }, (_, voice) => Math.round(values?.[13 + voice] ?? 0)),
      ...Array.from({ length: 4 }, (_, voice) => Math.round(values?.[9 + voice] ?? 0)),
    ],
    labelX = width * 0.78,
    ledX = width * 0.92,
    following = (values?.[5] ?? 0) > 0.5,
    address = Math.round(values?.[57] ?? 0),
    midi = Math.round(60 + 12 * (values?.[58] ?? 0)),
    noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
    note = `${noteNames[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  return (
    <>
      <rect width={width} height={height} fill={BACKGROUND} />
      {["A", "B", "C", "D", "T1", "T2", "T3", "T4"].map((label, index) => (
        <text
          key={label}
          x={sliderColumns[index]}
          y="6.7"
          textAnchor="middle"
          fill={index < 4 ? "rgba(200,110,63,.75)" : `rgba(74,154,205,${following ? 0.3 : 0.75})`}
          fontSize="6.5"
        >
          {label}
        </text>
      ))}
      <text x={labelX - 14} y="6.7" textAnchor="middle" fill="#707080" fontSize="6.5">
        TAP
      </text>
      <text x={ledX} y="6.7" textAnchor="middle" fill="#707080" fontSize="6.5">
        ·
      </text>
      <line
        x1={width * 0.02}
        y1={headerHeight}
        x2={width * 0.98}
        y2={headerHeight}
        stroke="#2a2a40"
        strokeWidth=".6"
      />
      <line
        x1={(sliderColumns[3] + sliderColumns[4]) * 0.5}
        y1={headerHeight + 1}
        x2={(sliderColumns[3] + sliderColumns[4]) * 0.5}
        y2={gridBottom - 1}
        stroke="#2a2a40"
        strokeWidth=".4"
      />
      {Array.from({ length: 40 }, (_, tap) => {
        const cy = headerHeight + (tap + 0.5) * rowHeight,
          selected = sliderTaps.includes(tap),
          lit = (values?.[17 + tap] ?? 0) > 0.5,
          clock = tap === 2 ? bounded(values?.[4] ?? 0, 0, 1) : 0;
        return (
          <g key={tap}>
            {sliderTaps.map((selectedTap, column) =>
              selectedTap === tap ? (
                <circle
                  key={column}
                  cx={sliderColumns[column]}
                  cy={cy}
                  r={Math.min(rowHeight * 0.36, 1.7)}
                  fill={column < 4 ? ORANGE : BLUE}
                  opacity={column >= 4 && following ? 0.3 : 1}
                />
              ) : null,
            )}
            <text
              x={labelX}
              y={cy + rowHeight * 0.3}
              textAnchor="end"
              fill={selected ? "#fff" : "#707080"}
              fontSize={Math.min(rowHeight * 0.95, 7.5)}
            >
              {tapLabels[tap]}
            </text>
            <circle
              cx={ledX}
              cy={cy}
              r={Math.min(rowHeight * 0.34, 2)}
              fill={
                lit
                  ? clock > 0.01
                    ? `rgb(${Math.round(255 + (236 - 255) * clock)},${Math.round(255 + (101 - 255) * clock)},${Math.round(255 + (46 - 255) * clock)})`
                    : "#fff"
                  : "#181824"
              }
            />
          </g>
        );
      })}
      <line
        x1={width * 0.02}
        y1={gridBottom}
        x2={width * 0.98}
        y2={gridBottom}
        stroke="#2a2a40"
        strokeWidth=".6"
      />
      <text x="4" y={gridBottom + 11.5} fill="#fff" fontSize="11">
        {note}
      </text>
      {following ? (
        <text x={width * 0.32} y={gridBottom + 10.5} fill={ORANGE} fontSize="6">
          ← FOLLOW {Math.round(values?.[6] ?? 0)}
        </text>
      ) : null}
      <text x={width - 4} y={gridBottom + 10.5} textAnchor="end" fill="#707080" fontSize="6">
        DCBA={[(address >> 3) & 1, (address >> 2) & 1, (address >> 1) & 1, address & 1].join("")}{" "}
        oct{(address >> 3) & 1} idx{address & 7}
      </text>
    </>
  );
}

function GravityDisplay({ values, width, height }: DisplayProps) {
  const mode = Math.round(values?.[0] ?? 0),
    cx = width / 2,
    cy = height / 2,
    radius = Math.min(width, height) / 2 - 6,
    toX = (x: number) => cx + (x / 10) * radius,
    toY = (y: number) => cy + (y / 10) * radius,
    angle = values?.[1] ?? 0,
    polar = (modelRadius: number, theta: number) =>
      [
        cx + (modelRadius / 10) * radius * Math.sin(theta),
        cy + (modelRadius / 10) * radius * Math.cos(theta),
      ] as const,
    arc = (modelRadius: number, start: number, end: number, segments = 10) =>
      Array.from({ length: segments + 1 }, (_, point) => {
        const [x, y] = polar(modelRadius, start + ((end - start) * point) / segments);
        return `${point ? "L" : "M"}${x} ${y}`;
      }).join(" "),
    trailCount = bounded(Math.round(values?.[285] ?? 0), 0, 128),
    trailPath = Array.from({ length: Math.max(0, trailCount - 1) }, (_, point) => {
      const left = 286 + point * 4,
        right = left + 4,
        pen = (values?.[left + 2] ?? 0) > 0.5 && (values?.[right + 2] ?? 0) > 0.5,
        broken = (values?.[right + 3] ?? 0) > 0.5;
      return pen && !broken
        ? `M${toX(values?.[left] ?? 0)} ${toY(values?.[left + 1] ?? 0)} L${toX(values?.[right] ?? 0)} ${toY(values?.[right + 1] ?? 0)}`
        : "";
    }).join(" "),
    turtleX = toX(values?.[58] ?? values?.[2] ?? 0),
    turtleY = toY(values?.[59] ?? values?.[3] ?? 0),
    turtleHeading = values?.[60] ?? 0,
    turtlePen = (values?.[61] ?? 0) > 0.5,
    hungryNode = (node: number) => {
      const ring = Math.floor(node / 12),
        sector = node % 12,
        modelRadius = 9.2 * (0.3 + (0.7 * (ring + 0.5)) / 4),
        theta = ((sector + 0.5) / 6) * Math.PI;
      return [modelRadius * Math.sin(theta), modelRadius * Math.cos(theta)] as const;
    },
    [hungryFromX, hungryFromY] = hungryNode(Math.round(values?.[69] ?? 0)),
    [hungryToX, hungryToY] = hungryNode(Math.round(values?.[70] ?? 0)),
    hungryAngle = Math.atan2(hungryToY - hungryFromY, hungryToX - hungryFromX),
    hungryX = toX(values?.[2] ?? 0),
    hungryY = toY(values?.[3] ?? 0),
    hungryMouth = 0.3 * Math.PI,
    hungryPath = `M${hungryX} ${hungryY} L${hungryX + Math.cos(hungryAngle + hungryMouth) * 6} ${hungryY + Math.sin(hungryAngle + hungryMouth) * 6} A6 6 0 1 1 ${hungryX + Math.cos(hungryAngle - hungryMouth) * 6} ${hungryY + Math.sin(hungryAngle - hungryMouth) * 6} Z`;
  return (
    <>
      <rect width={width} height={height} fill={BACKGROUND} />
      <circle cx={cx} cy={cy} r={radius} fill="#0a0a18" stroke={PURPLE} strokeWidth="1.2" />
      {Array.from({ length: 6 }, (_, sector) => {
        const theta = (sector / 6) * Math.PI * 2,
          flash = bounded(values?.[8 + sector] ?? 0, 0, 1);
        return mode === 3 && flash < 0.01 ? null : (
          <line
            key={sector}
            x1={cx}
            y1={cy}
            x2={cx + Math.sin(theta) * radius}
            y2={cy + Math.cos(theta) * radius}
            stroke={flash > 0.01 ? ORANGE : PURPLE}
            strokeWidth={1 + flash * 1.5}
          />
        );
      })}
      {Array.from({ length: 6 }, (_, sector) => {
        const level = bounded((values?.[75 + sector] ?? 0) / 10, 0, 1);
        return level < 0.01 ? null : (
          <path
            key={`level-${sector}`}
            d={arc(10 - 30 / radius, (sector / 3) * Math.PI, ((sector + 1) / 3) * Math.PI)}
            fill="none"
            stroke={BLUE}
            strokeOpacity={level}
            strokeWidth="2.5"
          />
        );
      })}
      {mode === 1 ? (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={7 + bounded(values?.[81] ?? 0.5, 0, 1) * 12}
            fill="rgba(208,168,80,.18)"
          />
          <circle cx={cx} cy={cy} r={4 + bounded(values?.[81] ?? 0.5, 0, 1) * 12} fill="#d0a850" />
        </>
      ) : mode !== 4 && mode !== 5 ? (
        <>
          <line
            x1={cx + Math.sin(angle * Math.PI) * (radius - 9)}
            y1={cy + Math.cos(angle * Math.PI) * (radius - 9)}
            x2={cx + Math.sin(angle * Math.PI) * radius}
            y2={cy + Math.cos(angle * Math.PI) * radius}
            stroke="rgba(208,168,80,.5)"
            strokeWidth="1.2"
          />
          <circle
            cx={cx + Math.sin(angle * Math.PI) * radius}
            cy={cy + Math.cos(angle * Math.PI) * radius}
            r="3.2"
            fill="#d0a850"
          />
        </>
      ) : null}
      {mode === 0 ? (
        <>
          <path
            d={`M${cx} ${cy} L${toX(values?.[4] ?? 0)} ${toY(values?.[5] ?? 0)} L${toX(values?.[6] ?? 0)} ${toY(values?.[7] ?? 0)}`}
            fill="none"
            stroke="#c0c8d0"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="2.5" fill={PURPLE} />
          <circle cx={toX(values?.[4] ?? 0)} cy={toY(values?.[5] ?? 0)} r="4" fill={BLUE} />
          <circle cx={toX(values?.[6] ?? 0)} cy={toY(values?.[7] ?? 0)} r="5" fill={ORANGE} />
        </>
      ) : null}
      {mode === 1 ? (
        <>
          {Array.from({ length: bounded(Math.round(values?.[20] ?? 0), 0, 5) }, (_, planet) => {
            const px = values?.[21 + planet * 3] ?? 0,
              py = values?.[22 + planet * 3] ?? 0,
              orbit = (Math.hypot(px, py) / 10) * radius,
              mass = bounded(values?.[23 + planet * 3] ?? 0, 0, 1);
            return (
              <g key={planet}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={orbit}
                  fill="none"
                  stroke="rgba(208,168,80,.12)"
                  strokeWidth=".6"
                />
                <circle cx={toX(px)} cy={toY(py)} r={2.5 + 3.5 * mass} fill="#d0a850" />
              </g>
            );
          })}
          <g
            transform={`translate(${toX(values?.[2] ?? 0)} ${toY(values?.[3] ?? 0)}) rotate(${(Math.atan2(values?.[83] ?? 0.8, values?.[82] ?? 0) * 180) / Math.PI})`}
          >
            <path d="M8 0 L-6 -4 L-3 0 L-6 4 Z" fill={ORANGE} />
          </g>
        </>
      ) : null}
      {mode === 2 ? (
        <>
          {Array.from({ length: bounded(Math.round(values?.[36] ?? 0), 0, 9) }, (_, ball) => (
            <circle
              key={ball}
              cx={toX(values?.[37 + ball * 2] ?? 0)}
              cy={toY(values?.[38 + ball * 2] ?? 0)}
              r={(0.1 / 10) * radius * (ball === 0 ? 1.15 : 1)}
              fill={ball ? BLUE : ORANGE}
            />
          ))}
          {(values?.[55] ?? 0) > 0.5 ? (
            <>
              <line
                x1={toX(values?.[2] ?? 0)}
                y1={toY(values?.[3] ?? 0)}
                x2={toX(values?.[56] ?? 0)}
                y2={toY(values?.[57] ?? 0)}
                stroke="rgba(255,255,255,.6)"
                strokeWidth="1.2"
              />
              <line
                x1={toX(values?.[2] ?? 0)}
                y1={toY(values?.[3] ?? 0)}
                x2={toX((values?.[2] ?? 0) * 2 - (values?.[56] ?? 0))}
                y2={toY((values?.[3] ?? 0) * 2 - (values?.[57] ?? 0))}
                stroke={ORANGE}
                strokeOpacity=".5"
              />
            </>
          ) : null}
        </>
      ) : null}
      {mode === 3 ? (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={radius * 0.92}
            fill="none"
            stroke="#3a4a9a"
            strokeWidth="1.6"
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius * 0.92 * 0.3}
            fill="none"
            stroke="#3a4a9a"
            strokeWidth="1.2"
          />
          {Array.from({ length: 3 }, (_, ring) =>
            Array.from({ length: 12 }, (_, sector) =>
              (values?.[87 + ring * 12 + sector] ?? 0) > 0.5 ? null : (
                <path
                  key={`ring-${ring}-${sector}`}
                  d={arc(
                    9.2 * (0.3 + (0.7 * (ring + 1)) / 4),
                    (sector / 6) * Math.PI,
                    ((sector + 1) / 6) * Math.PI,
                  )}
                  fill="none"
                  stroke="#3a4a9a"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              ),
            ),
          )}
          {Array.from({ length: 4 }, (_, ring) =>
            Array.from({ length: 12 }, (_, sector) => {
              if ((values?.[135 + ring * 12 + sector] ?? 0) > 0.5) return null;
              const theta = ((sector + 1) / 6) * Math.PI,
                inner = 9.2 * (0.3 + (0.7 * ring) / 4),
                outer = 9.2 * (0.3 + (0.7 * (ring + 1)) / 4),
                [x0, y0] = polar(inner, theta),
                [x1, y1] = polar(outer, theta);
              return (
                <line
                  key={`rad-${ring}-${sector}`}
                  x1={x0}
                  y1={y0}
                  x2={x1}
                  y2={y1}
                  stroke="#3a4a9a"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              );
            }),
          )}
          {Array.from({ length: 48 }, (_, node) => {
            const ring = Math.floor(node / 12),
              sector = node % 12,
              [x, y] = polar(
                9.2 * (0.3 + (0.7 * (ring + 0.5)) / 4),
                ((sector + 0.5) / 6) * Math.PI,
              ),
              big = (values?.[183 + node] ?? 0) > 0.5,
              small = (values?.[231 + node] ?? 0) > 0.5;
            return big || small ? (
              <circle
                key={node}
                cx={x}
                cy={y}
                r={big ? 3.6 : 1.4}
                fill={big ? ORANGE : "#f0c060"}
              />
            ) : null;
          })}
          <path d={hungryPath} fill="#f5d030" />
          {(values?.[86] ?? 0) > 0 ? (
            <text x={cx} y={cy + 7} textAnchor="middle" fill="#f5d030" fontSize="22">
              LEVEL {Math.round(values?.[85] ?? 1)}
            </text>
          ) : (
            <>
              <text x={cx} y={cy - 3} textAnchor="middle" fill="#f0c060" fontSize="11">
                {Math.round(values?.[84] ?? 0)}
              </text>
              <text x={cx} y={cy + 9} textAnchor="middle" fill="rgba(240,192,96,.56)" fontSize="8">
                LV {Math.round(values?.[85] ?? 1)}
              </text>
            </>
          )}
        </>
      ) : null}
      {mode === 4 || mode === 5 ? (
        <>
          <path
            d={trailPath}
            fill="none"
            stroke="#4cc88a"
            strokeOpacity=".75"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x={cx - radius * 0.66} y={cy - radius * 0.62} fill="#4cc88a" fontSize="8">
            {mode === 5
              ? (values?.[64] ?? 1) > 1
                ? `ROSE ${Math.round(values?.[63] ?? 1)}/${Math.round(values?.[64] ?? 1)}`
                : `ROSE n=${Math.round(values?.[63] ?? 1)}`
              : [
                  "FD",
                  "LT FD",
                  "RT FD",
                  "ARC L",
                  "ARC R",
                  "LT",
                  "RT",
                  "SPIRAL",
                  "SETH",
                  "PU FD PD",
                  "HOME",
                ][bounded(Math.round(values?.[62] ?? 0), 0, 10)]}
          </text>
          {mode === 5 ? (
            <text x={cx - radius * 0.66} y={cy - radius * 0.62 + 10} fill="#4cc88a" fontSize="8">
              step={Math.round(values?.[65] ?? 1)}°
            </text>
          ) : null}
          <g
            transform={`translate(${turtleX} ${turtleY}) rotate(${(-turtleHeading * 180) / Math.PI})`}
          >
            <circle cx="-3.4" cy="-3" r="1.7" fill={turtlePen ? "#5ad089" : "#8a8e9a"} />
            <circle cx="3.4" cy="-3" r="1.7" fill={turtlePen ? "#5ad089" : "#8a8e9a"} />
            <circle cx="-3.4" cy="3" r="1.7" fill={turtlePen ? "#5ad089" : "#8a8e9a"} />
            <circle cx="3.4" cy="3" r="1.7" fill={turtlePen ? "#5ad089" : "#8a8e9a"} />
            <circle cx="0" cy="6.4" r="2.1" fill={turtlePen ? "#5ad089" : "#8a8e9a"} />
            <ellipse
              cx="0"
              cy="0"
              rx="4.3"
              ry="5.2"
              fill={turtlePen ? "#3fa86a" : "#707480"}
              stroke={turtlePen ? "#1e4a32" : "rgba(30,74,50,.5)"}
              strokeWidth=".8"
            />
            <path d="M-3.6 0 H3.6 M0 -4.6 V4.6" stroke="#1e4a32" strokeWidth=".6" />
          </g>
        </>
      ) : null}
    </>
  );
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
  SCALE_NAMES = [
    "Chroma",
    "Major",
    "Minor",
    "Penta+",
    "Penta-",
    "Blues",
    "Whole",
    "Harmonic",
    "Dorian",
    "Phrygian",
    "Lydian",
    "Mixolyd",
    "HarmMin",
    "Hijaz",
    "Hirajoshi",
    "Pelog",
    "Slendro",
    "MeloMin",
    "Locrian",
  ],
  CHANNEL_COLORS = [BLUE, "#00c300", "#ff4b00", "#7b25cb"],
  CHANNEL_OFF = ["#0d5986", "#064e06", "#661e00", "#331054"];

function ArrangeDisplay({ values }: DisplayProps) {
  const current = Math.round(values?.[0] ?? 0),
    edited = Math.round(values?.[1] ?? 0),
    barIn = Math.round(values?.[2] ?? 0),
    totalBars = Math.round(values?.[3] ?? 0),
    running = (values?.[4] ?? 0) > 0.5;
  return (
    <>
      <rect width="400" height="157" rx="4" fill={BACKGROUND} />
      <text x="14" y="10" fill={ORANGE} fontSize="11" dominantBaseline="middle">
        {`Bar ${totalBars}.${barIn + 1}`}
      </text>
      {Array.from({ length: 7 }, (_, index) => (
        <path key={`arrow-${index}`} d={`M${61 + index * 48} 36 l-9.25 4.25 v-8.5 Z`} fill={BLUE} />
      ))}
      {Array.from({ length: 8 }, (_, phrase) => {
        const offset = 5 + phrase * 12,
          bars = bounded(Math.round(values?.[offset] ?? 4), 1, 16),
          active = (values?.[offset + 1] ?? 1) > 0.5,
          root = bounded(Math.round(values?.[offset + 2] ?? 0), 0, 11),
          scale = bounded(Math.round(values?.[offset + 3] ?? 1), 0, SCALE_NAMES.length - 1),
          bpm = Math.round(values?.[offset + 4] ?? 120),
          inheritedRoot = (values?.[offset + 5] ?? 0) > 0.5,
          inheritedScale = (values?.[offset + 6] ?? 0) > 0.5,
          inheritedBpm = (values?.[offset + 7] ?? 0) > 0.5,
          left = 14 + phrase * 48,
          focused = phrase === edited,
          playing = running && phrase === current,
          textColor = focused ? "#fff" : active ? "#e6e6f0" : "#6e6e8a";
        return (
          <g key={phrase}>
            <rect
              x={left}
              y="18"
              width="36"
              height="36"
              rx="2"
              fill={!active ? "#1f1f34" : focused ? BLUE : PURPLE}
              stroke={playing ? ORANGE : "none"}
              strokeWidth={playing ? 1.5 : 0}
            />
            <text x={left + 5.5} y="31" fill={textColor} fontSize="12" dominantBaseline="middle">
              {`P${phrase + 1}`}
            </text>
            <text
              x={left + 31.5}
              y="30"
              fill={!active || inheritedRoot ? "#8a523a" : ORANGE}
              fontSize="9"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {NOTE_NAMES[root]}
            </text>
            <text
              x={left + 18}
              y="45"
              fill={!active || inheritedScale ? "#6e6e8a" : textColor}
              fontSize="9"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {SCALE_NAMES[scale]}
            </text>
            <text
              x={left + 18}
              y="60.5"
              fill={phrase === current ? ORANGE : !active || inheritedBpm ? "#8a523a" : ORANGE}
              fontSize="8"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {`${bpm} BPM`}
            </text>
            {Array.from({ length: 16 }, (_, bar) => {
              const column = bar % 4,
                row = Math.floor(bar / 4),
                here = playing && bar === barIn;
              return (
                <rect
                  key={`bar-${bar}`}
                  x={15 + phrase * 48 + column * 9}
                  y={68 + row * 9}
                  width="7"
                  height="7"
                  rx="1"
                  fill={here ? ORANGE : bar < bars ? BLUE : PURPLE}
                />
              );
            })}
            {Array.from({ length: 4 }, (_, channel) => (
              <rect
                key={`channel-${channel}`}
                x={15 + phrase * 48}
                y={106 + channel * 11}
                width="34"
                height="9"
                rx="1.5"
                fill={
                  (values?.[offset + 8 + channel] ?? 1) > 0.5
                    ? CHANNEL_COLORS[channel]
                    : CHANNEL_OFF[channel]
                }
              />
            ))}
          </g>
        );
      })}
    </>
  );
}

function MeterXDisplay({ values }: DisplayProps) {
  const barPosition = values?.[0] ?? 0,
    periods = [1, 2, 4, 8, 16, 32, 64, 128];
  return (
    <>
      {periods.map((period, index) => {
        const fraction = (((barPosition % period) + period) % period) / period,
          cx = 18 * (75 / 25.4),
          cy = (42 + index * 11) * (75 / 25.4),
          radius = 2.1 * (75 / 25.4),
          angle = -Math.PI / 2 + fraction * Math.PI * 2,
          endX = cx + radius * Math.cos(angle),
          endY = cy + radius * Math.sin(angle),
          large = fraction > 0.5 ? 1 : 0;
        return (
          <g key={period}>
            <circle cx={cx} cy={cy} r={radius} fill="#d8d8d0" />
            {fraction > 0.001 ? (
              <path
                d={`M${cx} ${cy} L${cx} ${cy - radius} A${radius} ${radius} 0 ${large} 1 ${endX} ${endY} Z`}
                fill="#e0803f"
              />
            ) : null}
          </g>
        );
      })}
    </>
  );
}

function OpEnvDisplay({ values }: DisplayProps) {
  const release = bounded(values?.[2] ?? 0.7, 0, 1),
    levels = Array.from({ length: 4 }, (_, index) =>
      bounded(values?.[4 + index] ?? [1, 0.5, 0.78, 0][index], 0, 1),
    ),
    env = Array.from({ length: 120 }, (_, index) => bounded(values?.[8 + index] ?? 0, 0, 1)),
    scope = Array.from({ length: 120 }, (_, index) => bounded(values?.[128 + index] ?? 0, 0, 1)),
    voice = ascii(values, 248, 11) || "E.PIANO 1",
    bank = ascii(values, 260, 32) || "OP ENV",
    px = (fraction: number) => 8 + fraction * 170,
    py = (amplitude: number) => 57 - amplitude * 41,
    path = (samples: number[]) =>
      samples
        .map((sample, index) => `${index ? "L" : "M"}${px(index / 119)} ${py(sample)}`)
        .join(" ");
  return (
    <>
      <rect x=".5" y=".5" width="185" height="59" rx="4" fill={BACKGROUND} stroke="#404060" />
      <text x="8" y="11" fill={ORANGE} fontSize="9">{`${Math.round(values?.[0] ?? 0) + 1} `}</text>
      <text x="22" y="11" fill="#fff" fontSize="9">
        {voice}
      </text>
      <text x="178" y="11" fill="rgba(160,168,192,.8)" fontSize="9" textAnchor="end">
        {bank}
      </text>
      {levels.map((level, index) => (
        <g key={index}>
          <line x1="8" y1={py(level)} x2="178" y2={py(level)} stroke="#2b2b42" strokeWidth=".7" />
          <text
            x="6.5"
            y={py(level)}
            fill="rgba(122,130,160,.73)"
            fontSize="7"
            textAnchor="end"
            dominantBaseline="middle"
          >{`L${index + 1}`}</text>
        </g>
      ))}
      {[0, release].map((position, index) => (
        <g key={position}>
          <line
            x1={px(position)}
            y1="16"
            x2={px(position)}
            y2="57"
            stroke="#2b2b42"
            strokeWidth=".7"
          />
          <text
            x={px(position)}
            y="18"
            fill="rgba(122,130,160,.73)"
            fontSize="7"
            textAnchor="middle"
          >
            {index ? "off" : "on"}
          </text>
        </g>
      ))}
      <path d={path(env)} fill="none" stroke={BLUE} strokeWidth="1.1" />
      <path d={path(scope)} fill="none" stroke={ORANGE} strokeWidth="1.2" />
    </>
  );
}

function OperatorDisplay({ values }: DisplayProps) {
  const tab = Math.round(values?.[0] ?? 0),
    algorithm = Math.round(values?.[1] ?? 0),
    carriers = Math.round(values?.[2] ?? 0),
    voice = ascii(values, 281, 11) || "E.PIANO 1",
    bank = ascii(values, 293, 32) || "BELL";
  return (
    <>
      <rect x=".5" y=".5" width="173" height="158" rx="4" fill={BACKGROUND} stroke="#404060" />
      {["OPERATORS", "ENVELOPE"].map((label, index) => (
        <g key={label}>
          <rect
            x={7 + index * 80}
            y="8"
            width="78"
            height="18"
            rx="2"
            fill={tab === index ? "#0d5986" : PURPLE}
          />
          <text
            x={46 + index * 80}
            y="17"
            fill={tab === index ? "#fff" : "#808080"}
            fontSize="9"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {label}
          </text>
        </g>
      ))}
      <path d={`M7 32 H165 M${46 + tab * 80} 28 V32.5`} stroke="#0d5988" strokeWidth="1" />
      <text x="13.4" y="43" fill="#fff" fontSize="9">
        {bank}
      </text>
      <text
        x="13.4"
        y="53"
        fill={ORANGE}
        fontSize="9"
      >{`${Math.round(values?.[3] ?? 0) + 1} `}</text>
      <text x="27" y="53" fill="#fff" fontSize="9">
        {voice}
      </text>
      <text
        x="160.6"
        y="53"
        fill="rgba(160,168,192,.8)"
        fontSize="8"
        textAnchor="end"
      >{`ALG ${algorithm + 1}`}</text>
      {tab === 0 ? (
        <>
          {Array.from({ length: 6 }, (_, index) => {
            const offset = 11 + index * 5,
              id = Math.round(values?.[offset] ?? 6 - index),
              column = Math.round(values?.[offset + 1] ?? index),
              row = Math.round(values?.[offset + 2] ?? 3),
              enabled = (values?.[5 + (6 - id)] ?? 1) > 0.5,
              carrier = ((carriers >> (6 - id)) & 1) !== 0,
              x = 12.567 + column * 26,
              y = 56 + row * 26;
            return (
              <g key={id}>
                {!carrier ? (
                  <line
                    x1={x + 9}
                    y1={y + 18}
                    x2={x + 9}
                    y2={y + 26}
                    stroke={enabled ? BLUE : "rgba(0,151,222,.25)"}
                    strokeWidth="1.2"
                  />
                ) : null}
                <rect
                  x={x}
                  y={y}
                  width="18"
                  height="18"
                  rx="2"
                  fill={enabled ? (carrier ? ORANGE : "#33ace5") : carrier ? "#4a4a66" : PURPLE}
                  stroke={
                    carrier && enabled
                      ? "none"
                      : carrier
                        ? "rgba(236,101,46,.33)"
                        : enabled
                          ? BLUE
                          : "rgba(0,151,222,.25)"
                  }
                />
                <text
                  x={x + 9}
                  y={y + 9}
                  fill={enabled ? "#fff" : "rgba(255,255,255,.53)"}
                  fontSize="11"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {id}
                </text>
              </g>
            );
          })}
        </>
      ) : (
        <>
          {[104, 156].map((baseline) => (
            <line
              key={baseline}
              x1="12.567"
              y1={baseline}
              x2="160.567"
              y2={baseline}
              stroke={PURPLE}
            />
          ))}
          <path
            d={Array.from(
              { length: 120 },
              (_, index) =>
                `${index ? "L" : "M"}${12.567 + (index / 119) * 148} ${104 - bounded(values?.[41 + index] ?? 0, 0, 1) * 47}`,
            ).join(" ")}
            fill="none"
            stroke={BLUE}
            strokeWidth="1"
          />
          <path
            d={Array.from(
              { length: 120 },
              (_, index) =>
                `${index ? "L" : "M"}${12.567 + (index / 119) * 148} ${156 - bounded(values?.[161 + index] ?? 0, 0, 1) * 46}`,
            ).join(" ")}
            fill="none"
            stroke={ORANGE}
            strokeWidth="1.2"
          />
        </>
      )}
    </>
  );
}

function PhaseDisplay({ values }: DisplayProps) {
  return (
    <>
      {[0, 1].map((row) => {
        const offset = row * 9,
          loaded = (values?.[offset] ?? 0) > 0.5,
          start = bounded(values?.[offset + 1] ?? 0, 0, 1),
          end = bounded(values?.[offset + 2] ?? 1, 0, 1),
          head = bounded(values?.[offset + 3] ?? 0, 0, 1),
          rotation = values?.[offset + 4] ?? 0,
          recording = (values?.[offset + 5] ?? 0) > 0.5,
          recordHead = bounded(values?.[offset + 6] ?? 0, 0, 1),
          cueCount = bounded(Math.round(values?.[offset + 7] ?? 0), 0, 128),
          top = row * 35.433,
          color = recording
            ? "rgba(255,60,60,.86)"
            : row
              ? "rgba(255,140,80,.78)"
              : "rgba(100,180,255,.78)",
          handle = row ? "rgb(255,200,160)" : "rgb(200,220,255)",
          miniOffset = 18 + row * 512,
          rawSamples = Array.from({ length: 512 }, (_, index) =>
            bounded(values?.[miniOffset + index] ?? 0, -1, 1),
          ),
          loopStart = Math.floor(start * rawSamples.length),
          loopEnd = Math.floor(end * rawSamples.length),
          loopLength = loopEnd - loopStart,
          rawRotation = loopLength > 0 ? Math.floor(rotation * rawSamples.length) % loopLength : 0,
          rotationOffset = rawRotation < 0 ? rawRotation + loopLength : rawRotation,
          samples = rawSamples.map((sample, index) => {
            if (index < loopStart || index >= loopEnd || loopLength <= 0) return sample;
            return rawSamples[loopStart + ((index - loopStart + rotationOffset) % loopLength)];
          }),
          pathTop = samples
            .map(
              (sample, index) =>
                `${index ? "L" : "M"}${(index / 512) * 270} ${top + 17.716 - sample * 15.944}`,
            )
            .join(" "),
          pathBottom = samples
            .map((sample, index) => `L${(index / 512) * 270} ${top + 17.716 + sample * 15.944}`)
            .reverse()
            .join(" ");
        return (
          <g key={row}>
            {loaded || recording ? <path d={`${pathTop} ${pathBottom} Z`} fill={color} /> : null}
            <rect x="0" y={top} width={start * 270} height="35.433" fill="rgba(10,10,20,.78)" />
            <rect
              x={end * 270}
              y={top}
              width={(1 - end) * 270}
              height="35.433"
              fill="rgba(10,10,20,.78)"
            />
            {Array.from({ length: cueCount }, (_, cue) => (
              <line
                key={cue}
                x1={(values?.[(row ? 1170 : 1042) + cue] ?? 0) * 270}
                y1={top + 1}
                x2={(values?.[(row ? 1170 : 1042) + cue] ?? 0) * 270}
                y2={top + 34.433}
                stroke={row ? "rgba(255,180,120,.39)" : "rgba(150,210,255,.39)"}
                strokeWidth=".75"
              />
            ))}
            <line
              x1={(recording ? recordHead : head) * 270}
              y1={top}
              x2={(recording ? recordHead : head) * 270}
              y2={top + 35.433}
              stroke={recording ? "rgb(255,80,80)" : "rgba(255,255,255,.86)"}
              strokeWidth="1.5"
            />
            {!recording ? (
              <>
                <path
                  d={`M${start * 270} ${top + 1} V${top + 34.433} M${start * 270} ${top + 1} h5 M${start * 270} ${top + 33.433} h5`}
                  stroke={handle}
                  strokeWidth="1"
                />
                <path
                  d={`M${end * 270} ${top + 1} V${top + 34.433} M${end * 270} ${top + 1} h-5 M${end * 270} ${top + 33.433} h-5`}
                  stroke={handle}
                  strokeWidth="1"
                />
              </>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

function noteIsWhite(note: number) {
  return [0, 2, 4, 5, 7, 9, 11].includes(((note % 12) + 12) % 12);
}

function GridInstrumentDisplay({ values, record }: DisplayProps & { record: boolean }) {
  const view = Math.round(values?.[0] ?? 1),
    layout = Math.round(values?.[1] ?? 0),
    root = Math.round(values?.[2] ?? 0),
    count = record ? 0 : Math.round(values?.[5] ?? 0),
    sampledOffset = record ? 9 : 6,
    mappedOffset = sampledOffset,
    rootOffset = 134,
    playingOffset = 262,
    gridOffset = record ? 137 : 390,
    nameOffset = record ? 745 : 486,
    statusOffset = record ? 794 : 535,
    name = ascii(values, nameOffset, 48) || (record ? "Instrument" : "no instrument"),
    status = ascii(values, statusOffset, 48) || (record ? "ready" : "load .sfz"),
    current = record ? Math.round(values?.[7] ?? -1) : -1,
    low = record ? Math.round(values?.[5] ?? 36) : 0,
    high = record ? Math.round(values?.[6] ?? 84) : 127,
    progress = record ? bounded(values?.[8] ?? 0, 0, 1) : 0;
  return (
    <>
      <rect width="215.551" height="168.307" rx="3" fill={BACKGROUND} />
      {["GRID", "PIANO"].map((label, index) => {
        const selected = view === (index ? 0 : 1),
          tabWidth = (215.551 - 16) / 2;
        return (
          <g key={label}>
            <rect
              x={6 + index * (tabWidth + 4)}
              y="4"
              width={tabWidth}
              height="15"
              rx="2"
              fill={selected ? "#0d5986" : "#2a2a3e"}
            />
            <text
              x={6 + tabWidth / 2 + index * (tabWidth + 4)}
              y="11.5"
              fill={selected ? "#e6e6f0" : "#6a6a88"}
              fontSize="9"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {label}
            </text>
          </g>
        );
      })}
      <text x="6" y="31" fill="#c8c8e0" fontSize="10">
        {name}
      </text>
      <text
        x="209.551"
        y="31"
        fill={record ? ORANGE : "#00c8ff"}
        fontSize={record ? 8 : 10}
        textAnchor="end"
      >
        {record ? status : `${count} voices`}
      </text>
      {record ? (
        <>
          <rect x="6" y="35" width="203.551" height="2.5" rx="1" fill={PURPLE} />
          <rect x="6" y="35" width={203.551 * progress} height="2.5" rx="1" fill={BLUE} />
        </>
      ) : null}
      {view === 1 ? (
        Array.from({ length: 96 }, (_, displayIndex) => {
          const displayRow = Math.floor(displayIndex / 12),
            column = displayIndex % 12,
            musicalRow = 7 - displayRow,
            note = Math.round(values?.[gridOffset + musicalRow * 12 + column] ?? -1),
            top = record ? 40 : 32,
            availableHeight = 168.307 - 6 - top,
            pad = Math.min((215.551 - 12) / 12, availableHeight / 8),
            x0 = (215.551 - pad * 12) / 2,
            y0 = top + Math.max(0, (availableHeight - pad * 8) / 2),
            size = pad * 0.88,
            x = x0 + column * pad + (pad - size) / 2,
            y = y0 + displayRow * pad + (pad - size) / 2,
            sampled = note >= 0 && (values?.[mappedOffset + note] ?? 0) > 0.5,
            isPlaying =
              note >= 0 &&
              (record ? note === current : (values?.[playingOffset + note] ?? 0) > 0.5),
            isRoot =
              note >= 0 &&
              (record
                ? (((note - root) % 12) + 12) % 12 === 0
                : (values?.[rootOffset + note] ?? 0) > 0.5),
            inRange = note >= low && note <= high,
            accidental = note >= 0 && !noteIsWhite(note),
            fill =
              note < 0
                ? "#141422"
                : isPlaying
                  ? "#00c8ff"
                  : sampled
                    ? BLUE
                    : record && inRange
                      ? "#254c66"
                      : layout === 2
                        ? accidental
                          ? "#23232e"
                          : "#404054"
                        : "#20202c";
          return (
            <g key={displayIndex}>
              <rect x={x} y={y} width={size} height={size} rx="2" fill={fill} />
              {isRoot ? (
                <rect
                  x={x + 0.5}
                  y={y + 0.5}
                  width={size - 1}
                  height={size - 1}
                  rx="2"
                  fill="none"
                  stroke="rgba(255,208,96,.8)"
                  strokeWidth="1.2"
                />
              ) : null}
            </g>
          );
        })
      ) : (
        <>
          {record ? (
            <RecordScope values={values} />
          ) : (
            <text x="6" y="43" fill="#8a8ab0" fontSize="9">
              {status}
            </text>
          )}
          <PianoDisplay
            values={values}
            record={record}
            mappedOffset={mappedOffset}
            rootOffset={rootOffset}
            playingOffset={playingOffset}
            current={current}
            low={low}
            high={high}
          />
        </>
      )}
    </>
  );
}

function RecordScope({ values }: { values?: number[] }) {
  const top = Array.from(
      { length: 256 },
      (_, index) =>
        `${index ? "L" : "M"}${6 + (index / 255) * 203.551} ${85.15 - bounded(values?.[489 + index] ?? 0, -1, 1) * 42.15}`,
    ).join(" "),
    bottom = Array.from(
      { length: 256 },
      (_, index) =>
        `L${6 + (index / 255) * 203.551} ${85.15 - bounded(values?.[233 + index] ?? 0, -1, 1) * 42.15}`,
    )
      .reverse()
      .join(" ");
  return (
    <>
      <line
        x1="6"
        y1="85.15"
        x2="209.551"
        y2="85.15"
        stroke="rgba(138,138,176,.25)"
        strokeWidth=".5"
      />
      <path d={`${top} ${bottom} Z`} fill="rgba(0,151,222,.87)" />
    </>
  );
}

function PianoDisplay({
  values,
  record,
  mappedOffset,
  rootOffset,
  playingOffset,
  current,
  low,
  high,
}: {
  values?: number[];
  record: boolean;
  mappedOffset: number;
  rootOffset: number;
  playingOffset: number;
  current: number;
  low: number;
  high: number;
}) {
  const first = 21,
    last = 108,
    whites = Array.from({ length: last - first + 1 }, (_, index) => first + index).filter(
      noteIsWhite,
    ),
    left = 6,
    width = 203.551,
    top = record ? 132.307 : 122.307,
    height = record ? 24 : 28,
    whiteWidth = width / whites.length;
  return (
    <>
      {whites.map((note, index) => {
        const active = record ? note === current : (values?.[playingOffset + note] ?? 0) > 0.5,
          mapped = (values?.[mappedOffset + note] ?? 0) > 0.5,
          root = !record && (values?.[rootOffset + note] ?? 0) > 0.5,
          inRange = note >= low && note <= high;
        return (
          <rect
            key={note}
            x={left + index * whiteWidth + 0.6}
            y={top}
            width={whiteWidth - 1.2}
            height={height}
            rx="1.4"
            fill={
              active
                ? "#00c8ff"
                : root || mapped
                  ? root
                    ? BLUE
                    : "#254c66"
                  : record && inRange
                    ? "#254c66"
                    : "#3a3a4a"
            }
          />
        );
      })}
      {Array.from({ length: last - first + 1 }, (_, index) => first + index)
        .filter((note) => !noteIsWhite(note))
        .map((note) => {
          const before = whites.filter((white) => white < note).length,
            active = record ? note === current : (values?.[playingOffset + note] ?? 0) > 0.5,
            mapped = (values?.[mappedOffset + note] ?? 0) > 0.5,
            root = !record && (values?.[rootOffset + note] ?? 0) > 0.5,
            inRange = note >= low && note <= high,
            blackWidth = whiteWidth * 0.6,
            x = left + before * whiteWidth - blackWidth / 2;
          return (
            <g key={note}>
              <rect
                x={x - 0.9}
                y={top}
                width={blackWidth + 1.8}
                height={height * 0.62 + 0.9}
                rx="1.6"
                fill={BACKGROUND}
              />
              <rect
                x={x}
                y={top}
                width={blackWidth}
                height={height * 0.62}
                rx="1.2"
                fill={
                  active
                    ? "#00c8ff"
                    : root
                      ? BLUE
                      : mapped || (record && inRange)
                        ? "#1b3a4e"
                        : "#20202c"
                }
              />
            </g>
          );
        })}
    </>
  );
}

type DisplayProps = { values?: number[]; width: number; height: number };

function DisplayContents({ model, values, width, height }: DisplayProps & { model: string }) {
  if (model === "Arrange") return <ArrangeDisplay values={values} width={400} height={157} />;
  if (model === "Band") return <BandDisplay values={values} width={width} height={height} />;
  if (model === "Beat") return <BeatDisplay values={values} width={174} height={155} />;
  if (model === "Chance") return <ChanceDisplay values={values} width={400} height={178} />;
  if (model === "Cycle") return <CycleDisplay values={values} width={width} height={height} />;
  if (model === "Gravity") return <GravityDisplay values={values} width={width} height={height} />;
  if (model === "Intone") return <IntoneDisplay values={values} width={width} height={height} />;
  if (model === "Meter") return <MeterDisplay values={values} width={width} height={height} />;
  if (model === "MeterX") return <MeterXDisplay values={values} width={width} height={height} />;
  if (model === "Muse")
    return <MuseDisplay values={values} width={width} height={height} scope={false} />;
  if (model === "MuseScope")
    return <MuseDisplay values={values} width={width} height={height} scope />;
  if (model === "Note") return <NoteDisplay values={values} width={174} height={228} />;
  if (model === "Overtone")
    return <OvertoneDisplay values={values} width={width} height={height} />;
  if (model === "OpEnv") return <OpEnvDisplay values={values} width={186} height={60} />;
  if (model === "Operator") return <OperatorDisplay values={values} width={174} height={159} />;
  if (model === "Phase") return <PhaseDisplay values={values} width={270} height={70.866} />;
  if (model === "Play")
    return (
      <GridInstrumentDisplay values={values} width={215.551} height={168.307} record={false} />
    );
  if (model === "Record")
    return <GridInstrumentDisplay values={values} width={215.551} height={168.307} record />;
  if (model === "Swell") return <SwellDisplay values={values} width={width} height={height} />;
  if (model === "Wave") return <WaveDisplay values={values} width={width} height={height} />;
  return null;
}

const INTERACTIVE = new Set([
  "Arrange",
  "Beat",
  "Chance",
  "Gravity",
  "Note",
  "Operator",
  "Phase",
  "Play",
  "Record",
]);
const LOGICAL_SIZE: Record<string, [number, number]> = {
  Arrange: [400, 157],
  Beat: [174, 155],
  Chance: [400, 178],
  Note: [174, 228],
  OpEnv: [186, 60],
  Operator: [174, 159],
  Phase: [270, 70.866],
  Play: [215.551, 168.307],
  Record: [215.551, 168.307],
};

export function RackSignalFunctionSetDisplay({
  values,
  model,
  actionBase,
  eventShift,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  model: string;
  actionBase: number;
  eventShift: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n(),
    interactive = INTERACTIVE.has(model),
    [logicalWidth, logicalHeight] = LOGICAL_SIZE[model] ?? [width, height],
    encode = (
      event: PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement> | WheelEvent<SVGSVGElement>,
      kind: number,
    ) => {
      const rect = event.currentTarget.getBoundingClientRect(),
        px = bounded(
          Math.round(((event.clientX - rect.left) / Math.max(1, rect.width)) * 1023),
          0,
          1023,
        ),
        py = bounded(
          Math.round(((event.clientY - rect.top) / Math.max(1, rect.height)) * 1023),
          0,
          1023,
        ),
        shift = event.shiftKey ? 1 << 21 : 0;
      return actionBase + (kind << eventShift) + shift + (py << 10) + px;
    },
    send = (
      event: PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement>,
      kind: number,
      end = false,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      const id = encode(event, kind);
      onAction(id, true);
      if (end) onAction(id, false);
    };
  return (
    <svg
      className="pw-signal-function-set-display"
      aria-label={t("display.signalFunctionSet", { model })}
      viewBox={`0 0 ${logicalWidth} ${logicalHeight}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: interactive ? "none" : undefined,
        pointerEvents: interactive ? "auto" : "none",
      }}
      onPointerDown={
        interactive
          ? (event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              send(event, 0);
            }
          : undefined
      }
      onPointerMove={
        interactive
          ? (event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) send(event, 1);
            }
          : undefined
      }
      onPointerUp={
        interactive
          ? (event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              send(event, 2, true);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          : undefined
      }
      onPointerCancel={
        interactive
          ? (event) => {
              send(event, 2, true);
            }
          : undefined
      }
      onDoubleClick={interactive ? (event) => send(event, 3, true) : undefined}
      onWheel={
        interactive
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              const id = encode(event, event.deltaY < 0 ? 4 : 5);
              onAction(id, true);
              onAction(id, false);
            }
          : undefined
      }
    >
      <DisplayContents model={model} values={values} width={logicalWidth} height={logicalHeight} />
    </svg>
  );
}
