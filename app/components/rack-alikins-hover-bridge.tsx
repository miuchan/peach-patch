import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type HoverVisual = Extract<RuntimeVisual, { kind: "alikins-hover-bridge" }>;

const significant = (value: number) => {
  if (!Number.isFinite(value)) return "0.000";
  if (value === 0) return "0.000";
  const text = value.toPrecision(4);
  return text.replace(/e([+-]?)0+(\d+)/, "e$1$2");
};

/** Read-only browser counterpart of Alikins' five Rack TextFields. Values are
 * supplied by the AudioWorklet hover bridge so ports and injected parameters
 * stay synchronized with the graph rather than a UI polling timer. */
export function RackAlikinsHoverBridge({
  visual,
  values,
  scaleX,
}: {
  visual: HoverVisual;
  values?: number[];
  scaleX: number;
}) {
  const type = ["", "Param", "Input", "Output"][Math.round(values?.[4] ?? 0)] ?? "";
  const fields = [
    significant(values?.[0] ?? 0),
    significant(values?.[1] ?? (visual.mode === "inspect" ? -5 : 0)),
    significant(values?.[2] ?? (visual.mode === "inspect" ? 5 : 0)),
    significant(values?.[3] ?? 0),
    type,
  ];
  return (
    <div
      className="pw-alikins-hover-bridge"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 10,
        pointerEvents: "none",
      }}
      aria-label={visual.mode === "inspect" ? "Hovered control values" : "Injected value target"}
    >
      {fields.map((text, index) => (
        <output
          key={visual.fieldY[index]}
          aria-label={["Value", "Minimum", "Maximum", "Default", "Type"][index]}
          style={{
            position: "absolute",
            left: visual.fieldX * scaleX,
            top: visual.fieldY[index],
            width: visual.fieldWidth * scaleX,
            height: visual.fieldHeight,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            padding: "1px 4px",
            border: "1px solid #777777",
            borderRadius: 2,
            background: "#d7d7d7",
            color: "#111111",
            font: "12px ui-monospace, SFMono-Regular, Menlo, monospace",
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </output>
      ))}
    </div>
  );
}
