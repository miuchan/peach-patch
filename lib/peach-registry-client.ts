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
  if (
    !isRecord(value) ||
    typeof value.key !== "string" ||
    typeof value.plugin !== "string" ||
    typeof value.model !== "string" ||
    typeof value.name !== "string" ||
    (value.hidden !== undefined && typeof value.hidden !== "boolean") ||
    typeof value.brand !== "string" ||
    typeof value.version !== "string" ||
    typeof value.license !== "string" ||
    typeof value.sourceUrl !== "string" ||
    typeof value.libraryUrl !== "string" ||
    typeof value.screenshotUrl !== "string" ||
    typeof value.wasmUrl !== "string" ||
    !isFiniteNumber(value.width) ||
    value.width <= 0 ||
    typeof value.description !== "string" ||
    !Array.isArray(value.params) ||
    !Array.isArray(value.inputs) ||
    !Array.isArray(value.outputs) ||
    !isFiniteNumber(value.lights) ||
    !isRecord(value.artifact) ||
    !isSha256(value.artifact.sha256) ||
    !isFiniteNumber(value.artifact.size) ||
    !Number.isSafeInteger(value.artifact.size) ||
    value.artifact.size <= 0
  )
    return false;
  return (
    value.params.every(
      (param) =>
        isRecord(param) &&
        Number.isSafeInteger(param.id) &&
        typeof param.name === "string" &&
        isFiniteNumber(param.min) &&
        isFiniteNumber(param.max) &&
        isFiniteNumber(param.default),
    ) &&
    value.inputs.every(isPortSpec) &&
    value.outputs.every(isPortSpec)
  );
}

function isPortSpec(value: unknown): boolean {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.id) &&
    typeof value.name === "string" &&
    (value.kind === "cv" || value.kind === "gate" || value.kind === "audio")
  );
}

export function modulesFromRegistryIndex(input: unknown, indexUrl: string): WebPluginModule[] {
  if (!input || typeof input !== "object")
    throw new Error("Peach Patch registry index is not an object");
  if (!isRecord(input) || input.schemaVersion !== 1 || !Array.isArray(input.packages))
    throw new Error("Unsupported Peach Patch registry schema");

  const seen = new Set<string>();
  return input.packages.map((item) => {
    if (!isModulePackage(item)) throw new Error("Registry contains an invalid package");
    if (seen.has(item.key)) throw new Error(`Duplicate registry key ${item.key}`);
    seen.add(item.key);
    const runtime = item.runtime
      ? {
          ...item.runtime,
          ...(item.runtime.visuals
            ? {
                visuals: item.runtime.visuals.map((visual) =>
                  "assetBase" in visual && visual.assetBase
                    ? { ...visual, assetBase: new URL(visual.assetBase, indexUrl).href }
                    : visual,
                ),
              }
            : {}),
        }
      : undefined;
    return {
      ...item,
      ...(runtime ? { runtime } : {}),
      screenshotUrl: item.screenshotUrl ? new URL(item.screenshotUrl, indexUrl).href : "",
      wasmUrl: new URL(item.wasmUrl, indexUrl).href,
      ...(item.manifestUrl ? { manifestUrl: new URL(item.manifestUrl, indexUrl).href } : {}),
    };
  });
}

export async function loadPeachRegistry(
  indexUrl = DEFAULT_PEACH_REGISTRY_URL,
  signal?: AbortSignal,
): Promise<WebPluginModule[]> {
  const parsed = new URL(indexUrl);
  if (parsed.protocol !== "https:") throw new Error("Peach Patch registry must use HTTPS");
  const response = await fetch(parsed, {
    signal,
    cache: "no-cache",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Peach Patch registry returned ${response.status}`);
  return modulesFromRegistryIndex(parseJson(await response.text()), response.url || parsed.href);
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
