export type RackViewport = {
  pan: { x: number; y: number };
  zoom: number;
};

export const RACK_VIEWPORT_OVERVIEW_ZOOM = 0.2;

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
