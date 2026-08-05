import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import type { ModuleInstance, PatchDocument } from "./patch-types";
import {
  anchoredViewportPan,
  modulesIntersectingViewportRect,
  moveRackModulesWithoutOverlap,
} from "./patch-operations";
import {
  createRackViewportTransformWriter,
  RACK_VIEWPORT_OVERVIEW_ZOOM,
  type RackViewport,
} from "./rack-viewport-transform";

export type RackDragState = {
  ids: string[];
  clientX: number;
  clientY: number;
  origins: Map<string, { x: number; y: number }>;
  before: PatchDocument;
};

export type RackMarqueeState = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  base: Set<string>;
};

export type RackPanGestureState = {
  pointerId: number;
  clientX: number;
  clientY: number;
  panX: number;
  panY: number;
};

export type RackPinchState = {
  distance: number;
  zoom: number;
  worldX: number;
  worldY: number;
};

type BrowserGestureEvent = Event & {
  clientX: number;
  clientY: number;
  scale: number;
};

export type RackCanvasGestureRefs = {
  rackRef: RefObject<HTMLElement | null>;
  worldRef: RefObject<HTMLElement | null>;
  viewportRef: MutableRefObject<RackViewport>;
  dragRef: MutableRefObject<RackDragState | null>;
  marqueeRef: MutableRefObject<RackMarqueeState | null>;
  panGestureRef: MutableRefObject<RackPanGestureState | null>;
  touchPointsRef: MutableRefObject<Map<number, { x: number; y: number }>>;
  pinchRef: MutableRefObject<RackPinchState | null>;
};

export type RackCanvasGestureOptions = RackCanvasGestureRefs & {
  modules: ModuleInstance[];
  pan: { x: number; y: number };
  zoom: number;
  setPan: Dispatch<SetStateAction<{ x: number; y: number }>>;
  setZoom: Dispatch<SetStateAction<number>>;
  setMarquee: Dispatch<
    SetStateAction<{ left: number; top: number; width: number; height: number } | null>
  >;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedCableIds: Dispatch<SetStateAction<Set<string>>>;
  onMarqueeStatus: (added: number, selected: number) => void;
  mutatePatch: (updater: (current: PatchDocument) => PatchDocument) => void;
  checkpointPatch: (patch: PatchDocument) => void;
  bumpLayoutRevision: () => void;
  onDirectInteractionChange?: (active: boolean) => void;
  onViewportInteractionChange?: (active: boolean) => void;
};

export function useRackCanvasGestures({
  rackRef,
  worldRef,
  viewportRef,
  dragRef,
  marqueeRef,
  panGestureRef,
  touchPointsRef,
  pinchRef,
  modules,
  pan,
  zoom,
  setPan,
  setZoom,
  setMarquee,
  setSelectedIds,
  setSelectedCableIds,
  onMarqueeStatus,
  mutatePatch,
  checkpointPatch,
  bumpLayoutRevision,
  onDirectInteractionChange,
  onViewportInteractionChange,
}: RackCanvasGestureOptions) {
  const viewportCommitTimerRef = useRef<number | null>(null);
  const viewportInteractionActiveRef = useRef(false);
  const nativeGestureActiveRef = useRef(false);
  const viewportWriterRef = useRef<ReturnType<typeof createRackViewportTransformWriter> | null>(
    null,
  );
  useEffect(() => {
    const writer = createRackViewportTransformWriter((transform) => {
      const world = worldRef.current;
      if (world) {
        world.style.transform = transform;
        world.classList.toggle(
          "viewport-overview",
          viewportRef.current.zoom < RACK_VIEWPORT_OVERVIEW_ZOOM,
        );
      }
    });
    viewportWriterRef.current = writer;
    return () => {
      writer.cancel();
      viewportWriterRef.current = null;
    };
  }, [viewportRef, worldRef]);
  const clearViewportCommitTimer = useCallback(() => {
    if (viewportCommitTimerRef.current === null) return;
    window.clearTimeout(viewportCommitTimerRef.current);
    viewportCommitTimerRef.current = null;
  }, []);
  const beginViewportInteraction = useCallback(() => {
    clearViewportCommitTimer();
    if (viewportInteractionActiveRef.current) return;
    viewportInteractionActiveRef.current = true;
    onDirectInteractionChange?.(true);
    onViewportInteractionChange?.(true);
  }, [clearViewportCommitTimer, onDirectInteractionChange, onViewportInteractionChange]);
  const endViewportInteraction = useCallback(() => {
    if (!viewportInteractionActiveRef.current) return;
    viewportInteractionActiveRef.current = false;
    onDirectInteractionChange?.(false);
    onViewportInteractionChange?.(false);
  }, [onDirectInteractionChange, onViewportInteractionChange]);
  const previewViewport = useCallback(
    (viewport: RackViewport) => {
      beginViewportInteraction();
      const snapshot = {
        pan: { x: viewport.pan.x, y: viewport.pan.y },
        zoom: viewport.zoom,
      };
      viewportRef.current = snapshot;
      viewportWriterRef.current?.preview(snapshot);
    },
    [beginViewportInteraction, viewportRef],
  );
  const commitViewport = useCallback(() => {
    clearViewportCommitTimer();
    viewportWriterRef.current?.flush();
    const viewport = viewportRef.current;
    startTransition(() => {
      setPan((current) =>
        current.x === viewport.pan.x && current.y === viewport.pan.y ? current : viewport.pan,
      );
      setZoom((current) => (current === viewport.zoom ? current : viewport.zoom));
    });
    endViewportInteraction();
  }, [clearViewportCommitTimer, endViewportInteraction, setPan, setZoom, viewportRef]);
  const commitViewportSoon = useCallback(
    (delay = 80) => {
      clearViewportCommitTimer();
      viewportCommitTimerRef.current = window.setTimeout(commitViewport, delay);
    },
    [clearViewportCommitTimer, commitViewport],
  );
  const readViewport = useCallback(() => viewportRef.current, [viewportRef]);

  useEffect(() => {
    const rack = rackRef.current;
    if (!rack) return;
    let gesture: {
      zoom: number;
      worldX: number;
      worldY: number;
    } | null = null;
    const localPoint = (event: { clientX: number; clientY: number }) => {
      const rect = rack.getBoundingClientRect();
      return {
        x: Number.isFinite(event.clientX) ? event.clientX - rect.left : rack.clientWidth / 2,
        y: Number.isFinite(event.clientY) ? event.clientY - rect.top : rack.clientHeight / 2,
      };
    };
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const viewport = viewportRef.current,
        deltaScale =
          event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
              ? rack.clientHeight
              : 1,
        deltaX = event.deltaX * deltaScale,
        deltaY = event.deltaY * deltaScale;
      if (event.metaKey || event.ctrlKey) {
        const anchor = localPoint(event),
          nextZoom = Math.min(1.5, Math.max(0.08, viewport.zoom - deltaY * 0.001));
        previewViewport({
          pan: anchoredViewportPan(viewport.pan, viewport.zoom, nextZoom, anchor),
          zoom: nextZoom,
        });
      } else {
        previewViewport({
          pan: {
            x: viewport.pan.x - deltaX,
            y: viewport.pan.y - deltaY,
          },
          zoom: viewport.zoom,
        });
      }
      commitViewportSoon();
    };
    const handleGestureStart = (source: Event) => {
      const event = source as BrowserGestureEvent,
        viewport = viewportRef.current,
        anchor = localPoint(event);
      event.preventDefault();
      gesture = {
        zoom: viewport.zoom,
        worldX: (anchor.x - viewport.pan.x) / viewport.zoom,
        worldY: (anchor.y - viewport.pan.y) / viewport.zoom,
      };
      nativeGestureActiveRef.current = true;
      beginViewportInteraction();
    };
    const handleGestureChange = (source: Event) => {
      const event = source as BrowserGestureEvent;
      event.preventDefault();
      if (!gesture) return;
      const anchor = localPoint(event),
        nextZoom = Math.min(1.5, Math.max(0.08, gesture.zoom * Math.max(0.01, event.scale || 1)));
      previewViewport({
        pan: {
          x: anchor.x - gesture.worldX * nextZoom,
          y: anchor.y - gesture.worldY * nextZoom,
        },
        zoom: nextZoom,
      });
    };
    const handleGestureEnd = (event: Event) => {
      event.preventDefault();
      gesture = null;
      nativeGestureActiveRef.current = false;
      commitViewportSoon();
    };

    rack.addEventListener("wheel", handleWheel, { passive: false });
    rack.addEventListener("gesturestart", handleGestureStart, {
      passive: false,
    });
    rack.addEventListener("gesturechange", handleGestureChange, {
      passive: false,
    });
    rack.addEventListener("gestureend", handleGestureEnd, { passive: false });
    return () => {
      rack.removeEventListener("wheel", handleWheel);
      rack.removeEventListener("gesturestart", handleGestureStart);
      rack.removeEventListener("gesturechange", handleGestureChange);
      rack.removeEventListener("gestureend", handleGestureEnd);
      nativeGestureActiveRef.current = false;
    };
  }, [beginViewportInteraction, commitViewportSoon, previewViewport, rackRef, viewportRef]);

  useLayoutEffect(() => {
    // The interaction-only React render must not overwrite the imperative
    // preview or cancel its pending commit. Once commitViewport publishes the
    // final pan/zoom pair, this effect observes equal state and becomes a no-op.
    if (viewportInteractionActiveRef.current) return;
    const current = viewportRef.current;
    if (current.pan.x === pan.x && current.pan.y === pan.y && current.zoom === zoom) return;
    clearViewportCommitTimer();
    viewportWriterRef.current?.cancel();
    viewportRef.current = { pan, zoom };
  }, [clearViewportCommitTimer, pan, viewportRef, zoom]);

  useEffect(
    () => () => {
      clearViewportCommitTimer();
    },
    [clearViewportCommitTimer],
  );

  const startBackgroundGesture = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const rack = rackRef.current;
      if (!rack) return;
      const viewport = viewportRef.current;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* Optional browser API. */
      }
      if (event.pointerType === "touch") {
        beginViewportInteraction();
        touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...touchPointsRef.current.values()];
        if (points.length === 1) {
          panGestureRef.current = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            panX: viewport.pan.x,
            panY: viewport.pan.y,
          };
          pinchRef.current = null;
        } else if (points.length >= 2) {
          const [first, second] = points;
          const rect = rack.getBoundingClientRect();
          const midX = (first.x + second.x) / 2 - rect.left;
          const midY = (first.y + second.y) / 2 - rect.top;
          pinchRef.current = {
            distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
            zoom: viewport.zoom,
            worldX: (midX - viewport.pan.x) / viewport.zoom,
            worldY: (midY - viewport.pan.y) / viewport.zoom,
          };
          panGestureRef.current = null;
        }
        event.preventDefault();
        return;
      }
      if (event.button === 0 || event.button === 1) {
        beginViewportInteraction();
        panGestureRef.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          panX: viewport.pan.x,
          panY: viewport.pan.y,
        };
        event.preventDefault();
      }
    },
    [beginViewportInteraction, panGestureRef, pinchRef, rackRef, touchPointsRef, viewportRef],
  );

  const pointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const selection = marqueeRef.current;
      if (selection?.pointerId === event.pointerId) {
        const rack = rackRef.current;
        if (!rack) return;
        const rect = rack.getBoundingClientRect();
        selection.currentX = event.clientX - rect.left;
        selection.currentY = event.clientY - rect.top;
        setMarquee({
          left: Math.min(selection.startX, selection.currentX),
          top: Math.min(selection.startY, selection.currentY),
          width: Math.abs(selection.currentX - selection.startX),
          height: Math.abs(selection.currentY - selection.startY),
        });
        event.preventDefault();
        return;
      }
      const drag = dragRef.current;
      if (drag) {
        const viewport = viewportRef.current;
        mutatePatch((current) => ({
          ...current,
          modules: moveRackModulesWithoutOverlap(current.modules, drag.origins, {
            x: (event.clientX - drag.clientX) / viewport.zoom,
            y: (event.clientY - drag.clientY) / viewport.zoom,
          }),
        }));
        return;
      }
      if (event.pointerType === "touch" && touchPointsRef.current.has(event.pointerId)) {
        touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (nativeGestureActiveRef.current) {
          event.preventDefault();
          return;
        }
        const points = [...touchPointsRef.current.values()];
        const pinch = pinchRef.current;
        const rack = rackRef.current;
        if (points.length >= 2 && pinch && rack) {
          const [first, second] = points;
          const rect = rack.getBoundingClientRect();
          const midX = (first.x + second.x) / 2 - rect.left;
          const midY = (first.y + second.y) / 2 - rect.top;
          const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
          const nextZoom = Math.min(1.5, Math.max(0.08, pinch.zoom * (distance / pinch.distance)));
          previewViewport({
            pan: { x: midX - pinch.worldX * nextZoom, y: midY - pinch.worldY * nextZoom },
            zoom: nextZoom,
          });
        } else {
          const gesture = panGestureRef.current;
          if (gesture?.pointerId === event.pointerId)
            previewViewport({
              pan: {
                x: gesture.panX + event.clientX - gesture.clientX,
                y: gesture.panY + event.clientY - gesture.clientY,
              },
              zoom: viewportRef.current.zoom,
            });
        }
        event.preventDefault();
        return;
      }
      const gesture = panGestureRef.current;
      if (gesture?.pointerId === event.pointerId) {
        previewViewport({
          pan: {
            x: gesture.panX + event.clientX - gesture.clientX,
            y: gesture.panY + event.clientY - gesture.clientY,
          },
          zoom: viewportRef.current.zoom,
        });
        event.preventDefault();
      }
    },
    [
      dragRef,
      marqueeRef,
      mutatePatch,
      panGestureRef,
      pinchRef,
      previewViewport,
      rackRef,
      setMarquee,
      touchPointsRef,
      viewportRef,
    ],
  );

  const pointerUp = useCallback(
    (event?: PointerEvent<HTMLElement>) => {
      const selection = marqueeRef.current;
      const endingSelection = Boolean(
        selection && (!event || selection.pointerId === event.pointerId),
      );
      const endingDirectManipulation = endingSelection || Boolean(dragRef.current);
      if (selection && (!event || selection.pointerId === event.pointerId)) {
        const left = Math.min(selection.startX, selection.currentX);
        const top = Math.min(selection.startY, selection.currentY);
        const right = Math.max(selection.startX, selection.currentX);
        const bottom = Math.max(selection.startY, selection.currentY);
        const viewport = viewportRef.current;
        const hits = modulesIntersectingViewportRect(modules, viewport.pan, viewport.zoom, {
          left,
          top,
          right,
          bottom,
        });
        const next = new Set(selection.base);
        for (const id of hits) next.add(id);
        setSelectedIds(next);
        setSelectedCableIds(new Set());
        onMarqueeStatus(hits.length, next.size);
        marqueeRef.current = null;
        setMarquee(null);
      }
      if (dragRef.current) {
        checkpointPatch(dragRef.current.before);
        dragRef.current = null;
        bumpLayoutRevision();
      }
      if (endingDirectManipulation) onDirectInteractionChange?.(false);
      const endingPan = event
        ? panGestureRef.current?.pointerId === event.pointerId
        : Boolean(panGestureRef.current);
      const endingPinch = Boolean(pinchRef.current);
      if (!event) {
        panGestureRef.current = null;
        pinchRef.current = null;
        touchPointsRef.current.clear();
        if (endingPan || endingPinch) commitViewport();
        return;
      }
      touchPointsRef.current.delete(event.pointerId);
      if (panGestureRef.current?.pointerId === event.pointerId) panGestureRef.current = null;
      const remaining = [...touchPointsRef.current.entries()];
      pinchRef.current = null;
      if (remaining.length >= 2) {
        const [, first] = remaining[0];
        const [, second] = remaining[1];
        const rack = rackRef.current;
        if (rack) {
          const rect = rack.getBoundingClientRect();
          const midX = (first.x + second.x) / 2 - rect.left;
          const midY = (first.y + second.y) / 2 - rect.top;
          const viewport = viewportRef.current;
          pinchRef.current = {
            distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
            zoom: viewport.zoom,
            worldX: (midX - viewport.pan.x) / viewport.zoom,
            worldY: (midY - viewport.pan.y) / viewport.zoom,
          };
        }
      } else if (remaining.length === 1) {
        const [pointerId, point] = remaining[0];
        const viewport = viewportRef.current;
        panGestureRef.current = {
          pointerId,
          clientX: point.x,
          clientY: point.y,
          panX: viewport.pan.x,
          panY: viewport.pan.y,
        };
      } else if (endingPan || endingPinch) {
        commitViewport();
      }
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* Already released. */
      }
    },
    [
      bumpLayoutRevision,
      checkpointPatch,
      commitViewport,
      dragRef,
      marqueeRef,
      modules,
      onDirectInteractionChange,
      panGestureRef,
      pinchRef,
      rackRef,
      setMarquee,
      setSelectedCableIds,
      setSelectedIds,
      onMarqueeStatus,
      touchPointsRef,
      viewportRef,
    ],
  );

  return {
    startBackgroundGesture,
    pointerMove,
    pointerUp,
    previewViewport,
    readViewport,
    commitViewportSoon,
  };
}
