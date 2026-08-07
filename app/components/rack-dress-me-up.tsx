import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type Part = { name: string; center: [number, number]; layer: number };
type Cloth = { type: number; id: number; parts: Part[] };
type PositionedPart = Part & {
  cloth: Cloth;
  image: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ShaderStateKeys = {
  enableShader: number;
  spotWidth: number;
  spotHeight: number;
  colorBoost: number;
  inputGamma: number;
  outputGamma: number;
  effectScale: number;
};

const BODY_SCALE = 0.08;
const BODY_SIZE: [number, number] = [1176 * BODY_SCALE, 2100 * BODY_SCALE];
const CLOTHES: Cloth[] = [
  { type: 0, id: 1, parts: [{ name: "green_hair", center: [571, 247], layer: 0.5 }] },
  {
    type: 0,
    id: 2,
    parts: [
      { name: "pink_hair", center: [611, 476], layer: 0.25 },
      { name: "pink_hair_top", center: [604, 353], layer: 0.75 },
    ],
  },
  { type: 0, id: 3, parts: [{ name: "purple_hair", center: [607, 340], layer: 0.5 }] },
  { type: 0, id: 4, parts: [{ name: "red_hair", center: [617, 230], layer: 0.5 }] },
  { type: 1, id: 1, parts: [{ name: "green_shirt", center: [567, 636], layer: 0.5 }] },
  { type: 1, id: 2, parts: [{ name: "pink_shirt", center: [578, 593], layer: 0.5 }] },
  { type: 1, id: 3, parts: [{ name: "purple_shirt", center: [576, 745], layer: 0.5 }] },
  { type: 1, id: 4, parts: [{ name: "red_shirt", center: [575, 745], layer: 0.5 }] },
  { type: 2, id: 1, parts: [{ name: "green_pants", center: [592, 1033], layer: 0.5 }] },
  { type: 2, id: 2, parts: [{ name: "pink_pants", center: [594, 1079], layer: 0.5 }] },
  { type: 2, id: 3, parts: [{ name: "purple_pants", center: [579, 1324], layer: 0.6 }] },
  { type: 2, id: 4, parts: [{ name: "red_pants", center: [543, 1433], layer: 0.45 }] },
  { type: 3, id: 1, parts: [{ name: "green_shoes", center: [539, 1775], layer: 0.5 }] },
  { type: 3, id: 2, parts: [{ name: "pink_shoes", center: [536, 1938], layer: 0.5 }] },
  { type: 3, id: 3, parts: [{ name: "purple_shoes", center: [541, 1937], layer: 0.5 }] },
  { type: 3, id: 4, parts: [{ name: "red_shoes", center: [537, 1947], layer: 0.5 }] },
];

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${url}`));
    image.src = url;
  });
}

function pointerPosition(
  event: ReactPointerEvent<HTMLCanvasElement>,
  width: number,
  height: number,
) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * width,
    y: ((event.clientY - rect.top) / rect.height) * height,
  };
}

function opaqueAt(part: PositionedPart, x: number, y: number) {
  const localX = Math.floor(((x - part.x) / part.width) * part.image.naturalWidth);
  const localY = Math.floor(((y - part.y) / part.height) * part.image.naturalHeight);
  if (
    localX < 0 ||
    localY < 0 ||
    localX >= part.image.naturalWidth ||
    localY >= part.image.naturalHeight
  )
    return false;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = part.image.naturalWidth;
    canvas.height = part.image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return true;
    context.drawImage(part.image, 0, 0);
    return context.getImageData(localX, localY, 1, 1).data[3] > 0;
  } catch {
    return true;
  }
}

function applyCrtShader(
  context: CanvasRenderingContext2D,
  pixelWidth: number,
  pixelHeight: number,
  parameters: {
    spotWidth: number;
    spotHeight: number;
    colorBoost: number;
    inputGamma: number;
    outputGamma: number;
    effectScale: number;
  },
) {
  const image = context.getImageData(0, 0, pixelWidth, pixelHeight);
  const source = new Uint8ClampedArray(image.data);
  const fixedWidth = Math.max(1, (pixelWidth / 6) * parameters.effectScale);
  const fixedHeight = Math.max(1, (pixelHeight / 6) * parameters.effectScale);
  const weight = (value: number) => {
    const limited = Math.min(value, 1);
    const shaped = 1 - limited * limited;
    return shaped * shaped;
  };
  const sample = (u: number, v: number, channel: number) => {
    const sx = Math.max(0, Math.min(pixelWidth - 1, Math.floor(u * pixelWidth)));
    const sy = Math.max(0, Math.min(pixelHeight - 1, Math.floor(v * pixelHeight)));
    return Math.pow(source[(sy * pixelWidth + sx) * 4 + channel] / 255, parameters.inputGamma);
  };
  for (let py = 0; py < pixelHeight; py += 1) {
    const v = (py + 0.5) / pixelHeight;
    const coordinatesY = v * fixedHeight;
    const centerY = Math.floor(coordinatesY) + 0.5;
    const textureY = centerY / fixedHeight;
    const deltaY = coordinatesY - centerY;
    const verticalCenter = weight(deltaY / parameters.spotHeight);
    const verticalOffset = (deltaY > 0 ? 1 : -1) / fixedHeight;
    const verticalNeighbor = weight((deltaY > 0 ? 1 - deltaY : 1 + deltaY) / parameters.spotHeight);
    for (let px = 0; px < pixelWidth; px += 1) {
      const u = (px + 0.5) / pixelWidth;
      const coordinatesX = u * fixedWidth;
      const centerX = Math.floor(coordinatesX) + 0.5;
      const textureX = centerX / fixedWidth;
      const deltaX = coordinatesX - centerX;
      const horizontalCenter = weight(deltaX / parameters.spotWidth);
      const horizontalOffset = (deltaX > 0 ? 1 : -1) / fixedWidth;
      const horizontalNeighbor = weight(
        (deltaX > 0 ? 1 - deltaX : 1 + deltaX) / parameters.spotWidth,
      );
      const edge = Math.min(u, 1 - u, v, 1 - v);
      const edgeMix = Math.max(0, Math.min(1, edge / 0.01));
      const vignette = edgeMix * edgeMix * (3 - 2 * edgeMix);
      const destination = (py * pixelWidth + px) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        let value = sample(textureX, textureY, channel) * horizontalCenter * verticalCenter;
        value +=
          sample(textureX + horizontalOffset, textureY, channel) *
          horizontalNeighbor *
          verticalCenter;
        value +=
          sample(textureX, textureY + verticalOffset, channel) *
          horizontalCenter *
          verticalNeighbor;
        value +=
          sample(textureX + horizontalOffset, textureY + verticalOffset, channel) *
          horizontalNeighbor *
          verticalNeighbor;
        value *= parameters.colorBoost;
        if (channel < 3) value *= vignette;
        image.data[destination + channel] =
          Math.max(0, Math.min(1, Math.pow(Math.max(0, value), 1 / parameters.outputGamma))) * 255;
      }
    }
  }
  context.putImageData(image, 0, 0);
}

/** Exact browser port of BGAL256 DressMeUpDisplay's layered doll and clothing drag/snap UI. */
export function RackDressMeUp({
  values,
  state,
  stateKeys,
  assetBase,
  actionBase,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  state: number[];
  stateKeys: ShaderStateKeys;
  assetBase: string;
  actionBase: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const partsRef = useRef<PositionedPart[]>([]);
  const dragRef = useRef<
    | {
        pointerId: number;
        cloth: Cloth;
        offsetX: number;
        offsetY: number;
        x: number;
        y: number;
      }
    | undefined
  >(undefined);
  const [images, setImages] = useState<Map<string, HTMLImageElement>>();
  const [dragging, setDragging] = useState(false);
  const signalIdentity = [0, 1, 2, 3].map((type) => Math.round(values?.[1 + type] ?? 0)).join(",");
  const [currentIds, setCurrentIds] = useState(() => signalIdentity.split(",").map(Number));
  useEffect(() => setCurrentIds(signalIdentity.split(",").map(Number)), [signalIdentity]);

  useEffect(() => {
    let disposed = false;
    const names = [
      "Background",
      "Body",
      ...CLOTHES.flatMap((cloth) => cloth.parts.map((part) => part.name)),
    ];
    void Promise.all(
      names.map(
        async (name) =>
          [
            name,
            await loadImage(`${assetBase}${name.includes("_") ? "clothes/" : ""}${name}.png`),
          ] as const,
      ),
    )
      .then((entries) => {
        if (!disposed) setImages(new Map(entries));
      })
      .catch(() => {
        if (!disposed) setImages(undefined);
      });
    return () => {
      disposed = true;
    };
  }, [assetBase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !images) return;
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const background = images.get("Background");
    if (background) context.drawImage(background, 0, 0, width, height);

    const bodyX = (width / 16) * 3 - BODY_SIZE[0] / 2;
    const bodyY = height / 2 - BODY_SIZE[1] / 2;
    const positioned: PositionedPart[] = [];
    for (const cloth of CLOTHES) {
      const worn = currentIds[cloth.type] === cloth.id;
      const primary = cloth.parts[0];
      const primaryImage = images.get(primary.name);
      if (!primaryImage) continue;
      const sortedX = width * (0.4 + 0.15 * (cloth.id - 1));
      const sortedY = height * (0.25 + 0.1875 * cloth.type);
      const drag = dragRef.current?.cloth === cloth ? dragRef.current : undefined;
      for (const part of cloth.parts) {
        const image = images.get(part.name);
        if (!image) continue;
        const partWidth = image.naturalWidth * BODY_SCALE;
        const partHeight = image.naturalHeight * BODY_SCALE;
        let partX: number;
        let partY: number;
        if (drag) {
          partX = drag.x + (part.center[0] - primary.center[0]) * BODY_SCALE;
          partY = drag.y + (part.center[1] - primary.center[1]) * BODY_SCALE;
        } else if (worn) {
          partX = bodyX + part.center[0] * BODY_SCALE - partWidth / 2;
          partY = bodyY + part.center[1] * BODY_SCALE - partHeight / 2;
        } else {
          partX = sortedX - partWidth / 2 + (part.center[0] - primary.center[0]) * BODY_SCALE;
          partY = sortedY - partHeight / 2 + (part.center[1] - primary.center[1]) * BODY_SCALE;
        }
        positioned.push({
          ...part,
          cloth,
          image,
          x: partX,
          y: partY,
          width: partWidth,
          height: partHeight,
        });
      }
    }
    const body = images.get("Body");
    const layers: Array<{ layer: number; draw: () => void }> = [];
    if (body)
      layers.push({
        layer: 0.4,
        draw: () => context.drawImage(body, bodyX, bodyY, BODY_SIZE[0], BODY_SIZE[1]),
      });
    for (const part of positioned)
      layers.push({
        layer: part.layer,
        draw: () => {
          const highlighted =
            Math.round(values?.[0] ?? 0) === part.cloth.type &&
            currentIds[part.cloth.type] === part.cloth.id;
          context.save();
          if (highlighted) {
            context.shadowColor = "rgba(255,255,255,.95)";
            context.shadowBlur = 7;
          }
          context.drawImage(part.image, part.x, part.y, part.width, part.height);
          context.restore();
        },
      });
    layers.sort((left, right) => left.layer - right.layer);
    for (const layer of layers) layer.draw();
    if ((state[stateKeys.enableShader] ?? 1) > 0.5) {
      context.resetTransform();
      applyCrtShader(context, canvas.width, canvas.height, {
        spotWidth: state[stateKeys.spotWidth] ?? 1.2,
        spotHeight: state[stateKeys.spotHeight] ?? 0.65,
        colorBoost: state[stateKeys.colorBoost] ?? 1.45,
        inputGamma: state[stateKeys.inputGamma] ?? 2.4,
        outputGamma: state[stateKeys.outputGamma] ?? 2.2,
        effectScale: state[stateKeys.effectScale] ?? 2.5,
      });
    }
    partsRef.current = positioned;
  }, [currentIds, height, images, state, stateKeys, values, width]);

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const point = pointerPosition(event, width, height);
    const hit = [...partsRef.current]
      .sort((left, right) => right.layer - left.layer)
      .find((part) => opaqueAt(part, point.x, point.y));
    if (!hit) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      cloth: hit.cloth,
      offsetX: point.x - hit.x,
      offsetY: point.y - hit.y,
      x: hit.x,
      y: hit.y,
    };
    setDragging(true);
    event.preventDefault();
    event.stopPropagation();
    setCurrentIds((ids) => [...ids]);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointerPosition(event, width, height);
    drag.x = Math.max(-drag.offsetX, Math.min(width - drag.offsetX, point.x - drag.offsetX));
    drag.y = Math.max(-drag.offsetY, Math.min(height - drag.offsetY, point.y - drag.offsetY));
    event.preventDefault();
    event.stopPropagation();
    setCurrentIds((ids) => [...ids]);
  };
  const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointerPosition(event, width, height);
    const bodyX = (width / 16) * 3 - BODY_SIZE[0] / 2;
    const bodyY = height / 2 - BODY_SIZE[1] / 2;
    const onBody =
      point.x >= bodyX &&
      point.x <= bodyX + BODY_SIZE[0] &&
      point.y >= bodyY &&
      point.y <= bodyY + BODY_SIZE[1];
    const nextId = onBody
      ? drag.cloth.id
      : currentIds[drag.cloth.type] === drag.cloth.id
        ? 0
        : currentIds[drag.cloth.type];
    dragRef.current = undefined;
    setDragging(false);
    if (nextId !== currentIds[drag.cloth.type]) {
      setCurrentIds((ids) => ids.map((id, type) => (type === drag.cloth.type ? nextId : id)));
      const action = actionBase + drag.cloth.type * 16 + nextId;
      onAction(action, true);
      onAction(action, false);
    } else setCurrentIds((ids) => [...ids]);
    event.currentTarget.releasePointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <canvas
      ref={canvasRef}
      className="pw-module-visual pw-dress-me-up"
      aria-label="DressMeUp clothing editor"
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      style={{
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        cursor: dragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
    />
  );
}
