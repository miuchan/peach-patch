import { useMemo, useState, type CSSProperties, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type SlolyVisual = Extract<RuntimeVisual, { kind: "sloly-pit-routing" }>;

const ROW_SPACING = 19;
const ROW_HEIGHT = 15;
const LABELS = ["Single", "Dynamic Below", "Dynamic Above", "Custom"];

function routesFrom(values: number[]) {
  return Array.from({ length: 16 }, (_, output) => {
    const offset = 4 + output * 17;
    const count = Math.max(0, Math.min(16, Math.round(values[offset] ?? 0)));
    return Array.from({ length: count }, (_, route) =>
      Math.max(0, Math.min(15, Math.round(values[offset + 1 + route] ?? 0))),
    );
  });
}

function noise(start: number, end: number, salt: number) {
  let seed =
    (Math.imul(start + 1, 73856093) ^
      Math.imul(end + 1, 19349663) ^
      Math.imul(salt + 1, 83492791)) >>>
    0;
  seed ^= seed >>> 13;
  seed = Math.imul(seed, 1274126177) >>> 0;
  seed ^= seed >>> 16;
  return (seed & 0xffff) / 32767.5 - 1;
}

function blockPoints(start: number, end: number, x: number, width: number) {
  const y = start * ROW_SPACING + 1;
  const height = (end - start - 1) * ROW_SPACING + ROW_HEIGHT;
  const point = (px: number, py: number, saltX: number, saltY: number) =>
    `${px + noise(start, end, saltX) * 2},${py + noise(start, end, saltY) * 2}`;
  return [
    point(x, y, 0, 1),
    point(x + width, y, 2, 3),
    point(x + width, y + height, 5, 6),
    point(x, y + height, 7, 8),
  ].join(" ");
}

function blockColor(start: number, end: number, block: number, selected = false, alpha = 0.61) {
  const darkness = (noise(start, end, 4) + 1) * 12;
  const base = selected
    ? [0xe4, 0xc4, 0x21]
    : block % 2 === 0
      ? [0x24, 0xc9, 0xa6]
      : [0x24, 0x86, 0x73];
  const [r, g, b] = base.map((value) => Math.max(0, Math.min(255, Math.round(value - darkness))));
  return `rgba(${r},${g},${b},${alpha})`;
}

function stop(event: PointerEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

/** Source-faithful browser host for Computerscare Sloly Pit's custom routing labels. */
export function RackSlolyPit({
  visual,
  values = [],
  scaleX,
  onAction,
}: {
  visual: SlolyVisual;
  values?: number[];
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const mode = Math.max(0, Math.min(3, Math.round(values[0] ?? 1)));
  const editing = Math.max(-1, Math.min(15, Math.round(values[1] ?? -1)));
  const inputChannels = Math.max(0, Math.min(16, Math.round(values[2] ?? 0)));
  const routes = useMemo(() => routesFrom(values), [values]);
  const [hoveredOutput, setHoveredOutput] = useState(-1);
  const [hoveredRoute, setHoveredRoute] = useState(-1);
  const [modeMenu, setModeMenu] = useState(false);
  const [routeMenu, setRouteMenu] = useState<{ row: number; add: boolean } | null>(null);
  const [textMenu, setTextMenu] = useState<{ output: number; text: string } | null>(null);
  const selectedRoute = editing >= 0 ? routes[editing] : [];

  const outputAtRow = (row: number) => {
    if (mode === 3) return row;
    return routes.findIndex((route) => route.includes(row));
  };
  const applyRouteText = (output: number, text: string) => {
    const normalized = text
      .toLowerCase()
      .split("")
      .map((character) => {
        if (character >= "1" && character <= "9") return Number(character) - 1;
        if (character === "0") return 9;
        if (character >= "a" && character <= "f") return 10 + character.charCodeAt(0) - 97;
        return -1;
      })
      .filter((channel) => channel >= 0)
      .slice(0, 16);
    onAction(visual.replaceActionBase + output, true);
    for (const channel of normalized) onAction(visual.appendActionBase + channel, true);
    setTextMenu(null);
  };

  const blocks: Array<{
    start: number;
    end: number;
    block: number;
    selected?: boolean;
    x?: number;
    width?: number;
    alpha?: number;
  }> = [];
  if (mode === 3) {
    routes.forEach((route, output) => {
      if (route.length) blocks.push({ start: output, end: output + 1, block: output });
    });
    if (editing >= 0) blocks.push({ start: editing, end: editing + 1, block: 0, selected: true });
  } else {
    routes.forEach((route, output) => {
      let start = -1;
      let previous = -2;
      let segment = output;
      for (const channel of route) {
        if (channel < 0 || channel >= (inputChannels || 16)) continue;
        if (start < 0) start = channel;
        else if (channel !== previous + 1) {
          blocks.push({ start, end: previous + 1, block: segment++ });
          start = channel;
        }
        previous = channel;
      }
      if (start >= 0) blocks.push({ start, end: previous + 1, block: segment });
    });
  }
  if (mode === 3 && editing >= 0) {
    selectedRoute.forEach((channel, route) =>
      blocks.push({
        start: route,
        end: route + 1,
        block: route,
        selected: true,
        x: 0,
        width: 17,
        alpha: channel >= (inputChannels || 16) ? 0.38 : 0.78,
      }),
    );
  }

  const menuStyle = (top: number, left = 2): CSSProperties => ({
    position: "absolute",
    zIndex: 40,
    top,
    left,
    minWidth: 120,
    padding: 5,
    border: "1px solid #777",
    borderRadius: 4,
    background: "#202020",
    boxShadow: "0 4px 16px #000a",
    color: "#eee",
    font: "11px system-ui, sans-serif",
    pointerEvents: "auto",
  });

  return (
    <div
      aria-label="Sloly Pit routing editor"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 14,
        pointerEvents: "none",
      }}
    >
      <button
        type="button"
        aria-label={`Routing mode: ${LABELS[mode]}`}
        title={`Routing Mode: ${LABELS[mode]}`}
        onPointerDown={stop}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setModeMenu((open) => !open);
          setRouteMenu(null);
          setTextMenu(null);
        }}
        style={{
          position: "absolute",
          left: 33 * scaleX,
          top: 43,
          width: 18 * scaleX,
          height: 18,
          padding: 1,
          border: "1px solid #111",
          borderRadius: 2,
          background: modeMenu ? "#d9ba28" : "#d8d3bd",
          color: "#17342d",
          fontSize: 9,
          fontWeight: 800,
          lineHeight: 1,
          pointerEvents: "auto",
          cursor: "pointer",
        }}
      >
        {mode === 0 ? "1·1" : mode === 1 ? "↓" : mode === 2 ? "↑" : "≋"}
      </button>
      {modeMenu ? (
        <div style={menuStyle(62, 10)} onPointerDown={stop}>
          <strong style={{ display: "block", margin: "2px 5px 5px" }}>Routing Mode</strong>
          {LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAction(visual.modeActionBase + index, true);
                setModeMenu(false);
              }}
              style={{
                display: "block",
                width: "100%",
                border: 0,
                padding: "4px 6px",
                textAlign: "left",
                background: index === mode ? "#4b664e" : "transparent",
                color: "inherit",
              }}
            >
              {index === mode ? "✓ " : "　"}
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <svg
        viewBox="0 0 36 300"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: 2 * scaleX,
          top: 66,
          width: 36 * scaleX,
          height: 300,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {blocks.map((block, index) => (
          <polygon
            key={`${block.x ?? 21}-${block.start}-${block.end}-${index}`}
            points={blockPoints(block.start, block.end, block.x ?? 21, block.width ?? 17)}
            fill={blockColor(
              block.start,
              block.end,
              block.block,
              block.selected,
              block.alpha ?? (block.selected ? 0.78 : 0.61),
            )}
          />
        ))}
        {mode === 3 && editing >= 0 && selectedRoute.length < 16 ? (
          <rect
            x="0.7"
            y={selectedRoute.length * ROW_SPACING + 1.5}
            width="15.6"
            height="14"
            fill="none"
            stroke="#e4c421"
            strokeWidth="1.1"
            strokeDasharray="2 2"
          />
        ) : null}
        {hoveredOutput >= 0 ? (
          <rect
            x="21"
            y={hoveredOutput * ROW_SPACING + 1}
            width="17"
            height="15"
            fill="none"
            stroke="#000"
            strokeWidth="1.2"
          />
        ) : null}
        {hoveredRoute >= 0 ? (
          <rect
            x="0"
            y={hoveredRoute * ROW_SPACING + 1}
            width="17"
            height="15"
            fill="none"
            stroke="#000"
            strokeWidth="1.2"
          />
        ) : null}
        {Array.from({ length: 16 }, (_, row) => (
          <text
            key={`main-${row}`}
            x="34"
            y={12 + row * ROW_SPACING}
            textAnchor="end"
            fill={mode !== 3 && inputChannels > 0 && row >= inputChannels ? "#a8a8a0" : "#101000"}
            fontFamily="Oswald, Arial Narrow, sans-serif"
            fontSize="16"
          >
            {row + 1}
          </text>
        ))}
        {mode === 3 && editing >= 0
          ? selectedRoute.map((channel, row) => (
              <text
                key={`route-${row}`}
                x="13"
                y={12 + row * ROW_SPACING}
                textAnchor="end"
                fill={inputChannels > 0 && channel >= inputChannels ? "#a8a8a0" : "#101000"}
                fontFamily="Oswald, Arial Narrow, sans-serif"
                fontSize="16"
              >
                {channel + 1}
              </text>
            ))
          : null}
      </svg>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 66,
          width: 40 * scaleX,
          height: 300,
          pointerEvents: "auto",
        }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) * 40) / Math.max(1, bounds.width);
          const row = Math.max(
            0,
            Math.min(15, Math.floor((event.clientY - bounds.top) / ROW_SPACING)),
          );
          if (mode === 3 && editing >= 0 && x <= 21) {
            setHoveredRoute(row <= selectedRoute.length ? row : -1);
            setHoveredOutput(-1);
          } else if (x >= 17) {
            setHoveredRoute(-1);
            setHoveredOutput(outputAtRow(row));
          } else {
            setHoveredRoute(-1);
            setHoveredOutput(-1);
          }
        }}
        onPointerLeave={() => {
          setHoveredOutput(-1);
          setHoveredRoute(-1);
        }}
        onContextMenu={(event) => {
          if (mode !== 3) return;
          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) * 40) / Math.max(1, bounds.width);
          if (x < 17) return;
          const output = Math.max(
            0,
            Math.min(15, Math.floor((event.clientY - bounds.top) / ROW_SPACING)),
          );
          const text = routes[output]
            .map((channel) =>
              channel < 9
                ? String(channel + 1)
                : channel === 9
                  ? "0"
                  : String.fromCharCode(97 + channel - 10),
            )
            .join("");
          onAction(visual.selectActionBase + output, true);
          setTextMenu({ output, text });
          setRouteMenu(null);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || mode !== 3) return;
          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) * 40) / Math.max(1, bounds.width);
          const row = Math.max(
            0,
            Math.min(15, Math.floor((event.clientY - bounds.top) / ROW_SPACING)),
          );
          if (x >= 17) {
            onAction(visual.selectActionBase + row, true);
            setRouteMenu(null);
            setTextMenu(null);
          } else if (editing >= 0 && row <= selectedRoute.length) {
            setRouteMenu({ row, add: row >= selectedRoute.length });
            setTextMenu(null);
          }
        }}
        title={
          hoveredOutput >= 0
            ? `${hoveredOutput + 1}${["st", "nd", "rd"][hoveredOutput] ?? "th"} Output\n${routes[hoveredOutput].length ? routes[hoveredOutput].map((channel, index) => `${index + 1}: Input ch ${channel + 1}`).join("\n") : "(none)"}`
            : undefined
        }
      />

      {routeMenu && editing >= 0 ? (
        <div
          style={menuStyle(Math.min(330, 66 + routeMenu.row * ROW_SPACING), 2)}
          onPointerDown={stop}
        >
          <strong style={{ display: "block", padding: "2px 5px 5px" }}>
            {routeMenu.add ? "Add Input Channel" : "Set Input Channel"}
          </strong>
          {!routeMenu.add ? (
            <button
              type="button"
              onClick={() => {
                onAction(visual.truncateActionBase + routeMenu.row, true);
                setRouteMenu(null);
              }}
              style={{
                display: "block",
                width: "100%",
                border: 0,
                padding: 4,
                textAlign: "left",
                color: "inherit",
                background: "transparent",
              }}
            >
              (none)
            </button>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
            {Array.from({ length: 16 }, (_, channel) => (
              <button
                key={channel}
                type="button"
                onClick={() => {
                  onAction(visual.routeActionBase + routeMenu.row * 16 + channel, true);
                  setRouteMenu(null);
                }}
                style={{
                  border: 0,
                  padding: 4,
                  color: channel >= inputChannels && inputChannels > 0 ? "#888" : "#eee",
                  background: selectedRoute[routeMenu.row] === channel ? "#4b664e" : "#333",
                }}
              >
                {channel + 1}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {textMenu ? (
        <form
          style={menuStyle(Math.min(330, 66 + textMenu.output * ROW_SPACING), 2)}
          onPointerDown={stop}
          onSubmit={(event) => {
            event.preventDefault();
            applyRouteText(textMenu.output, textMenu.text);
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>
            Output {textMenu.output + 1} routing
          </strong>
          <input
            autoFocus
            value={textMenu.text}
            maxLength={16}
            onChange={(event) =>
              setTextMenu({
                ...textMenu,
                text: event.target.value.replace(/[^0-9a-f]/gi, "").toLowerCase(),
              })
            }
            style={{
              width: 150,
              padding: 4,
              color: "#c0e7de",
              background: "#111",
              border: "1px solid #666",
              fontSize: 18,
            }}
          />
          <small style={{ display: "block", marginTop: 4, color: "#aaa" }}>
            1–9: ch 1–9 · 0: ch 10 · a–f: ch 11–16
          </small>
        </form>
      ) : null}
    </div>
  );
}
