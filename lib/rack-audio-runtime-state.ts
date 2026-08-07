export type RackAudioGraphState = {
  audioRunning: boolean;
  currentStructureKey: string;
  enginePresent: boolean;
  loadedStructureKey: string;
  rebuildDeferred: boolean;
};

export type RackAudioCrossfadeEngine = {
  activate: () => void;
  fadeOut: () => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * Makes the prepared graph audible before retiring the graph that is still
 * feeding the speakers. Teardown is best-effort because a replacement that is
 * already live must not be discarded for an error in the old context.
 */
export async function crossfadeRackAudioEngines(
  previous: RackAudioCrossfadeEngine,
  replacement: RackAudioCrossfadeEngine,
) {
  replacement.activate();
  await previous.fadeOut();
  try {
    await previous.stop();
  } catch {
    // The replacement is already live; stale-context cleanup must not stop it.
  }
}

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
