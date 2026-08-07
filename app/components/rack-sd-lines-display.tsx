import { useI18n } from "../i18n/provider";

const COLORS = {
  positive: "rgb(255,255,255)",
  negative: "rgb(255,0,0)",
  zero: "rgb(120,120,120)",
  outside: "rgb(0,0,0)",
};

const RANGES = [
  { minimum: 0, maximum: 10, bipolar: false },
  { minimum: -10, maximum: 10, bipolar: true },
  { minimum: 0, maximum: 5, bipolar: false },
  { minimum: -5, maximum: 5, bipolar: true },
];

const finite = (value: number | undefined) => (Number.isFinite(value) ? Number(value) : 0);

export function RackSdLinesDisplay({
  values,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const { t } = useI18n();
  const channels = Math.max(0, Math.min(16, Math.trunc(finite(values?.[0]))));
  const mode = Math.max(0, Math.min(1, Math.round(finite(values?.[1]))));
  const range = RANGES[Math.max(0, Math.min(3, Math.round(finite(values?.[2]))))];
  // These offsets intentionally retain SDLines' native widget-coordinate quirk.
  const lineX = 1;
  const lineY = y;
  const lineWidth = width - 2;
  const lineHeight = height - 0.5;
  const halfStroke = 0.5;
  const centerX = lineX + lineWidth / 2 + halfStroke;
  const centerY = lineY + lineHeight / 2 + halfStroke;
  const startY = lineY + lineHeight + halfStroke;
  const deltaX = channels > 1 ? (lineWidth - 2 - channels) / (channels - 1) + 1 : 1;
  const lines = Array.from({ length: channels }, (_, channel) => {
    let voltage = finite(values?.[3 + channel]);
    let color: string;
    if (voltage < range.minimum) {
      voltage = range.minimum;
      color = COLORS.outside;
    } else if (voltage > range.maximum) {
      voltage = range.maximum;
      color = COLORS.outside;
    } else {
      color = voltage === 0 ? COLORS.zero : voltage >= 0 ? COLORS.positive : COLORS.negative;
    }
    voltage /= range.maximum - range.minimum || 10;
    const baseline = range.bipolar ? centerY : startY;
    const voltageY = baseline - lineHeight * voltage - halfStroke;
    if (mode === 0)
      return (
        <line
          key={channel}
          x1={lineX + halfStroke}
          x2={lineX + lineWidth - halfStroke}
          y1={voltageY}
          y2={voltageY}
          stroke={color}
          strokeWidth="1"
        />
      );
    const voltageX = channels === 1 ? centerX : lineX + 1 + deltaX * channel + halfStroke;
    return (
      <line
        key={channel}
        x1={voltageX}
        x2={voltageX}
        y1={baseline}
        y2={voltageY}
        stroke={color}
        strokeWidth="1"
      />
    );
  });
  return (
    <svg
      className="pw-rack-sd-lines"
      aria-label={t("display.sdLines")}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        overflow: "visible",
      }}
    >
      {lines}
    </svg>
  );
}
