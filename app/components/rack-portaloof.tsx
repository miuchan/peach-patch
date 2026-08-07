import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { SampleAssetRef } from "../../lib/patch-types";
import { imageBlob } from "./rack-computerscare-blank";

function cloneRackSnapshot(rack: HTMLElement) {
  const clone = rack.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-portaloof]").forEach((element) => element.remove());
  const originalCanvases = rack.querySelectorAll("canvas");
  const clonedCanvases = clone.querySelectorAll("canvas");
  originalCanvases.forEach((canvas, index) => {
    const target = clonedCanvases[index];
    if (!target) return;
    try {
      const image = document.createElement("img");
      image.src = canvas.toDataURL();
      image.className = target.className;
      image.setAttribute("style", target.getAttribute("style") ?? "");
      target.replaceWith(image);
    } catch {
      target.remove();
    }
  });
  const originalInputs = rack.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
  const clonedInputs = clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
  originalInputs.forEach((input, index) => {
    if (clonedInputs[index]) clonedInputs[index].value = input.value;
  });
  clone.removeAttribute("aria-label");
  clone.setAttribute("aria-hidden", "true");
  clone.style.pointerEvents = "none";
  return clone;
}

function wedgePolygon(index: number, count: number) {
  if (count <= 1) return "none";
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  const next = ((index + 1) / count) * Math.PI * 2 - Math.PI / 2;
  const point = (value: number) => `${50 + Math.cos(value) * 80}% ${50 + Math.sin(value) * 80}%`;
  return `polygon(50% 50%, ${point(angle)}, ${point(next)})`;
}

type SourceEffects = {
  enabled: boolean[];
  values: number[];
};

function installSource(
  host: HTMLDivElement,
  factory: () => HTMLElement | undefined,
  effects: SourceEffects,
  alpha: number,
) {
  const value = (row: number, fallback: number) =>
    effects.enabled[row] ? effects.values[row] : fallback;
  const uniform = value(0, 1);
  const scaleX = uniform * value(1, 1);
  const scaleY = uniform * value(2, 1);
  const rotation = value(3, 0);
  const kaleido = Math.round(value(4, 0));
  const translateX = value(5, 0) * 100;
  const translateY = value(6, 0) * 100;
  const hue = value(7, 0);
  const fold = value(8, 0);
  const warp = value(9, 0);
  const segments = Math.max(1, Math.abs(kaleido));
  const fragment = document.createDocumentFragment();
  for (let segment = 0; segment < segments; segment += 1) {
    const content = factory();
    if (!content) continue;
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none";
    wrapper.style.clipPath = wedgePolygon(segment, segments);
    const segmentRotation = segments > 1 ? (segment * 360) / segments : 0;
    const reflection = kaleido < 0 && segment % 2 ? -1 : 1;
    content.style.position = "absolute";
    content.style.inset = "0";
    content.style.transformOrigin = "50% 50%";
    content.style.transform = `translate(${translateX}%, ${translateY}%) rotate(${rotation + segmentRotation}deg) scale(${scaleX * reflection}, ${scaleY})`;
    content.style.filter = `hue-rotate(${hue}deg) saturate(${Math.max(0, 1 + warp)} ) contrast(${Math.max(0.05, 1 + Math.abs(warp) + fold * 0.35)})`;
    wrapper.append(content);
    fragment.append(wrapper);
  }
  host.replaceChildren(fragment);
  host.style.opacity = String(Math.max(0, Math.min(1, alpha)));
}

/** Live browser implementation of Computerscare Portaloof's two-source visual processor. */
export function RackPortaloof({
  asset,
  values,
  params,
  data,
  x,
  y,
  width,
  height,
  scaleX,
  onLoad,
  onParam,
  onData,
}: {
  asset?: SampleAssetRef;
  values?: number[];
  params: number[];
  data: Record<string, unknown>;
  displayX: number;
  actionBase: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onLoad: () => void;
  onParam: (id: number, value: number) => void;
  onData: (data: Record<string, unknown>) => void;
}) {
  const rackHost = useRef<HTMLDivElement>(null);
  const imageHost = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState<string>();
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [secondary, setSecondary] = useState(false);

  useEffect(() => {
    let disposed = false;
    let url: string | undefined;
    if (!asset) {
      setImageUrl(undefined);
      return;
    }
    void imageBlob(asset).then((blob) => {
      if (!blob || disposed) return;
      url = URL.createObjectURL(blob);
      setImageUrl(url);
    });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset]);

  const sourceEffects = useMemo(
    () =>
      [0, 1].map((source): SourceEffects => ({
        values: Array.from({ length: 10 }, (_, row) =>
          Number(values?.[1 + source * 10 + row] ?? params[3 + row * 3] ?? 0),
        ),
        enabled: Array.from(
          { length: 10 },
          (_, row) => Number(values?.[21 + source * 10 + row] ?? params[2 + row * 3] ?? 0) > 0.5,
        ),
      })),
    [params, values],
  );

  useEffect(() => {
    const rack = rootRef.current?.closest(".pw-rack") as HTMLElement | null;
    const rackTarget = rackHost.current;
    const imageTarget = imageHost.current;
    if (!rack || !rackTarget || !imageTarget) return;
    const update = () => {
      const mix = Math.max(-1, Math.min(1, Number(values?.[0] ?? params[1] ?? -1)));
      const imageAlpha = imageUrl ? (mix + 1) / 2 : 0;
      const rackAlpha = imageUrl ? 1 - imageAlpha : 1;
      const rackRect = rack.getBoundingClientRect();
      installSource(
        rackTarget,
        () => {
          const clone = cloneRackSnapshot(rack);
          clone.style.width = `${rackRect.width}px`;
          clone.style.height = `${rackRect.height}px`;
          clone.style.transformOrigin = "0 0";
          clone.style.transform = `scale(${width / rackRect.width}, ${height / rackRect.height})`;
          return clone;
        },
        sourceEffects[0],
        rackAlpha,
      );
      installSource(
        imageTarget,
        () => {
          if (!imageUrl) return undefined;
          const image = document.createElement("img");
          image.src = imageUrl;
          image.alt = "";
          image.style.width = "100%";
          image.style.height = "100%";
          image.style.objectFit = "cover";
          return image;
        },
        sourceEffects[1],
        imageAlpha,
      );
    };
    update();
    if ((params[0] ?? 0) > 0.5) return;
    const interval = window.setInterval(update, 200);
    return () => window.clearInterval(interval);
  }, [height, imageUrl, params, sourceEffects, values, width]);

  const modSpeed = (event: { ctrlKey: boolean; shiftKey: boolean }) =>
    event.ctrlKey && event.shiftKey ? 0.01 : event.ctrlKey ? 0.1 : event.shiftKey ? 4 : 1;
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editing || event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const speed = modSpeed(event);
    const dx = ((event.clientX - drag.x) / Math.max(1, width * scaleX)) * speed;
    const dy = ((event.clientY - drag.y) / Math.max(1, height)) * speed;
    drag.x = event.clientX;
    drag.y = event.clientY;
    onParam(secondary ? 6 : 18, (params[secondary ? 6 : 18] ?? (secondary ? 1 : 0)) + dx);
    onParam(secondary ? 9 : 21, (params[secondary ? 9 : 21] ?? (secondary ? 1 : 0)) + dy);
    event.preventDefault();
    event.stopPropagation();
  };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = undefined;
    event.currentTarget.releasePointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };
  const wheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!editing) return;
    const direction = event.deltaY === 0 ? -event.deltaX : -event.deltaY;
    const speed = modSpeed(event);
    if (secondary) onParam(12, (params[12] ?? 0) + direction * speed * 0.08);
    else onParam(3, (params[3] ?? 1) * Math.pow(1.08, (direction * speed) / 24));
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={rootRef}
      data-portaloof="true"
      className="pw-module-visual pw-portaloof"
      aria-label="Portaloof live Rack visual"
      tabIndex={0}
      onPointerEnter={(event) => {
        setHovered(true);
        event.currentTarget.focus({ preventScroll: true });
      }}
      onPointerLeave={() => setHovered(false)}
      onKeyDown={(event) => {
        if (event.key === "q") {
          setEditing((active) => !active);
          event.preventDefault();
          event.stopPropagation();
        } else if (event.key === "a") {
          setSecondary((active) => !active);
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onDoubleClick={(event) => {
        if (editing) return;
        onLoad();
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onWheel={wheel}
      style={{
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        overflow: "hidden",
        background: "#232129",
        touchAction: "none",
        cursor: editing ? "crosshair" : "grab",
      }}
    >
      <div ref={rackHost} className="pw-portaloof-source" />
      <div ref={imageHost} className="pw-portaloof-source" />
      {hovered && (
        <div className={`pw-portaloof-hint ${editing ? "active" : ""}`}>
          Q EDIT&nbsp;&nbsp; A MODE{editing ? ` · ${secondary ? "SCALE/ROT" : "MOVE/SCALE"}` : ""}
        </div>
      )}
      <button
        type="button"
        className="pw-portaloof-source-button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => {
          onData({ portaloofSource: data.portaloofSource === "image" ? "rack" : "image" });
          if (!imageUrl) onLoad();
        }}
      >
        {data.portaloofSource === "image" ? "IMG2" : "RACK"}
      </button>
    </div>
  );
}
