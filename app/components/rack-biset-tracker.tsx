import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type TrackerVisual = Extract<RuntimeVisual, { kind: "biset-tracker" }>;
type TrackerOutputVisual = Extract<RuntimeVisual, { kind: "biset-tracker-output" }>;
type TrackerStateVisual = Extract<RuntimeVisual, { kind: "biset-tracker-state" }>;
type TrackerSynth = { index: number; color: number; mode: number; channels: number; name: string };
type TrackerPattern = { index: number; color: number; name: string };
type TrackerNote = {
  mode: number;
  pitch: number;
  velocity: number;
  panning: number;
  synth: number;
  delay: number;
  glide: number;
  fxCount: number;
  effects: Array<{ type: number; value: number }>;
};
type TrackerCv = { mode: number; value: number; curve: number; delay: number };
type TrackerLine = { line: number; notes: TrackerNote[]; cvs: TrackerCv[] };
type TrackerInstance = {
  row: number;
  beat: number;
  length: number;
  start: number;
  pattern: number;
  color: number;
  muted: boolean;
  selected: boolean;
};
export type TrackerVoice = {
  synth: number;
  channel: number;
  color: number;
  mode: number;
  pitch: number;
  gate: number;
  velocity: number;
  panning: number;
};

export type BisetTrackerState = {
  mode: number;
  play: number;
  beat: number;
  patternId: number;
  synthId: number;
  patternCount: number;
  synthCount: number;
  patternLine: number;
  patternColumn: number;
  patternCell: number;
  patternCameraX: number;
  patternCameraY: number;
  octave: number;
  jump: number;
  timelineCameraX: number;
  timelineCameraY: number;
  viewMask: number;
  patternLineCount: number;
  noteCount: number;
  cvCount: number;
  lpb: number;
  beatCount: number;
  playingLine: number;
  synths: TrackerSynth[];
  patterns: TrackerPattern[];
  lines: TrackerLine[];
  instances: TrackerInstance[];
  voices: TrackerVoice[];
};

const PITCH_NAMES = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];

function integer(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) ? Math.round(value as number) : fallback;
}

function decodeText(values: readonly number[], offset: number) {
  const length = Math.max(0, Math.min(32, integer(values[offset]))),
    bytes = Uint8Array.from(
      Array.from({ length }, (_, index) =>
        Math.max(0, Math.min(255, integer(values[offset + 1 + index]))),
      ),
    );
  return new TextDecoder().decode(bytes);
}

export function parseBisetTrackerState(values: readonly number[] = []): BisetTrackerState | null {
  if (integer(values[0]) !== 1 || values.length < 32) return null;
  const synthCount = Math.max(0, Math.min(100, integer(values[7]))),
    visiblePatternCount = Math.max(0, Math.min(1000, integer(values[30]))),
    noteCount = Math.max(0, Math.min(32, integer(values[22]))),
    cvCount = Math.max(0, Math.min(32, integer(values[23])));
  let offset = 32;
  const synths: TrackerSynth[] = [];
  for (let index = 0; index < synthCount && offset + 36 < values.length; index++, offset += 37)
    synths.push({
      index: integer(values[offset]),
      color: integer(values[offset + 1]),
      mode: integer(values[offset + 2]),
      channels: integer(values[offset + 3]),
      name: decodeText(values, offset + 4),
    });
  const patterns: TrackerPattern[] = [];
  for (
    let index = 0;
    index < visiblePatternCount && offset + 34 < values.length;
    index++, offset += 35
  )
    patterns.push({
      index: integer(values[offset]),
      color: integer(values[offset + 1]),
      name: decodeText(values, offset + 2),
    });
  const lines: TrackerLine[] = [];
  if (integer(values[4], -1) >= 0) {
    for (let visibleLine = 0; visibleLine < 39 && offset < values.length; visibleLine++) {
      const line = integer(values[offset++], -1),
        notes: TrackerNote[] = [],
        cvs: TrackerCv[] = [];
      for (let column = 0; column < noteCount && offset + 23 < values.length; column++) {
        const effects = Array.from({ length: 8 }, (_, effect) => ({
          type: integer(values[offset + 8 + effect * 2]),
          value: integer(values[offset + 9 + effect * 2]),
        }));
        notes.push({
          mode: integer(values[offset], -1),
          pitch: integer(values[offset + 1]),
          velocity: integer(values[offset + 2]),
          panning: integer(values[offset + 3]),
          synth: integer(values[offset + 4]),
          delay: integer(values[offset + 5]),
          glide: integer(values[offset + 6]),
          fxCount: Math.max(0, Math.min(8, integer(values[offset + 7]))),
          effects,
        });
        offset += 24;
      }
      for (let column = 0; column < cvCount && offset + 3 < values.length; column++) {
        cvs.push({
          mode: integer(values[offset], -1),
          value: integer(values[offset + 1]),
          curve: integer(values[offset + 2]),
          delay: integer(values[offset + 3]),
        });
        offset += 4;
      }
      lines.push({ line, notes, cvs });
    }
  }
  const instanceCount = Math.max(0, Math.min(4096, integer(values[offset++]))),
    instances: TrackerInstance[] = [];
  for (let index = 0; index < instanceCount && offset + 7 < values.length; index++, offset += 8)
    instances.push({
      row: integer(values[offset]),
      beat: integer(values[offset + 1]),
      length: integer(values[offset + 2]),
      start: integer(values[offset + 3]),
      pattern: integer(values[offset + 4]),
      color: integer(values[offset + 5]),
      muted: (values[offset + 6] ?? 0) > 0.5,
      selected: (values[offset + 7] ?? 0) > 0.5,
    });
  const voiceCount = Math.max(0, Math.min(1600, integer(values[offset++]))),
    voices: TrackerVoice[] = [];
  for (let index = 0; index < voiceCount && offset + 7 < values.length; index++, offset += 8)
    voices.push({
      synth: integer(values[offset]),
      channel: integer(values[offset + 1]),
      color: integer(values[offset + 2]),
      mode: integer(values[offset + 3]),
      pitch: values[offset + 4] ?? 0,
      gate: values[offset + 5] ?? 0,
      velocity: values[offset + 6] ?? 0,
      panning: values[offset + 7] ?? 0,
    });
  return {
    mode: integer(values[1]),
    play: integer(values[2]),
    beat: values[3] ?? 0,
    patternId: integer(values[4], -1),
    synthId: integer(values[5], -1),
    patternCount: integer(values[6]),
    synthCount,
    patternLine: integer(values[8]),
    patternColumn: integer(values[9]),
    patternCell: integer(values[10]),
    patternCameraX: integer(values[11]),
    patternCameraY: integer(values[12]),
    octave: integer(values[13]),
    jump: integer(values[14]),
    timelineCameraX: integer(values[15]),
    timelineCameraY: integer(values[16]),
    viewMask: integer(values[17]),
    patternLineCount: integer(values[21]),
    noteCount,
    cvCount,
    lpb: Math.max(1, integer(values[24], 1)),
    beatCount: integer(values[25]),
    playingLine: integer(values[29], -1),
    synths,
    patterns,
    lines,
    instances,
    voices,
  };
}

function prepareCanvas(canvas: HTMLCanvasElement, width: number, height: number, scaleX = 1) {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(width * scaleX * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext("2d");
  context?.setTransform(ratio * scaleX, 0, 0, ratio, 0, 0);
  return context;
}

function pad(value: number, width: number) {
  return String(Math.max(0, Math.trunc(value)))
    .padStart(width, "0")
    .slice(-width);
}

function sourceCellAt(state: BisetTrackerState, x: number) {
  const visible = (bit: number) => (state.viewMask & bit) !== 0;
  const aim = Math.floor((x - 2) / 6.302522) - 2 + state.patternCameraX;
  let cursor = 0;
  for (let column = 0; column < state.noteCount; column++) {
    const note = state.lines[0]?.notes[column],
      widths: Array<[number, number]> = [
        [2, 0],
        [1, 1],
        ...(visible(1) ? ([[2, 2]] as Array<[number, number]>) : []),
        ...(visible(2) ? ([[2, 3]] as Array<[number, number]>) : []),
        [2, 4],
        ...(visible(4) ? ([[2, 5]] as Array<[number, number]>) : []),
        ...(visible(8) ? ([[2, 6]] as Array<[number, number]>) : []),
      ];
    if (visible(16))
      for (let effect = 0; effect < (note?.fxCount ?? 0); effect++)
        widths.push([1, 7 + effect * 2], [2, 8 + effect * 2]);
    for (const [width, cell] of widths) {
      cursor += width;
      if (cursor >= aim) return { column, cell };
    }
    cursor++;
  }
  for (let column = 0; column < state.cvCount; column++) {
    for (const [width, cell] of [
      [3, 0],
      [2, 1],
      [2, 2],
    ] as Array<[number, number]>) {
      cursor += width;
      if (cursor >= aim) return { column: state.noteCount + column, cell };
    }
    cursor++;
  }
  return { column: Math.max(0, state.noteCount + state.cvCount - 1), cell: 0 };
}

function drawPattern(
  context: CanvasRenderingContext2D,
  visual: TrackerVisual,
  state: BisetTrackerState,
) {
  const colors = visual.colors,
    cw = visual.charWidth,
    ch = visual.charHeight,
    visible = (bit: number) => (state.viewMask & bit) !== 0;
  context.fillStyle = colors[0];
  context.fillRect(0, 0, visual.main.width, visual.main.height + 1);
  context.font = `9px ${JSON.stringify(visual.font.family)}`;
  context.textBaseline = "alphabetic";
  if (
    state.play &&
    state.playingLine >= state.patternCameraY &&
    state.playingLine < state.patternCameraY + 39
  ) {
    context.fillStyle = colors[15];
    context.fillRect(
      0,
      3.5 + ch * (state.playingLine - state.patternCameraY),
      visual.main.width + 0.5,
      ch,
    );
  }
  if (state.patternLine >= state.patternCameraY && state.patternLine < state.patternCameraY + 39) {
    context.fillStyle = colors[15];
    context.fillRect(
      0,
      3.5 + ch * (state.patternLine - state.patternCameraY),
      visual.main.width + 0.5,
      ch,
    );
  }
  const text = (value: string, tx: number, row: number, color: number, focused = false) => {
    const localX = tx - state.patternCameraX;
    if (localX < 0 || localX > visual.columns - 1) return;
    const x = 2 + cw * (localX + 3),
      y = 11 + ch * row;
    if (focused) {
      context.fillStyle = colors[12];
      context.fillRect(x, y - ch + 1, cw * value.length, ch);
    }
    context.fillStyle = colors[color];
    context.fillText(value, x, y);
  };
  for (let row = 0; row < state.lines.length; row++) {
    const line = state.lines[row];
    if (line.line < 0) continue;
    context.fillStyle = line.line % state.lpb === 0 ? colors[13] : colors[15];
    context.fillText(
      line.line % state.lpb === 0 ? pad(line.line / state.lpb, 3) : pad(line.line % state.lpb, 2),
      2,
      11 + row * ch,
    );
    let tx = 0;
    for (let column = 0; column < state.noteCount; column++) {
      const note = line.notes[column],
        focusedLine = state.patternColumn === column && state.patternLine === line.line;
      let cellX = tx;
      const keep = note.mode === 0,
        stop = note.mode === 3,
        pitch = keep ? ".." : stop ? "--" : PITCH_NAMES[((note.pitch % 12) + 12) % 12],
        octave = keep ? "." : stop ? "-" : pad(note.pitch / 12, 1);
      text(pitch, cellX, row, 3, focusedLine && state.patternCell === 0);
      cellX += 2;
      text(octave, cellX, row, 2, focusedLine && state.patternCell === 1);
      cellX++;
      if (visible(1)) {
        text(
          keep || stop ? ".." : pad(note.velocity, 2),
          cellX,
          row,
          5,
          focusedLine && state.patternCell === 2,
        );
        cellX += 2;
      }
      if (visible(2)) {
        text(
          keep || stop ? ".." : pad(note.panning, 2),
          cellX,
          row,
          6,
          focusedLine && state.patternCell === 3,
        );
        cellX += 2;
      }
      text(
        note.mode === 1 ? pad(note.synth, 2) : "..",
        cellX,
        row,
        4,
        focusedLine && state.patternCell === 4,
      );
      cellX += 2;
      if (visible(4)) {
        text(
          keep ? ".." : pad(note.delay, 2),
          cellX,
          row,
          10,
          focusedLine && state.patternCell === 5,
        );
        cellX += 2;
      }
      if (visible(8)) {
        text(
          note.mode === 2 ? pad(note.glide, 2) : "..",
          cellX,
          row,
          11,
          focusedLine && state.patternCell === 6,
        );
        cellX += 2;
      }
      if (visible(16))
        for (let effect = 0; effect < note.fxCount; effect++) {
          const item = note.effects[effect],
            empty = keep || stop || !item.type;
          text(
            empty ? "." : String.fromCharCode(item.type),
            cellX,
            row,
            13,
            focusedLine && state.patternCell === 7 + effect * 2,
          );
          cellX++;
          text(
            empty ? ".." : pad(item.value, 2),
            cellX,
            row,
            14,
            focusedLine && state.patternCell === 8 + effect * 2,
          );
          cellX += 2;
        }
      tx = cellX + 1;
    }
    for (let column = 0; column < state.cvCount; column++) {
      const cv = line.cvs[column],
        focusedLine =
          state.patternColumn === state.noteCount + column && state.patternLine === line.line;
      text(
        cv.mode === 0 ? "..." : pad(cv.value, 3),
        tx,
        row,
        3,
        focusedLine && state.patternCell === 0,
      );
      tx += 3;
      text(
        cv.mode === 0 ? ".." : pad(cv.curve, 2),
        tx,
        row,
        5,
        focusedLine && state.patternCell === 1,
      );
      tx += 2;
      text(
        cv.mode === 0 ? ".." : pad(cv.delay, 2),
        tx,
        row,
        10,
        focusedLine && state.patternCell === 2,
      );
      tx += 3;
    }
  }
}

function drawTimeline(
  context: CanvasRenderingContext2D,
  visual: TrackerVisual,
  state: BisetTrackerState,
) {
  const colors = visual.colors,
    user = visual.userColors,
    cw = visual.charWidth,
    ch = visual.charHeight;
  context.fillStyle = colors[0];
  context.fillRect(0, 0, visual.main.width, visual.main.height + 1);
  context.font = `9px ${JSON.stringify(visual.font.family)}`;
  if (state.play === 1 || state.play === 2) {
    context.fillStyle = colors[15];
    context.fillRect(2 + cw * (state.beat + 2 - state.timelineCameraX), 0, cw, visual.main.height);
  }
  for (let index = 0; index < 85; index++) {
    const beat = index + state.timelineCameraX;
    context.fillStyle = beat % 4 === 0 ? colors[13] : colors[15];
    context.fillText(pad(beat % 4 === 0 ? beat / 4 : beat % 4, 3), 2 + cw * (index + 2), 11);
  }
  context.fillStyle = colors[15];
  for (let index = 4 - (state.timelineCameraX % 4); index < 85; index += 4)
    context.fillRect(2 + cw * (index + 2), 13 + ch * 2, 1, ch * 36);
  for (const instance of state.instances) {
    const x = 2 + cw * (instance.beat - state.timelineCameraX + 2),
      y = 13 + ch * ((instance.row - state.timelineCameraY) * 3 + 2),
      width = cw * instance.length - 1,
      height = ch * 3 - 4;
    context.save();
    context.globalAlpha = instance.muted ? 0.5 : 1;
    context.fillStyle = user[instance.color] ?? user[0];
    context.beginPath();
    context.roundRect(x + 1, y + 2, width, height, instance.length > 1 ? 5 : 3);
    context.fill();
    context.restore();
    if (instance.length > 2) {
      context.strokeStyle = colors[0];
      context.lineWidth = 1;
      for (const handleX of [x + 1 + cw, x + 1 + width - cw]) {
        context.beginPath();
        context.moveTo(handleX, y + 2);
        context.lineTo(handleX, y + 2 + height);
        context.stroke();
      }
    }
    if (instance.selected) {
      context.strokeStyle = colors[12];
      context.beginPath();
      context.roundRect(x + 1, y + 2, width, height, instance.length > 1 ? 5 : 3);
      context.stroke();
    }
    const name = state.patterns.find((pattern) => pattern.index === instance.pattern)?.name ?? "";
    context.fillStyle = colors[12];
    context.fillText(name.slice(0, Math.max(0, instance.length - 1)), x + 3, y + ch * 2 - 2);
  }
  context.fillStyle = colors[0];
  context.fillRect(0, 6 + ch * 3, 2 + cw * 2, 6 + ch * 35);
  for (let index = 0; index < 12; index++) {
    const row = index + state.timelineCameraY;
    context.fillStyle = row % 2 === 0 ? colors[14] : colors[13];
    context.fillText(pad(row, 2), 2, 11 + ch * (index * 3 + 4));
  }
}

function drawTuning(
  context: CanvasRenderingContext2D,
  visual: TrackerVisual,
  params: readonly number[],
) {
  const centerX = visual.main.width / 2,
    centerY = visual.main.height / 2;
  context.fillStyle = visual.colors[0];
  context.fillRect(0, 0, visual.main.width, visual.main.height + 1);
  context.lineCap = "round";
  context.strokeStyle = visual.colors[14];
  context.lineWidth = 10;
  for (let index = 0; index < 12; index++) {
    const angle = ((index * 100) / 1200) * Math.PI * 2 - Math.PI;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + Math.sin(angle) * 155, centerY + Math.cos(angle) * 155);
    context.stroke();
  }
  context.fillStyle = visual.colors[15];
  context.beginPath();
  context.arc(centerX, centerY, 150, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = visual.colors[4];
  context.lineWidth = 2;
  for (let index = 0; index < 12; index++) {
    const cents = params[21 + index] ?? index * 100,
      length = 100 + (Math.abs((cents % 100) - 50) / 50) * 50,
      angle = (cents / 1200) * Math.PI * 2 - Math.PI;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + Math.sin(angle) * length, centerY + Math.cos(angle) * length);
    context.stroke();
  }
  context.fillStyle = visual.colors[14];
  context.beginPath();
  context.arc(centerX, centerY, 20, 0, Math.PI * 2);
  context.fill();
}

function useTrackerFont(visual: Pick<TrackerVisual, "assetBase" | "font">) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof FontFace === "undefined") {
      setReady(true);
      return;
    }
    const face = new FontFace(
      visual.font.family,
      `url(${JSON.stringify(`${visual.assetBase}${visual.font.file}`)})`,
    );
    void face.load().then((loaded) => {
      document.fonts.add(loaded);
      setReady(true);
    });
  }, [visual.assetBase, visual.font]);
  return ready;
}

export function RackBisetTracker({
  visual,
  values,
  params,
  scaleX,
  onAction,
}: {
  visual: TrackerVisual;
  values?: number[];
  params: readonly number[];
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const mainCanvas = useRef<HTMLCanvasElement>(null),
    sideCanvas = useRef<HTMLCanvasElement>(null),
    infoCanvas = useRef<HTMLCanvasElement>(null),
    dragging = useRef(false),
    fontReady = useTrackerFont(visual),
    state = useMemo(() => parseBisetTrackerState(values), [values]);

  useEffect(() => {
    if (!fontReady || !state) return;
    const canvas = mainCanvas.current,
      side = sideCanvas.current,
      info = infoCanvas.current;
    if (!canvas || !side || !info) return;
    const context = prepareCanvas(canvas, visual.main.width, visual.main.height, scaleX),
      sideContext = prepareCanvas(side, visual.side.width, visual.side.height, scaleX),
      infoContext = prepareCanvas(info, visual.info.width, visual.info.height, scaleX);
    if (!context || !sideContext || !infoContext) return;
    if (state.mode === 0) drawPattern(context, visual, state);
    else if (state.mode === 1) drawTimeline(context, visual, state);
    else if (state.mode === 3) drawTuning(context, visual, params);
    else {
      context.fillStyle = visual.colors[0];
      context.fillRect(0, 0, visual.main.width, visual.main.height);
    }
    sideContext.fillStyle = visual.colors[0];
    sideContext.fillRect(0, 0, visual.side.width, visual.side.height + 1);
    sideContext.font = `9px ${JSON.stringify(visual.font.family)}`;
    const list =
      state.mode === 0
        ? state.synths.slice(integer(values?.[26]))
        : state.patterns.slice(integer(values?.[27]));
    for (let row = 0; row < Math.min(13, list.length + 1); row++) {
      const item = list[row],
        y = visual.charHeight * 3 * row + 6,
        height = visual.charHeight * 3 - 4;
      sideContext.fillStyle = item
        ? item.index === (state.mode === 0 ? state.synthId : state.patternId)
          ? visual.colors[13]
          : visual.colors[14]
        : visual.colors[2];
      sideContext.beginPath();
      sideContext.roundRect(0, y, visual.side.width - (item ? 10 : 0), height, 5);
      sideContext.fill();
      if (item) {
        sideContext.fillStyle = visual.userColors[item.color] ?? visual.userColors[0];
        sideContext.beginPath();
        sideContext.roundRect(visual.side.width - 15, y, 15, height, 5);
        sideContext.fill();
        sideContext.fillRect(visual.side.width - 15, y, 5, height);
        sideContext.fillStyle = visual.colors[12];
        sideContext.fillText(item.name, 3, y + 12);
      } else {
        sideContext.fillStyle = visual.colors[0];
        sideContext.fillText("+", visual.side.width / 2 - visual.charWidth / 2, y + 15);
      }
    }
    infoContext.fillStyle = visual.colors[0];
    infoContext.fillRect(0, 0, visual.info.width, visual.info.height + 1);
    infoContext.font = `9px ${JSON.stringify(visual.font.family)}`;
    infoContext.fillStyle = visual.colors[3];
    const labels = ["Pitch", "Octave", "Velocity", "Panning", "Synth", "Delay", "Glide"];
    infoContext.fillText(
      state.mode === 0
        ? (labels[state.patternCell] ?? "Effect")
        : state.mode === 1
          ? `Beat ${pad(Math.floor(state.beat) + 1, 4)}`
          : "Tuning",
      2,
      11,
    );
    infoContext.fillStyle = visual.colors[4];
    if (state.mode === 0)
      infoContext.fillText(`Oct ${state.octave}  Jump ${state.jump}`, 2, 11 + visual.charHeight);
  }, [fontReady, params, scaleX, state, values, visual]);

  const timelinePosition = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect(),
      x = ((event.clientX - rect.left) / rect.width) * visual.main.width,
      y = ((event.clientY - rect.top) / rect.height) * visual.main.height,
      row = Math.floor((y - 3) / (visual.charHeight * 3)) + (state?.timelineCameraY ?? 0) - 1,
      beat = Math.floor((x - 2) / visual.charWidth - 2) + (state?.timelineCameraX ?? 0);
    return { row, beat };
  };
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!state || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    if (state.mode === 0) {
      const rect = event.currentTarget.getBoundingClientRect(),
        x = ((event.clientX - rect.left) / rect.width) * visual.main.width,
        y = ((event.clientY - rect.top) / rect.height) * visual.main.height,
        line = Math.floor((y - 3) / visual.charHeight) + state.patternCameraY,
        { column, cell } = sourceCellAt(state, x);
      onAction(100000 + line * 2048 + column * 32 + cell, true);
    } else if (state.mode === 1) {
      const { row, beat } = timelinePosition(event);
      if (row >= 0 && beat >= 0) {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        onAction(500000 + row * 8192 + beat, true);
      }
    }
  };
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current || !state || state.mode !== 1) return;
    const { row, beat } = timelinePosition(event);
    if (row >= 0 && beat >= 0) onAction(800000 + row * 8192 + beat, true);
  };
  const keyCode = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === "ArrowLeft") return 256;
    if (event.key === "ArrowRight") return 257;
    if (event.key === "ArrowUp") return 258;
    if (event.key === "ArrowDown") return 259;
    if (event.key === "Insert") return 260;
    if (event.key === "Delete") return 261;
    if (event.key === "Backspace") return 8;
    if (event.key === " ") return 32;
    return event.key.length === 1 ? event.key.toUpperCase().charCodeAt(0) : -1;
  };
  const key = (event: KeyboardEvent<HTMLCanvasElement>, active: boolean) => {
    event.stopPropagation();
    if (event.key === "Shift") {
      event.preventDefault();
      onAction(300300, active);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const code = keyCode(event);
    if (code < 0) return;
    event.preventDefault();
    onAction(300000 + code, active);
  };
  const sideWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    if (!state || !event.deltaY) return;
    event.preventDefault();
    event.stopPropagation();
    const base = state.mode === 0 ? 40000 : 40002;
    onAction(base + (event.deltaY > 0 ? 1 : 0), true);
  };
  const sideClick = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!state || event.button !== 0 || (state.mode !== 0 && state.mode !== 1)) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect(),
      y = ((event.clientY - rect.top) / rect.height) * visual.side.height,
      row = Math.floor((y - 6) / (visual.charHeight * 3));
    if (row < 0) return;
    if (state.mode === 0) {
      const camera = integer(values?.[26]),
        index = camera + row;
      const action =
        index < state.synthCount ? 10000 + index : index === state.synthCount ? 10100 : -1;
      if (action >= 0) onAction(action, true);
    } else {
      const index = integer(values?.[27]) + row;
      const action =
        index < state.patternCount ? 20000 + index : index === state.patternCount ? 21000 : -1;
      if (action >= 0) onAction(action, true);
      if (event.detail === 2 && index < state.patternCount) onAction(34000 + index, true);
    }
  };

  const canvasStyle = (
    box: TrackerVisual["main"] | TrackerVisual["side"] | TrackerVisual["info"],
  ) => ({
    position: "absolute" as const,
    left: box.x * scaleX,
    top: box.y,
    width: box.width * scaleX,
    height: box.height,
    pointerEvents: "auto" as const,
  });
  return (
    <>
      <canvas
        ref={mainCanvas}
        className="pw-rack-biset-tracker-main"
        aria-label="Biset Tracker editor"
        tabIndex={0}
        style={canvasStyle(visual.main)}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={(event) => {
          dragging.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onKeyDown={(event) => key(event, true)}
        onKeyUp={(event) => key(event, false)}
      />
      <canvas
        ref={sideCanvas}
        className="pw-rack-biset-tracker-side"
        aria-label="Biset Tracker source list"
        style={canvasStyle(visual.side)}
        onPointerDown={sideClick}
        onWheel={sideWheel}
      />
      <canvas
        ref={infoCanvas}
        className="pw-rack-biset-tracker-info"
        aria-label="Biset Tracker editor status"
        style={{ ...canvasStyle(visual.info), pointerEvents: "none" }}
      />
    </>
  );
}

export function RackBisetTrackerOutput({
  visual,
  values,
  paramValue,
  scaleX,
  onParam,
}: {
  visual: TrackerOutputVisual;
  values?: number[];
  paramValue: number;
  scaleX: number;
  onParam: (value: number) => void;
}) {
  const state = useMemo(() => parseBisetTrackerState(values), [values]),
    [open, setOpen] = useState(false),
    fontReady = useTrackerFont(visual),
    selected = Math.max(0, integer(paramValue));
  return (
    <div
      className="pw-rack-biset-tracker-output"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        zIndex: 12,
      }}
    >
      <button
        type="button"
        aria-label={`Select Tracker ${visual.variant} source`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          height: "100%",
          border: 0,
          padding: 0,
          color: visual.colors.text,
          background:
            selected === state?.synthId ? visual.colors.selected : visual.colors.background,
          fontFamily: fontReady ? visual.font.family : "monospace",
          fontSize: 21,
          lineHeight: `${visual.height}px`,
          cursor: "pointer",
        }}
      >
        {pad(selected, 2)}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            left: 0,
            top: "100%",
            minWidth: 180,
            maxHeight: 240,
            overflowY: "auto",
            padding: 4,
            borderRadius: 5,
            background: visual.colors.background,
            boxShadow: "0 6px 20px #0009",
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {(state?.synths ?? []).map((synth) => (
            <button
              key={synth.index}
              type="button"
              role="menuitemradio"
              aria-checked={selected === synth.index}
              onClick={() => {
                onParam(synth.index);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                border: 0,
                padding: "4px 7px",
                textAlign: "left",
                color: visual.colors.text,
                background: selected === synth.index ? visual.colors.selected : "transparent",
                fontFamily: fontReady ? visual.font.family : "monospace",
              }}
            >
              {synth.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RackBisetTrackerState({
  visual,
  values,
  scaleX,
}: {
  visual: TrackerStateVisual;
  values?: number[];
  scaleX: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    scales = useRef(new Map<string, number>()),
    state = useMemo(() => parseBisetTrackerState(values), [values]);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const element = canvas.current;
      if (!element) return;
      const context = prepareCanvas(element, visual.width, visual.height, scaleX);
      if (!context) return;
      context.fillStyle = visual.background;
      context.fillRect(0, 0, visual.width, visual.height);
      for (const voice of state?.voices ?? []) {
        const key = `${voice.synth}:${voice.channel}`,
          current = scales.current.get(key) ?? 0,
          next =
            voice.mode === 0
              ? current * 0.99 + voice.gate * 0.01
              : voice.gate > current
                ? voice.gate
                : current * 0.99 + voice.gate * 0.01;
        scales.current.set(key, next);
        const opacityScale = next * 0.1;
        if (opacityScale <= 0.1) continue;
        const x = visual.width / 2 + (voice.panning / 5) * (visual.width / 2 - 5),
          y = visual.height / 2 - (voice.pitch / 5) * (visual.height / 2 - 5),
          radius = (2 + (voice.velocity / 10) * 3) * opacityScale;
        context.fillStyle = visual.userColors[voice.color] ?? visual.userColors[0];
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [scaleX, state, visual]);
  return (
    <canvas
      ref={canvas}
      className="pw-rack-biset-tracker-state"
      aria-label="Biset Tracker voice state"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        pointerEvents: "none",
      }}
    />
  );
}
