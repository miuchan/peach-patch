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
  if (kind === "WanderSlider" || kind === "VowelMorphSlider") {
    const width = position.width ?? 97.44,
      height = position.height ?? 16.24,
      handleWidth = 11.74218,
      handleHeight = 4.3204,
      handleX = 8.1 - handleWidth / 2 + normalized * (89.34 - 8.1),
      handleY = 8.12 - handleHeight / 2;
    return (
      <span
        className="pw-rack-param-visual sfs-horizontal-slider"
        style={{ ...placementStyle(width, height), width: width * scale, height: height * scale }}
        aria-hidden="true"
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <rect x="0" y="3.87" width="97.44" height="8.5" rx="1.83" fill="#000" />
          <g transform={`translate(${handleX} ${handleY})`}>
            <rect width={handleWidth} height={handleHeight} fill="#454545" />
            <rect width=".964" height={handleHeight} fill="#363636" />
            <rect x="1.871" width="1" height={handleHeight} fill="#787878" />
            <rect x="2.871" width="6" height={handleHeight} fill="#d4d4d4" />
            <rect x="8.871" width="1" height={handleHeight} fill="#262626" />
            <rect x="10.948" width=".794" height={handleHeight} fill="#5e5e5e" />
          </g>
        </svg>
      </span>
    );
  }
  if (kind === "MuseSlider") {
    const width = position.width ?? 17,
      height = position.height ?? 261,
      handleY = 3 + normalized * 255;
    return (
      <span
        className="pw-rack-param-visual sfs-muse-slider"
        style={{ ...placementStyle(width, height), width: width * scale, height: height * scale }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 17 261" width="100%" height="100%">
          <rect x="6.5" y="2" width="4" height="257" rx="1.5" fill="#1a1a2e" />
          <g stroke="#a0a0a0" strokeWidth=".5" strokeLinecap="round" opacity=".45">
            {Array.from({ length: 40 }, (_, index) => {
              const y = 3 + (255 * index) / 39;
              return <line key={index} x1="11.5" y1={y} x2="13.5" y2={y} />;
            })}
          </g>
          <g transform={`translate(0 ${handleY - 3})`}>
            <rect
              x="3"
              y="1"
              width="11"
              height="4"
              rx=".8"
              fill="#454545"
              stroke="#222"
              strokeWidth=".4"
            />
            <rect x="4" y="1.4" width=".8" height="3.2" fill="#787878" />
            <rect x="5.4" y="1.4" width="6" height="3.2" fill="#d4d4d4" />
            <rect x="11.7" y="1.4" width=".8" height="3.2" fill="#262626" />
          </g>
        </svg>
      </span>
    );
  }
  if (kind === "CKSSHoriz") {
    const width = position.width ?? 15,
      height = position.height ?? 6.26,
      handleX = normalized >= 0.5 ? 0.33 : 2.65;
    return (
      <span
        className="pw-rack-param-visual sfs-horizontal-switch"
        style={{ ...placementStyle(width, height), width: width * scale, height: height * scale }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 5.08 2.12" width="100%" height="100%">
          <rect width="5.08" height="2.12" rx=".35" fill="#1a1a1a" />
          <rect x=".18" y=".18" width="4.72" height="1.76" rx=".25" fill="#3a3a3a" />
          <rect
            x={handleX}
            y=".42"
            width="2.1"
            height="1.28"
            rx=".22"
            fill="#d9d9d9"
            stroke="#888"
            strokeWidth=".06"
          />
        </svg>
      </span>
    );
  }
  if (kind === "LinkDotButton") {
    const width = position.width ?? 12.402,
      height = position.height ?? 12.402,
      radius = Math.min(width, height) * (1.7 / 4.2);
    return (
      <span
        className={`pw-rack-param-visual sfs-link-dot ${normalized > 0.5 ? "active" : ""}`}
        style={{ ...placementStyle(width, height), width: width * scale, height: height * scale }}
        aria-hidden="true"
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill={normalized > 0.5 ? "#f2f2f2" : "#3a3a44"}
            stroke="#2a2a33"
            strokeWidth="1"
          />
          {normalized > 0.5 && (
            <circle cx={width / 2} cy={height / 2} r={radius * (1.35 / 1.7)} fill="#fff" />
          )}
        </svg>
      </span>
    );
  }
  if (kind.startsWith("VCVLightLatch")) {
    const colorName = kind.slice("VCVLightLatch".length),
      activeColor =
        (
          {
            Green: "#1fbc17",
            Red: "#ef3038",
            White: "#f4f4ff",
            Yellow: "#f4c430",
            Blue: "#0097de",
          } as const
        )[colorName as "Green" | "Red" | "White" | "Yellow" | "Blue"] ?? "#1fbc17",
      width = position.width ?? 18,
      height = position.height ?? 18,
      radius = Math.min(width, height) / 3;
    return (
      <span
        className={`pw-rack-param-visual light-latch ${normalized > 0.5 ? "active" : ""}`}
        style={{ ...placementStyle(width, height), width: width * scale, height: height * scale }}
        aria-hidden="true"
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius + 1.2}
            fill="#222"
            stroke="#777"
            strokeWidth=".7"
          />
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill={normalized > 0.5 ? activeColor : "#202020"}
          />
          {normalized > 0.5 && (
            <circle
              cx={width / 2 - radius * 0.28}
              cy={height / 2 - radius * 0.28}
              r={radius * 0.28}
              fill="#fff"
              opacity=".72"
            />
          )}
        </svg>
      </span>
    );
  }
  if (kind === "VCVLatch") {
    const width = position.width ?? 18,
      height = position.height ?? 18,
      radius = Math.min(width, height) / 3;
    return (
      <span
        className={`pw-rack-param-visual latch ${normalized > 0.5 ? "active" : ""}`}
        style={{ ...placementStyle(width, height), width: width * scale, height: height * scale }}
        aria-hidden="true"
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius + 1.2}
            fill="#222"
            stroke="#777"
            strokeWidth=".7"
          />
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill={normalized > 0.5 ? "#d8d8d8" : "#303030"}
          />
        </svg>
      </span>
    );
  }
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
  const control = rackParamSwitchAsset(kind);
  if (!control && kind.endsWith("Slider")) {
    const { width, height } = rackParamControlSize(param),
      horizontal = width > height,
      travel = horizontal
        ? width - Math.min(12, width * 0.18)
        : height - Math.min(12, height * 0.18),
      handleX = horizontal ? (width - travel) * 0.5 + normalized * travel : width * 0.5,
      handleY = horizontal ? height * 0.5 : (height - travel) * 0.5 + (1 - normalized) * travel;
    return (
      <span
        className="pw-rack-param-visual generic-slider"
        style={{ ...placementStyle(width, height), width: width * scale, height: height * scale }}
        aria-hidden="true"
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <line
            x1={horizontal ? 4 : width * 0.5}
            y1={horizontal ? height * 0.5 : 4}
            x2={horizontal ? width - 4 : width * 0.5}
            y2={horizontal ? height * 0.5 : height - 4}
            stroke="#171717"
            strokeWidth={Math.min(5, Math.min(width, height) * 0.28)}
            strokeLinecap="round"
          />
          <rect
            x={handleX - (horizontal ? 3 : Math.min(width * 0.38, 7))}
            y={handleY - (horizontal ? Math.min(height * 0.38, 7) : 3)}
            width={horizontal ? 6 : Math.min(width * 0.76, 14)}
            height={horizontal ? Math.min(height * 0.76, 14) : 6}
            rx="1"
            fill="#d4d4d4"
            stroke="#555"
            strokeWidth=".6"
          />
        </svg>
      </span>
    );
  }
  if (!control && kind.endsWith("Switch")) {
    const { width, height } = rackParamControlSize(param),
      horizontal = width > height,
      frame = rackParamSwitchFrame(normalized, rackParamSwitchFrames(param));
    return (
      <span
        className="pw-rack-param-visual generic-switch"
        style={{ ...placementStyle(width, height), width: width * scale, height: height * scale }}
        aria-hidden="true"
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <rect
            x=".5"
            y=".5"
            width={width - 1}
            height={height - 1}
            rx="2"
            fill="#202020"
            stroke="#666"
          />
          <circle
            cx={
              horizontal
                ? 3 + (frame / Math.max(1, rackParamSwitchFrames(param) - 1)) * (width - 6)
                : width * 0.5
            }
            cy={
              horizontal
                ? height * 0.5
                : height -
                  3 -
                  (frame / Math.max(1, rackParamSwitchFrames(param) - 1)) * (height - 6)
            }
            r={Math.max(1.5, Math.min(width, height) * 0.28)}
            fill="#d8d8d8"
            stroke="#777"
            strokeWidth=".6"
          />
        </svg>
      </span>
    );
  }
  if (!control) return null;
  const frame = rackParamSwitchFrame(normalized, control.frames);
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
