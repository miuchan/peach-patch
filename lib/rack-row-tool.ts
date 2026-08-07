import type { ModuleInstance } from "./patch-types";

export const RACK_ROW_HEIGHT = 380;

export function rackRowToolAction(
  modules: ModuleInstance[],
  roomId: string,
  action: 0 | 1 | 3 | 4,
) {
  const room = modules.find((module) => module.id === roomId);
  if (!room) return modules;
  const above = action < 2;
  if (action === 0 || action === 4) {
    const inclusive = (room.state?.[0] ?? 0) > 0.5;
    if (inclusive && !modules.some((module) => module.id !== room.id && module.y === room.y))
      return modules;
    const delta = above ? -RACK_ROW_HEIGHT : RACK_ROW_HEIGHT;
    return modules.map((module) => {
      const outside = above ? module.y < room.y : module.y > room.y;
      const sameRow = inclusive && module.id !== room.id && module.y === room.y;
      return outside || sameRow ? { ...module, y: module.y + delta } : module;
    });
  }

  const candidates = modules.filter((module) => (above ? module.y < room.y : module.y > room.y));
  if (!candidates.length) return modules;
  const last = above
    ? Math.min(...candidates.map((module) => module.y))
    : Math.max(...candidates.map((module) => module.y));
  const delta = above ? RACK_ROW_HEIGHT : -RACK_ROW_HEIGHT;
  return modules.map((module) => {
    if (!(above ? module.y < room.y : module.y > room.y)) return module;
    return { ...module, y: module.y + delta === room.y ? last : module.y + delta };
  });
}

export function rackRowToolDragIds(modules: ModuleInstance[], roomId: string, stripMode: boolean) {
  const room = modules.find((module) => module.id === roomId);
  if (!room) return [];
  const row = modules.filter((module) => module.y === room.y).sort((a, b) => a.x - b.x);
  if (!stripMode) return row.map((module) => module.id);
  const index = row.findIndex((module) => module.id === room.id);
  let first = index;
  let last = index;
  while (first > 0 && row[first - 1].x + row[first - 1].width === row[first].x) first--;
  while (last + 1 < row.length && row[last].x + row[last].width === row[last + 1].x) last++;
  return row.slice(first, last + 1).map((module) => module.id);
}
