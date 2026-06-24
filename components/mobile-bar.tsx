"use client";

import { Crop, Download, Eye, ImagePlus, Sparkles } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useLastLook } from "@/store/use-last-look";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fileToItem } from "./upload-dropzone";

const ITEMS = [
  { key: "crop", label: "Crop", icon: Crop },
  { key: "look", label: "Look", icon: Sparkles },
  { key: "preview", label: "Check", icon: Eye },
  { key: "export", label: "Export", icon: Download },
] as const;

export function MobileBar() {
  const { mobilePanel, setMobilePanel, addImages } = useLastLook();
  const t = useI18n();
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (files) => addImages(await Promise.all(files.slice(0, 20).map(fileToItem))),
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] },
    multiple: true,
  });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 grid h-[68px] grid-cols-5 items-center gap-1 border-t border-white/10 bg-[#070707]/92 px-2 pb-[max(4px,env(safe-area-inset-bottom))] shadow-[0_-20px_50px_rgba(0,0,0,.35)] backdrop-blur-2xl lg:hidden">
      <div
        {...getRootProps()}
        role="button"
        tabIndex={0}
        aria-label={t.mobile.import}
        className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] text-white/38 transition hover:text-white"
      >
        <input {...getInputProps()} />
        <ImagePlus className="size-4" />
        {t.mobile.import}
      </div>
      {ITEMS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setMobilePanel(key)}
          className={cn(
            "relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] transition",
            mobilePanel === key
              ? key === "export"
                ? "bg-[#8fe9ff] text-black shadow-[0_8px_24px_rgba(143,233,255,.24)]"
                : "text-white"
              : "text-white/38",
          )}
        >
          {mobilePanel === key && key !== "export" && <span className="absolute -top-1 h-0.5 w-5 rounded-full bg-[#8fe9ff]" />}
          <Icon className="size-4" />
          {t.mobile[key] ?? label}
        </button>
      ))}
    </nav>
  );
}
