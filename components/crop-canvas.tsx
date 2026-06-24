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
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
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
      className={`relative h-full w-full touch-none overflow-hidden select-none ${interactive ? "cursor-grab active:cursor-grabbing" : ""} ${className}`}
      onPointerDown={(event) => {
        if (!interactive || item.settings.fitMode === "fit") return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          x: event.clientX,
          y: event.clientY,
          startX: item.settings.x,
          startY: item.settings.y,
        };
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const dx = (event.clientX - dragRef.current.x) / Math.max(rect.width * 0.28, 1);
        const dy = (event.clientY - dragRef.current.y) / Math.max(rect.height * 0.28, 1);
        update(item.id, {
          x: Math.max(-1, Math.min(1, dragRef.current.startX + dx)),
          y: Math.max(-1, Math.min(1, dragRef.current.startY + dy)),
        });
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onWheel={(event) => {
        if (!interactive || item.settings.fitMode === "fit") return;
        event.preventDefault();
        update(item.id, {
          zoom: Math.max(1, Math.min(2.5, item.settings.zoom - event.deltaY * 0.0015)),
        });
      }}
    >
      <canvas
        key={`${item.id}-${item.settings.ratio}-${frameSize.width}x${frameSize.height}`}
        ref={canvasRef}
        width={pixelWidth}
        height={pixelHeight}
        style={{ width: `${frameSize.width}px`, height: `${frameSize.height}px` }}
        className="absolute inset-0 block max-h-none max-w-none"
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
