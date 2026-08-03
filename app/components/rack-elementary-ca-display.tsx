import { useEffect, useMemo, useRef } from "react";

type Props = {
  samples?: number[][];
  params: number[];
  ruleParam: number;
  seedParam: number;
  scaleParam: number;
  cells: number;
  scaleValues: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  labelX: number;
  labelY: number;
  labelWidth: number;
  labelHeight: number;
  scaleX: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

function last(values: number[] | undefined) {
  const value = values?.at(-1) ?? 0;
  return Number.isFinite(value) ? value : 0;
}

export function RackElementaryCaDisplay({
  samples,
  params,
  ruleParam,
  seedParam,
  scaleParam,
  cells,
  scaleValues,
  x,
  y,
  width,
  height,
  labelX,
  labelY,
  labelWidth,
  labelHeight,
  scaleX,
}: Props) {
  const scaleCv = samples?.[2]?.at(-1),
    ref = useRef<HTMLCanvasElement>(null),
    rule = clamp(Math.floor((params[ruleParam] ?? 0) + last(samples?.[0])), 0, 255),
    seed = clamp(Math.floor((params[seedParam] ?? 0) + last(samples?.[1])), 0, 255),
    scale = clamp(
      Math.floor(
        (params[scaleParam] ?? 0) +
          (Number.isFinite(scaleCv) ? ((scaleCv as number) + 10) * 0.8 : 0),
      ),
      0,
      scaleValues.length - 1,
    ),
    rows = useMemo(() => {
      const result = Array.from({ length: cells }, () => new Uint8Array(cells)),
        left = Math.floor(cells / 2) - 3;
      for (let column = 0; column < 8; column++) result[0][left + column] = (seed >> column) & 1;
      for (let row = 1; row < cells; row++) {
        const previous = result[row - 1],
          next = result[row];
        for (let column = 0; column < cells; column++) {
          const neighborhood =
            (previous[(column + cells - 1) % cells] << 2) |
            (previous[column] << 1) |
            previous[(column + 1) % cells];
          next[column] = (rule >> neighborhood) & 1;
        }
      }
      return result;
    }, [cells, rule, seed]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1)),
      cssWidth = width * scaleX,
      context = canvas.getContext("2d");
    canvas.width = Math.max(1, Math.round(cssWidth * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    if (!context) return;
    context.setTransform(canvas.width / cells, 0, 0, canvas.height / cells, 0, 0);
    context.clearRect(0, 0, cells, cells);
    context.fillStyle = "#e0f7fa";
    for (let row = 0; row < cells; row++)
      for (let column = 0; column < cells; column++)
        if (rows[row][column]) context.fillRect(column, row, 1, 1);
  }, [cells, height, rows, scaleX, width]);

  return (
    <>
      <canvas
        ref={ref}
        className="pw-elementary-ca"
        style={{ left: x * scaleX, top: y, width: width * scaleX, height }}
        aria-label={`Elementary cellular automaton rule ${rule}, seed ${seed}`}
      />
      <span
        className="pw-elementary-ca-label"
        style={{
          left: labelX * scaleX,
          top: labelY,
          width: labelWidth * scaleX,
          height: labelHeight,
          fontSize: 9 * scaleX,
        }}
        aria-hidden="true"
      >
        {scaleValues[scale]}
      </span>
    </>
  );
}
