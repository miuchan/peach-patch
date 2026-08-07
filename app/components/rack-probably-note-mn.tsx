import { useMemo, useState, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type ProbablyVisual = Extract<RuntimeVisual, { kind: "probably-note-mn" }>;

type Pitch = {
  pitch: number;
  dissonance: number;
  inUse: boolean;
  probability: number;
  type: number;
  numerator: number;
  denominator: number;
  tempering: number;
};

const GREEN = "#4ac327";
const YELLOW = "#ffff00";
const DIM_YELLOW = "rgba(255,255,0,.56)";

function value(values: number[], index: number) {
  const result = values[index] ?? 0;
  return Number.isFinite(result) ? result : 0;
}

function decode(values: number[], offset: number, length: number) {
  let text = "";
  for (let index = 0; index < length; index++) {
    const code = Math.round(values[offset + index] ?? 0);
    if (!code) break;
    text += String.fromCharCode(code);
  }
  return text;
}

function endpoint(pitch: number, radius: number, centerX = 585.5, centerY = 241.5) {
  const angle = (pitch / 1200) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * radius + centerX, y: Math.sin(angle) * radius + centerY };
}

/** Exact dynamic overlay and hover inspector for Frozen Wasteland ProbablyNoteMN. */
export function RackProbablyNoteMn({
  visual,
  values = [],
  scaleX,
}: {
  visual: ProbablyVisual;
  values?: number[];
  scaleX: number;
}) {
  const pitchCount = Math.max(0, Math.min(visual.maxPitches, Math.round(value(values, 0))));
  const temperingCount = Math.max(0, Math.min(visual.maxPitches, Math.round(value(values, 1))));
  const selectedPitch = Math.round(value(values, 2));
  const pitches = useMemo(
    () =>
      Array.from({ length: pitchCount }, (_, index): Pitch => {
        const offset = visual.fixedValues + index * visual.pitchStride;
        return {
          pitch: value(values, offset),
          dissonance: value(values, offset + 1),
          inUse: value(values, offset + 2) > 0.5,
          probability: value(values, offset + 3),
          type: Math.round(value(values, offset + 4)),
          numerator: value(values, offset + 5),
          denominator: value(values, offset + 6),
          tempering: value(values, offset + 7),
        };
      }),
    [pitchCount, values, visual.fixedValues, visual.pitchStride],
  );
  const temperingOffset = visual.fixedValues + pitchCount * visual.pitchStride;
  const temperingPitches = useMemo(
    () =>
      Array.from({ length: temperingCount }, (_, index) => value(values, temperingOffset + index)),
    [temperingCount, temperingOffset, values],
  );
  const [inspected, setInspected] = useState(-1);
  const octaveSize = value(values, 5);
  const octaveScaleConstant = value(values, 27);
  const gridMode = Math.round(value(values, 4));
  const gridPitches: Array<{ pitch: number; major: boolean }> = [];
  if (gridMode === 1) {
    const count = Math.max(0, Math.ceil((octaveSize - 1) * 12));
    for (let index = 0; index < count; index++)
      gridPitches.push({ pitch: count ? (index / count) * 1200 : 0, major: index % 12 === 0 });
  } else if (gridMode === 2 || gridMode === 3) {
    const cents = (octaveSize - 1) * 1200;
    const offset = gridMode === 2 ? 384 : 412;
    for (let index = 0; index < 28; index++) {
      const pitch = value(values, offset + index);
      if (pitch > cents) break;
      gridPitches.push({ pitch: cents ? (pitch / cents) * 1200 : 0, major: index % 7 === 6 });
    }
  }

  const factors = Array.from({ length: 10 }, (_, index) => ({
    name: decode(values, 64 + index * 12, 12),
    numeratorSteps: Math.round(value(values, 32 + index * 3)),
    denominatorSteps: Math.round(value(values, 33 + index * 3)),
    tempering: value(values, 34 + index * 3),
  }));
  const noteName = decode(values, 360, 16);
  const inspector = inspected >= 0 ? pitches[inspected] : undefined;
  const text = (
    x: number,
    y: number,
    content: string | number,
    options: { anchor?: "start" | "middle" | "end"; size?: number; color?: string } = {},
  ) => (
    <text
      x={x}
      y={y}
      textAnchor={options.anchor ?? "start"}
      fontFamily="DejaVu Sans Mono, ui-monospace, monospace"
      fontSize={options.size ?? 9}
      fill={options.color ?? GREEN}
      letterSpacing="-1"
    >
      {content}
    </text>
  );

  return (
    <svg
      aria-label="Probably Note Math Nerd pitch display"
      viewBox={`0 0 ${visual.width} ${visual.height}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 12,
        pointerEvents: "none",
      }}
    >
      <g fill="none" strokeWidth="1">
        {gridPitches.map((grid, index) => {
          const point = endpoint(grid.pitch, 75);
          return (
            <line
              key={`grid-${index}`}
              x1={point.x}
              y1={point.y}
              x2="585.5"
              y2="241.5"
              stroke={grid.major ? "#808080" : "#404040"}
            />
          );
        })}
        {value(values, 3) > 0
          ? temperingPitches.map((pitch, index) => {
              const point = endpoint(pitch, 75);
              return (
                <line
                  key={`tempering-${index}`}
                  x1={point.x}
                  y1={point.y}
                  x2="585.5"
                  y2="241.5"
                  stroke="rgba(74,35,199,.31)"
                />
              );
            })
          : null}
        {pitches.map((pitch, index) => {
          const outer = endpoint(pitch.pitch, 75);
          const inner = endpoint(pitch.pitch, pitch.dissonance * 75);
          const opacity = Math.max(70, Math.min(255, pitch.probability * 255)) / 255;
          const color =
            index === selectedPitch
              ? `rgba(74,195,39,${opacity})`
              : pitch.inUse
                ? `rgba(255,255,0,${opacity})`
                : `rgba(255,0,0,${opacity})`;
          return (
            <line
              key={`pitch-${index}`}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={color}
            />
          );
        })}
      </g>

      {noteName
        ? text(564, 82, noteName, { color: value(values, 8) !== 0 ? DIM_YELLOW : GREEN })
        : null}
      {Math.round(value(values, 9)) !== 0
        ? text(578, 332, `+${Math.round(value(values, 9))}`, { anchor: "end" })
        : null}
      {text(532, 109, octaveSize.toFixed(3), { anchor: "end" })}

      {Math.round(value(values, 10)) === 0 ? (
        <>
          {text(344, 49, Math.round(value(values, 11)), {
            anchor: "end",
            color: value(values, 11) > 0 ? GREEN : YELLOW,
          })}
          {text(403, 49, Math.round(value(values, 12)), {
            anchor: "end",
            color: value(values, 11) > 0 ? GREEN : YELLOW,
          })}
          {text(460, 49, Math.round(value(values, 13)), {
            anchor: "end",
            color: value(values, 11) > 0 ? GREEN : YELLOW,
          })}
        </>
      ) : (
        text(344, 49, value(values, 14).toFixed(3), { anchor: "end" })
      )}

      {text(331, 131, Math.round(value(values, 15)), {
        anchor: "end",
        color:
          value(values, 19) > 0.5
            ? "#ff0000"
            : value(values, 15) || value(values, 16)
              ? GREEN
              : YELLOW,
      })}
      {text(377, 131, Math.round(value(values, 16)), {
        anchor: "end",
        color:
          value(values, 19) > 0.5
            ? "#ff0000"
            : value(values, 15) || value(values, 16)
              ? GREEN
              : YELLOW,
      })}
      {text(423, 131, value(values, 17).toFixed(3), {
        anchor: "end",
        color:
          value(values, 19) > 0.5
            ? "#ff0000"
            : value(values, 15) || value(values, 16)
              ? GREEN
              : YELLOW,
      })}
      {text(469, 131, Math.round(value(values, 18)), {
        anchor: "end",
        color:
          value(values, 19) > 0.5
            ? "#ff0000"
            : value(values, 15) || value(values, 16)
              ? GREEN
              : YELLOW,
      })}

      {factors.map((factor, index) => {
        const y = 30 + index * 34.5;
        const factorColor =
          factor.numeratorSteps === 0 && factor.denominatorSteps === 0
            ? "rgba(255,255,0,.81)"
            : GREEN;
        const temperColor =
          factor.tempering === 0 ? GREEN : factor.tempering > 0 ? "#376af3" : "#c32727";
        return (
          <g key={`factor-${index}`}>
            {text(40, y + 0.5, factor.name, { anchor: "end", size: 11, color: factorColor })}
            {text(109, y, factor.numeratorSteps, {
              anchor: "end",
              color: factor.numeratorSteps === 0 ? DIM_YELLOW : GREEN,
            })}
            {text(184, y, factor.denominatorSteps, {
              anchor: "end",
              color: factor.denominatorSteps === 0 ? DIM_YELLOW : GREEN,
            })}
            {text(262, y, factor.tempering.toFixed(2), { anchor: "end", color: temperColor })}
          </g>
        );
      })}

      {Math.round(value(values, 20)) !== 0 ? text(404, 200, decode(values, 232, 24)) : null}
      {text(334, 200, decode(values, 184, 48), {
        color: value(values, 21) <= value(values, 22) ? GREEN : YELLOW,
      })}
      {value(values, 3) > 0 ? (
        <>
          {text(307, 259, decode(values, 256, 24))}
          {text(411, 259, `${(value(values, 23) * 100).toFixed(2)} %`, {
            anchor: "end",
            color: value(values, 11) > 0 ? GREEN : YELLOW,
          })}
          {text(468, 259, `${(value(values, 24) * 100).toFixed(2)} %`, {
            anchor: "end",
            color: value(values, 11) > 0 ? GREEN : YELLOW,
          })}
        </>
      ) : null}
      {value(values, 25) > 0 ? (
        <>
          {text(324, 318.5, decode(values, 280, 32))}
          {text(414, 318.5, decode(values, 312, 48))}
        </>
      ) : null}
      {text(608.5, 159, Math.round(value(values, 6)), { anchor: "end" })}

      {inspector ? (
        <g>
          <rect
            x="420"
            y="159"
            width="100"
            height="60"
            fill="#101015"
            stroke="#999"
            strokeWidth="1"
          />
          {text(422, 169, `Type: ${["JI", "EDO", "Equal Step", "MOS"][inspector.type] ?? ""}`)}
          {text(
            422,
            179,
            `Ratio: ${inspector.numerator.toFixed(0)}/${inspector.denominator.toFixed(0)}`,
          )}
          {text(422, 189, `Tempering: ${inspector.tempering.toFixed(3)}`)}
          {text(422, 199, `Pitch: ${(inspector.pitch * octaveScaleConstant).toFixed(3)}`)}
        </g>
      ) : null}

      <circle
        cx="585.5"
        cy="241.5"
        r="75"
        fill="transparent"
        style={{ pointerEvents: "auto", cursor: "crosshair" }}
        onPointerMove={(event: PointerEvent<SVGCircleElement>) => {
          const svg = event.currentTarget.ownerSVGElement;
          if (!svg) return;
          const bounds = svg.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) * visual.width) / Math.max(1, bounds.width);
          const y = ((event.clientY - bounds.top) * visual.height) / Math.max(1, bounds.height);
          let found = -1;
          let closest = 1;
          pitches.forEach((pitch, index) => {
            const point = endpoint(pitch.pitch, 75);
            const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
            if (distance < closest) {
              closest = distance;
              found = index;
            }
          });
          setInspected(found);
        }}
        onPointerLeave={() => setInspected(-1)}
      />
    </svg>
  );
}
