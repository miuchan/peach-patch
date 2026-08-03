import { rackKeyFromKeyboard, rackModifiersFromKeyboard } from "./rack-studio-helpers.ts";

type RackModuleKeyboardEvent = {
  key: string;
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
};

export function rackKeyFromModuleEvent(event: RackModuleKeyboardEvent) {
  return rackKeyFromKeyboard(event as KeyboardEvent);
}

export function rackModifiersFromModuleEvent(event: RackModuleKeyboardEvent) {
  return rackModifiersFromKeyboard(event as KeyboardEvent);
}

const STROKE_KEY_NAMES: Readonly<Record<number, string>> = {
  256: "Esc",
  257: "Enter",
  258: "Tab",
  259: "Backspace",
  260: "Insert",
  261: "Delete",
  262: "→",
  263: "←",
  264: "↓",
  265: "↑",
  266: "Page Up",
  267: "Page Down",
  268: "Home",
  269: "End",
  280: "Caps Lock",
  281: "Scroll Lock",
  282: "Num Lock",
  283: "Print",
  284: "Pause",
  340: "Left Shift",
  341: "Left Ctrl",
  342: "Left Alt",
  343: "Left Meta",
  344: "Right Shift",
  345: "Right Ctrl",
  346: "Right Alt",
  347: "Right Meta",
};

const AUDIO_METER_THRESHOLDS = [0, -6, -12, -24, -36, -48] as const;

export function strokeKeyLabel(key: number, modifiers: number) {
  if (key < 0) return "Map key";

  const prefix = [
    modifiers & 8 ? "⌘" : "",
    modifiers & 2 ? "Ctrl+" : "",
    modifiers & 4 ? "Alt+" : "",
    modifiers & 1 ? "Shift+" : "",
  ].join("");
  const label =
    STROKE_KEY_NAMES[key] ??
    (key >= 290 && key <= 314 ? `F${key - 289}` : String.fromCharCode(key));
  return `${prefix}${label}`;
}

export function rackMidiLogText(values: number[] | undefined, rows: number, columns: number) {
  if (!values?.length) return "";

  const rowCount = Math.max(0, Math.min(rows, Math.round(values[0] ?? 0)));
  const lines: string[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    const offset = 1 + row * (columns + 1);
    const length = Math.max(0, Math.min(columns, Math.round(values[offset] ?? 0)));
    const characters = values
      .slice(offset + 1, offset + 1 + length)
      .map((value) => Math.max(0, Math.min(255, Math.round(value))));
    lines.push(String.fromCharCode(...characters));
  }
  return lines.join("\n");
}

export function audioBoundaryLightValues(
  channels: 2 | 8 | 16,
  count: number,
  running: boolean,
  inputLevels: Readonly<Record<number, number>>,
) {
  const values = Array.from({ length: count }, () => 0);
  if (channels > 2) {
    if (running) values[0] = 1;
    return values;
  }

  for (let channel = 0; channel < 2; channel += 1) {
    const decibels = 20 * Math.log10(Math.max(1e-9, (inputLevels[channel] ?? 0) / 10));
    for (let band = 0; band < AUDIO_METER_THRESHOLDS.length; band += 1) {
      values[channel * AUDIO_METER_THRESHOLDS.length + band] =
        decibels >= AUDIO_METER_THRESHOLDS[band] ? 1 : 0;
    }
  }
  return values;
}
