import assert from "node:assert/strict";
import test from "node:test";
import {
  createRackViewportTransformWriter,
  rackModuleIntersectsViewport,
  rackViewportTransform,
} from "../lib/rack-viewport-transform.ts";

test("Rack viewport transforms stay on a GPU-friendly 3D translation", () => {
  assert.equal(
    rackViewportTransform({ pan: { x: 12.5, y: -8 }, zoom: 0.75 }),
    "translate3d(12.5px,-8px,0) scale(0.75)",
  );
});

test("high-frequency viewport previews coalesce into one write per frame", () => {
  const writes: string[] = [];
  const cancelled: number[] = [];
  const scheduled: Array<() => void> = [];
  let requests = 0;
  const writer = createRackViewportTransformWriter((transform) => writes.push(transform), {
    request(callback) {
      requests += 1;
      scheduled.push(callback);
      return requests;
    },
    cancel(frame) {
      cancelled.push(frame);
    },
  });

  writer.preview({ pan: { x: 10, y: 20 }, zoom: 1 });
  writer.preview({ pan: { x: 30, y: 40 }, zoom: 0.9 });
  writer.preview({ pan: { x: 50, y: 60 }, zoom: 0.8 });

  assert.equal(requests, 1);
  assert.deepEqual(writes, []);
  scheduled.shift()?.();
  assert.deepEqual(writes, ["translate3d(50px,60px,0) scale(0.8)"]);

  writer.preview({ pan: { x: 70, y: 80 }, zoom: 0.7 });
  writer.flush();
  assert.deepEqual(cancelled, [2]);
  assert.equal(writes.at(-1), "translate3d(70px,80px,0) scale(0.7)");

  writer.preview({ pan: { x: 90, y: 100 }, zoom: 0.6 });
  writer.cancel();
  assert.deepEqual(cancelled, [2, 3]);
});

test("large racks keep only the viewport and an overscan margin mounted", () => {
  const viewport = { pan: { x: -1_000, y: -380 }, zoom: 1 };
  const size = { width: 1_000, height: 760 };
  assert.equal(
    rackModuleIntersectsViewport({ x: 1_200, y: 380, width: 120 }, viewport, size),
    true,
  );
  assert.equal(
    rackModuleIntersectsViewport({ x: 3_000, y: 380, width: 120 }, viewport, size),
    false,
  );
  assert.equal(
    rackModuleIntersectsViewport({ x: 9_000, y: 9_000, width: 120 }, viewport, {
      width: 0,
      height: 0,
    }),
    true,
  );
});
