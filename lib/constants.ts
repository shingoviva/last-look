import type { ImageSettings, LookKey, RatioKey } from "./types";

export const DEFAULT_SETTINGS: ImageSettings = {
  ratio: "3:4",
  fitMode: "crop",
  padding: "white",
  look: "none",
  strength: 70,
  safeGuard: false,
  zoom: 1,
  x: 0,
  y: 0,
};

export const RATIOS: { key: RatioKey; label: string; short: string; value?: number }[] = [
  { key: "3:4", label: "Current Instagram", short: "3:4", value: 3 / 4 },
  { key: "4:5", label: "Classic Portrait", short: "4:5", value: 4 / 5 },
  { key: "1:1", label: "Square", short: "1:1", value: 1 },
  { key: "1.91:1", label: "Landscape", short: "1.91:1", value: 1.91 },
  { key: "9:16", label: "Story", short: "9:16", value: 9 / 16 },
  { key: "original", label: "Original", short: "Original" },
];

export const LOOKS: { key: LookKey; name: string; note: string }[] = [
  { key: "none", name: "Original", note: "Clean and untouched" },
  { key: "soft", name: "Soft Classic", note: "Open shadows, natural skin" },
  { key: "deep", name: "Deep Classic", note: "Dense mids, cool restraint" },
  { key: "night", name: "Night Black", note: "Teal shadows, brass light" },
];

export function ratioValue(key: RatioKey, image?: { width: number; height: number }) {
  if (key === "original") return image ? image.width / image.height : 3 / 4;
  return RATIOS.find((ratio) => ratio.key === key)?.value ?? 3 / 4;
}

export const EXPORT_SIZES: Record<Exclude<RatioKey, "original">, [number, number]> = {
  "3:4": [1080, 1440],
  "4:5": [1080, 1350],
  "1:1": [1080, 1080],
  "1.91:1": [1080, 566],
  "9:16": [1080, 1920],
};
