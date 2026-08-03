import { useEffect, useMemo, useState } from "react";

function hueColor(hue: number) {
  const normalized = ((hue % 1) + 1) % 1;
  return `hsla(${normalized * 360} 50% 50% / .75)`;
}

export function RackFullScopeDisplay({
  values,
  points,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  points: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const [rotation, setRotation] = useState(0),
    valid = values?.length === points * 2 + 7,
    lissajous = valid ? values[points * 2] >= 0.5 : true,
    colorConnected = valid ? values[points * 2 + 1] >= 0.5 : false,
    hue = valid ? values[points * 2 + 2] : 0,
    rotationRate = valid ? values[points * 2 + 4] : 0,
    xConnected = valid ? values[points * 2 + 5] >= 0.5 : false,
    yConnected = valid ? values[points * 2 + 6] >= 0.5 : false;

  useEffect(() => {
    if (rotationRate) setRotation((value) => value + rotationRate);
    else setRotation(0);
  }, [values, rotationRate]);

  const paths = useMemo(() => {
    if (!valid || !values) return { xy: "", x: "", y: "" };
    const line = (xValue: (index: number) => number, yValue: (index: number) => number) =>
      Array.from({ length: points }, (_, index) => {
        const px = Math.max(-2, Math.min(3, xValue(index))) * width,
          py = (1 - Math.max(-2, Math.min(3, yValue(index)))) * height;
        return `${index ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`;
      }).join(" ");
    return {
      xy: line(
        (index) => values[index] / 2 + 0.5,
        (index) => values[points + index] / 2 + 0.5,
      ),
      x: line(
        (index) => index / (points - 1),
        (index) => values[index] / 2 + 0.5,
      ),
      y: line(
        (index) => index / (points - 1),
        (index) => values[points + index] / 2 + 0.5,
      ),
    };
  }, [height, points, valid, values, width]);

  const stroke = colorConnected ? hueColor(hue) : "rgba(25,150,252,.75)",
    transform = `rotate(${(rotation * 180) / Math.PI} ${width / 2} ${height / 2})`;
  return (
    <svg
      className="pw-rack-full-scope"
      aria-label={lissajous ? "FullScope Lissajous display" : "FullScope waveform display"}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", left: x * scaleX, top: y, width: width * scaleX, height }}
    >
      <rect width={width} height={height} fill="#000" />
      <g
        transform={transform}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        style={{ mixBlendMode: "screen" }}
      >
        {lissajous && (xConnected || yConnected) ? <path d={paths.xy} stroke={stroke} /> : null}
        {!lissajous && yConnected ? <path d={paths.y} stroke={stroke} /> : null}
        {!lissajous && xConnected ? <path d={paths.x} stroke="rgba(40,176,243,.75)" /> : null}
      </g>
    </svg>
  );
}
