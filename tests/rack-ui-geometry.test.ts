import assert from "node:assert/strict";
import test from "node:test";
import { rackUiGeometryIsTrustworthy } from "../lib/rack-ui-geometry.ts";
import type { ParamSpec, PortSpec } from "../lib/web-plugin-registry.ts";

const param = (id: number, x: number, y: number): ParamSpec => ({
  id,
  name: `Param ${id}`,
  min: 0,
  max: 1,
  default: 0,
  position: { x, y, centered: true },
});
const port = (id: number, x: number, y: number): PortSpec => ({
  id,
  name: `Port ${id}`,
  kind: "cv",
  position: { x, y, centered: true },
});

test("source UI geometry accepts distinct Rack control centers", () => {
  assert.equal(
    rackUiGeometryIsTrustworthy(
      [param(0, 60, 95), param(1, 60, 140)],
      [port(0, 20, 95), port(1, 20, 140)],
      [port(0, 32, 253)],
    ),
    true,
  );
});

test("source UI geometry rejects missing, collapsed, and out-of-panel coordinates", () => {
  assert.equal(rackUiGeometryIsTrustworthy([], [], []), false);
  assert.equal(rackUiGeometryIsTrustworthy([param(0, 22, 33), param(1, 22, 33)], [], []), false);
  assert.equal(rackUiGeometryIsTrustworthy([param(0, 40, -1)], [], []), false);
});
