import assert from "node:assert/strict";
import test from "node:test";
import {
  cablePortSnapRadius,
  closestCablePort,
  type RackCablePortCandidate,
} from "../lib/rack-cable-targeting.ts";

const ports: RackCablePortCandidate[] = [
  { moduleId: "osc", direction: "out", portId: 0, clientX: 20, clientY: 20 },
  { moduleId: "filter", direction: "in", portId: 0, clientX: 80, clientY: 30 },
  { moduleId: "filter", direction: "in", portId: 1, clientX: 80, clientY: 70 },
  { moduleId: "filter", direction: "out", portId: 0, clientX: 100, clientY: 30 },
  { moduleId: "mixer", direction: "in", portId: 0, clientX: 120, clientY: 30 },
];

test("cable targeting chooses the nearest compatible port inside the magnetic radius", () => {
  assert.deepEqual(closestCablePort(ports, { clientX: 78, clientY: 55 }, 32, ports[0]), ports[2]);
  assert.equal(closestCablePort(ports, { clientX: 140, clientY: 100 }, 32, ports[0]), null);
});

test("cable targeting excludes the anchor module and same-direction ports", () => {
  const anchor = { moduleId: "filter", direction: "out" as const, portId: 9 };
  assert.equal(closestCablePort(ports, { clientX: 20, clientY: 20 }, 20, anchor), null);
  assert.equal(closestCablePort(ports, { clientX: 82, clientY: 29 }, 20, anchor), null);
  assert.deepEqual(closestCablePort(ports, { clientX: 119, clientY: 29 }, 20, anchor), ports[4]);
});

test("touch and pen get larger physical acquisition radii than a mouse", () => {
  assert.equal(cablePortSnapRadius("mouse", "start"), 22);
  assert.equal(cablePortSnapRadius("touch", "start"), 34);
  assert.equal(cablePortSnapRadius("mouse", "drop"), 32);
  assert.equal(cablePortSnapRadius("pen", "drop"), 40);
  assert.equal(cablePortSnapRadius("touch", "drop"), 48);
});
