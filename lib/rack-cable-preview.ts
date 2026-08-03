import type { RackCableGeometry } from "./rack-cable-layout";
import type { RackViewport } from "./rack-viewport-transform";

export type RackCablePreviewFrame = {
  geometry: RackCableGeometry;
  viewport: RackViewport;
  color: string;
};

type FrameScheduler = {
  request: (callback: () => void) => number;
  cancel: (frame: number) => void;
};

const browserFrameScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (frame) => cancelAnimationFrame(frame),
};

/** Coalesces pointer events so a cable performs at most one preview draw per frame. */
export function createRackCablePreviewWriter(
  write: (preview: RackCablePreviewFrame) => void,
  scheduler: FrameScheduler = browserFrameScheduler,
) {
  let frame: number | null = null;
  let pending: RackCablePreviewFrame | null = null;

  const writePending = () => {
    frame = null;
    const preview = pending;
    pending = null;
    if (preview) write(preview);
  };

  return {
    preview(preview: RackCablePreviewFrame) {
      pending = preview;
      if (frame === null) frame = scheduler.request(writePending);
    },
    flush() {
      if (!pending) return;
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
