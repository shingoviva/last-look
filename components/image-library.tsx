"use client";

import { Check, GripVertical, Trash2 } from "lucide-react";
import { UploadDropzone } from "./upload-dropzone";
import { useLastLook } from "@/store/use-last-look";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ImageLibrary() {
  const { images, selectedId, select, remove, reorder, toggleExport, setAllExport } = useLastLook();
  const t = useI18n();
  const selectedForExport = images.filter((image) => image.exportEnabled).length;

  return (
    <aside className="glass-panel hidden h-full min-h-0 w-[258px] shrink-0 flex-col border-r border-white/8 lg:flex">
      <div className="flex items-end justify-between px-5 pb-3 pt-6">
        <div>
          <p className="eyebrow">{t.library.sequence}</p>
          <h2 className="mt-1 text-sm font-medium tracking-tight">{t.library.selects}</h2>
        </div>
        <span className="font-mono text-xs tabular-nums text-white/35">{String(images.length).padStart(2, "0")}</span>
      </div>
      <div className="hud-panel mx-3 mb-3 flex items-center justify-between rounded-[8px] px-3 py-2">
        <span className="text-[9px] uppercase tracking-[.16em] text-white/42">
          {t.library.export} {selectedForExport}/{images.length}
        </span>
        <button
          onClick={() => setAllExport(selectedForExport !== images.length)}
          className="text-[9px] text-[#8fe9ff]/72 transition hover:text-white"
        >
          {selectedForExport === images.length ? t.library.clearAll : t.library.selectAll}
        </button>
      </div>
      <div className="scrollbar-none flex-1 space-y-2 overflow-y-auto px-3 pb-4">
        {images.map((image, index) => (
          <button
            key={image.id}
            draggable
            onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => reorder(Number(event.dataTransfer.getData("text/plain")), index)}
            onClick={() => select(image.id)}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-[8px] border p-2 text-left transition duration-200",
              selectedId === image.id
                ? "border-[#8fe9ff]/24 bg-[#8fe9ff]/[.055] shadow-[inset_0_1px_rgba(255,255,255,.08),0_14px_30px_rgba(0,0,0,.2)]"
                : "border-transparent hover:border-white/10 hover:bg-white/[.035]",
            )}
          >
            <GripVertical className="size-3 shrink-0 text-stone-700 group-hover:text-stone-500" />
            {/* Blob URLs are local previews and should not pass through Next image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="size-14 rounded-[3px] object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{image.name}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-stone-600">
                {image.settings.ratio} · {image.settings.look}
              </p>
            </div>
            <span className="absolute left-7 top-2 grid size-4 place-items-center rounded-full bg-black/70 text-[9px]">
              {index + 1}
            </span>
            <span
              role="checkbox"
              aria-checked={image.exportEnabled}
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                toggleExport(image.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleExport(image.id);
                }
              }}
              className={cn(
                "absolute bottom-2 right-2 grid size-5 place-items-center rounded-md border transition",
                image.exportEnabled
                  ? "border-[#8fe9ff]/60 bg-[#8fe9ff] text-black shadow-[0_0_18px_rgba(143,233,255,.28)]"
                  : "border-white/20 bg-black/55 text-transparent hover:border-white/40",
              )}
              aria-label={`${image.exportEnabled ? t.library.exclude : t.library.include} ${image.name}`}
            >
              <Check className="size-3" />
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                remove(image.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") remove(image.id);
              }}
              className="absolute right-2 top-2 hidden rounded-[3px] bg-black/75 p-1.5 text-stone-400 hover:text-white group-hover:block"
              aria-label={`${t.library.remove} ${image.name}`}
            >
              <Trash2 className="size-3" />
            </span>
          </button>
        ))}
      </div>
      <div className="border-t border-white/8 p-3">
        <UploadDropzone compact />
      </div>
    </aside>
  );
}
