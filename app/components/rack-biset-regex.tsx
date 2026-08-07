import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type BisetRegexVisual = Extract<RuntimeVisual, { kind: "biset-regex" }>;
type Selection = { start: number; end: number };

function expressionArray(data: Record<string, unknown>, key: string, rows: number) {
  const stored = data[key];
  return Array.from({ length: rows }, (_, index) =>
    Array.isArray(stored) && typeof stored[index] === "string" ? stored[index] : "",
  );
}

function visibleOffset(condensed: boolean, cursor: number) {
  if (condensed) return cursor >= 32 ? cursor - 32 : 0;
  return cursor >= 64 ? Math.floor((cursor - 32) / 32) * 32 : 0;
}

function activeCharacters(text: string, start: number) {
  const active = new Set<number>();
  if (start < 0 || start >= text.length) return active;
  let index = start;
  if (text[index] === "-") {
    active.add(index++);
    while (/\d/.test(text[index] ?? "")) active.add(index++);
  } else if (/\d/.test(text[index])) {
    while (/\d/.test(text[index] ?? "")) active.add(index++);
  } else if (/[a-g]/i.test(text[index])) {
    active.add(index++);
    if (text[index] === "#" || text[index] === "b") active.add(index++);
    if (/\d/.test(text[index] ?? "")) active.add(index);
  } else active.add(index);
  return active;
}

function characterColor(character: string, active: boolean, colors: BisetRegexVisual["colors"]) {
  if (active || "><^@?!$x%*".includes(character)) return colors.active;
  if ("(),".includes(character)) return colors.syntax;
  return colors.value;
}

export function RackBisetRegex({
  visual,
  data,
  params,
  values = [],
  scaleX,
  onData,
  onAction,
}: {
  visual: BisetRegexVisual;
  data: Record<string, unknown>;
  params: readonly number[];
  values?: number[];
  scaleX: number;
  onData: (data: Record<string, unknown>) => void;
  onAction: (id: number, active: boolean) => void;
}) {
  const inputs = useRef<Array<HTMLTextAreaElement | null>>([]),
    [fontReady, setFontReady] = useState(false),
    [characterWidth, setCharacterWidth] = useState(7),
    [activeRow, setActiveRow] = useState(-1),
    [selections, setSelections] = useState<Selection[]>(() =>
      Array.from({ length: visual.rows }, () => ({ start: 0, end: 0 })),
    );
  const expressions = expressionArray(data, visual.dataKey, visual.rows);

  useEffect(() => {
    if (typeof FontFace === "undefined") {
      setFontReady(true);
      return;
    }
    const face = new FontFace(
      visual.font.family,
      `url(${JSON.stringify(`${visual.assetBase}${visual.font.file}`)})`,
    );
    void face.load().then((loaded) => {
      document.fonts.add(loaded);
      setFontReady(true);
    });
  }, [visual.assetBase, visual.font]);

  useEffect(() => {
    if (!fontReady) return;
    const canvas = document.createElement("canvas"),
      context = canvas.getContext("2d");
    if (!context) return;
    context.font = `12px ${JSON.stringify(visual.font.family)}`;
    const measured = context.measureText("x").width;
    if (Number.isFinite(measured) && measured > 0) setCharacterWidth(measured);
  }, [fontReady, visual.font.family]);

  const select = (row: number, start: number, end = start) => {
    setSelections((current) => {
      const next = [...current];
      next[row] = { start, end };
      return next;
    });
  };
  const syncSelection = (row: number) => {
    const input = inputs.current[row];
    if (input) select(row, input.selectionStart, input.selectionEnd);
  };
  const setCaret = (row: number, position: number) => {
    const input = inputs.current[row];
    if (!input) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(position, position);
    setActiveRow(row);
    select(row, position);
  };
  const update = (row: number, nextText: string) => {
    const next = [...expressions];
    next[row] = nextText.replace(/[\s]/g, "");
    onData({ [visual.dataKey]: next });
  };
  const pointer = (row: number, event: PointerEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const input = event.currentTarget,
      rect = input.getBoundingClientRect(),
      current = selections[row]?.start ?? 0,
      offset = visibleOffset(visual.condensed, current),
      column = Math.floor((event.clientX - rect.left - 3) / characterWidth),
      line = visual.condensed ? 0 : Math.floor((event.clientY - rect.top - 3) / 12),
      position = Math.max(
        0,
        Math.min(expressions[row].length, offset + Math.max(0, column) + Math.max(0, line) * 32),
      );
    setCaret(row, position);
  };
  const key = (row: number, event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    const input = event.currentTarget,
      cursor = input.selectionStart;
    if (event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat)
        onAction(
          event.ctrlKey || event.metaKey ? visual.compileAllAction : visual.compileActionBase + row,
          true,
        );
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (!event.repeat) onAction(visual.stopActionBase + row, true);
      return;
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === "ArrowDown" || event.key === "ArrowUp")
    ) {
      event.preventDefault();
      const target = row + (event.key === "ArrowDown" ? 1 : -1);
      if (target >= 0 && target < visual.rows)
        setCaret(target, Math.min(expressions[target].length, cursor));
      return;
    }
    if (!visual.condensed && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const target = cursor + (event.key === "ArrowDown" ? 32 : -32);
      if (target >= 0 && target <= expressions[row].length) setCaret(row, target);
      return;
    }
    if (
      (event.key === "Backspace" || event.key === "Delete") &&
      (event.ctrlKey || event.metaKey || event.altKey)
    ) {
      event.preventDefault();
      const start = input.selectionStart,
        end = input.selectionEnd,
        from = start === end && event.key === "Backspace" ? Math.max(0, start - 1) : start,
        to =
          start === end && event.key === "Delete"
            ? Math.min(expressions[row].length, end + 1)
            : end,
        next = expressions[row].slice(0, from) + expressions[row].slice(to);
      update(row, next);
      requestAnimationFrame(() => setCaret(row, from));
      return;
    }
    requestAnimationFrame(() => syncSelection(row));
  };

  return (
    <div
      className="pw-rack-biset-regex"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        pointerEvents: "none",
        zIndex: 9,
      }}
    >
      {expressions.map((text, row) => {
        const selection = selections[row] ?? { start: 0, end: 0 },
          cursor = selection.start,
          offset = visibleOffset(visual.condensed, cursor),
          count = visual.condensed ? 32 : 64,
          visible = text.slice(offset, offset + count),
          statusOffset = 1 + row * 3,
          syntax = (values[statusOffset] ?? 1) > 0.5,
          running = (values[statusOffset + 1] ?? (text ? 0 : 1)) > 0.5,
          active = activeCharacters(text, Math.round(values[statusOffset + 2] ?? -1)),
          pitch = (params[row] ?? 0) > 0.5,
          selectionStart = Math.min(selection.start, selection.end),
          selectionEnd = Math.max(selection.start, selection.end),
          background = pitch ? visual.colors.pitch : visual.colors.clock,
          inverse = pitch ? visual.colors.clock : visual.colors.pitch,
          indicator =
            !syntax && text
              ? visual.colors.error
              : running
                ? visual.colors.running
                : visual.colors.editing;
        return (
          <div
            key={row}
            style={{
              position: "absolute",
              left: visual.displayX * scaleX,
              top: visual.displayY + row * visual.rowStep,
              width: visual.displayWidth * scaleX,
              height: visual.displayHeight,
              overflow: "hidden",
              borderRadius: 5,
              background,
              pointerEvents: "auto",
            }}
          >
            {Array.from(visible).map((character, localIndex) => {
              const index = offset + localIndex,
                selected = activeRow === row && index >= selectionStart && index < selectionEnd;
              return (
                <span
                  key={index}
                  style={{
                    position: "absolute",
                    left: 3 + (localIndex % 32) * characterWidth,
                    top: 3 + Math.floor(localIndex / 32) * 12,
                    width: characterWidth + 0.1,
                    height: 12,
                    overflow: "visible",
                    whiteSpace: "pre",
                    color: characterColor(character, active.has(index), visual.colors),
                    background: selected ? inverse : undefined,
                    fontFamily: visual.font.family,
                    fontSize: 12,
                    lineHeight: "12px",
                  }}
                >
                  {character}
                </span>
              );
            })}
            {activeRow === row && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left:
                    2 +
                    (visual.condensed
                      ? Math.min(32, Math.max(0, cursor - offset))
                      : Math.max(0, cursor - offset) % 32) *
                      characterWidth,
                  top:
                    3 + (visual.condensed ? 0 : Math.floor(Math.max(0, cursor - offset) / 32)) * 12,
                  width: 1,
                  height: 12,
                  background: visual.colors.editing,
                }}
              />
            )}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: 20,
                height: "100%",
                borderRadius: "0 5px 5px 0",
                background: indicator,
              }}
            />
            <textarea
              ref={(element) => {
                inputs.current[row] = element;
              }}
              aria-label={`Regex expression ${row + 1}`}
              spellCheck={false}
              value={text}
              onPointerDown={(event) => pointer(row, event)}
              onClick={(event) => event.stopPropagation()}
              onFocus={() => {
                setActiveRow(row);
                syncSelection(row);
              }}
              onBlur={() => setActiveRow((current) => (current === row ? -1 : current))}
              onSelect={() => syncSelection(row)}
              onKeyDown={(event) => key(row, event)}
              onChange={(event) => update(row, event.currentTarget.value)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                margin: 0,
                padding: 3,
                border: 0,
                outline: 0,
                resize: "none",
                overflow: "hidden",
                whiteSpace: "pre",
                color: "transparent",
                caretColor: "transparent",
                background: "transparent",
                fontFamily: visual.font.family,
                fontSize: 12,
                lineHeight: "12px",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
