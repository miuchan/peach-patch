import { useState, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type MootsVisual = Extract<RuntimeVisual, { kind: "sapphire-moots" }>;
type OutputSelectorVisual = Extract<RuntimeVisual, { kind: "sapphire-output-selector" }>;

function stop(event: PointerEvent<HTMLButtonElement>) {
  event.preventDefault();
  event.stopPropagation();
}

/** Exact overlay assets and anti-click glyphs from Sapphire's MootsWidget. */
export function RackSapphireMoots({
  visual,
  state,
  scaleX,
  onState,
}: {
  visual: MootsVisual;
  state: number[];
  scaleX: number;
  onState: (updates: Array<[id: number, value: number]>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const trigger = (state[visual.controlModeState] ?? 0) > 0.5;
  const labelFile = `moots_label_${trigger ? "trigger" : "gate"}${hovered ? "_h" : ""}.svg`;
  const [labelX, labelY] = visual.labelCenter;
  const [hitWidth, hitHeight] = visual.labelHitSize;

  return (
    <div
      aria-label="Moots gate or trigger mode"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 11,
        pointerEvents: "none",
      }}
    >
      <img
        aria-hidden="true"
        alt=""
        draggable={false}
        src={`${visual.assetBase}${labelFile}`}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${visual.width} ${visual.height}`}
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {visual.buttonCenters.map(([centerX, centerY], index) => {
          if ((state[visual.rampingStates[index]] ?? 0) < 0.5) return null;
          const size = visual.buttonSize;
          const left = centerX - size / 2;
          const top = centerY - size / 2;
          const f = 0.38;
          const e = 0.32;
          const ax = left + f * size;
          const ay = top + (1 - e) * size;
          const bx = left + (1 - f) * size;
          const by = top + e * size;
          const h = 0.15 * size;
          return (
            <path
              key={index}
              d={`M ${ax - h} ${ay} L ${ax} ${ay} L ${bx} ${by} L ${bx + h} ${by}`}
              fill="none"
              stroke="#000000"
              strokeWidth={1.75}
            />
          );
        })}
      </svg>
      <button
        type="button"
        aria-label="Toggle gate or trigger control mode"
        title="Toggle gate/trigger"
        style={{
          position: "absolute",
          left: (labelX - hitWidth / 2) * scaleX,
          top: labelY - hitHeight / 2,
          width: hitWidth * scaleX,
          height: hitHeight,
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          pointerEvents: "auto",
        }}
        onPointerDown={stop}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onState([[visual.controlModeState, trigger ? 0 : 1]]);
        }}
      />
    </div>
  );
}

/** Exact Nucleus/Polynucleus Tricorder output-row cursor and selected arrow. */
export function RackSapphireOutputSelector({
  visual,
  state,
  values = [],
  scaleX,
  onState,
}: {
  visual: OutputSelectorVisual;
  state: number[];
  values?: number[];
  scaleX: number;
  onState: (updates: Array<[id: number, value: number]>) => void;
}) {
  const [hoveredRow, setHoveredRow] = useState(0);
  const connected = (values[0] ?? 0) > 0.5;
  const selectedRow = Math.max(1, Math.min(visual.rows, Math.round(state[visual.state] ?? 1)));
  const boxFor = (row: number) => ({
    x: visual.rowBox.x,
    y: visual.rowBox.y + (row - 1) * visual.rowBox.pitch,
    width: visual.rowBox.width,
    height: visual.rowBox.height,
  });
  const arrowPath = (row: number) => {
    const box = boxFor(row);
    const x1 = box.x + visual.arrow.v * box.width;
    const x2 = box.x + visual.arrow.a * box.width;
    const x3 = box.x + box.width - visual.arrow.w * box.width;
    const y1 = box.y + visual.arrow.g * box.height;
    const yc = box.y + box.height / 2;
    const y2 = yc - (visual.arrow.h * box.height) / 2;
    const y3 = yc + (visual.arrow.h * box.height) / 2;
    const y4 = box.y + box.height - visual.arrow.g * box.height;
    return `M ${x1} ${y2} L ${x2} ${y2} L ${x2} ${y1} L ${x3} ${yc} L ${x2} ${y4} L ${x2} ${y3} L ${x1} ${y3} Z`;
  };

  if (!connected) return null;
  return (
    <div
      aria-label="Tricorder output selector"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 11,
        pointerEvents: "none",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${visual.width} ${visual.height}`}
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {hoveredRow > 0 &&
          (() => {
            const box = boxFor(hoveredRow);
            return (
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx={box.width / 20}
                fill="none"
                stroke="#ffd714"
                strokeWidth={1}
              />
            );
          })()}
        <path d={arrowPath(selectedRow)} fill="#c0a020" stroke="#000000" strokeWidth={1} />
      </svg>
      {Array.from({ length: visual.rows }, (_, index) => {
        const row = index + 1;
        const box = boxFor(row);
        const hitWidth = box.width * visual.hitFraction;
        return (
          <button
            key={row}
            type="button"
            aria-label={`Send output row ${row} to Tricorder`}
            style={{
              position: "absolute",
              left: (box.x + box.width - hitWidth) * scaleX,
              top: box.y,
              width: hitWidth * scaleX,
              height: box.height,
              padding: 0,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              pointerEvents: "auto",
            }}
            onPointerDown={stop}
            onPointerEnter={() => setHoveredRow(row)}
            onPointerLeave={() => setHoveredRow(0)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onState([[visual.state, row]]);
            }}
          />
        );
      })}
    </div>
  );
}
