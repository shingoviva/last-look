"use client";

import { Grid3X3, Images, LayoutTemplate, Smartphone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PreviewContext } from "@/lib/types";
import { useLastLook } from "@/store/use-last-look";
import { cn } from "@/lib/utils";

const MODES: { key: PreviewContext; label: string; icon: typeof LayoutTemplate }[] = [
  { key: "feed", label: "Feed", icon: LayoutTemplate },
  { key: "grid", label: "Grid", icon: Grid3X3 },
  { key: "carousel", label: "Carousel", icon: Images },
  { key: "story", label: "Story", icon: Smartphone },
];

export function PreviewToolbar() {
  const { preview, setPreview, images } = useLastLook();
  const t = useI18n();
  return (
    <div className="hud-panel absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full p-1 lg:top-5 lg:rounded-[7px]">
      <span className="hidden pl-2 pr-1 font-mono text-[8px] uppercase tracking-[.18em] text-[#8fe9ff]/58 lg:inline">
        {t.preview.sim}
      </span>
      {MODES.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          aria-label={`${t.preview.modes[key]} preview`}
          onClick={() => setPreview(key)}
          disabled={key === "carousel" && images.length < 2}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-3 text-[10px] font-semibold tracking-[-.015em] transition disabled:opacity-30 lg:rounded-[5px]",
            preview === key
              ? "bg-[linear-gradient(180deg,#fff,#e5fbff)] text-black shadow-[0_6px_18px_rgba(143,233,255,.16)]"
              : "text-white/42 hover:bg-white/[.045] hover:text-white",
          )}
        >
          <Icon className="size-3" />
          <span className={cn(preview === key ? "inline" : "hidden sm:inline")}>{t.preview.modes[key] ?? label}</span>
        </button>
      ))}
    </div>
  );
}
