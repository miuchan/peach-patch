import type { ModuleInstance } from "./patch-types";

export type RackViewport = {
  pan: { x: number; y: number };
  zoom: number;
};

export const RACK_VIEWPORT_OVERVIEW_ZOOM = 0.2;

export function rackModuleIntersectsViewport(
  module: Pick<ModuleInstance, "x" | "y" | "width">,
  viewport: RackViewport,
  size: { width: number; height: number },
  overscanPixels = 480,
) {
  if (size.width <= 0 || size.height <= 0 || viewport.zoom <= 0) return true;
  const left = (-viewport.pan.x - overscanPixels) / viewport.zoom,
    top = (-viewport.pan.y - overscanPixels) / viewport.zoom,
    right = (size.width - viewport.pan.x + overscanPixels) / viewport.zoom,
    bottom = (size.height - viewport.pan.y + overscanPixels) / viewport.zoom;
  return (
    module.x + module.width >= left &&
    module.x <= right &&
    module.y + 380 >= top &&
    module.y <= bottom
  );
}

export function rackViewportTransform({ pan, zoom }: RackViewport) {
  return `translate3d(${pan.x}px,${pan.y}px,0) scale(${zoom})`;
}

type FrameScheduler = {
  request: (callback: () => void) => number;
  cancel: (frame: number) => void;
};

const browserFrameScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (frame) => cancelAnimationFrame(frame),
};

/**
 * Coalesces high-frequency viewport previews into one compositor write per
 * animation frame. React state can then be committed once when the gesture
 * finishes instead of reconciling the complete rack on every pointer event.
 */
export function createRackViewportTransformWriter(
  write: (transform: string) => void,
  scheduler: FrameScheduler = browserFrameScheduler,
) {
  let frame: number | null = null;
  let pending: RackViewport | null = null;

  const writePending = () => {
    frame = null;
    const viewport = pending;
    pending = null;
    if (viewport) write(rackViewportTransform(viewport));
  };

  return {
    preview(viewport: RackViewport) {
      pending = viewport;
      if (frame === null) frame = scheduler.request(writePending);
    },
    flush() {
      if (frame !== null) scheduler.cancel(frame);
      writePending();
    },
    cancel() {
      if (frame !== null) scheduler.cancel(frame);
      frame = null;
      pending = null;
    },
  };
}
