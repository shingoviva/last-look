"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, CircleHelp, Download, Languages, LockKeyhole } from "lucide-react";
import { useLastLook } from "@/store/use-last-look";
import { useI18n } from "@/lib/i18n";
import { UploadDropzone } from "./upload-dropzone";
import { ImageLibrary } from "./image-library";
import { PhonePreview } from "./phone-preview";
import { PreviewToolbar } from "./preview-toolbar";
import { ControlPanel } from "./control-panel";
import { MobileBar } from "./mobile-bar";
import { HelpModal } from "./help-modal";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { assetPath } from "@/lib/paths";

export function Workspace({ validationSet = false }: { validationSet?: boolean }) {
  const { images, selectedId, select, resetCrop, locale, setLocale } = useLastLook();
  const t = useI18n();
  const [helpOpen, setHelpOpen] = useState(false);
  const item = images.find((image) => image.id === selectedId) ?? images[0];
  const exportCount = images.filter((image) => image.exportEnabled).length;

  useEffect(() => {
    const saved = window.localStorage.getItem("last-look-locale");
    const nextLocale = saved === "en" || saved === "ja"
      ? saved
      : window.navigator.language.toLowerCase().startsWith("ja")
        ? "ja"
        : "en";
    if (nextLocale !== useLastLook.getState().locale) {
      useLastLook.getState().setLocale(nextLocale);
    }
  }, []);

  useEffect(() => {
    if (!validationSet || useLastLook.getState().images.length > 0) return;
    useLastLook.getState().setImages(
      [
        ["qa-day-portrait", "leica-validation-portrait-day.png"],
        ["qa-city", "leica-validation-city-day.png"],
        ["qa-night", "leica-validation-portrait-night.png"],
      ].map(([id, name]) => ({
        id,
        file: new File([], name, { type: "image/png" }),
        name,
        url: assetPath(`/qa/${name}`),
        width: 1086,
        height: 1448,
        exportEnabled: true,
        settings: { ...DEFAULT_SETTINGS },
      })),
    );
  }, [validationSet]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useLastLook.getState();
      if (!state.selectedId) return;
      const index = state.images.findIndex((image) => image.id === state.selectedId);
      if (event.key === "ArrowRight" && index < state.images.length - 1) select(state.images[index + 1].id);
      if (event.key === "ArrowLeft" && index > 0) select(state.images[index - 1].id);
      if (event.key.toLowerCase() === "r") resetCrop(state.selectedId);
      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        useLastLook.getState().setMobilePanel("export");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resetCrop, select]);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-transparent text-white">
      <header className="glass-panel relative z-40 flex h-[52px] shrink-0 items-center justify-between border-b border-white/7 px-4 shadow-[0_10px_40px_rgba(0,0,0,.18)] lg:h-[58px] lg:px-5">
        <div className="flex items-center gap-4">
          <Link href="/" className="grid size-8 place-items-center rounded-full text-white/35 transition hover:bg-white/5 hover:text-white">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="app-title-mark text-[10px] text-white/82">LAST LOOK</span>
          <span className="hidden h-4 w-px bg-white/10 sm:block" />
          <span className="hidden max-w-[240px] truncate text-[10px] text-white/32 sm:block">{item?.name ?? t.common.untitled}</span>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-white/38">
          <span className="hidden items-center gap-1.5 sm:flex"><LockKeyhole className="size-3" /> {t.common.localOnly}</span>
          {item && (
            <button
              onClick={() => {
                useLastLook.getState().setMobilePanel("export");
                requestAnimationFrame(() => document.querySelector("#export-panel")?.scrollIntoView({ behavior: "smooth" }));
              }}
              className="flex h-8 items-center gap-2 rounded-[6px] border border-[#8fe9ff]/24 bg-[#8fe9ff]/9 px-3 text-[#dffaff] shadow-[inset_0_1px_rgba(255,255,255,.07)] transition hover:border-[#8fe9ff]/50 hover:bg-[#8fe9ff]/14"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">{t.common.export}</span>
              <span className="rounded-[3px] bg-[#8fe9ff] px-1.5 py-0.5 font-semibold text-black">{exportCount}</span>
            </button>
          )}
          <button
            onClick={() => setLocale(locale === "en" ? "ja" : "en")}
            className="flex h-8 items-center gap-1.5 rounded-full border border-white/8 px-2.5 text-[9px] text-white/55 transition hover:bg-white/[.035] hover:text-white"
            aria-label="Switch language"
          >
            <Languages className="hidden size-3.5 sm:block" />
            {t.common.language}
          </button>
          <button
            onClick={() => setHelpOpen(true)}
            className="grid size-8 place-items-center rounded-full hover:bg-white/5"
            aria-label={t.common.help}
          >
            <CircleHelp className="size-4" />
          </button>
        </div>
      </header>

      {!item ? (
        <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-5 pb-10 pt-6 sm:py-12">
          <div className="w-full max-w-2xl">
            <div className="mb-7 text-left sm:text-center">
              <p className="eyebrow">{t.empty.eyebrow}</p>
              <h1 className="sharp-title mt-4 max-w-sm text-[2.95rem] leading-[.9] sm:mx-auto sm:max-w-none sm:text-6xl">
                {t.empty.title.split("\n").map((line, index) => (
                  <span key={line}>
                    {line}
                    {index === 0 && <br />}
                  </span>
                ))}
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-stone-500 sm:mx-auto">
                {t.empty.body}
              </p>
            </div>
            <UploadDropzone />
            <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[9px] uppercase tracking-widest text-stone-700">
              {t.empty.types.map((type) => <span key={type}>{type}</span>)}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
          <ImageLibrary />
          <section className="hairline-grid absolute inset-0 bottom-[68px] overflow-hidden lg:static lg:min-h-0 lg:flex-1 lg:border-b-0">
            <PreviewToolbar />
            <PhonePreview item={item} />
          </section>
          <ControlPanel item={item} />
          <MobileBar />
        </div>
      )}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
