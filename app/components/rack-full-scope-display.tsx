import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/provider";

function hueColor(hue: number) {
  const normalized = ((hue % 1) + 1) % 1;
  return `hsla(${normalized * 360} 50% 50% / .75)`;
}

export function RackFullScopeDisplay({
  values,
  points,
  defaultColor = "rgba(25,150,252,.753)",
  xColor = "rgba(40,176,243,.753)",
  showStats = false,
  assetBase,
  font,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  points: number;
  defaultColor?: string;
  xColor?: string;
  showStats?: boolean;
  assetBase?: string;
  font?: { family: string; file: string };
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { t } = useI18n();
  const samples = useMemo(() => values ?? [], [values]),
    [rotation, setRotation] = useState(0),
    valid = samples.length >= points * 2 + 7,
    lissajous = valid ? samples[points * 2] >= 0.5 : true,
    colorConnected = valid ? samples[points * 2 + 1] >= 0.5 : false,
    hue = valid ? samples[points * 2 + 2] : 0,
    rotationRate = valid ? samples[points * 2 + 4] : 0,
    xConnected = valid ? samples[points * 2 + 5] >= 0.5 : false,
    yConnected = valid ? samples[points * 2 + 6] >= 0.5 : false,
    statsVisible =
      showStats && valid && samples.length >= points * 2 + 11 && samples[points * 2 + 3] >= 0.5,
    displayWidth = width * scaleX;

  useEffect(() => {
    if (!assetBase || !font || typeof FontFace === "undefined") return;
    const face = new FontFace(font.family, `url(${JSON.stringify(`${assetBase}${font.file}`)})`);
    void face.load().then((loaded) => document.fonts.add(loaded));
  }, [assetBase, font]);

  useEffect(() => {
    if (rotationRate) setRotation((value) => value + rotationRate);
    else setRotation(0);
  }, [values, rotationRate]);

  const paths = useMemo(() => {
    if (!valid) return { xy: "", x: "", y: "" };
    const line = (xValue: (index: number) => number, yValue: (index: number) => number) =>
      Array.from({ length: points }, (_, index) => {
        const px = xValue(index) * displayWidth,
          py = (1 - yValue(index)) * height;
        return `${index ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`;
      }).join(" ");
    return {
      xy: line(
        (index) => samples[index] / 2 + 0.5,
        (index) => samples[points + index] / 2 + 0.5,
      ),
      x: line(
        (index) => index / (points - 1),
        (index) => samples[index] / 2 + 0.5,
      ),
      y: line(
        (index) => index / (points - 1),
        (index) => samples[points + index] / 2 + 0.5,
      ),
    };
  }, [displayWidth, height, points, samples, valid]);

  const stroke = colorConnected ? hueColor(hue) : defaultColor,
    transform = `rotate(${(rotation * 180) / Math.PI} ${displayWidth / 2} ${height / 2})`,
    statText = (label: string, value: number) =>
      `${label}${Math.abs(value) <= 100 ? value.toFixed(2).padStart(6, " ") : "  ---"}`;
  return (
    <svg
      className="pw-rack-full-scope"
      aria-label={t(lissajous ? "display.fullScopeLissajous" : "display.fullScopeWaveform")}
      viewBox={`0 0 ${displayWidth} ${height}`}
      style={{ position: "absolute", left: x * scaleX, top: y, width: displayWidth, height }}
    >
      <rect width={displayWidth} height={height} fill="#000" />
      <g
        transform={transform}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        style={{ mixBlendMode: "plus-lighter" }}
      >
        {lissajous && (xConnected || yConnected) ? <path d={paths.xy} stroke={stroke} /> : null}
        {!lissajous && yConnected ? <path d={paths.y} stroke={stroke} /> : null}
        {!lissajous && xConnected ? <path d={paths.x} stroke={xColor} /> : null}
      </g>
      {statsVisible ? (
        <g
          fill="rgba(244,189,141,.753)"
          fontFamily={font?.family ?? "ui-monospace, monospace"}
          fontSize="12"
          letterSpacing="-0.5"
        >
          <text x="18" y="11">
            {" "}
            x
          </text>
          <text x="38" y="11">
            {statText("max", samples[points * 2 + 8])}
          </text>
          <text x="93" y="11">
            {statText("min", samples[points * 2 + 7])}
          </text>
          <text x="144" y="11">
            | y
          </text>
          <text x="164" y="11">
            {statText("max", samples[points * 2 + 10])}
          </text>
          <text x="219" y="11">
            {statText("min", samples[points * 2 + 9])}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
