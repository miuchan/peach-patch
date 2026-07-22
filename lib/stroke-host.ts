export const STROKE_SPECIAL_MODES = [
  { value: 9, label: "Randomize hovered param" },
  { value: 10, label: "Copy hovered param" },
  { value: 11, label: "Paste hovered param" },
  { value: 12, label: "Focus module · 90%" },
  { value: 14, label: "Focus module · 30%" },
  { value: 13, label: "Fit patch" },
  { value: 15, label: "Toggle focus / fit" },
  { value: 20, label: "Toggle cable opacity" },
  { value: 21, label: "Next cable color" },
  { value: 22, label: "Rotate cable layer" },
  { value: 23, label: "Toggle cable visibility" },
  { value: 33, label: "Toggle module lock" },
  { value: 38, label: "Add random module" },
  { value: 36, label: "Save module preset" },
  { value: 37, label: "Save default preset" },
  { value: 40, label: "Pan left" },
  { value: 41, label: "Pan right" },
  { value: 42, label: "Pan up" },
  { value: 43, label: "Pan down" },
] as const;

export const STROKE_REPEATABLE_MODES = new Set<number>([40, 41, 42, 43]);

export function isStrokeCvMode(mode: number) {
  return mode >= 1 && mode <= 3;
}

export function strokeSpecialModeLabel(mode: number) {
  return STROKE_SPECIAL_MODES.find((option) => option.value === mode)?.label;
}
