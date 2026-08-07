import { useMemo, useRef, useState } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type SpellbookVisual = Extract<RuntimeVisual, { kind: "spellbook-editor" }>;

function coloredLine(line: string, lineIndex: number) {
  let comment = false;
  return [...line].map((character, index) => {
    let color = lineIndex < 0 ? "#ffffff" : comment ? "#9e50bf" : "#ffd700";
    if (character === ",") {
      color = "#9b8300";
      comment = false;
    } else if (character === "?") {
      color = "#7908aa";
      comment = true;
    }
    return (
      <span key={index} style={{ color }}>
        {character}
      </span>
    );
  });
}

export function RackSpellbookEditor({
  data,
  visual,
  scaleX,
  onData,
}: {
  data: Record<string, unknown>;
  visual: SpellbookVisual;
  scaleX: number;
  onData: (data: Record<string, unknown>) => void;
}) {
  const overlayRef = useRef<HTMLPreElement>(null);
  const [focused, setFocused] = useState(false);
  const storedText = data[visual.dataKey];
  const text = typeof storedText === "string" ? storedText : visual.defaultText;
  const storedLineHeight = Number(data[visual.lineHeightKey]);
  const lineHeight = Math.max(
    visual.minimumLineHeight,
    Math.min(visual.maximumLineHeight, Number.isFinite(storedLineHeight) ? storedLineHeight : 12),
  );
  const lines = useMemo(() => text.split("\n"), [text]);
  const width = visual.width * scaleX;
  const common = {
    fontFamily: "Hack, ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: lineHeight,
    lineHeight: `${lineHeight}px`,
    letterSpacing: 0,
    tabSize: 2,
  } as const;

  return (
    <div
      className={`pw-spellbook-editor${focused ? " is-focused" : ""}`}
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width,
        height: visual.height,
        overflow: "hidden",
        background: focused ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.48)",
        zIndex: 9,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <pre
        ref={overlayRef}
        aria-hidden="true"
        style={{
          ...common,
          position: "absolute",
          inset: 0,
          margin: 0,
          overflow: "hidden",
          whiteSpace: "pre",
          pointerEvents: "none",
        }}
      >
        {lines.map((line, lineIndex) => (
          <span key={lineIndex}>
            {coloredLine(line, lineIndex)}
            {lineIndex < lines.length - 1 ? "\n" : ""}
          </span>
        ))}
      </pre>
      <textarea
        aria-label="Spellbook sequence"
        className="pw-spellbook-editor-input"
        value={text}
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onScroll={(event) => {
          if (!overlayRef.current) return;
          overlayRef.current.scrollLeft = event.currentTarget.scrollLeft;
          overlayRef.current.scrollTop = event.currentTarget.scrollTop;
        }}
        onChange={(event) => onData({ [visual.dataKey]: event.currentTarget.value })}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (!(event.ctrlKey || event.metaKey) || (event.key !== "[" && event.key !== "]")) return;
          event.preventDefault();
          const next = Math.max(
            visual.minimumLineHeight,
            Math.min(visual.maximumLineHeight, lineHeight + (event.key === "]" ? 1 : -1)),
          );
          onData({ [visual.lineHeightKey]: next });
        }}
        style={{
          ...common,
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          margin: 0,
          padding: 0,
          resize: "none",
          overflow: "auto",
          border: 0,
          outline: 0,
          background: "transparent",
          color: "transparent",
          WebkitTextFillColor: "transparent",
          caretColor: "rgba(158,80,191,.75)",
          whiteSpace: "pre",
        }}
      />
    </div>
  );
}
