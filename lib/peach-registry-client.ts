import type { WebPluginModule } from "./web-plugin-registry.ts";

export const DEFAULT_PEACH_REGISTRY_URL =
  process.env.NEXT_PUBLIC_PEACH_PATCH_REGISTRY_URL ||
  "https://raw.githubusercontent.com/miuchan/peach-patch-registry/main/index.json";

type RegistryPackage = Omit<WebPluginModule, "wasmUrl"> & {
  wasmUrl: string;
  artifact: { sha256: string; size: number };
};

type RegistryIndex = {
  schemaVersion: 1;
  abiVersion: string;
  packages: RegistryPackage[];
};

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function modulesFromRegistryIndex(
  input: unknown,
  indexUrl: string,
): WebPluginModule[] {
  if (!input || typeof input !== "object")
    throw new Error("Peach Patch registry index is not an object");
  const index = input as Partial<RegistryIndex>;
  if (index.schemaVersion !== 1 || !Array.isArray(index.packages))
    throw new Error("Unsupported Peach Patch registry schema");

  const seen = new Set<string>();
  return index.packages.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.key !== "string" ||
      typeof item.wasmUrl !== "string" ||
      !item.artifact ||
      !isSha256(item.artifact.sha256) ||
      !Number.isSafeInteger(item.artifact.size) ||
      item.artifact.size <= 0
    )
      throw new Error("Registry contains an invalid package");
    if (seen.has(item.key)) throw new Error(`Duplicate registry key ${item.key}`);
    seen.add(item.key);
    return {
      ...item,
      wasmUrl: new URL(item.wasmUrl, indexUrl).href,
      ...(item.manifestUrl
        ? { manifestUrl: new URL(item.manifestUrl, indexUrl).href }
        : {}),
    } as WebPluginModule;
  });
}

export async function loadPeachRegistry(
  indexUrl = DEFAULT_PEACH_REGISTRY_URL,
  signal?: AbortSignal,
): Promise<WebPluginModule[]> {
  const parsed = new URL(indexUrl);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost")
    throw new Error("Peach Patch registry must use HTTPS");
  const response = await fetch(parsed, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`Peach Patch registry returned ${response.status}`);
  return modulesFromRegistryIndex(await response.json(), response.url || parsed.href);
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function fetchVerifiedWasm(
  definition: Pick<WebPluginModule, "key" | "wasmUrl" | "artifact">,
): Promise<ArrayBuffer> {
  const response = await fetch(definition.wasmUrl);
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
