import type { ParamSpec } from "../../lib/web-plugin-registry";

import {
  rackParamAssetUrl,
  rackParamControlSize,
  rackParamInteraction,
  rackParamKnobAsset,
  rackParamKnobRotation,
  rackParamNormalizedValue,
  rackParamPlacementStyle,
  rackParamSwitchAsset,
  rackParamSwitchFrame,
  rackParamSwitchFrames,
  rackParamTextValue,
  rackParamWidgetKind,
  type RackParamInteraction,
} from "../../lib/rack-param-visual-data";

export {
  rackParamControlSize,
  rackParamInteraction,
  rackParamSwitchFrames,
  rackParamWidgetKind,
  type RackParamInteraction,
};

export function RackParamVisual({
  param,
  value,
  moduleWidth,
  sourceWidth,
}: {
  param: ParamSpec;
  value: number;
  moduleWidth: number;
  sourceWidth: number;
}) {
  const position = param.position,
    kind = rackParamWidgetKind(param);
  if (!position || !kind) return null;
  const scale = moduleWidth / sourceWidth,
    normalized = rackParamNormalizedValue(param, value),
    placementStyle = (width: number, height: number) =>
      rackParamPlacementStyle(position, sourceWidth, width, height),
    knob = rackParamKnobAsset(kind);
  if (knob) {
    const size = knob.size * scale,
      rotation = rackParamKnobRotation(knob, normalized, Boolean(param.unbounded));
    if (knob.procedural) {
      const radius = knob.size / 2,
        indicatorEnd = knob.procedural.margin,
        lineWidth = knob.procedural.lineWidth ?? 2,
        dotRadius = knob.procedural.dotRadius ?? 2;
      return (
        <span
          className="pw-rack-param-visual knob"
          style={{ ...placementStyle(knob.size, knob.size), width: size, height: size }}
          aria-hidden="true"
        >
          <svg viewBox={`0 0 ${knob.size} ${knob.size}`} width="100%" height="100%">
            <circle
              cx={radius}
              cy={radius}
              r={radius - 1}
              fill={knob.procedural.base}
              stroke={knob.procedural.border}
              strokeWidth="1"
            />
            <circle cx={radius} cy={radius} r={radius - 4} fill={knob.procedural.center} />
            <g transform={`rotate(${rotation} ${radius} ${radius})`}>
              <line
                x1={radius}
                y1={radius}
                x2={radius}
                y2={indicatorEnd}
                stroke={knob.procedural.indicator}
                strokeWidth={lineWidth}
                strokeLinecap="round"
              />
              <circle
                cx={radius}
                cy={indicatorEnd}
                r={dotRadius}
                fill={knob.procedural.indicator}
              />
            </g>
          </svg>
        </span>
      );
    }
    return (
      <span
        className="pw-rack-param-visual knob"
        style={{ ...placementStyle(knob.size, knob.size), width: size, height: size }}
        aria-hidden="true"
      >
        {knob.bg && <img className="background" src={rackParamAssetUrl(knob.bg)} alt="" />}
        {knob.name && (
          <img
            className="moving"
            src={rackParamAssetUrl(knob.name)}
            alt=""
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        )}
        {knob.fg && <img className="foreground" src={rackParamAssetUrl(knob.fg)} alt="" />}
      </span>
    );
  }
  if (kind === "TextKnob")
    return (
      <span
        className="pw-rack-param-visual text-knob"
        style={{ ...placementStyle(60, 30), width: 60 * scale, height: 30 * scale }}
        aria-hidden="true"
      >
        <b>{param.name.toUpperCase()}</b>
        <em>{rackParamTextValue(param, value)}</em>
      </span>
    );
  if (kind === "VCVSlider")
    return (
      <span
        className="pw-rack-param-visual slider"
        style={{
          ...placementStyle(19.8426, 76.5352),
          width: 19.8426 * scale,
          height: 76.5352 * scale,
        }}
        aria-hidden="true"
      >
        <img src={rackParamAssetUrl("VCVSlider")} alt="" />
        <img
          className="handle"
          src={rackParamAssetUrl("VCVSliderHandle")}
          alt=""
          style={{ top: `${(1 - normalized) * 64.793 * scale}px` }}
        />
      </span>
    );
  if (kind === "BefacoSlidePot")
    return (
      <span
        className="pw-rack-param-visual befaco-slider"
        style={{ ...placementStyle(15.5913, 111), width: 15.5913 * scale, height: 111 * scale }}
        aria-hidden="true"
      >
        <img
          className="background"
          src={rackParamAssetUrl("BefacoSlidePot")}
          alt=""
          style={{
            left: 3.5 * scale,
            top: 3.5 * scale,
            width: 8.5913 * scale,
            height: 104 * scale,
          }}
        />
        <img
          className="handle"
          src={rackParamAssetUrl("BefacoSlidePotHandle")}
          alt=""
          style={{
            left: 2.5 * scale,
            top: (1.5 + (1 - normalized) * 89) * scale,
            width: 11.7 * scale,
            height: 19.27 * scale,
          }}
        />
      </span>
    );
  if (kind === "LFMSliderWhite")
    return (
      <span
        className="pw-rack-param-visual lifeform-slider"
        style={{ ...placementStyle(8.5, 76.5), width: 22 * scale, height: 76.5 * scale }}
        aria-hidden="true"
      >
        <img
          className="background"
          src={rackParamAssetUrl("lifeform/LFMSlider.svg")}
          alt=""
          style={{ left: 6.75 * scale, top: 0, width: 8.5 * scale, height: 76.5 * scale }}
        />
        <img
          className="handle"
          src={rackParamAssetUrl("lifeform/LFMSliderWhiteHandle.svg")}
          alt=""
          style={{
            left: 0,
            top: (1 + (1 - normalized) * 67.7) * scale,
            width: 22 * scale,
            height: 8.8 * scale,
          }}
        />
      </span>
    );
  if (kind === "VCVBezel")
    return (
      <span
        className={`pw-rack-param-visual bezel ${normalized > 0.01 ? "active" : ""}`}
        style={{
          ...placementStyle(21.2603, 21.2599),
          width: 21.2603 * scale,
          height: 21.2599 * scale,
        }}
        aria-hidden="true"
      >
        <img src={rackParamAssetUrl("VCVBezel")} alt="" />
      </span>
    );
  if (kind === "RecButton")
    return (
      <span
        className={`pw-rack-param-visual rec-button ${normalized > 0.01 ? "active" : ""}`}
        style={{ ...placementStyle(32.48, 32.48), width: 32.48 * scale, height: 32.48 * scale }}
        aria-hidden="true"
      >
        <i />
      </span>
    );
  if (kind === "OpcToggleButton" || kind === "OpcDetectModeButton") {
    const width = position.width ?? 38,
      height = position.height ?? 20,
      label =
        kind === "OpcDetectModeButton"
          ? normalized < 0.5
            ? "PEAK"
            : "RMS"
          : param.name.replace(/ (?:Mode|Enable)$/, "").toUpperCase();
    return (
      <span
        className="pw-rack-param-visual"
        style={{ ...placementStyle(width, height), width: width * scale, height: height * scale }}
        aria-hidden="true"
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <defs>
            <linearGradient id={`opc-${param.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor={normalized > 0.5 ? "#535353" : "#383838"} />
              <stop offset="1" stopColor="#222" />
            </linearGradient>
          </defs>
          <rect
            x=".5"
            y=".5"
            width={width - 1}
            height={height - 1}
            rx="3"
            fill={`url(#opc-${param.id})`}
            stroke="#181818"
          />
          <path d={`M 3 1.5 H ${width - 3}`} stroke="#666" strokeWidth=".8" />
          <text
            x={kind === "OpcDetectModeButton" ? 6 : width / 2}
            y={height / 2 + 0.8}
            textAnchor={kind === "OpcDetectModeButton" ? "start" : "middle"}
            dominantBaseline="middle"
            fill={normalized > 0.5 && kind !== "OpcDetectModeButton" ? "#f4c44f" : "#fff"}
            fontFamily="monospace"
            fontSize={Math.min(11, height * 0.55)}
          >
            {label}
          </text>
          {kind === "OpcDetectModeButton" && (
            <path
              d={`M ${width - 14} ${height / 2 - 2} l 4 4 l 4 -4`}
              fill="none"
              stroke="#aaa"
              strokeWidth="2"
            />
          )}
        </svg>
      </span>
    );
  }
  if (kind === "ClickableLight")
    return (
      <span
        className="pw-rack-param-visual"
        style={{ ...placementStyle(8, 8), width: 8 * scale, height: 8 * scale }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 8 8" width="100%" height="100%">
          <circle
            cx="4"
            cy="4"
            r="3"
            fill={normalized < 0.5 ? "rgb(255 133 133)" : "rgb(80 80 80)"}
            stroke="rgb(200 200 200)"
            strokeWidth=".5"
          />
        </svg>
      </span>
    );
  const control = rackParamSwitchAsset(kind),
    frame = rackParamSwitchFrame(normalized, control.frames);
  return (
    <span
      className={`pw-rack-param-visual switch ${normalized > 0.01 ? "active" : ""}`}
      style={{
        ...placementStyle(control.size[0], control.size[1]),
        width: control.size[0] * scale,
        height: control.size[1] * scale,
      }}
      aria-hidden="true"
    >
      <img
        src={rackParamAssetUrl(
          control.names?.[frame] ??
            (control.name.startsWith("gtg/")
              ? `${control.name}${frame}.svg`
              : `${control.name}${frame}`),
        )}
        alt=""
        style={
          control.rotation
            ? {
                left: (control.size[0] - control.size[1]) * 0.5 * scale,
                top: (control.size[1] - control.size[0]) * 0.5 * scale,
                width: control.size[1] * scale,
                height: control.size[0] * scale,
                transform: `rotate(${control.rotation}deg)`,
              }
            : undefined
        }
      />
    </span>
  );
}
