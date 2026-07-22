import { decompress } from "fzstd";

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
  const patch = first===123
    ? JSON.parse(new TextDecoder().decode(compressed)) as VcvPatch
    : JSON.parse(decodeTarEntry(decompress(compressed), "patch.json")) as VcvPatch;
  if (!Array.isArray(patch.modules) || !Array.isArray(patch.cables)) {
    throw new Error("The VCV patch has no module graph");
  }
  return patch;
}
