import { useCallback, type Dispatch, type MutableRefObject, type PointerEvent, type RefObject, type SetStateAction } from "react";
import type { ModuleInstance, PatchDocument } from "./patch-types";
import { modulesIntersectingViewportRect, moveRackModulesWithoutOverlap } from "./patch-operations";

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

export type RackCanvasGestureRefs = {
  rackRef: RefObject<HTMLElement | null>;
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
  setMarquee: Dispatch<SetStateAction<{ left: number; top: number; width: number; height: number } | null>>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedCableIds: Dispatch<SetStateAction<Set<string>>>;
  setStatus: Dispatch<SetStateAction<string>>;
  mutatePatch: (updater: (current: PatchDocument) => PatchDocument) => void;
  checkpointPatch: (patch: PatchDocument) => void;
  bumpLayoutRevision: () => void;
};

export function useRackCanvasGestures({
  rackRef,
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
  setStatus,
  mutatePatch,
  checkpointPatch,
  bumpLayoutRevision,
}: RackCanvasGestureOptions) {
  const startBackgroundGesture = useCallback((event: PointerEvent<HTMLElement>) => {
    const rack = rackRef.current;
    if (!rack) return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Optional browser API. */ }
    if (event.pointerType === "touch") {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...touchPointsRef.current.values()];
      if (points.length === 1) {
        panGestureRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, panX: pan.x, panY: pan.y };
        pinchRef.current = null;
      } else if (points.length >= 2) {
        const [first, second] = points;
        const rect = rack.getBoundingClientRect();
        const midX = (first.x + second.x) / 2 - rect.left;
        const midY = (first.y + second.y) / 2 - rect.top;
        pinchRef.current = {
          distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
          zoom,
          worldX: (midX - pan.x) / zoom,
          worldY: (midY - pan.y) / zoom,
        };
        panGestureRef.current = null;
      }
      event.preventDefault();
      return;
    }
    if (event.button === 0 || event.button === 1) {
      panGestureRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, panX: pan.x, panY: pan.y };
      event.preventDefault();
    }
  }, [pan.x, pan.y, panGestureRef, pinchRef, rackRef, touchPointsRef, zoom]);

  const pointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
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
      mutatePatch((current) => ({
        ...current,
        modules: moveRackModulesWithoutOverlap(current.modules, drag.origins, {
          x: (event.clientX - drag.clientX) / zoom,
          y: (event.clientY - drag.clientY) / zoom,
        }),
      }));
      return;
    }
    if (event.pointerType === "touch" && touchPointsRef.current.has(event.pointerId)) {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
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
        setZoom(nextZoom);
        setPan({ x: midX - pinch.worldX * nextZoom, y: midY - pinch.worldY * nextZoom });
      } else {
        const gesture = panGestureRef.current;
        if (gesture?.pointerId === event.pointerId)
          setPan({ x: gesture.panX + event.clientX - gesture.clientX, y: gesture.panY + event.clientY - gesture.clientY });
      }
      event.preventDefault();
      return;
    }
    const gesture = panGestureRef.current;
    if (gesture?.pointerId === event.pointerId) {
      setPan({ x: gesture.panX + event.clientX - gesture.clientX, y: gesture.panY + event.clientY - gesture.clientY });
      event.preventDefault();
    }
  }, [dragRef, marqueeRef, mutatePatch, panGestureRef, pinchRef, rackRef, setMarquee, setPan, setZoom, touchPointsRef, zoom]);

  const pointerUp = useCallback((event?: PointerEvent<HTMLElement>) => {
    const selection = marqueeRef.current;
    if (selection && (!event || selection.pointerId === event.pointerId)) {
      const left = Math.min(selection.startX, selection.currentX);
      const top = Math.min(selection.startY, selection.currentY);
      const right = Math.max(selection.startX, selection.currentX);
      const bottom = Math.max(selection.startY, selection.currentY);
      const hits = modulesIntersectingViewportRect(modules, pan, zoom, { left, top, right, bottom });
      const next = new Set(selection.base);
      for (const id of hits) next.add(id);
      setSelectedIds(next);
      setSelectedCableIds(new Set());
      setStatus(`${hits.length} module${hits.length === 1 ? "" : "s"} added by marquee · ${next.size} selected`);
      marqueeRef.current = null;
      setMarquee(null);
    }
    if (dragRef.current) {
      checkpointPatch(dragRef.current.before);
      dragRef.current = null;
      bumpLayoutRevision();
    }
    if (!event) return;
    touchPointsRef.current.delete(event.pointerId);
    if (panGestureRef.current?.pointerId === event.pointerId) panGestureRef.current = null;
    const remaining = [...touchPointsRef.current.entries()];
    pinchRef.current = null;
    if (remaining.length === 1) {
      const [pointerId, point] = remaining[0];
      panGestureRef.current = { pointerId, clientX: point.x, clientY: point.y, panX: pan.x, panY: pan.y };
    }
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
  }, [bumpLayoutRevision, checkpointPatch, dragRef, marqueeRef, modules, pan, panGestureRef, pinchRef, setMarquee, setSelectedCableIds, setSelectedIds, setStatus, touchPointsRef, zoom]);

  return { startBackgroundGesture, pointerMove, pointerUp };
}
