"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import type { ImageItem } from "@/lib/types";
import { useLastLook } from "@/store/use-last-look";

export async function fileToItem(file: File): Promise<ImageItem> {
  const url = URL.createObjectURL(file);
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = url;
  });
  return {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    url,
    ...dimensions,
    exportEnabled: true,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function UploadDropzone({ compact = false }: { compact?: boolean }) {
  const addImages = useLastLook((state) => state.addImages);
  const t = useI18n();
  const [busy, setBusy] = useState(false);
  const onDrop = useCallback(
    async (files: File[]) => {
      setBusy(true);
      try {
        const items = await Promise.all(files.slice(0, 20).map(fileToItem));
        addImages(items);
      } finally {
        setBusy(false);
      }
    },
    [addImages],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] },
    multiple: true,
    disabled: busy,
  });

  if (compact) {
    return (
      <div
        {...getRootProps()}
        role="button"
        tabIndex={0}
        aria-label={t.upload.add}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[.03] text-xs text-white/46 transition hover:border-[#8fe9ff]/35 hover:text-white"
      >
        <input {...getInputProps()} />
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {t.upload.add}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`group hud-panel flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-3xl p-7 text-center transition sm:min-h-80 sm:rounded-[2rem] sm:p-8 ${
        isDragActive ? "border-[#8fe9ff]/65 bg-[#8fe9ff]/8" : "hover:border-[#8fe9ff]/35"
      }`}
    >
      <input {...getInputProps()} />
      <div className="mb-5 grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/6 shadow-[0_12px_30px_rgba(0,0,0,.24)] sm:mb-6 sm:size-16 sm:rounded-full">
        {busy ? <LoaderCircle className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
      </div>
      <h2 className="sharp-title text-3xl leading-none sm:text-4xl">{t.upload.choose}</h2>
      <p className="mt-3 max-w-sm text-sm leading-6 text-stone-400">
        {t.upload.body}
      </p>
      <span className="mt-7 flex h-12 min-w-44 items-center justify-center rounded-2xl bg-white px-6 text-xs font-semibold text-black shadow-[0_12px_30px_rgba(143,233,255,.14)]">
        {t.upload.cta}
      </span>
    </div>
  );
}
