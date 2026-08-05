import assert from "node:assert/strict";
import test from "node:test";
import {
  createRackViewportFrameWriter,
  rackCableIntersectsViewport,
  rackModuleIntersectsViewport,
  rackViewportPresentation,
} from "../lib/rack-viewport-transform.ts";

test("Rack viewport presentation keeps every shared layer viewport-sized", () => {
  const presentation = rackViewportPresentation(
    { pan: { x: 12.5, y: -8 }, zoom: 0.75 },
    { width: 390, height: 760 },
  );
  assert.deepEqual(
    {
      panX: presentation.panX,
      panY: presentation.panY,
      zoom: presentation.zoom,
      railWidth: presentation.railWidth,
      railHeight: presentation.railHeight,
    },
    {
      panX: "12.5px",
      panY: "-8px",
      zoom: "0.75",
      railWidth: "228px",
      railHeight: "285px",
    },
  );
  assert.deepEqual(presentation.cableViewBox.split(" ").map(Number), [
    -12.5 / 0.75,
    8 / 0.75,
    390 / 0.75,
    760 / 0.75,
  ]);
});

test("high-frequency viewport previews coalesce into one write per frame", () => {
  const writes: Array<{ pan: { x: number; y: number }; zoom: number }> = [];
  const cancelled: number[] = [];
  const scheduled: Array<() => void> = [];
  let requests = 0;
  const writer = createRackViewportFrameWriter((viewport) => writes.push(viewport), {
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
  assert.deepEqual(writes, [{ pan: { x: 50, y: 60 }, zoom: 0.8 }]);

  writer.preview({ pan: { x: 70, y: 80 }, zoom: 0.7 });
  writer.flush();
  assert.deepEqual(cancelled, [2]);
  assert.deepEqual(writes.at(-1), { pan: { x: 70, y: 80 }, zoom: 0.7 });

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

test("large racks keep only cables whose complete curve can reach the viewport", () => {
  const viewport = { pan: { x: -1_000, y: -380 }, zoom: 1 };
  const size = { width: 1_000, height: 760 };
  const visibleCable = {
    x1: 200,
    y1: 200,
    x2: 2_400,
    y2: 400,
    curveStartX: 220,
    curveStartY: 220,
    curveControlX: 1_200,
    curveControlY: 500,
    curveEndX: 2_380,
    curveEndY: 400,
  };
  const distantCable = {
    ...visibleCable,
    x1: 3_000,
    x2: 4_000,
    curveStartX: 3_020,
    curveControlX: 3_500,
    curveEndX: 3_980,
  };
  assert.equal(rackCableIntersectsViewport(visibleCable, viewport, size), true);
  assert.equal(rackCableIntersectsViewport(distantCable, viewport, size), false);
  assert.equal(rackCableIntersectsViewport(distantCable, viewport, { width: 0, height: 0 }), true);
});
