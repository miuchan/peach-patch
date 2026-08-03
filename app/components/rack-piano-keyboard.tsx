import { useRef, type PointerEvent } from "react";

const keyboardLayouts = {
  small: {
    width: 195.736,
    height: 80.431,
    keyWidth: 23,
    keyHeight: 38,
    positions: [
      [3.839, 42.431],
      [17.953, 3.986],
      [32.037, 42.431],
      [46.004, 3.986],
      [60.059, 42.431],
      [88.612, 42.431],
      [102.697, 3.986],
      [116.604, 42.431],
      [130.659, 3.986],
      [144.596, 42.431],
      [158.799, 3.986],
      [172.736, 42.431],
    ],
  },
  big: {
    width: 292,
    height: 155,
    keyWidth: 34,
    keyHeight: 70,
    positions: [
      [5.256, 79.99],
      [26.002, 5.285],
      [46.624, 79.99],
      [66.998, 5.285],
      [87.608, 79.99],
      [129.006, 79.99],
      [149.557, 5.285],
      [169.99, 79.99],
      [190.57, 5.285],
      [211.004, 79.99],
      [231.752, 5.285],
      [252.0, 79.99],
    ],
  },
} as const;

export function RackPianoKeyboard({
  actionBase,
  keys,
  voices,
  lightStart,
  lightStride = voices,
  lightVoiceStride = 1,
  lightChannels = 1,
  lightOrder = "top-down",
  actionSteps,
  fixedKeyOnDrag = false,
  modifierBank,
  values,
  x,
  y,
  width,
  height,
  scaleX,
  layout,
  rightClick = false,
  onMomentary,
}: {
  actionBase: number;
  keys: number;
  voices: number;
  lightStart: number;
  lightStride?: number;
  lightVoiceStride?: number;
  lightChannels?: number;
  lightOrder?: "top-down" | "bottom-up";
  actionSteps?: number;
  fixedKeyOnDrag?: boolean;
  modifierBank?: "shift";
  values: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  layout?: "small" | "big";
  rightClick?: boolean;
  onMomentary: (id: number, active: boolean) => void;
}) {
  const activeRef = useRef<{
    pointerId: number;
    action: number;
    key: number;
    bank: boolean;
  } | null>(null);
  const pointerValue = (event: PointerEvent<HTMLDivElement>, lockedKey?: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / rect.width) * width;
    const localY = ((event.clientY - rect.top) / rect.height) * height;
    let key = lockedKey ?? Math.min(keys - 1, Math.max(0, Math.floor((localX / width) * keys)));
    let velocity = Math.max(0, Math.min(1, localY / height));
    if (layout) {
      const geometry = keyboardLayouts[layout];
      const scaleLayoutX = width / geometry.width;
      const scaleLayoutY = height / geometry.height;
      if (lockedKey === undefined) {
        // Rack adds black keys after white keys, so they receive pointer events first.
        const order = [1, 3, 6, 8, 10, 0, 2, 4, 5, 7, 9, 11];
        const hit = order.find((candidate) => {
          const position = geometry.positions[candidate];
          return (
            localX >= position[0] * scaleLayoutX &&
            localX <= (position[0] + geometry.keyWidth) * scaleLayoutX &&
            localY >= position[1] * scaleLayoutY &&
            localY <= (position[1] + geometry.keyHeight) * scaleLayoutY
          );
        });
        if (hit !== undefined) key = hit;
      }
      const position = geometry.positions[key];
      velocity = Math.max(
        0,
        Math.min(1, (localY - position[1] * scaleLayoutY) / (geometry.keyHeight * scaleLayoutY)),
      );
    }
    return { key, velocity };
  };
  const actionAt = (event: PointerEvent<HTMLDivElement>, bank: boolean, lockedKey?: number) => {
    const hit = pointerValue(event, lockedKey);
    const steps = actionSteps ?? voices;
    const step = actionSteps
      ? Math.round(hit.velocity * (steps - 1))
      : Math.min(steps - 1, Math.floor(hit.velocity * steps));
    return {
      action: actionBase + (bank ? steps * keys : 0) + step * keys + hit.key,
      key: hit.key,
    };
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    onMomentary(active.action, false);
    activeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <div
      className="pw-piano-keyboard"
      role="group"
      aria-label={voices > 1 ? "Chord keyboard" : "Piano keyboard"}
      style={{ left: x * scaleX, top: y, width: width * scaleX, height }}
      onPointerDown={(event) => {
        if (event.button !== 0 && !(rightClick && event.button === 2)) return;
        event.preventDefault();
        event.stopPropagation();
        const bank =
          (rightClick && event.button === 2) || (modifierBank === "shift" && event.shiftKey);
        const { action, key } = actionAt(event, bank);
        activeRef.current = { pointerId: event.pointerId, action, key, bank };
        event.currentTarget.setPointerCapture(event.pointerId);
        onMomentary(action, true);
      }}
      onPointerMove={(event) => {
        const active = activeRef.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const { action, key } = actionAt(
          event,
          active.bank,
          fixedKeyOnDrag ? active.key : undefined,
        );
        if (action === active.action) return;
        onMomentary(active.action, false);
        active.action = action;
        active.key = key;
        onMomentary(action, true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(event) => {
        if (rightClick) event.preventDefault();
      }}
    >
      {Array.from({ length: keys }, (_, key) =>
        Array.from({ length: voices }, (_, voice) => {
          const lightIndex = lightStart + key * lightStride + voice * lightVoiceStride;
          const channels = Array.from({ length: lightChannels }, (_, channel) =>
            Math.max(0, Math.min(1, values[lightIndex + channel] ?? 0)),
          );
          const value = Math.max(...channels, 0);
          const displayVoice = lightOrder === "bottom-up" ? voices - 1 - voice : voice;
          const geometry = layout ? keyboardLayouts[layout] : null;
          const position = geometry?.positions[key];
          const left = position
            ? ((position[0] + geometry!.keyWidth / 2) / geometry!.width) * 100
            : ((key + 0.5) / keys) * 100;
          const top = position
            ? ((position[1] + (geometry!.keyHeight * (displayVoice + 0.5)) / voices) /
                geometry!.height) *
              100
            : ((displayVoice + 0.5) / voices) * 100;
          const color =
            lightChannels >= 3
              ? `rgb(${Math.round(40 * channels[0] + 245 * channels[1] + 232 * channels[2])} ${Math.round(200 * channels[0] + 72 * channels[1] + 241 * channels[2])} ${Math.round(111 * channels[0] + 72 * channels[1] + 255 * channels[2])})`
              : undefined;
          return (
            <i
              key={`${key}-${voice}`}
              className={`voice-${voice}`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                opacity: value,
                ...(color ? { backgroundColor: color, color } : {}),
              }}
            />
          );
        }),
      )}
    </div>
  );
}
