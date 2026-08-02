import { decompress } from "fzstd";
import { isFiniteNumber, isRecord, parseJson } from "./runtime-type-guards.ts";

export type VcvModule = {
  id: number;
  plugin: string;
  model: string;
  pos: [number, number];
  params?: Array<{ id: number; value: number }>;
  data?: Record<string, unknown>;
  version?: string;
  [key:string]:unknown;
};

export type VcvCable = {
  id: number;
  outputModuleId: number;
  outputId: number;
  inputModuleId: number;
  inputId: number;
  color?: string;
  [key:string]:unknown;
};

export type VcvPatch = {
  version?: string;
  zoom?: number;
  gridOffset?: [number, number];
  modules: VcvModule[];
  cables: VcvCable[];
  [key:string]:unknown;
};

function normalizeLegacyVcvPatch(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.modules) || !Array.isArray(value.wires) || value.cables !== undefined) {
    return value;
  }
  const modules = value.modules.map((module, id) => {
    if (
      !isRecord(module) ||
      typeof module.plugin !== "string" ||
      typeof module.model !== "string" ||
      !Array.isArray(module.pos) ||
      module.pos.length !== 2 ||
      !module.pos.every(isFiniteNumber) ||
      !Array.isArray(module.params) ||
      !module.params.every(isFiniteNumber) ||
      (module.data !== undefined && !isRecord(module.data))
    ) {
      return module;
    }
    return {
      ...module,
      id,
      pos: [module.pos[0] / 15, module.pos[1] / 380],
      params: module.params.map((param, paramId) => ({ id: paramId, value: param })),
    };
  });
  const cables = value.wires.map((wire, id) => isRecord(wire) ? { ...wire, id } : wire);
  return {
    ...Object.fromEntries(Object.entries(value).filter(([key]) => key !== "wires")),
    modules,
    cables,
  };
}

function isVcvPatch(value: unknown): value is VcvPatch {
  if (!isRecord(value) || !Array.isArray(value.modules) || !Array.isArray(value.cables)) return false;
  return value.modules.every((module) => {
    if (!isRecord(module) || !isFiniteNumber(module.id) || typeof module.plugin !== "string" ||
      typeof module.model !== "string" || !Array.isArray(module.pos) || module.pos.length !== 2 ||
      !module.pos.every(isFiniteNumber)) return false;
    if (module.params !== undefined && (!Array.isArray(module.params) || !module.params.every((param) =>
      isRecord(param) && isFiniteNumber(param.id) && isFiniteNumber(param.value)))) return false;
    return module.data === undefined || isRecord(module.data);
  }) && value.cables.every((cable) => isRecord(cable) && isFiniteNumber(cable.id) &&
    isFiniteNumber(cable.outputModuleId) && isFiniteNumber(cable.outputId) &&
    isFiniteNumber(cable.inputModuleId) && isFiniteNumber(cable.inputId));
}

function decodeTarEntry(bytes: Uint8Array, wanted: string): string {
  const decoder = new TextDecoder();
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, "");
    const sizeText = decoder.decode(header.subarray(124, 136)).replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeText || "0", 8);
    const bodyStart = offset + 512;
    if (name.replace(/^\.\//, "") === wanted) {
      return decoder.decode(bytes.subarray(bodyStart, bodyStart + size));
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  throw new Error(`${wanted} was not found in the VCV archive`);
}

export function parseVcvArchive(source: ArrayBuffer | Uint8Array): VcvPatch {
  const compressed = source instanceof Uint8Array ? source : new Uint8Array(source);
  const first=compressed.find(byte=>byte!==9&&byte!==10&&byte!==13&&byte!==32);
  const decoded = first===123
    ? parseJson(new TextDecoder().decode(compressed))
    : parseJson(decodeTarEntry(decompress(compressed), "patch.json"));
  const patch = normalizeLegacyVcvPatch(decoded);
  if (!isVcvPatch(patch)) {
    throw new Error("The VCV patch has no module graph");
  }
  return patch;
}
