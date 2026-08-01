import type { WebPluginModule } from "./web-plugin-registry.ts";
import { isFiniteNumber, isRecord, parseJson } from "./runtime-type-guards.ts";

export const DEFAULT_PEACH_REGISTRY_URL =
  "https://raw.githubusercontent.com/miuchan/peach-patch-registry/main/index.json";

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isModulePackage(value: unknown): value is WebPluginModule & {
  artifact: { sha256: string; size: number };
} {
  if (!isRecord(value) || typeof value.key !== "string" || typeof value.plugin !== "string" ||
    typeof value.model !== "string" || typeof value.name !== "string" || typeof value.brand !== "string" ||
    typeof value.version !== "string" || typeof value.license !== "string" || typeof value.sourceUrl !== "string" ||
    typeof value.libraryUrl !== "string" || typeof value.screenshotUrl !== "string" || typeof value.wasmUrl !== "string" ||
    !isFiniteNumber(value.width) || typeof value.description !== "string" || !Array.isArray(value.params) ||
    !Array.isArray(value.inputs) || !Array.isArray(value.outputs) || !isFiniteNumber(value.lights) ||
    !isRecord(value.artifact) || !isSha256(value.artifact.sha256) ||
    !isFiniteNumber(value.artifact.size) || !Number.isSafeInteger(value.artifact.size) ||
    value.artifact.size <= 0) return false;
  return value.params.every((param) => isRecord(param) && Number.isSafeInteger(param.id) &&
    typeof param.name === "string" && isFiniteNumber(param.min) && isFiniteNumber(param.max) &&
    isFiniteNumber(param.default)) && value.inputs.every(isPortSpec) && value.outputs.every(isPortSpec);
}

function isPortSpec(value: unknown): boolean {
  return isRecord(value) && Number.isSafeInteger(value.id) && typeof value.name === "string" &&
    (value.kind === "cv" || value.kind === "gate" || value.kind === "audio");
}

function geometryWidth(module: WebPluginModule): number {
  const positions = [
    ...module.params.map((param) => ({ position: param.position, size: 30 })),
    ...module.inputs.map((port) => ({ position: port.position, size: 16 })),
    ...module.outputs.map((port) => ({ position: port.position, size: 16 })),
  ];
  const rightEdge = positions.reduce((maximum, item) => {
    const position = item.position;
    if (!position || !isFiniteNumber(position.x)) return maximum;
    const elementWidth = isFiniteNumber(position.width) ? position.width : item.size;
    return Math.max(maximum, position.x + (position.centered ? elementWidth / 2 : elementWidth));
  }, 15);
  return Math.ceil(rightEdge / 15) * 15;
}

function normalizePositions<T extends { position?: WebPluginModule["params"][number]["position"] }>(
  items: T[],
  size: number,
): T[] {
  const outOfBoundsY = items
    .map((item, index) => ({ index, y: item.position?.y }))
    .filter((item) => isFiniteNumber(item.y) && (item.y < 0 || item.y > 380));
  if (!items.some((item) => item.position && (item.position.x < 0 || item.position.y < 0 || item.position.y > 380)))
    return items;
  return items.map((item, index) => {
    const position = item.position;
    if (!position) return item;
    const outlierIndex = outOfBoundsY.findIndex((candidate) => candidate.index === index);
    const nextX = position.x < 0 ? (position.centered ? size / 2 : 0) : position.x;
    const nextY = position.y < 0 || position.y > 380
      ? outOfBoundsY.length === 1
        ? (position.y < 0 ? 36 : 344)
        : 36 + (outlierIndex / Math.max(1, outOfBoundsY.length - 1)) * 308
      : position.y;
    return {
      ...item,
      position: { ...position, x: nextX, y: nextY },
    };
  });
}

function normalizeModuleGeometry(module: WebPluginModule): WebPluginModule {
  const width = Math.max(module.width, geometryWidth(module));
  const params = normalizePositions(module.params, 30);
  const inputs = normalizePositions(module.inputs, 16);
  const outputs = normalizePositions(module.outputs, 16);
  return width === module.width && params === module.params && inputs === module.inputs && outputs === module.outputs
    ? module
    : { ...module, width, params, inputs, outputs };
}

export function modulesFromRegistryIndex(
  input: unknown,
  indexUrl: string,
): WebPluginModule[] {
  if (!input || typeof input !== "object")
    throw new Error("Peach Patch registry index is not an object");
  if (!isRecord(input) || input.schemaVersion !== 1 || !Array.isArray(input.packages))
    throw new Error("Unsupported Peach Patch registry schema");

  const seen = new Set<string>();
  return input.packages.map((item) => {
    if (!isModulePackage(item))
      throw new Error("Registry contains an invalid package");
    if (seen.has(item.key)) throw new Error(`Duplicate registry key ${item.key}`);
    seen.add(item.key);
    return normalizeModuleGeometry({
      ...item,
      wasmUrl: new URL(item.wasmUrl, indexUrl).href,
      ...(item.manifestUrl
        ? { manifestUrl: new URL(item.manifestUrl, indexUrl).href }
        : {}),
    });
  });
}

export async function loadPeachRegistry(
  indexUrl = DEFAULT_PEACH_REGISTRY_URL,
  signal?: AbortSignal,
): Promise<WebPluginModule[]> {
  const parsed = new URL(indexUrl);
  if (parsed.protocol !== "https:")
    throw new Error("Peach Patch registry must use HTTPS");
  const response = await fetch(parsed, {
    signal,
    cache: "no-cache",
    headers: { accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`Peach Patch registry returned ${response.status}`);
  return modulesFromRegistryIndex(parseJson(await response.text()), response.url || parsed.href);
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function fetchVerifiedWasm(
  definition: Pick<WebPluginModule, "key" | "wasmUrl" | "artifact">,
): Promise<ArrayBuffer> {
  const artifactUrl = new URL(definition.wasmUrl);
  if (artifactUrl.protocol !== "https:")
    throw new Error(`WASM for ${definition.key} must use HTTPS`);
  const response = await fetch(artifactUrl);
  if (!response.ok) throw new Error(`Unable to load ${definition.wasmUrl}`);
  const bytes = await response.arrayBuffer();
  if (definition.artifact) {
    if (bytes.byteLength !== definition.artifact.size)
      throw new Error(`WASM size check failed for ${definition.key}`);
    const digest = hex(await crypto.subtle.digest("SHA-256", bytes));
    if (digest !== definition.artifact.sha256)
      throw new Error(`WASM integrity check failed for ${definition.key}`);
  }
  return bytes;
}
