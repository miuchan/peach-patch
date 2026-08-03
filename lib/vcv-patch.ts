import { decompress } from "fzstd";
import { isFiniteNumber, isRecord, parseJson } from "./runtime-type-guards.ts";
import {
  CURRENT_VCV_PATCH_VERSION,
  legacyVcvMigration,
  migrateLegacyModule,
  migrateLegacyPortId,
} from "./vcv-legacy-migrations.ts";

export type VcvModule = {
  id: number;
  plugin: string;
  model: string;
  pos: [number, number];
  params?: Array<{ id: number; value: number }>;
  data?: Record<string, unknown>;
  version?: string;
  [key: string]: unknown;
};

export type VcvCable = {
  id: number;
  outputModuleId: number;
  outputId: number;
  inputModuleId: number;
  inputId: number;
  color?: string;
  [key: string]: unknown;
};

export type VcvPatch = {
  version?: string;
  zoom?: number;
  gridOffset?: [number, number];
  modules: VcvModule[];
  cables: VcvCable[];
  [key: string]: unknown;
};

function normalizeLegacyVcvPatch(value: unknown): unknown {
  if (
    !isRecord(value) ||
    !Array.isArray(value.modules) ||
    !Array.isArray(value.wires) ||
    value.cables !== undefined
  ) {
    return value;
  }
  const migration = legacyVcvMigration(value.version);
  const sourceModules = value.modules;
  const legacyModules = sourceModules.map((module) => {
    if (
      !isRecord(module) ||
      typeof module.plugin !== "string" ||
      typeof module.model !== "string" ||
      !Array.isArray(module.pos) ||
      module.pos.length !== 2 ||
      !module.pos.every(isFiniteNumber) ||
      !Array.isArray(module.params) ||
      !module.params.every(isFiniteNumber) ||
      (module.data != null && !isRecord(module.data))
    ) {
      return undefined;
    }
    return module as Record<string, unknown> & {
      plugin: string;
      model: string;
      pos: [number, number];
      params: number[];
    };
  });
  const modules = legacyModules.map((module, id) => {
    if (!module) return sourceModules[id];
    const migrated = migrateLegacyModule(module, migration);
    return {
      ...migrated,
      id,
      pos: [module.pos[0] / 15, module.pos[1] / 380],
    };
  });
  const cables = value.wires.map((wire, id) => {
    if (!isRecord(wire)) return wire;
    const outputModuleId = wire.outputModuleId;
    const inputModuleId = wire.inputModuleId;
    const outputId = wire.outputId;
    const inputId = wire.inputId;
    if (
      !Number.isSafeInteger(outputModuleId) ||
      !Number.isSafeInteger(inputModuleId) ||
      !Number.isSafeInteger(outputId) ||
      !Number.isSafeInteger(inputId)
    )
      return { ...wire, id };
    return {
      ...wire,
      id,
      outputId: migrateLegacyPortId(
        legacyModules[outputModuleId as number],
        "output",
        outputId as number,
        migration,
      ),
      inputId: migrateLegacyPortId(
        legacyModules[inputModuleId as number],
        "input",
        inputId as number,
        migration,
      ),
    };
  });
  const previousMigrations = Array.isArray(value.patchworkWebMigrations)
    ? value.patchworkWebMigrations.filter((item): item is string => typeof item === "string")
    : [];
  return {
    ...Object.fromEntries(Object.entries(value).filter(([key]) => key !== "wires")),
    ...(migration
      ? {
          version: CURRENT_VCV_PATCH_VERSION,
          patchworkWebSourceVersion: value.version,
          patchworkWebMigrations: [...new Set([...previousMigrations, migration.id])],
        }
      : {}),
    modules,
    cables,
  };
}

function isVcvPatch(value: unknown): value is VcvPatch {
  if (!isRecord(value) || !Array.isArray(value.modules) || !Array.isArray(value.cables))
    return false;
  return (
    value.modules.every((module) => {
      if (
        !isRecord(module) ||
        !isFiniteNumber(module.id) ||
        typeof module.plugin !== "string" ||
        typeof module.model !== "string" ||
        !Array.isArray(module.pos) ||
        module.pos.length !== 2 ||
        !module.pos.every(isFiniteNumber)
      )
        return false;
      if (
        module.params !== undefined &&
        (!Array.isArray(module.params) ||
          !module.params.every(
            (param) => isRecord(param) && isFiniteNumber(param.id) && isFiniteNumber(param.value),
          ))
      )
        return false;
      return module.data === undefined || isRecord(module.data);
    }) &&
    value.cables.every(
      (cable) =>
        isRecord(cable) &&
        isFiniteNumber(cable.id) &&
        isFiniteNumber(cable.outputModuleId) &&
        isFiniteNumber(cable.outputId) &&
        isFiniteNumber(cable.inputModuleId) &&
        isFiniteNumber(cable.inputId),
    )
  );
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
  const first = compressed.find((byte) => byte !== 9 && byte !== 10 && byte !== 13 && byte !== 32);
  const decoded =
    first === 123
      ? parseJson(new TextDecoder().decode(compressed))
      : parseJson(decodeTarEntry(decompress(compressed), "patch.json"));
  const patch = normalizeLegacyVcvPatch(decoded);
  if (!isVcvPatch(patch)) {
    const version =
      isRecord(decoded) && typeof decoded.version === "string"
        ? `VCV Rack ${decoded.version}`
        : "The VCV";
    throw new Error(
      `${version} patch could not be loaded because its module graph format is unsupported or invalid`,
    );
  }
  return patch;
}
