"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Bookmark, Ellipsis, Heart, MessageCircle, Send } from "lucide-react";
import { ratioValue } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import type { ImageItem } from "@/lib/types";
import { useLastLook } from "@/store/use-last-look";
import { CropCanvas } from "./crop-canvas";
import { cn } from "@/lib/utils";

export function PhonePreview({ item }: { item: ImageItem }) {
  const { preview, images, selectedId, select } = useLastLook();
  const t = useI18n();
  const ratio = preview === "story" ? 9 / 16 : ratioValue(item.settings.ratio, item);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 370, height: 700, mobile: false });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const mobile = window.innerWidth < 1024;
      setStageSize({
        width: Math.max(240, rect.width - 24),
        height: mobile ? Math.max(280, rect.height * 0.62 - 12) : Math.max(360, rect.height - 32),
        mobile,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const phoneSize = getPhoneSize(preview, ratio, stageSize);

  return (
    <div
      ref={stageRef}
      className="relative flex h-full min-h-0 w-full items-start justify-center overflow-hidden px-3 pb-[38dvh] pt-12 sm:px-8 lg:items-center lg:py-6"
    >
      <div className="preview-glow" />
      <div className="hud-panel absolute left-4 top-[52px] z-20 hidden max-w-[210px] rounded-[10px] px-3 py-2 lg:block">
        <p className="font-mono text-[8px] uppercase tracking-[.18em] text-[#8fe9ff]/70">{t.preview.outputTarget}</p>
        <p className="mt-1 text-[10px] leading-4 text-white/48">
          {t.preview.outputCopy}
        </p>
      </div>
      <motion.div
        layout
        style={{ width: phoneSize.width, height: phoneSize.height }}
        className={cn(
          "relative z-10 flex shrink-0 flex-col overflow-hidden border-0 bg-transparent shadow-[0_30px_80px_rgba(0,0,0,.5)] lg:border lg:border-white/10 lg:bg-[#080808] lg:shadow-[0_50px_120px_rgba(0,0,0,.75)]",
          preview === "story"
            ? "aspect-[9/19] rounded-[18px] p-0 lg:rounded-[2.9rem] lg:p-2"
            : "rounded-[18px] p-0 lg:rounded-[2.5rem] lg:p-2",
        )}
      >
        <div className="absolute left-1/2 top-3 z-30 hidden h-5 w-24 -translate-x-1/2 rounded-full bg-black lg:block" />
        <AnimatePresence mode="wait">
          <motion.div
            key={`${preview}-${selectedId}-${item.settings.ratio}`}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="scanline relative flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] bg-[#121212] lg:rounded-[2.05rem]"
          >
            {preview === "grid" ? (
              <GridPreview item={item} images={images} />
            ) : preview === "story" ? (
              <StoryPreview item={item} />
            ) : (
              <FeedPreview item={item} ratio={ratio} carousel={preview === "carousel"} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
      {preview === "carousel" && images.length > 1 && (
        <div className="absolute bottom-7 z-20 flex gap-1.5">
          {images.map((image) => (
            <button
              key={image.id}
              onClick={() => select(image.id)}
              aria-label={`Show ${image.name}`}
              className={cn("size-1.5 rounded-full", image.id === selectedId ? "bg-white" : "bg-white/25")}
            />
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 rounded-full border border-white/8 bg-black/35 px-3 py-1.5 text-[8px] uppercase tracking-[.18em] text-white/38 backdrop-blur-xl lg:block">
        {t.preview.safeNotShift}
      </div>
    </div>
  );
}

function FeedPreview({ item, ratio, carousel }: { item: ImageItem; ratio: number; carousel: boolean }) {
  const t = useI18n();
  const compare = useLastLook((state) => state.compare);
  const images = useLastLook((state) => state.images);
  const selectedId = useLastLook((state) => state.selectedId);
  const select = useLastLook((state) => state.select);
  const index = images.findIndex((image) => image.id === selectedId);

  return (
    <>
      <div className="hidden h-12 shrink-0 items-end justify-between px-4 pb-2 text-[11px] font-semibold lg:flex">
        <span>9:41</span>
        <span className="tracking-[.26em] text-stone-500">LAST LOOK</span>
        <span>● ◒</span>
      </div>
      <div className="absolute inset-x-0 top-0 z-20 flex h-12 items-center gap-2.5 bg-gradient-to-b from-black/70 to-transparent px-3 pb-2 lg:static lg:h-11 lg:shrink-0 lg:bg-none lg:pb-0">
        <span className="size-7 rounded-full bg-gradient-to-br from-stone-500 to-stone-800" />
        <div className="flex-1">
          <p className="text-[11px] font-semibold">your.archive</p>
          <p className="text-[9px] text-stone-500">{t.preview.location}</p>
        </div>
        <Ellipsis className="size-4" />
      </div>
      <div
        className="relative w-full shrink-0 overflow-hidden bg-black"
        style={{ aspectRatio: String(ratio) }}
        onTouchEnd={(event) => {
          if (!carousel || images.length < 2) return;
          const x = event.changedTouches[0]?.clientX ?? 0;
          const start = Number(event.currentTarget.dataset.start ?? x);
          if (Math.abs(x - start) > 35) {
            const next = x < start ? Math.min(images.length - 1, index + 1) : Math.max(0, index - 1);
            select(images[next].id);
          }
        }}
        onTouchStart={(event) => {
          event.currentTarget.dataset.start = String(event.touches[0]?.clientX ?? 0);
        }}
      >
        <CropCanvas item={item} compare={compare} />
        {carousel && images.length > 1 && (
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[9px]">
            {index + 1}/{images.length}
          </span>
        )}
      </div>
      <div className="hidden min-h-0 flex-1 px-3 pt-3 lg:block">
        <div className="flex items-center gap-3">
          <Heart className="size-5" />
          <MessageCircle className="size-5" />
          <Send className="size-5" />
          <div className="flex flex-1 justify-center gap-1">
            {carousel &&
              images.slice(0, 7).map((image) => (
                <span
                  key={image.id}
                  className={cn("size-1 rounded-full", image.id === selectedId ? "bg-[#7d9cff]" : "bg-stone-600")}
                />
              ))}
          </div>
          <Bookmark className="size-5" />
        </div>
        <p className="mt-3 text-[10px] font-medium">Liked by studio.notes and others</p>
        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-stone-400">
          <span className="font-semibold text-white">your.archive </span>
          {t.preview.caption}
        </p>
      </div>
    </>
  );
}

function getPhoneSize(
  preview: "feed" | "grid" | "carousel" | "story",
  ratio: number,
  stage: { width: number; height: number; mobile: boolean },
) {
  const outerPadding = stage.mobile ? 0 : 16;
  const maxOuterWidth = Math.min(370, stage.width);

  if (preview === "story") {
    const width = Math.min(maxOuterWidth, stage.height * (9 / 19));
    return { width, height: width * (19 / 9) };
  }

  if (preview === "grid") {
    const width = Math.min(maxOuterWidth, stage.height * (9 / 16));
    return { width, height: width * (16 / 9) };
  }

  const feedChromeHeight = stage.mobile ? 0 : 148;
  const maxContentWidthByHeight = Math.max(180, (stage.height - feedChromeHeight - outerPadding) * ratio);
  const contentWidth = Math.min(maxOuterWidth - outerPadding, maxContentWidthByHeight);
  return {
    width: contentWidth + outerPadding,
    height: contentWidth / ratio + feedChromeHeight + outerPadding,
  };
}

function GridPreview({ item, images }: { item: ImageItem; images: ImageItem[] }) {
  const compare = useLastLook((state) => state.compare);
  const select = useLastLook((state) => state.select);
  const cells = Array.from({ length: 9 });
  return (
    <>
      <div className="flex h-14 shrink-0 items-end justify-center pb-2 text-[10px] tracking-[.18em]">YOUR.ARCHIVE</div>
      <div className="flex items-center gap-4 border-b border-white/8 px-4 pb-4">
        <div className="size-16 rounded-full bg-gradient-to-br from-stone-400 to-stone-800 p-[2px]">
          <div className="size-full rounded-full bg-[#161616]" />
        </div>
        <div className="flex flex-1 justify-around text-center">
          {["128 Posts", "4.8K Friends", "202 Following"].map((text) => (
            <p key={text} className="whitespace-pre-line text-[9px] leading-4">
              <strong className="block text-xs">{text.split(" ")[0]}</strong>
              {text.split(" ")[1]}
            </p>
          ))}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 content-start gap-[2px] bg-black pt-[2px]">
        {cells.map((_, index) => {
          const neighbors = images.filter((image) => image.id !== item.id);
          const source = index === 4 ? item : neighbors[index < 4 ? index : index - 1];
          const isCurrent = index === 4;
          return (
            <button
              key={index}
              onClick={() => source && select(source.id)}
              className={cn("relative aspect-square overflow-hidden bg-stone-900", isCurrent && "ring-2 ring-inset ring-white")}
            >
              {source ? (
                <CropCanvas item={source} compare={compare} interactive={false} />
              ) : (
                <span className="absolute inset-0 bg-gradient-to-br from-white/[.025] to-white/[.08]" />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function StoryPreview({ item }: { item: ImageItem }) {
  const t = useI18n();
  const compare = useLastLook((state) => state.compare);
  return (
    <div className="relative h-full min-h-0">
      <CropCanvas item={item} compare={compare} />
      <div className="pointer-events-none absolute inset-x-3 top-4 flex gap-1">
        <span className="h-0.5 flex-1 rounded-full bg-white" />
        <span className="h-0.5 flex-1 rounded-full bg-white/35" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[8%] border-t border-dashed border-white/35">
        <span className="ml-3 bg-black/45 px-2 py-1 text-[8px] uppercase tracking-wider">{t.preview.safeArea}</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[12%] border-t border-dashed border-white/35" />
      <div className="absolute bottom-5 left-4 right-4 flex h-9 items-center rounded-full border border-white/60 px-4 text-[9px]">
        {t.preview.sendMessage}
      </div>
    </div>
  );
}
