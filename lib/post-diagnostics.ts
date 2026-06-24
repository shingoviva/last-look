import { drawProcessed, getExportSize, getSrgbContext, loadImage } from "./image-processing";
import type { ImageItem, ImageSettings } from "./types";

export type RiskLevel = "safe" | "watch" | "risk";

export type DiagnosticMetric = {
  key: "crop" | "shadow" | "highlight" | "color" | "compression";
  label: string;
  value: number;
  level: RiskLevel;
  note: string;
};

export type PostDiagnostic = {
  score: number;
  verdict: string;
  summary: string;
  metrics: DiagnosticMetric[];
  suggestions: string[];
  exportSize: [number, number];
  safeFixRecommended: boolean;
};

type PixelStats = {
  shadow: number;
  highlight: number;
  saturation: number;
  compression: number;
  skin: number;
};

const ANALYSIS_WIDTH = 360;

export async function analyzePostReadiness(item: ImageItem): Promise<PostDiagnostic> {
  const [exportWidth, exportHeight] = getExportSize(item);
  const ratio = exportWidth / exportHeight;
  const width = ratio >= 1 ? ANALYSIS_WIDTH : Math.round(ANALYSIS_WIDTH * ratio);
  const height = ratio >= 1 ? Math.round(ANALYSIS_WIDTH / ratio) : ANALYSIS_WIDTH;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(96, width);
  canvas.height = Math.max(96, height);
  const ctx = getSrgbContext(canvas, { readFrequently: true, alpha: false });
  if (!ctx) throw new Error("Canvas is unavailable.");
  const image = await loadImage(item.url);
  drawProcessed(ctx, image, item, { width: canvas.width, height: canvas.height, compare: "edited" });

  const stats = measurePixels(ctx, canvas.width, canvas.height);
  const cropRisk = measureCropRisk(item, exportWidth / exportHeight);
  const metrics: DiagnosticMetric[] = [
    metric("crop", "Frame", cropRisk, "Crop loss", "Composition has hidden edge loss"),
    metric("shadow", "Shadow", stats.shadow, "Shadow detail is stable", "Dark tones may break after upload"),
    metric("highlight", "Highlight", stats.highlight, "Highlights are controlled", "Bright areas are close to clipping"),
    metric("color", "Color", Math.max(stats.saturation, stats.skin), "Color is upload-safe", "Saturation or skin tone needs protection"),
    metric("compression", "Texture", stats.compression, "Texture should survive", "Fine detail may show JPEG breakup"),
  ];
  const weightedRisk =
    cropRisk * 0.18 +
    stats.shadow * 0.24 +
    stats.highlight * 0.16 +
    Math.max(stats.saturation, stats.skin) * 0.18 +
    stats.compression * 0.24;
  const score = Math.max(0, Math.min(99, Math.round(100 - weightedRisk)));
  const suggestions = buildSuggestions(metrics, item);
  const risky = metrics.filter((item) => item.level === "risk").length;
  const watch = metrics.filter((item) => item.level === "watch").length;

  return {
    score,
    verdict: score >= 86 ? "Ready" : score >= 72 ? "Watch" : "Fix",
    summary:
      score >= 86
        ? "Looks resilient for posting. Safe Export can stay clean."
        : risky > 0
          ? "A few areas may degrade after upload. Safe Fix can protect them."
          : "Mostly safe, with minor upload-sensitive areas to watch.",
    metrics,
    suggestions,
    exportSize: [exportWidth, exportHeight],
    safeFixRecommended: risky > 0 || watch >= 2 || !item.settings.safeGuard,
  };
}

export function createSafeFixPatch(item: ImageItem, diagnostic?: PostDiagnostic): Partial<ImageSettings> {
  const compressionRisk = diagnostic?.metrics.find((metric) => metric.key === "compression")?.value ?? 0;
  const cropRisk = diagnostic?.metrics.find((metric) => metric.key === "crop")?.value ?? 0;
  const patch: Partial<ImageSettings> = {
    safeGuard: true,
    safeFixSnapshot: item.settings.safeFixSnapshot ?? {
      strength: item.settings.strength,
      zoom: item.settings.zoom,
    },
  };
  if ((item.settings.look === "deep" || item.settings.look === "night") && compressionRisk > 52) {
    patch.strength = Math.min(item.settings.strength, 62);
  }
  if (cropRisk > 58 && item.settings.zoom > 1.08) {
    patch.zoom = Math.max(1, item.settings.zoom - 0.12);
  }
  return patch;
}

export function createSafeFixResetPatch(item: ImageItem): Partial<ImageSettings> {
  return {
    safeGuard: false,
    safeFixSnapshot: undefined,
    ...(item.settings.safeFixSnapshot
      ? {
          strength: item.settings.safeFixSnapshot.strength,
          zoom: item.settings.safeFixSnapshot.zoom,
        }
      : {}),
  };
}

function metric(
  key: DiagnosticMetric["key"],
  label: string,
  value: number,
  safeNote: string,
  riskNote: string,
): DiagnosticMetric {
  const rounded = Math.round(value);
  return {
    key,
    label,
    value: rounded,
    level: rounded >= 62 ? "risk" : rounded >= 38 ? "watch" : "safe",
    note: rounded >= 38 ? riskNote : safeNote,
  };
}

function measurePixels(ctx: CanvasRenderingContext2D, width: number, height: number): PixelStats {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const total = width * height;
  let shadow = 0;
  let highlight = 0;
  let saturationRisk = 0;
  let skinRisk = 0;
  let edgeRisk = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index] / 255;
      const g = data[index + 1] / 255;
      const b = data[index + 2] / 255;
      const luma = lumaOf(r, g, b);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max <= 0.0001 ? 0 : (max - min) / max;
      const hue = hueOf(r, g, b, max, min);

      if (luma < 0.13) shadow += (0.13 - luma) / 0.13;
      if (luma > 0.92) highlight += (luma - 0.92) / 0.08;
      if (saturation > 0.68 && luma > 0.14) saturationRisk += Math.min(1, (saturation - 0.68) / 0.26);
      if (isSkinLike(hue, saturation, luma) && (luma < 0.26 || saturation > 0.48)) {
        skinRisk += Math.max(luma < 0.26 ? (0.26 - luma) / 0.26 : 0, saturation > 0.48 ? (saturation - 0.48) / 0.28 : 0);
      }

      if (x > 0 && y > 0) {
        const left = ((y * width + x - 1) * 4);
        const top = (((y - 1) * width + x) * 4);
        const leftLuma = lumaOf(data[left] / 255, data[left + 1] / 255, data[left + 2] / 255);
        const topLuma = lumaOf(data[top] / 255, data[top + 1] / 255, data[top + 2] / 255);
        const edge = Math.abs(luma - leftLuma) + Math.abs(luma - topLuma);
        if (edge > 0.09) edgeRisk += Math.min(1, edge * 2.8) * (luma < 0.38 ? 1.15 : 0.72);
      }
    }
  }

  return {
    shadow: normalizeRisk(shadow / total, 0.12),
    highlight: normalizeRisk(highlight / total, 0.075),
    saturation: normalizeRisk(saturationRisk / total, 0.09),
    skin: normalizeRisk(skinRisk / Math.max(1, total * 0.18), 0.28),
    compression: normalizeRisk(edgeRisk / total, 0.16),
  };
}

function measureCropRisk(item: ImageItem, outputRatio: number) {
  if (item.settings.fitMode === "fit") return 8;
  const sourceRatio = item.width / item.height;
  const hiddenByRatio = sourceRatio > outputRatio
    ? 1 - outputRatio / sourceRatio
    : 1 - sourceRatio / outputRatio;
  const zoomLoss = 1 - 1 / Math.max(1, item.settings.zoom ** 2);
  return Math.min(100, Math.max(0, (hiddenByRatio * 82 + zoomLoss * 58)));
}

function buildSuggestions(metrics: DiagnosticMetric[], item: ImageItem) {
  const active = [...metrics].sort((a, b) => b.value - a.value).filter((metric) => metric.level !== "safe");
  if (active.length === 0) {
    return item.settings.safeGuard
      ? ["Safe Fix is already protecting fragile tones."]
      : ["Optional: apply Safe Fix for a subtle upload-safety pass."];
  }
  return active.slice(0, 2).map((metric) => {
    if (metric.key === "shadow") return "Lift fragile shadows with Safe Fix before export.";
    if (metric.key === "compression") return "Check IG Shift around hair, fabric, and dark texture.";
    if (metric.key === "crop") return "Review the crop edge or switch to Fit + pad for full-frame delivery.";
    if (metric.key === "highlight") return "Safe Fix will hold bright areas before sharpening.";
    return "Safe Fix will tame saturated color without changing the selected look.";
  });
}

function normalizeRisk(value: number, ceiling: number) {
  return Math.min(100, Math.max(0, (value / ceiling) * 100));
}

function lumaOf(r: number, g: number, b: number) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function hueOf(r: number, g: number, b: number, max: number, min: number) {
  const delta = max - min;
  if (delta < 0.00001) return 0;
  if (max === r) return (((g - b) / delta) % 6 + 6) % 6 / 6;
  if (max === g) return ((b - r) / delta + 2) / 6;
  return ((r - g) / delta + 4) / 6;
}

function isSkinLike(hue: number, saturation: number, luma: number) {
  return hue > 0.015 && hue < 0.14 && saturation > 0.12 && saturation < 0.72 && luma > 0.16 && luma < 0.88;
}
