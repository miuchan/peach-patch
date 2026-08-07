import assert from "node:assert/strict";
import test from "node:test";

import {
  editableTextUpdate,
  editableTextValue,
  type EditableTextVisual,
} from "../lib/rack-editable-text-data.ts";

const dynamicArrayVisual: EditableTextVisual = {
  kind: "editable-text",
  dataKey: "KnobSetNames",
  dataIndexState: 0,
  defaultTexts: ["Knob Set 1", "Knob Set 2", "Knob Set 3"],
  foregroundKey: "",
  backgroundKey: "",
  defaultForeground: "#000000",
  defaultBackground: "#ffffff00",
  defaultFontSize: 12,
  multiline: false,
  rotation: 0,
  x: 0,
  y: 0,
  width: 100,
  height: 20,
};

test("editable text follows a state-selected array entry", () => {
  const data = { KnobSetNames: ["Bass", "Lead", ""] };
  assert.equal(editableTextValue(data, dynamicArrayVisual, [1]), "Lead");
  assert.equal(editableTextValue({}, dynamicArrayVisual, [2]), "Knob Set 3");
  assert.deepEqual(editableTextUpdate(data, dynamicArrayVisual, "Pads", [2]), {
    KnobSetNames: ["Bass", "Lead", "Pads"],
  });
});

test("a dynamic array edit preserves every non-selected entry", () => {
  const data = { KnobSetNames: ["One", "Two", "Three"] };
  assert.deepEqual(editableTextUpdate(data, dynamicArrayVisual, "Second", [1]), {
    KnobSetNames: ["One", "Second", "Three"],
  });
});

test("editable text follows a parameter-selected nested array without losing sibling patterns", () => {
  const visual: EditableTextVisual = {
    ...dynamicArrayVisual,
    dataKey: "hexStrings",
    dataIndex: 1,
    dataIndexState: undefined,
    dataOuterIndexParam: 0,
  };
  const data = {
    hexStrings: [
      ["A", "B"],
      ["C", "D"],
    ],
  };
  assert.equal(editableTextValue(data, visual, [], [1]), "D");
  assert.deepEqual(editableTextUpdate(data, visual, "E", [], [1]), {
    hexStrings: [
      ["A", "B"],
      ["C", "E"],
    ],
  });
});

test("editable text normalizes source character and numeric formats", () => {
  const digits: EditableTextVisual = {
    ...dynamicArrayVisual,
    dataKey: "steps",
    dataIndexState: undefined,
    dataFormat: "one-based-digits",
  };
  assert.equal(editableTextValue({ steps: [0, 8, -1, 4, 9, "2"] }, digits), "1953");
  assert.deepEqual(editableTextUpdate({}, digits, "190x5"), { steps: [0, 8, 4] });

  const integer: EditableTextVisual = {
    ...dynamicArrayVisual,
    dataKey: "count",
    dataIndexState: undefined,
    dataFormat: "integer",
    minimum: 2,
    maximum: 8,
  };
  assert.deepEqual(editableTextUpdate({}, integer, "99.5"), { count: 8 });
  assert.deepEqual(editableTextUpdate({}, integer, "-4"), { count: 2 });
  assert.equal(editableTextUpdate({}, integer, "no digits"), undefined);

  const number: EditableTextVisual = {
    ...integer,
    dataFormat: "number",
    minimum: undefined,
    maximum: undefined,
  };
  assert.deepEqual(editableTextUpdate({}, number, "3.25"), { count: 3.25 });
  assert.equal(editableTextUpdate({}, number, "3x"), undefined);

  const filtered: EditableTextVisual = {
    ...dynamicArrayVisual,
    dataKey: "label",
    dataIndexState: undefined,
    uppercase: true,
    allowedCharacters: "ABC123",
  };
  assert.deepEqual(editableTextUpdate({}, filtered, "a-b c123z"), { label: "ABC123" });
  assert.equal(editableTextValue({ label: 42 }, filtered), "42");
  assert.equal(
    editableTextValue({}, { ...filtered, defaultTexts: undefined, defaultText: "Untitled" }),
    "Untitled",
  );
});

test("editable text resolves fallback selectors and grows missing nested storage", () => {
  const selected: EditableTextVisual = {
    ...dynamicArrayVisual,
    dataIndex: 2,
    dataIndexState: 0,
    dataIndexParam: 1,
  };
  assert.equal(editableTextValue({}, selected, undefined, [0, 1]), "Knob Set 2");
  assert.equal(editableTextValue({}, selected, [-4], [0, 1]), "Knob Set 1");
  assert.equal(editableTextValue({}, selected), "Knob Set 3");

  const outerText: EditableTextVisual = {
    ...dynamicArrayVisual,
    dataKey: "patterns",
    dataIndexState: undefined,
    dataOuterIndex: 2,
  };
  assert.deepEqual(editableTextUpdate({ patterns: "invalid" }, outerText, "Third"), {
    patterns: [[], [], "Third"],
  });
  assert.equal(editableTextValue({ patterns: ["First", "Second", "Third"] }, outerText), "Third");

  const nested: EditableTextVisual = {
    ...outerText,
    dataIndex: 2,
  };
  assert.deepEqual(editableTextUpdate({ patterns: ["not an array"] }, nested, "Cell"), {
    patterns: ["not an array", [], ["", "", "Cell"]],
  });

  const flat: EditableTextVisual = {
    ...dynamicArrayVisual,
    dataKey: "names",
    dataIndexState: undefined,
    dataIndex: 2,
  };
  assert.deepEqual(editableTextUpdate({ names: "invalid" }, flat, "Third"), {
    names: ["", "", "Third"],
  });
  assert.equal(editableTextValue({ names: ["First", "Second", "Third"] }, flat), "Third");
});
