import { useEffect } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type FlyingFaderVisual = Extract<RuntimeVisual, { kind: "flying-fader" }>;

export function RackFlyingFader({
  visual,
  value,
  capColor,
  text,
  scaleX,
}: {
  visual: FlyingFaderVisual;
  value: number;
  capColor: number;
  text: string;
  scaleX: number;
}) {
  useEffect(() => {
    if (typeof FontFace === "undefined") return;
    const face = new FontFace(
      visual.font.family,
      `url(${JSON.stringify(`${visual.assetBase}${visual.font.file}`)})`,
    );
    void face.load().then((loaded) => document.fonts.add(loaded));
  }, [visual.assetBase, visual.font]);
  const normalized = Math.max(0, Math.min(1, value / 1.4125375747680664)),
    handleY = visual.minHandleY + (visual.maxHandleY - visual.minHandleY) * normalized,
    color = visual.colors[Math.max(0, Math.min(visual.colors.length - 1, Math.round(capColor)))];
  return (
    <div
      className="pw-rack-flying-fader"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        pointerEvents: "none",
      }}
    >
      <img
        alt=""
        src={`${visual.assetBase}MotorizedFaderBackground.svg`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <img
        alt=""
        src={`${visual.assetBase}MotorizedFaderHandle_${color}.svg`}
        style={{ position: "absolute", left: 0, top: handleY, width: "100%", height: 42 }}
      />
      <svg
        role="img"
        aria-label={text}
        viewBox="0 0 18 153"
        style={{ position: "absolute", left: -11.5 * scaleX, top: 97.5, width: 18, height: 153 }}
      >
        <text
          x="11"
          y="76.5"
          fill="#000"
          fontFamily={visual.font.family}
          fontSize="16"
          textAnchor="middle"
          dominantBaseline="middle"
          transform="rotate(-90 11 76.5)"
        >
          {text}
        </text>
      </svg>
    </div>
  );
}
