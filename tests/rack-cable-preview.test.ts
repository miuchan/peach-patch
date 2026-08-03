import assert from "node:assert/strict";
import test from "node:test";
import { createRackCablePreviewWriter } from "../lib/rack-cable-preview.ts";
import { layoutRackCablePreview } from "../lib/rack-cable-layout.ts";

test("cable preview geometry moves only the requested endpoint", () => {
  const input = layoutRackCablePreview(
    { movingSide: "input", anchor: { x: 10, y: 20 } },
    { x: 300, y: 240 },
    0.5,
  );
  assert.deepEqual([input.x1, input.y1, input.x2, input.y2], [10, 20, 300, 240]);

  const output = layoutRackCablePreview(
    { movingSide: "output", anchor: { x: 300, y: 240 } },
    { x: 10, y: 20 },
    0.5,
  );
  assert.deepEqual([output.x1, output.y1, output.x2, output.y2], [10, 20, 300, 240]);
});

test("cable preview writer coalesces pointer events and writes only the latest frame", () => {
  const frames = new Map<number, () => void>();
  let nextFrame = 1;
  const writes: string[] = [];
  const writer = createRackCablePreviewWriter((preview) => writes.push(preview.geometry.d), {
    request(callback) {
      const frame = nextFrame++;
      frames.set(frame, callback);
      return frame;
    },
    cancel(frame) {
      frames.delete(frame);
    },
  });
  const first = layoutRackCablePreview(
    { movingSide: "input", anchor: { x: 0, y: 0 } },
    { x: 20, y: 30 },
    0.5,
  );
  const latest = layoutRackCablePreview(
    { movingSide: "input", anchor: { x: 0, y: 0 } },
    { x: 40, y: 60 },
    0.5,
  );

  const frame = (geometry: typeof first) => ({
    geometry,
    viewport: { pan: { x: 0, y: 0 }, zoom: 1 },
    color: "#fff",
  });
  writer.preview(frame(first));
  writer.preview(frame(latest));
  assert.equal(frames.size, 1);
  const [scheduledFrame, scheduledCallback] = frames.entries().next().value ?? [];
  if (scheduledFrame !== undefined) frames.delete(scheduledFrame);
  scheduledCallback?.();
  assert.deepEqual(writes, [latest.d]);

  writer.preview(frame(first));
  writer.flush();
  assert.deepEqual(writes, [latest.d, first.d]);
  assert.equal(frames.size, 0);
  writer.flush();
  writer.preview(frame(latest));
  writer.cancel();
  assert.equal(frames.size, 0);
});
