export type ModuleStatus = "ready" | "resolving" | "source-required" | "error";

export type SampleAssetRef = { storageKey:string; name:string; sampleRate:number; channels:number; frames:number };

export type ModuleInstance = {
  id: string;
  key: string;
  plugin: string;
  model: string;
  version?: string;
  x: number;
  y: number;
  width: number;
  params: number[];
  state?: number[];
  stateKeys?: Array<{key:string;type:"integer"|"real"|"boolean"|"string-enum";values?:string[];index?:number;path?:Array<number|string>}>;
  asset?: SampleAssetRef;
  assets?: Array<SampleAssetRef | undefined>;
  polyphony?: number;
  bypassed?: boolean;
  rack?: Record<string,unknown>;
  status: ModuleStatus;
  description?: string;
  screenshotUrl?: string;
  sourceUrl?: string;
  license?: string;
  error?: string;
};

export type PatchCable = {
  id: string;
  fromModule: string;
  fromPort: number;
  toModule: string;
  toPort: number;
  color: string;
  rack?: Record<string,unknown>;
};

export type PatchDocument = {
  modules: ModuleInstance[];
  cables: PatchCable[];
  rack?: Record<string,unknown>;
  rackOrigin?: [number,number];
};
