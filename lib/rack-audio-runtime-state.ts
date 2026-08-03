export type RackAudioGraphState = {
  audioRunning: boolean;
  currentStructureKey: string;
  enginePresent: boolean;
  loadedStructureKey: string;
  rebuildDeferred: boolean;
};

/**
 * A graph is stale only after an engine exists and reports which patch
 * structure it actually loaded. Structure changes observed during asynchronous
 * startup must remain pending until that startup resolves.
 */
export function rackAudioGraphNeedsRebuild({
  audioRunning,
  currentStructureKey,
  enginePresent,
  loadedStructureKey,
  rebuildDeferred,
}: RackAudioGraphState): boolean {
  return (
    !rebuildDeferred && audioRunning && enginePresent && loadedStructureKey !== currentStructureKey
  );
}
