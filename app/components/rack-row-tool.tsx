import { useState, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type RowToolVisual = Extract<RuntimeVisual, { kind: "rack-row-tool" }>;

export function RackRowTool({
  visual,
  scaleX,
  onAction,
  onDragStart,
}: {
  visual: RowToolVisual;
  scaleX: number;
  onAction: (action: 0 | 1 | 3 | 4) => void;
  onDragStart: (event: PointerEvent<HTMLButtonElement>) => void;
}) {
  const [pressed, setPressed] = useState(-1);
  const rowHeight = visual.height / visual.rows;
  const labels = [
    "Insert row above",
    "Rotate rows above",
    "Move row or strip",
    "Rotate rows below",
    "Insert row below",
  ];
  return (
    <div
      className="pw-rack-row-tool"
      style={{
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
      }}
    >
      {labels.map((label, index) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          title={label}
          className={pressed === index ? "pressed" : undefined}
          style={{ top: index * rowHeight, height: rowHeight }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            setPressed(index);
            if (index === 2) onDragStart(event);
            else onAction(index as 0 | 1 | 3 | 4);
          }}
          onPointerUp={() => setPressed(-1)}
          onPointerCancel={() => setPressed(-1)}
        />
      ))}
    </div>
  );
}
