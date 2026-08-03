import assert from "node:assert/strict";
import test from "node:test";
import { rackRuntimePorts } from "../lib/rack-runtime-ports.ts";

test("browser audio boundaries expose only routable stereo device inputs", () => {
  const ports = rackRuntimePorts({
    inputs: Array.from({ length: 8 }, (_, id) => ({
      id,
      name: `TO DEVICE ${id + 1}`,
      kind: "audio" as const,
    })),
    outputs: Array.from({ length: 8 }, (_, id) => ({
      id,
      name: `FROM DEVICE ${id + 1}`,
      kind: "audio" as const,
    })),
    runtime: { strategy: "rack-boundary", audio: { channels: 8 } },
  });

  assert.deepEqual(
    ports.inputs.map((port) => port.id),
    [0, 1],
  );
  assert.deepEqual(ports.outputs, []);
});

test("ordinary Rack modules preserve every visible input and output", () => {
  const ports = rackRuntimePorts({
    inputs: [
      { id: 0, name: "Pitch", kind: "cv" },
      { id: 1, name: "Hidden", kind: "cv", hidden: true },
    ],
    outputs: [{ id: 0, name: "Sine", kind: "audio" }],
  });

  assert.deepEqual(
    ports.inputs.map((port) => port.id),
    [0],
  );
  assert.deepEqual(
    ports.outputs.map((port) => port.id),
    [0],
  );
});
