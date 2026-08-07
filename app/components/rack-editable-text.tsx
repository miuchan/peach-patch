import { useEffect, useState, type CSSProperties } from "react";
import {
  editableTextUpdate,
  editableTextValue,
  type EditableTextVisual,
} from "../../lib/rack-editable-text-data";

function color(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value)
    ? value
    : fallback;
}

function paddedHex(value: bigint, length: number) {
  return value.toString(16).toUpperCase().padStart(length, "0").slice(-length);
}

function transformHexPattern(
  key: string,
  text: string,
  density: number,
  minimumLength: number,
  maximumLength: number,
) {
  const normalized = text.replaceAll("*", "0").toUpperCase();
  if (key === "p") {
    const from = Math.max(1, Math.min(16, Math.round(minimumLength)));
    const to = Math.max(from, Math.min(16, Math.round(maximumLength)));
    const length = from + Math.floor(Math.random() * (to - from + 1));
    return Array.from({ length }, () => {
      let nibble = 0;
      for (let bit = 0; bit < 4; bit += 1) if (Math.random() < density) nibble |= 1 << bit;
      return nibble.toString(16).toUpperCase();
    }).join("");
  }
  if (!normalized) return text;
  const bits = BigInt(normalized.length * 4);
  const mask = (1n << bits) - 1n;
  const value = BigInt(`0x${normalized}`);
  if (key === "r")
    return paddedHex((value >> 1n) | ((value & 1n) << (bits - 1n)), normalized.length);
  if (key === "l")
    return paddedHex(((value << 1n) & mask) | (value >> (bits - 1n)), normalized.length);
  if (key === "h" && text.length <= 8) {
    const doubled = [
      "00",
      "02",
      "08",
      "0A",
      "20",
      "22",
      "28",
      "2A",
      "80",
      "82",
      "88",
      "8A",
      "A0",
      "A2",
      "A8",
      "AA",
    ];
    return [...text.toUpperCase()]
      .map((character) => (character === "*" ? "**" : doubled[Number.parseInt(character, 16)]))
      .join("");
  }
  return text;
}

export function RackEditableText({
  data,
  state,
  params,
  visual,
  scaleX,
  onData,
}: {
  data: Record<string, unknown>;
  state?: readonly number[];
  params?: readonly number[];
  visual: EditableTextVisual;
  scaleX: number;
  onData: (data: Record<string, unknown>) => void;
}) {
  const {
    dataKey,
    foregroundKey,
    backgroundKey,
    fontSizeKey,
    title,
    maximumLength,
    defaultForeground,
    defaultBackground,
    defaultFontSize,
    fontFamily = "'Share Tech Mono', ui-monospace, monospace",
    fontWeight,
    textAlign,
    lineHeight = 1.05,
    padding = 2,
    borderRadius = 5,
    multiline,
    rotation,
    x,
    y,
    width,
    height,
  } = visual;
  const externalValue = editableTextValue(data, visual, state, params);
  const deferred =
    visual.deferred === true || visual.dataFormat === "integer" || visual.dataFormat === "number";
  const [draft, setDraft] = useState(externalValue);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(externalValue);
  }, [externalValue, focused]);
  const value = deferred ? draft : externalValue;
  const fontSizeValue = Number(fontSizeKey ? data[fontSizeKey] : defaultFontSize);
  const shared: CSSProperties = {
    position: "absolute",
    left: x * scaleX,
    top: y,
    width: width * scaleX,
    height,
    boxSizing: "border-box",
    resize: "none",
    overflow: "hidden",
    border: 0,
    borderRadius,
    outline: "none",
    padding,
    color:
      focused && draft !== externalValue && visual.dirtyForeground
        ? visual.dirtyForeground
        : color(data[foregroundKey], defaultForeground),
    background:
      (focused ? visual.focusBackgroundCss : visual.backgroundCss) ??
      color(data[backgroundKey], defaultBackground),
    fontSize: Number.isFinite(fontSizeValue) ? fontSizeValue : defaultFontSize,
    fontFamily,
    fontWeight,
    textAlign,
    lineHeight,
    whiteSpace: multiline ? "pre-wrap" : "pre",
    zIndex: 9,
    transformOrigin: "0 0",
    transform: rotation === 90 ? "translateX(25px) rotate(90deg)" : undefined,
  };
  const update = (next: string) => {
    const updates = editableTextUpdate(data, visual, next, state, params);
    if (updates) onData(updates);
  };
  const commit = () => {
    if (deferred) update(draft);
  };
  const events = {
    onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
    onClick: (event: React.MouseEvent) => event.stopPropagation(),
    onFocus: () => setFocused(true),
    onBlur: () => {
      commit();
      setFocused(false);
    },
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (deferred) setDraft(event.target.value);
      else update(event.target.value);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      event.stopPropagation();
      const shortcut = visual.hexPatternShortcuts;
      const key = event.key.toLowerCase();
      if (
        shortcut &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        ["p", "r", "l", "h"].includes(key)
      ) {
        event.preventDefault();
        const next = transformHexPattern(
          key,
          value,
          Math.max(0, Math.min(1, state?.[shortcut.densityState] ?? 0.3)),
          state?.[shortcut.minimumLengthState] ?? 8,
          state?.[shortcut.maximumLengthState] ?? 8,
        );
        setDraft(next);
        if (event.shiftKey) update(next);
        return;
      }
      if (!multiline && event.key === "Enter") {
        commit();
        event.currentTarget.blur();
      }
    },
  };
  return multiline ? (
    <textarea
      aria-label={title ?? dataKey}
      title={title}
      maxLength={maximumLength}
      spellCheck={false}
      value={value}
      style={shared}
      {...events}
    />
  ) : (
    <input
      aria-label={title ?? dataKey}
      title={title}
      maxLength={maximumLength}
      inputMode={deferred ? "decimal" : undefined}
      spellCheck={false}
      value={value}
      style={shared}
      {...events}
    />
  );
}
