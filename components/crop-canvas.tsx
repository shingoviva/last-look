"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  drawProcessed,
  drawSourceCover,
  getSrgbContext,
  loadImage,
  renderInstagramShiftSource,
} from "@/lib/image-processing";
import type { CompareMode, ImageItem } from "@/lib/types";
import { useLastLook } from "@/store/use-last-look";

export function CropCanvas({
  item,
  compare,
  interactive = true,
  className = "",
}: {
  item: ImageItem;
  compare: CompareMode;
  interactive?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<
    | { mode: "pan"; x: number; y: number; startX: number; startY: number }
    | { mode: "pinch"; distance: number; zoom: number; centerX: number; centerY: number; startX: number; startY: number }
    | null
  >(null);
  const update = useLastLook((state) => state.updateSettings);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1, dpr: 1 });
  const [shiftSource, setShiftSource] = useState<CanvasImageSource | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const ready = loadedUrl === item.url;

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const source = compare === "shift" ? shiftSource : imageRef.current;
    if (!canvas || !source) return;
    const width = Math.max(1, Math.round(frameSize.width * frameSize.dpr));
    const height = Math.max(1, Math.round(frameSize.height * frameSize.dpr));
    const ctx = getSrgbContext(canvas, { readFrequently: true, alpha: false });
    if (!ctx) return;
    if (compare === "shift") {
      drawSourceCover(ctx, source, width, height);
    } else {
      drawProcessed(ctx, source, item, { width, height, compare });
    }
  }, [compare, frameSize, item, shiftSource]);

  useEffect(() => {
    let alive = true;
    loadImage(item.url).then((image) => {
      if (!alive) return;
      imageRef.current = image;
      setLoadedUrl(item.url);
    });
    return () => {
      alive = false;
    };
  }, [item.url]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const rect = frame.getBoundingClientRect();
      const next = {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      };
      setFrameSize((current) =>
        current.width === next.width && current.height === next.height && current.dpr === next.dpr
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (ready) render();
  }, [ready, render]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !interactive) return;
    const stopNativeTouch = (event: TouchEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const stopGesture = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    frame.addEventListener("touchstart", stopNativeTouch, { passive: false });
    frame.addEventListener("touchmove", stopNativeTouch, { passive: false });
    frame.addEventListener("gesturestart", stopGesture);
    frame.addEventListener("gesturechange", stopGesture);
    return () => {
      frame.removeEventListener("touchstart", stopNativeTouch);
      frame.removeEventListener("touchmove", stopNativeTouch);
      frame.removeEventListener("gesturestart", stopGesture);
      frame.removeEventListener("gesturechange", stopGesture);
    };
  }, [interactive]);

  useEffect(() => {
    if (compare !== "shift") return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setShiftSource(null);
      setShiftLoading(true);
      renderInstagramShiftSource(item)
        .then((source) => {
          if (!alive) return;
          setShiftSource(source);
        })
        .catch(() => {
          if (alive) setShiftSource(null);
        })
        .finally(() => {
          if (alive) setShiftLoading(false);
        });
    }, 180);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [compare, item]);

  const pixelWidth = Math.max(1, Math.round(frameSize.width * frameSize.dpr));
  const pixelHeight = Math.max(1, Math.round(frameSize.height * frameSize.dpr));

  return (
    <div
      ref={frameRef}
      className={`crop-touch-target relative h-full w-full touch-none overflow-hidden select-none ${interactive ? "cursor-grab active:cursor-grabbing" : ""} ${className}`}
      onPointerDown={(event) => {
        if (!interactive || item.settings.fitMode === "fit") return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        gestureRef.current = createGesture(pointersRef.current, item);
      }}
      onPointerMove={(event) => {
        if (!gestureRef.current || !pointersRef.current.has(event.pointerId)) return;
        event.preventDefault();
        event.stopPropagation();
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const rect = event.currentTarget.getBoundingClientRect();
        const points = Array.from(pointersRef.current.values());
        const gesture = gestureRef.current;
        if (gesture.mode === "pinch" && points.length >= 2) {
          const distance = getDistance(points[0], points[1]);
          const center = getCenter(points[0], points[1]);
          const dx = (center.x - gesture.centerX) / Math.max(rect.width * 0.28, 1);
          const dy = (center.y - gesture.centerY) / Math.max(rect.height * 0.28, 1);
          update(item.id, {
            zoom: clamp(gesture.zoom * (distance / Math.max(gesture.distance, 1)), 1, 2.5),
            x: clamp(gesture.startX + dx, -1, 1),
            y: clamp(gesture.startY + dy, -1, 1),
          });
          return;
        }
        const point = pointersRef.current.get(event.pointerId);
        if (!point || gesture.mode !== "pan") return;
        const dx = (point.x - gesture.x) / Math.max(rect.width * 0.28, 1);
        const dy = (point.y - gesture.y) / Math.max(rect.height * 0.28, 1);
        update(item.id, {
          x: clamp(gesture.startX + dx, -1, 1),
          y: clamp(gesture.startY + dy, -1, 1),
        });
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        event.stopPropagation();
        pointersRef.current.delete(event.pointerId);
        gestureRef.current = createGesture(pointersRef.current, item);
      }}
      onPointerCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        pointersRef.current.delete(event.pointerId);
        gestureRef.current = createGesture(pointersRef.current, item);
      }}
      onWheel={(event) => {
        if (!interactive || item.settings.fitMode === "fit") return;
        event.preventDefault();
        event.stopPropagation();
        update(item.id, {
          zoom: clamp(item.settings.zoom - event.deltaY * 0.0015, 1, 2.5),
        });
      }}
    >
      <canvas
        key={`${item.id}-${item.settings.ratio}-${frameSize.width}x${frameSize.height}`}
        ref={canvasRef}
        width={pixelWidth}
        height={pixelHeight}
        className="absolute inset-0 block size-full max-h-none max-w-none"
        aria-label={`Preview of ${item.name}`}
      />
      {!ready && <div className="absolute inset-0 animate-pulse bg-stone-900" />}
      {compare === "shift" && shiftLoading && (
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-center">
          <span className="rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-[9px] tracking-wide text-white/75 backdrop-blur-xl">
            Simulating JPEG…
          </span>
        </div>
      )}
    </div>
  );
}

function createGesture(pointers: Map<number, { x: number; y: number }>, item: ImageItem) {
  const points = Array.from(pointers.values());
  if (points.length >= 2) {
    const center = getCenter(points[0], points[1]);
    return {
      mode: "pinch" as const,
      distance: getDistance(points[0], points[1]),
      zoom: item.settings.zoom,
      centerX: center.x,
      centerY: center.y,
      startX: item.settings.x,
      startY: item.settings.y,
    };
  }
  if (points.length === 1) {
    return {
      mode: "pan" as const,
      x: points[0].x,
      y: points[0].y,
      startX: item.settings.x,
      startY: item.settings.y,
    };
  }
  return null;
}

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getCenter(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
