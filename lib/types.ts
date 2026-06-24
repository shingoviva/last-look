export type RatioKey = "3:4" | "4:5" | "1:1" | "1.91:1" | "9:16" | "original";
export type FitMode = "crop" | "fit";
export type PaddingColor = "white" | "black";
export type LookKey = "none" | "soft" | "deep" | "night";
export type PreviewContext = "feed" | "grid" | "carousel" | "story";
export type CompareMode = "original" | "edited" | "shift";

export type SafeFixSnapshot = {
  strength: number;
  zoom: number;
};

export type ImageSettings = {
  ratio: RatioKey;
  fitMode: FitMode;
  padding: PaddingColor;
  look: LookKey;
  strength: number;
  safeGuard: boolean;
  safeFixSnapshot?: SafeFixSnapshot;
  zoom: number;
  x: number;
  y: number;
};

export type ImageItem = {
  id: string;
  file: File;
  name: string;
  url: string;
  width: number;
  height: number;
  exportEnabled: boolean;
  settings: ImageSettings;
};
