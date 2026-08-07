import { useEffect, useRef } from "react";

export type CatroColorLayer = {
  shape: "rect" | "circle" | "meter";
  signal: number;
  active: number;
  mode: number;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
  yStart?: number;
  ySize?: number;
};

type ColorState = {
  average: number;
  high: boolean;
  clock: number;
  frequency: number;
  lastFrequency: number;
};

const initialState = (): ColorState => ({
  average: 0,
  high: false,
  clock: 0,
  frequency: 0,
  lastFrequency: 0,
});

function smoothed(state: ColorState, decay: number, signal: number) {
  const amount = Math.max(0, Math.min(1, decay));
  state.average = Math.max(0, Math.min(1, state.average * amount + signal * (1 - amount)));
  return state.average;
}

function zeroCrossingFrequency(state: ColorState, signal: number) {
  if (state.clock < 44) state.clock += 1;
  const high = signal > 0.0001;
  if (state.high !== high) {
    state.frequency = (1 - state.clock / 44) ** 2;
    state.lastFrequency = state.lastFrequency * 0.8 + state.frequency * 0.2;
    state.clock = 0;
  }
  state.high = high;
  return state.lastFrequency * 0.7 + state.frequency * 0.3;
}

function hsl(hue: number, saturation: number, lightness: number, alpha: number) {
  const wrappedHue = ((hue % 1) + 1) % 1;
  return `hsla(${wrappedHue * 360} ${saturation * 100}% ${lightness * 100}% / ${alpha / 255})`;
}

function colorFor(state: ColorState, signal: number, mode: number, alpha: number) {
  if (mode === 0) return hsl(0, 0, zeroCrossingFrequency(state, signal), alpha);
  if (mode === 1)
    return hsl(0.5, 0.9, Math.min(smoothed(state, 0.93, Math.abs(signal) * 0.2), 0.7), alpha);
  if (mode === 2) {
    const hue = smoothed(state, 0.9, Math.abs(signal) * 0.1 + 0.2);
    return hsl(hue, 1, state.average * 0.4 + 0.3, alpha);
  }
  if (mode === 3) {
    // Preserve the original C++ expression's operator precedence: its ternary
    // resolves to frequency - 1 for every finite frequency produced here.
    const hue = zeroCrossingFrequency(state, signal) - 1;
    return hsl(hue, 1, Math.min(smoothed(state, 0.9, Math.abs(signal) * 0.2), 0.5), alpha);
  }
  if (mode === 4) return hsl(smoothed(state, 0.4, signal * 0.1), 1, 0.45, alpha);
  return hsl(0.7, 0.8, 0.3, alpha);
}

export function RackCatroColorDisplay({
  values,
  layers,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  layers: CatroColorLayer[];
  width: number;
  height: number;
  scaleX: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statesRef = useRef<ColorState[]>([]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, width, height);
    while (statesRef.current.length < layers.length) statesRef.current.push(initialState());
    layers.forEach((layer, index) => {
      if (!(values?.[layer.active] ?? 0)) return;
      const signal = values?.[layer.signal] ?? 0;
      const mode = Math.round(values?.[layer.mode] ?? 0);
      context.fillStyle = colorFor(statesRef.current[index], signal, mode, layer.alpha);
      context.beginPath();
      if (layer.shape === "circle") {
        context.arc(layer.x, layer.y, layer.width, 0, Math.PI * 2);
      } else {
        const y = layer.shape === "meter" ? (values?.[layer.yStart ?? -1] ?? layer.y) : layer.y;
        const layerHeight =
          layer.shape === "meter" ? (values?.[layer.ySize ?? -1] ?? layer.height) : layer.height;
        context.rect(layer.x, y, layer.width, layerHeight);
      }
      context.fill();
    });
  }, [height, layers, values, width]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: width * scaleX,
        height,
        pointerEvents: "none",
      }}
    />
  );
}
