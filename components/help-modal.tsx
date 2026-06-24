"use client";

import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useI18n();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/62 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <div className="hud-panel max-h-[86dvh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5 shadow-[0_30px_100px_rgba(0,0,0,.62)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t.common.help}</p>
            <h2 className="sharp-title mt-3 text-3xl leading-none sm:text-5xl">{t.help.title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/48">{t.help.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.help.close}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.035] text-white/55 transition hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {t.help.points.map((point) => (
            <section key={point.title} className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <h3 className="text-sm font-semibold tracking-[-.03em]">{point.title}</h3>
              <p className="mt-2 text-xs leading-5 text-white/48">{point.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-5 rounded-2xl border border-[#8fe9ff]/14 bg-[#8fe9ff]/[.035] p-4 text-[11px] leading-5 text-white/50">
          {t.help.shortcuts}
        </p>
      </div>
    </div>
  );
}
