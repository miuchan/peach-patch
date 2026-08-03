import { useEffect, useMemo, useRef } from "react";
import type { LightSpec, ParamSpec } from "../../lib/web-plugin-registry";

const PX_PER_MM = 75 / 25.4,
  HALO_BRIGHTNESS = 0.25,
  COLORS = {
    red: "#ed2c24",
    green: "#90c73e",
    blue: "#29b2ef",
    yellow: "#f0d648",
    white: "#ffffff",
    orange: "#f0a040",
  };

function lightKind(widget: string) {
  const slider = /VCVLightSlider|LEDLightSlider/.test(widget),
    bezel = /VCVLightBezel|LEDBezelLight/.test(widget),
    gate = /GateLight/.test(widget),
    rubber = /RubberButtonLed/.test(widget),
    rubberSmall = /RubberSmallButtonLed/.test(widget),
    lucky = /LuckyLight/.test(widget),
    diagonal = /DiagonalLuckyLight/.test(widget),
    mosquito = /^MyLight</.test(widget),
    size = mosquito
      ? 6 * PX_PER_MM
      : rubberSmall
        ? 5 * PX_PER_MM
        : rubber
          ? 8 * PX_PER_MM
          : /Large(?:Simple)?Light/.test(widget)
            ? 5 * PX_PER_MM
            : /Medium(?:Simple)?Light/.test(widget)
              ? 3 * PX_PER_MM
              : /Small(?:Simple)?Light/.test(widget)
                ? 2 * PX_PER_MM
                : /Tiny(?:Simple)?Light/.test(widget)
                  ? PX_PER_MM
                  : bezel
                    ? 17.545
                    : gate
                      ? 22
                      : slider
                        ? 6
                        : 0,
    width = lucky ? 5 * PX_PER_MM : slider ? 4.32027 : size,
    height = lucky ? 2 * PX_PER_MM : slider ? 6 : size,
    direct = /^(?:Large|Medium|Small|Tiny)Light/.test(widget),
    asset = lucky
      ? "modular-mooch/RectangleLuckyLight.svg"
      : slider
        ? "VCVSliderLight"
        : direct
          ? /LargeLight/.test(widget)
            ? "LargeLight"
            : /MediumLight/.test(widget)
              ? "MediumLight"
              : /SmallLight/.test(widget)
                ? "SmallLight"
                : /TinyLight/.test(widget)
                  ? "TinyLight"
                  : ""
          : "";
  let colors: string[] = [];
  if (/RedGreenBlueLight/.test(widget)) colors = [COLORS.red, COLORS.green, COLORS.blue];
  else if (/GreenRedLight/.test(widget)) colors = [COLORS.green, COLORS.red];
  else if (/RedGreenLight/.test(widget)) colors = [COLORS.red, COLORS.green];
  else if (/YellowRedLight/.test(widget)) colors = [COLORS.yellow, COLORS.red];
  else if (gate) colors = [COLORS.yellow];
  else
    for (const [name, color] of Object.entries(COLORS))
      if (new RegExp(`${name}Light`, "i").test(widget)) {
        colors = [color];
        break;
      }
  return width && height && colors.length
    ? { width, height, asset, colors, slider, rectangle: lucky, rotation: diagonal ? -45 : 0 }
    : null;
}

export function RackLightVisual({
  light,
  values,
  moduleWidth,
  sourceWidth,
  param,
  paramValue,
}: {
  light: LightSpec;
  values: number[];
  moduleWidth: number;
  sourceWidth: number;
  param?: ParamSpec;
  paramValue?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    kind = useMemo(() => lightKind(light.widget), [light.widget]),
    scaleX = moduleWidth / sourceWidth;
  const normalized =
      param && paramValue !== undefined && param.max !== param.min
        ? Math.max(0, Math.min(1, (paramValue - param.min) / (param.max - param.min)))
        : 0,
    centerX = light.position.x + (light.position.centered ? 0 : (kind?.width ?? 0)) / 2,
    centerY =
      kind?.slider && light.position.centered
        ? light.position.y - 32.3965 + (1 - normalized) * 64.793
        : light.position.y + (light.position.centered ? 0 : (kind?.height ?? 0)) / 2;
  useEffect(() => {
    const element = canvas.current;
    if (!element || !kind) return;
    const dpr = window.devicePixelRatio || 1,
      pad = 15,
      width = (kind.width + pad * 2) * scaleX,
      height = kind.height + pad * 2;
    element.width = Math.max(1, Math.round(width * dpr));
    element.height = Math.max(1, Math.round(height * dpr));
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = "screen";
    const cx = (pad + kind.width / 2) * scaleX,
      cy = pad + kind.height / 2,
      radius = Math.max(kind.width * scaleX, kind.height) / 2,
      outer = radius + Math.min(radius * 4, 15);
    kind.colors.forEach((color, index) => {
      const brightness = Math.max(0, Math.min(1, Number(values[light.id + index]) || 0));
      if (!brightness) return;
      const halo = context.createRadialGradient(cx, cy, radius, cx, cy, outer);
      context.globalAlpha = brightness;
      halo.addColorStop(0, color);
      halo.addColorStop(1, `${color}00`);
      context.fillStyle = halo;
      context.globalAlpha = brightness * HALO_BRIGHTNESS;
      context.fillRect(cx - outer, cy - outer, outer * 2, outer * 2);
      context.globalAlpha = brightness;
      context.fillStyle = color;
      context.save();
      context.translate(cx, cy);
      if (kind.rotation) context.rotate((kind.rotation * Math.PI) / 180);
      context.beginPath();
      if (kind.slider || kind.rectangle)
        context.rect(
          (-kind.width * scaleX) / 2,
          -kind.height / 2,
          kind.width * scaleX,
          kind.height,
        );
      else context.ellipse(0, 0, (kind.width * scaleX) / 2, kind.height / 2, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.globalAlpha = 1;
    });
  }, [kind, light.id, scaleX, values]);
  if (!kind) return null;
  const left = (centerX - kind.width / 2) * scaleX,
    top = centerY - kind.height / 2;
  return (
    <span
      className="pw-rack-light-visual"
      style={{ left, top, width: kind.width * scaleX, height: kind.height }}
      aria-hidden="true"
    >
      {kind.asset && (
        <img
          src={
            kind.asset.includes("/")
              ? `/rack-components/${kind.asset}`
              : `/api/rack-component?name=${kind.asset}`
          }
          alt=""
          style={kind.rotation ? { transform: `rotate(${kind.rotation}deg)` } : undefined}
        />
      )}
      <canvas
        ref={canvas}
        style={{
          left: -15 * scaleX,
          top: -15,
          width: (kind.width + 30) * scaleX,
          height: kind.height + 30,
        }}
      />
    </span>
  );
}
