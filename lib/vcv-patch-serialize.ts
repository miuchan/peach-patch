import type { PatchDocument } from "./patch-types.ts";
import { dataFromState } from "./patch-state.ts";

function preservedId(id: string, rack: Record<string, unknown> | undefined): number | undefined {
  if (typeof rack?.id === "number" && Number.isSafeInteger(rack.id)) return rack.id;
  const match = id.match(/^vcv-(?:cable-)?(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

export function patchToVcvObject(patch: PatchDocument) {
  const used = new Set<number>(),
    ids = new Map<string, number>();
  for (const item of patch.modules) {
    const id = preservedId(item.id, item.rack);
    if (id !== undefined && !used.has(id)) {
      used.add(id);
      ids.set(item.id, id);
    }
  }
  let nextId = 0;
  for (const item of patch.modules) {
    if (ids.has(item.id)) continue;
    while (used.has(nextId)) nextId++;
    ids.set(item.id, nextId);
    used.add(nextId++);
  }
  const origin = patch.rackOrigin ?? [0, 0];
  const modules = patch.modules.map((item) => {
    const source = { ...(item.rack ?? {}) };
    delete source.bypass;
    delete source.disabled;
    const sourceData =
      source.data && typeof source.data === "object"
        ? (source.data as Record<string, unknown>)
        : undefined;
    const hydratedData = dataFromState(item.key, sourceData, item.state, item.stateKeys),
      data =
        item.asset || item.assets?.some(Boolean) || (item.polyphony && item.polyphony > 1)
          ? {
              ...(hydratedData ?? {}),
              ...(item.asset ? { patchworkWebAsset: item.asset } : {}),
              ...(item.assets?.some(Boolean) ? { patchworkWebAssets: item.assets } : {}),
              ...(item.polyphony && item.polyphony > 1
                ? { patchworkWebPolyphony: item.polyphony }
                : {}),
            }
          : hydratedData,
      rackCompatibleData =
        item.key === "Core/MIDI-Map" && data && Array.isArray(data.maps)
          ? {
              ...data,
              maps: data.maps.map((map) => {
                if (!map || typeof map !== "object") return map;
                const sourceMap = map as Record<string, unknown>,
                  targetId = ids.get(String(sourceMap.patchworkModuleId || ""));
                if (targetId === undefined) return sourceMap;
                const translated: Record<string, unknown> = {
                  ...sourceMap,
                  moduleId: targetId,
                };
                delete translated.patchworkModuleId;
                return translated;
              }),
            }
          : data,
      version = item.version ?? source.version;
    if (item.key === "Core/Blank")
      return {
        ...source,
        id: ids.get(item.id),
        plugin: item.plugin,
        model: item.model,
        version,
        bypass: item.bypassed || undefined,
        params: item.params.map((value, id) => ({ id, value })),
        data: {
          ...(rackCompatibleData ?? {}),
          width: Math.max(3, Math.round(item.width / 15)),
        },
        pos: [
          Math.round((item.x - 20) / 15 + origin[0]),
          Math.round((item.y - 20) / 400 + origin[1]),
        ],
      };
    return {
      ...source,
      id: ids.get(item.id),
      plugin: item.plugin,
      model: item.model,
      version,
      bypass: item.bypassed || undefined,
      params: item.params.map((value, id) => ({ id, value })),
      data: rackCompatibleData,
      pos: [
        Math.round((item.x - 20) / 15 + origin[0]),
        Math.round((item.y - 20) / 400 + origin[1]),
      ],
    };
  });
  const cables = patch.cables.flatMap((cable, index) => {
    const outputModuleId = ids.get(cable.fromModule),
      inputModuleId = ids.get(cable.toModule);
    if (outputModuleId === undefined || inputModuleId === undefined) return [];
    return [
      {
        ...(cable.rack ?? {}),
        id: preservedId(cable.id, cable.rack) ?? index,
        outputModuleId,
        outputId: cable.fromPort,
        inputModuleId,
        inputId: cable.toPort,
        color: cable.color,
      },
    ];
  });
  const rack: Record<string, unknown> = {
    version: "2.6.6",
    zoom: 1,
    gridOffset: [0, 0],
    ...(patch.rack ?? {}),
  };
  const automation = rack.patchworkWebAutomation;
  if (
    automation &&
    typeof automation === "object" &&
    !Array.isArray(automation) &&
    Array.isArray((automation as Record<string, unknown>).events)
  ) {
    const sourceAutomation = automation as Record<string, unknown>;
    rack.patchworkWebAutomation = {
      ...sourceAutomation,
      events: (sourceAutomation.events as unknown[]).map((event) => {
        if (!event || typeof event !== "object" || Array.isArray(event)) return event;
        const sourceEvent = event as Record<string, unknown>,
          targetId = ids.get(String(sourceEvent.moduleId || ""));
        return targetId === undefined
          ? sourceEvent
          : { ...sourceEvent, moduleId: `vcv-${targetId}` };
      }),
    };
  }
  if (typeof rack.masterModuleId === "number" && !used.has(rack.masterModuleId))
    delete rack.masterModuleId;
  return { ...rack, modules, cables };
}

export function serializeVcvPatch(patch: PatchDocument): string {
  return JSON.stringify(patchToVcvObject(patch), null, 2) + "\n";
}
