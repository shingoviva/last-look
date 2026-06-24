"use client";

import * as Slider from "@radix-ui/react-slider";
import { Check, Copy, Download, Info, LoaderCircle, PackageCheck, RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import type { PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { LOOKS, RATIOS } from "@/lib/constants";
import { downloadBlob, getExportSize, outputName, renderToBlob } from "@/lib/image-processing";
import { useI18n } from "@/lib/i18n";
import { analyzePostReadiness, createSafeFixPatch, createSafeFixResetPatch, type PostDiagnostic } from "@/lib/post-diagnostics";
import type { ImageItem, ImageSettings } from "@/lib/types";
import { useLastLook } from "@/store/use-last-look";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export function ControlPanel({ item }: { item: ImageItem }) {
  const panel = useLastLook((state) => state.mobilePanel);
  const sheetExpanded = useLastLook((state) => state.mobileSheetExpanded);
  const setSheetExpanded = useLastLook((state) => state.setMobileSheetExpanded);
  const t = useI18n();
  const dragStartY = useRef<number | null>(null);
  const dragHandled = useRef(false);
  const mobileTitles = {
    crop: t.panel.titles.crop,
    look: t.panel.titles.look,
    preview: t.panel.titles.preview,
    export: t.panel.titles.export,
  };
  const selectedCount = useLastLook((state) => state.images.filter((image) => image.exportEnabled).length);
  const mobileMeta = {
    crop: `${item.settings.ratio} · ${Math.round(item.settings.zoom * 100)}%`,
    look: item.settings.look === "none" ? t.looks.none.name : `${t.looks[item.settings.look].name} · ${item.settings.strength}`,
    preview: "Original · Safe · IG Shift",
    export: `${selectedCount} ${t.common.selected}`,
  };
  const onHandlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    dragStartY.current = event.clientY;
    dragHandled.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onHandlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragStartY.current === null) return;
    const delta = event.clientY - dragStartY.current;
    dragStartY.current = null;
    if (Math.abs(delta) < 20) return;
    dragHandled.current = true;
    setSheetExpanded(delta < 0);
    window.setTimeout(() => {
      dragHandled.current = false;
    }, 0);
  };
  return (
    <aside
      className={cn(
        "mobile-editor-sheet glass-panel scrollbar-none absolute inset-x-0 bottom-[54px] z-40 w-full border-white/8 transition-all duration-300 ease-out lg:static lg:h-full lg:max-h-none lg:w-[348px] lg:shrink-0 lg:overflow-y-auto lg:border-l",
        sheetExpanded
          ? "h-[24dvh] min-h-[176px] overflow-y-auto"
          : "h-[58px] min-h-[58px] overflow-hidden",
      )}
    >
      <div className="sticky top-0 z-20 border-b border-white/7 bg-[#101010]/78 px-4 pb-2 pt-1.5 backdrop-blur-2xl lg:hidden">
        <button
          type="button"
          aria-label={sheetExpanded ? "Hide controls and show the photo" : "Show controls"}
          aria-expanded={sheetExpanded}
          onPointerDown={onHandlePointerDown}
          onPointerUp={onHandlePointerUp}
          onClick={() => {
            if (dragHandled.current) return;
            setSheetExpanded(!sheetExpanded);
          }}
          className="mx-auto mb-2 flex h-5 w-28 touch-none items-center justify-center rounded-full text-white/45"
        >
          <span className="h-1 w-10 rounded-full bg-white/24" />
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow mb-1 hidden sm:block">{t.panel.hud}</p>
            <h2 className="text-[0.95rem] font-semibold tracking-[-.045em]">{mobileTitles[panel]}</h2>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[.08em] text-white/38">{mobileMeta[panel]}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {(["crop", "look", "preview", "export"] as const).map((step) => (
            <span
              key={step}
              className={cn("h-0.5 rounded-full", panel === step ? "bg-[#8fe9ff]" : "bg-white/12")}
            />
          ))}
        </div>
      </div>
      <div className="hidden px-5 pb-4 pt-6 lg:block">
        <p className="eyebrow">{t.panel.finalAdjustments}</p>
        <h2 className="mt-1 text-sm font-semibold tracking-[-.03em]">{t.panel.postReadyHud}</h2>
      </div>
      <div className={cn("space-y-1 px-4 pb-5 pt-1 lg:block lg:px-4 lg:pb-8 lg:pt-0", !sheetExpanded && "hidden")}>
        <section className={cn("control-card", panel !== "crop" && "hidden lg:block")}>
          <SectionHeading number="01" title={t.panel.sections.frame} mobileHidden />
          <RatioSelector item={item} />
          <div className="mt-5">
            <p className="control-label">{t.panel.fit}</p>
            <div className="segmented mt-2">
              {(["crop", "fit"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() =>
                    useLastLook.getState().updateSettings(item.id, {
                      fitMode: mode,
                      zoom: 1,
                      x: 0,
                      y: 0,
                    })
                  }
                  className={item.settings.fitMode === mode ? "active" : ""}
                >
                  {mode === "crop" ? t.panel.cropFill : t.panel.fitPad}
                </button>
              ))}
            </div>
          </div>
          {item.settings.fitMode === "fit" && (
            <div className="mt-4">
              <p className="control-label">{t.panel.padding}</p>
              <div className="mt-2 flex gap-2">
                {(["white", "black"] as const).map((color) => (
                  <button
                    key={color}
                    onClick={() => useLastLook.getState().updateSettings(item.id, { padding: color })}
                    className={cn(
                      "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border text-[11px] capitalize",
                      item.settings.padding === color ? "border-white/35 bg-white/8" : "border-white/8",
                    )}
                  >
                    <span className={cn("size-3 rounded-full border border-stone-500", color === "white" ? "bg-white" : "bg-black")} />
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-5 flex items-center gap-3">
            <span className="control-label w-10">{t.panel.zoom}</span>
            <Range
              value={item.settings.zoom}
              min={1}
              max={2.5}
              step={0.01}
              disabled={item.settings.fitMode === "fit"}
              onChange={(zoom) => useLastLook.getState().updateSettings(item.id, { zoom })}
            />
            <span className="w-9 text-right text-[10px] tabular-nums text-stone-500">
              {Math.round(item.settings.zoom * 100)}%
            </span>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => useLastLook.getState().resetCrop(item.id)}
            >
              <RotateCcw className="size-3" /> {t.panel.reset}
            </Button>
            <ApplyButton label={t.panel.ratioAll} keys={["ratio", "fitMode", "padding"]} />
          </div>
        </section>

        <section className={cn("control-card", panel !== "look" && "hidden lg:block")}>
          <SectionHeading number="02" title={t.panel.sections.look} mobileHidden />
          <div className="grid grid-cols-2 gap-2">
            {LOOKS.map((look) => (
              <button
                key={look.key}
                onClick={() => useLastLook.getState().updateSettings(item.id, { look: look.key })}
                className={cn(
                  "relative min-h-[96px] overflow-hidden rounded-[8px] border p-3 pt-5 text-left transition",
                  item.settings.look === look.key
                    ? lookActiveClass(look.key)
                    : "border-white/8 bg-white/[.02] hover:bg-white/[.05]",
                )}
              >
                <span className={cn("absolute inset-x-0 top-0 h-[3px]", lookBarClass(look.key))} />
                {item.settings.look === look.key && <Check className="absolute right-2.5 top-2.5 size-3" />}
                <span className="text-[11px] font-semibold tracking-[-.035em]">{t.looks[look.key].name}</span>
                <span className="mt-1.5 block text-[9px] leading-3.5 text-stone-500">{t.looks[look.key].note}</span>
              </button>
            ))}
          </div>
          <div className="mt-5">
            <div className="flex justify-between">
              <p className="control-label">{t.panel.strength}</p>
              <span className="text-[10px] tabular-nums text-stone-500">{item.settings.strength}</span>
            </div>
            <Range
              className="mt-3"
              value={item.settings.strength}
              min={0}
              max={100}
              step={1}
              onChange={(strength) => useLastLook.getState().updateSettings(item.id, { strength })}
            />
          </div>
          <ApplyButton className="mt-4 w-full" label={t.panel.lookAll} keys={["look", "strength"]} />
        </section>

        <section className={cn("control-card", panel !== "preview" && "hidden lg:block")}>
          <SectionHeading number="03" title={t.panel.sections.preview} mobileHidden />
          <PostDoctor item={item} />
          <CompareSelector />
          <div className="mt-4 flex gap-2 rounded-xl border border-[#8fe9ff]/14 bg-[#8fe9ff]/[.035] p-3 text-[9px] leading-4 text-white/48">
            <Info className="mt-0.5 size-3 shrink-0 text-[#8fe9ff]/70" />
            <span>
              {t.panel.previewOnly}
            </span>
          </div>
        </section>

        <section id="export-panel" className={cn("control-card", panel !== "export" && "hidden lg:block")}>
          <SectionHeading number="04" title={t.panel.sections.export} mobileHidden />
          <ExportActions item={item} />
        </section>
      </div>
    </aside>
  );
}

function PostDoctor({ item }: { item: ImageItem }) {
  const t = useI18n();
  const [diagnostic, setDiagnostic] = useState<PostDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      if (alive) setLoading(true);
      analyzePostReadiness(item)
        .then((next) => {
          if (alive) setDiagnostic(next);
        })
        .catch(() => {
          if (alive) setDiagnostic(null);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [item]);

  const score = diagnostic?.score ?? 0;
  const verdict = loading ? t.doctor.scan : diagnostic?.verdict ?? "Watch";
  const summary = loading
    ? t.doctor.scanning
    : item.settings.safeGuard
      ? t.doctor.fixedSummary
      : diagnostic?.verdict === "Ready"
        ? t.doctor.readySummary
        : diagnostic?.verdict === "Fix"
          ? t.doctor.fixSummary
          : t.doctor.watchSummary;
  const accent = diagnostic?.verdict === "Fix" ? "text-amber-300" : diagnostic?.verdict === "Watch" ? "text-[#d9a067]" : "text-[#8fe9ff]";

  return (
    <div className="mb-4 rounded-2xl border border-white/8 bg-black/20 p-3 shadow-[inset_0_1px_rgba(255,255,255,.045)]">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#8fe9ff]/18 bg-[#8fe9ff]/8 text-[#8fe9ff]">
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : <ScanRing score={score} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[.18em] text-[#8fe9ff]/58">{t.doctor.title}</p>
              <p className="mt-1 text-sm font-semibold tracking-[-.04em]">
                <span className={accent}>{verdict}</span>
                {!loading && <span className="ml-2 text-white/42">{score}/100</span>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {item.settings.safeGuard && (
                <span className="hidden rounded-md border border-[#8fe9ff]/18 bg-[#8fe9ff]/8 px-2 py-1 text-[8px] font-semibold text-[#8fe9ff]/85 sm:inline">
                  {t.common.safeFixOn}
                </span>
              )}
              <button
                onClick={() =>
                  useLastLook.getState().updateSettings(
                    item.id,
                    item.settings.safeGuard
                      ? createSafeFixResetPatch(item)
                      : createSafeFixPatch(item, diagnostic ?? undefined),
                  )
                }
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[10px] font-semibold transition",
                  item.settings.safeGuard
                    ? "border-white/12 bg-white/[.035] text-white/68 hover:border-[#8fe9ff]/28 hover:text-white"
                    : "border-white/10 bg-white text-black hover:bg-[#e5fbff]",
                )}
                title={item.settings.safeGuard ? t.common.safeFixReset : t.common.safeFix}
              >
                {item.settings.safeGuard ? <RotateCcw className="size-3.5" /> : <WandSparkles className="size-3.5" />}
                {item.settings.safeGuard ? t.common.safeFixReset : t.common.safeFix}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-4 text-white/45">
            {summary}
          </p>
        </div>
      </div>

      {diagnostic && (
        <>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {diagnostic.metrics.map((metric) => (
              <div
                key={metric.key}
                title={metric.note}
                className={cn(
                  "rounded-lg border px-2 py-2",
                  metric.level === "risk"
                    ? "border-amber-300/24 bg-amber-300/8"
                    : metric.level === "watch"
                      ? "border-[#d9a067]/22 bg-[#d9a067]/7"
                      : "border-white/7 bg-white/[.025]",
                )}
              >
                <p className="truncate text-[8px] text-white/42">{t.doctor.metrics[metric.key]}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px] font-semibold",
                    metric.level === "safe" ? "text-white/70" : metric.level === "watch" ? "text-[#d9a067]" : "text-amber-300",
                  )}
                >
                  {metric.level === "safe" ? t.common.safe : metric.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {diagnostic.metrics.filter((metric) => metric.level !== "safe").slice(0, 2).map((metric) => (
              <p key={metric.key} className="text-[9px] leading-4 text-white/43">
                <span className="mr-1 text-[#8fe9ff]/70">→</span>
                {t.doctor.suggestion[metric.key]}
              </p>
            ))}
            {diagnostic.metrics.every((metric) => metric.level === "safe") && (
              <p className="text-[9px] leading-4 text-white/43">
                <span className="mr-1 text-[#8fe9ff]/70">→</span>
                {item.settings.safeGuard ? t.doctor.suggestion.fixed : t.doctor.suggestion.safe}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ScanRing({ score }: { score: number }) {
  return (
    <span className="relative grid size-5 place-items-center rounded-full border border-[#8fe9ff]/25 text-[8px] font-semibold">
      {score}
      <span
        className="absolute inset-[-3px] rounded-full border border-[#8fe9ff]/45"
        style={{ clipPath: `polygon(50% 50%, 50% 0, ${score}% 0, 100% 100%, 0 100%, 0 0)` }}
      />
    </span>
  );
}

function SectionHeading({ number, title, mobileHidden = false }: { number: string; title: string; mobileHidden?: boolean }) {
  return (
    <div className={cn("mb-4 flex items-center gap-2", mobileHidden && "hidden lg:flex")}>
      <span className="font-mono text-[9px] text-[#8fe9ff]/48">{number}</span>
      <h3 className="text-xs font-semibold tracking-[-.025em]">{title}</h3>
    </div>
  );
}

function RatioSelector({ item }: { item: ImageItem }) {
  const t = useI18n();
  return (
    <div>
      <p className="control-label">{t.panel.ratio}</p>
      <div className="scrollbar-none mt-2 flex gap-2 overflow-x-auto lg:grid lg:grid-cols-3">
        {RATIOS.map((ratio) => (
          <button
            key={ratio.key}
            title={ratio.label}
            onClick={() =>
              useLastLook.getState().updateSettings(item.id, {
                ratio: ratio.key,
                zoom: 1,
                x: 0,
                y: 0,
              })
            }
            className={cn(
              "flex h-9 min-w-[78px] flex-col items-center justify-center rounded-[7px] border text-[10px] font-semibold transition lg:h-11 lg:min-w-0",
              item.settings.ratio === ratio.key
                ? "border-[#8fe9ff]/45 bg-[#8fe9ff]/10 text-white shadow-[0_0_24px_rgba(143,233,255,.08)]"
                : "border-white/8 text-stone-500 hover:border-white/16 hover:text-white",
            )}
          >
            <span>{ratio.short}</span>
            {ratio.key === "3:4" && <span className="text-[7px] uppercase tracking-widest text-[#8fe9ff]">{t.common.current}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function lookBarClass(look: ImageSettings["look"]) {
  if (look === "soft") return "bg-gradient-to-r from-[#9d7967] via-[#e4c7aa] to-[#8993a3]";
  if (look === "deep") return "bg-gradient-to-r from-[#101821] via-[#536a83] to-[#9ca7b3]";
  if (look === "night") return "bg-gradient-to-r from-[#0a4d62] via-[#132b3b] to-[#c07a36]";
  return "bg-gradient-to-r from-stone-700 via-stone-300 to-stone-700";
}

function lookActiveClass(look: ImageSettings["look"]) {
  if (look === "soft") return "border-[#d1a98f]/45 bg-[#9d7967]/10 shadow-[inset_0_1px_rgba(255,255,255,.08),0_0_28px_rgba(209,169,143,.07)]";
  if (look === "deep") return "border-[#7891ae]/45 bg-[#536a83]/10 shadow-[inset_0_1px_rgba(255,255,255,.08),0_0_28px_rgba(83,106,131,.08)]";
  if (look === "night") return "border-[#3a8ca5]/45 bg-[#0a4d62]/12 shadow-[inset_0_1px_rgba(255,255,255,.08),0_0_28px_rgba(58,140,165,.08)]";
  return "border-white/35 bg-white/9";
}

function Range({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Slider.Root
      value={[value]}
      onValueChange={([next]) => onChange(next)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn("relative flex h-5 flex-1 touch-none items-center select-none data-disabled:opacity-30", className)}
    >
      <Slider.Track className="relative h-px flex-1 bg-white/15">
        <Slider.Range className="absolute h-full bg-white" />
      </Slider.Track>
      <Slider.Thumb className="block size-3 rounded-full border-2 border-black bg-white shadow outline-none" />
    </Slider.Root>
  );
}

function ApplyButton({
  label,
  keys,
  className,
}: {
  label: string;
  keys: (keyof ImageSettings)[];
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("text-stone-500", className)}
      onClick={() => useLastLook.getState().applyToAll(keys)}
    >
      <Copy className="size-3" /> {label}
    </Button>
  );
}

function CompareSelector() {
  const { compare, setCompare } = useLastLook();
  const t = useI18n();
  return (
    <div className="segmented">
      {(["original", "edited", "shift"] as const).map((mode) => (
        <button key={mode} onClick={() => setCompare(mode)} className={compare === mode ? "active" : ""}>
          {mode === "shift" ? t.panel.compareShift : mode === "edited" ? t.common.safe : t.common.original}
        </button>
      ))}
    </div>
  );
}

function ExportActions({ item }: { item: ImageItem }) {
  const t = useI18n();
  const images = useLastLook((state) => state.images);
  const toggleExport = useLastLook((state) => state.toggleExport);
  const selected = images.filter((image) => image.exportEnabled);
  const [busy, setBusy] = useState<"current" | "selected" | null>(null);
  const [done, setDone] = useState(false);
  const [receipt, setReceipt] = useState<{ count: number; size: string; mode: string } | null>(null);

  async function current() {
    setBusy("current");
    setDone(false);
    setReceipt(null);
    try {
      const blob = await renderToBlob(item);
      downloadBlob(blob, outputName(item));
      const [width, height] = getExportSize(item);
      setReceipt({ count: 1, size: `${width}×${height}`, mode: item.settings.safeGuard ? t.common.safeFixOn : t.common.cleanSafe });
      setDone(true);
    } finally {
      setBusy(null);
    }
  }

  async function exportSelected() {
    if (selected.length === 0) return;
    setBusy("selected");
    setDone(false);
    setReceipt(null);
    try {
      if (selected.length === 1) {
        downloadBlob(await renderToBlob(selected[0]), outputName(selected[0]));
        const [width, height] = getExportSize(selected[0]);
        setReceipt({ count: 1, size: `${width}×${height}`, mode: selected[0].settings.safeGuard ? t.common.safeFixOn : t.common.cleanSafe });
        setDone(true);
        return;
      }
      const zip = new JSZip();
      for (let index = 0; index < selected.length; index += 1) {
        zip.file(outputName(selected[index], index), await renderToBlob(selected[index]));
      }
      downloadBlob(await zip.generateAsync({ type: "blob" }), "last-look-exports.zip");
      setReceipt({ count: selected.length, size: t.exportPanel.mixed, mode: selected.some((image) => image.settings.safeGuard) ? t.common.safeFixOn : t.common.cleanSafe });
      setDone(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[#8fe9ff]/18 bg-[linear-gradient(135deg,rgba(143,233,255,.12),rgba(255,255,255,.025))] p-3 shadow-[inset_0_1px_rgba(255,255,255,.08)]">
        <div className="grid size-10 place-items-center rounded-xl bg-white text-black shadow-[0_8px_24px_rgba(143,233,255,.16)]">
          <Sparkles className="size-4" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-medium">{t.exportPanel.title}</p>
          <p className="mt-0.5 text-[9px] text-stone-500">
            {item.settings.safeGuard ? t.exportPanel.fixedMeta : t.exportPanel.cleanMeta}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[9px] tabular-nums text-stone-300">
          {selected.length}/{images.length}
        </span>
      </div>
      <button
        onClick={() => toggleExport(item.id)}
        className="mb-3 flex w-full items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-[10px] text-stone-400 transition hover:border-white/15 hover:text-white"
      >
        <span>{t.exportPanel.includeCurrent}</span>
        <span
          className={cn(
            "grid size-5 place-items-center rounded-md border",
            item.exportEnabled ? "border-[#8fe9ff] bg-[#8fe9ff] text-black" : "border-white/20 text-transparent",
          )}
        >
          <Check className="size-3" />
        </span>
      </button>
      <Button
        className="export-primary h-14 w-full rounded-2xl text-sm"
        onClick={exportSelected}
        disabled={Boolean(busy) || selected.length === 0}
      >
        {busy === "selected" ? <LoaderCircle className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
        {t.exportPanel.exportSelected.replace("{count}", String(selected.length))}
      </Button>
      {receipt && (
        <div className="mt-3 rounded-xl border border-white/8 bg-white/[.025] p-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[8px] uppercase tracking-[.18em] text-[#8fe9ff]/58">{t.exportPanel.receipt}</p>
            <span className="text-[9px] text-white/42">
              {t.exportPanel.files.replace("{count}", String(receipt.count)).replace("{plural}", receipt.count > 1 ? "s" : "")}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
            <span className="rounded-lg bg-black/24 px-2 py-1.5 text-white/52">{receipt.size}</span>
            <span className="rounded-lg bg-black/24 px-2 py-1.5 text-white/52">{receipt.mode}</span>
          </div>
          <p className="mt-2 text-[9px] leading-4 text-white/38">{t.exportPanel.notBaked}</p>
        </div>
      )}
      {done && <p className="mt-3 text-center text-[10px] text-emerald-400">{t.exportPanel.ready}</p>}
      <Button variant="ghost" className="mt-2 w-full text-stone-500" onClick={current} disabled={Boolean(busy)}>
        {busy === "current" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
        {t.exportPanel.exportCurrent}
      </Button>
      <p className="mt-4 text-center text-[9px] leading-4 text-stone-600">
        {t.exportPanel.privacy}
      </p>
    </>
  );
}
