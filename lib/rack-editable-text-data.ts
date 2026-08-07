import type { RuntimeVisual } from "./web-plugin-registry";

export type EditableTextVisual = Extract<RuntimeVisual, { kind: "editable-text" }>;

function selectedIndex(
  fixed: number | undefined,
  stateIndex: number | undefined,
  paramIndex: number | undefined,
  state: readonly number[] | undefined,
  params: readonly number[] | undefined,
) {
  if (stateIndex === undefined && paramIndex === undefined) return fixed;
  const value = Math.round(
    (stateIndex === undefined ? undefined : state?.[stateIndex]) ??
      (paramIndex === undefined ? undefined : params?.[paramIndex]) ??
      fixed ??
      0,
  );
  return Math.max(0, value);
}

function dataIndex(
  visual: EditableTextVisual,
  state: readonly number[] | undefined,
  params: readonly number[] | undefined,
) {
  return selectedIndex(
    visual.dataIndex,
    visual.dataIndexState,
    visual.dataIndexParam,
    state,
    params,
  );
}

function dataOuterIndex(
  visual: EditableTextVisual,
  state: readonly number[] | undefined,
  params: readonly number[] | undefined,
) {
  return selectedIndex(
    visual.dataOuterIndex,
    visual.dataOuterIndexState,
    visual.dataOuterIndexParam,
    state,
    params,
  );
}

function storedValue(
  data: Record<string, unknown>,
  visual: EditableTextVisual,
  state: readonly number[] | undefined,
  params: readonly number[] | undefined,
) {
  const stored = data[visual.dataKey];
  const outerIndex = dataOuterIndex(visual, state, params);
  const outerStored =
    outerIndex === undefined ? stored : Array.isArray(stored) ? stored[outerIndex] : undefined;
  const index = dataIndex(visual, state, params);
  return index === undefined && visual.dataFormat !== "one-based-digits"
    ? outerStored
    : Array.isArray(outerStored)
      ? index === undefined
        ? outerStored
        : outerStored[index]
      : undefined;
}

export function editableTextValue(
  data: Record<string, unknown>,
  visual: EditableTextVisual,
  state?: readonly number[],
  params?: readonly number[],
) {
  const stored = storedValue(data, visual, state, params);
  if (visual.dataFormat === "one-based-digits" && Array.isArray(stored)) {
    return stored
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 8)
      .map((value) => String(value + 1))
      .join("");
  }
  if (typeof stored === "string" || typeof stored === "number") return String(stored);
  return visual.defaultTexts?.[dataIndex(visual, state, params) ?? 0] ?? visual.defaultText ?? "";
}

export function editableTextUpdate(
  data: Record<string, unknown>,
  visual: EditableTextVisual,
  nextText: string,
  state?: readonly number[],
  params?: readonly number[],
): Record<string, unknown> | undefined {
  let normalizedText = visual.uppercase ? nextText.toUpperCase() : nextText;
  if (visual.allowedCharacters) {
    const allowed = new Set(visual.allowedCharacters);
    normalizedText = [...normalizedText].filter((character) => allowed.has(character)).join("");
  }
  if (visual.dataFormat === "integer" || visual.dataFormat === "number") {
    const parsed =
      visual.dataFormat === "integer"
        ? Number.parseInt(normalizedText, 10)
        : Number(normalizedText);
    if (!Number.isFinite(parsed)) return undefined;
    return {
      [visual.dataKey]: Math.max(
        visual.minimum ?? -Infinity,
        Math.min(visual.maximum ?? Infinity, parsed),
      ),
    };
  }
  if (visual.dataFormat === "one-based-digits") {
    const values = [...normalizedText]
      .map((character) => Number(character) - 1)
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 8);
    return { [visual.dataKey]: values };
  }
  const index = dataIndex(visual, state, params);
  const outerIndex = dataOuterIndex(visual, state, params);
  if (index === undefined && outerIndex === undefined) return { [visual.dataKey]: normalizedText };
  const stored = data[visual.dataKey];
  if (outerIndex !== undefined) {
    const outerValues = Array.isArray(stored)
      ? stored.map((value) => (Array.isArray(value) ? [...value] : value))
      : [];
    while (outerValues.length <= outerIndex) outerValues.push([]);
    if (index === undefined) {
      outerValues[outerIndex] = normalizedText;
    } else {
      const innerValues = Array.isArray(outerValues[outerIndex])
        ? [...outerValues[outerIndex]]
        : [];
      while (innerValues.length <= index) innerValues.push("");
      innerValues[index] = normalizedText;
      outerValues[outerIndex] = innerValues;
    }
    return { [visual.dataKey]: outerValues };
  }
  if (index === undefined) return { [visual.dataKey]: normalizedText };
  const values = Array.isArray(stored) ? [...stored] : [];
  while (values.length <= index) values.push("");
  values[index] = normalizedText;
  return { [visual.dataKey]: values };
}
