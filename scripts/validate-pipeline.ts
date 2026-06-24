import { readFile } from "node:fs/promises";
import { EXPORT_SIZES, DEFAULT_SETTINGS, ratioValue } from "../lib/constants.ts";

const expectedSizes = {
  "3:4": [1080, 1440],
  "4:5": [1080, 1350],
  "1:1": [1080, 1080],
  "1.91:1": [1080, 566],
  "9:16": [1080, 1920],
};

const imageProcessing = await readFile(new URL("../lib/image-processing.ts", import.meta.url), "utf8");
const uploadDropzone = await readFile(new URL("../components/upload-dropzone.tsx", import.meta.url), "utf8");
const controlPanel = await readFile(new URL("../components/control-panel.tsx", import.meta.url), "utf8");
const diagnostics = await readFile(new URL("../lib/post-diagnostics.ts", import.meta.url), "utf8");
const i18n = await readFile(new URL("../lib/i18n.ts", import.meta.url), "utf8");

const sharpenIndex = imageProcessing.indexOf("applyOutputSharpening(ctx");
const grainIndex = imageProcessing.indexOf("applyGrain(", sharpenIndex);
const checks: [string, boolean, string][] = [
  [
    "All platform export dimensions match the product contract",
    JSON.stringify(EXPORT_SIZES) === JSON.stringify(expectedSizes),
    JSON.stringify(EXPORT_SIZES),
  ],
  ["Default ratio is current Instagram 3:4", DEFAULT_SETTINGS.ratio === "3:4", DEFAULT_SETTINGS.ratio],
  ["Default look is Original", DEFAULT_SETTINGS.look === "none", DEFAULT_SETTINGS.look],
  ["Safe Fix is off by default", DEFAULT_SETTINGS.safeGuard === false, String(DEFAULT_SETTINGS.safeGuard)],
  ["3:4 ratio value is exact", ratioValue("3:4") === 0.75, String(ratioValue("3:4"))],
  [
    "New uploads are selected for export by default",
    uploadDropzone.includes("exportEnabled: true"),
    "exportEnabled: true",
  ],
  [
    "Working canvases request explicit sRGB",
    imageProcessing.includes('colorSpace: "srgb"') && imageProcessing.includes('colorType: "unorm8"'),
    "sRGB / unorm8",
  ],
  [
    "Wide-gamut decode uses browser color management",
    imageProcessing.includes('colorSpaceConversion: "default"'),
    "colorSpaceConversion: default",
  ],
  [
    "Instagram Shift performs a real second JPEG encode",
    imageProcessing.includes('canvasToBlob(canvas, "image/jpeg", 0.82)'),
    "JPEG quality 0.82",
  ],
  [
    "Safe export uses JPEG quality 0.90",
    imageProcessing.includes('canvasToBlob(canvas, "image/jpeg", 0.9)'),
    "JPEG quality 0.90",
  ],
  [
    "Progressive downsampling is active",
    imageProcessing.includes("function progressiveDownsample") && imageProcessing.includes("current.width / 2"),
    "multi-step half-size downsample",
  ],
  [
    "Output sharpening runs before final grain",
    sharpenIndex >= 0 && grainIndex > sharpenIndex,
    `${sharpenIndex} < ${grainIndex}`,
  ],
  [
    "Multi-image ZIP export is sequential to constrain memory",
    controlPanel.includes("for (let index = 0; index < selected.length; index += 1)") &&
      controlPanel.includes("await renderToBlob(selected[index])"),
    "sequential await",
  ],
  [
    "UI clarifies IG Shift is preview-only and never exported",
    controlPanel.includes("t.panel.previewOnly") &&
      i18n.includes("Preview only: IG Shift") &&
      i18n.includes("never applied to export") &&
      i18n.includes("Export never saves the degraded simulation") &&
      i18n.includes("IG劣化は確認専用です") &&
      i18n.includes("劣化シミュレーションは書き出しに保存されません"),
    "preview-only export disclosure present",
  ],
  [
    "Post Doctor scans crop, tone, color, and texture risk",
    diagnostics.includes("measureCropRisk") &&
      diagnostics.includes("shadow") &&
      diagnostics.includes("compression") &&
      i18n.includes("Post Doctor"),
    "diagnostic scan present",
  ],
  [
    "Safe Fix is a single toggle that affects clean export, not IG Shift",
    imageProcessing.includes("applySafeGuard") &&
      imageProcessing.includes("item.settings.safeGuard") &&
      controlPanel.includes("t.common.safeFix") &&
      i18n.includes("Safe Fix"),
    "safe guard export path present",
  ],
  [
    "Export receipt reminds users Shift is not baked into files",
    controlPanel.includes("t.exportPanel.notBaked") &&
      i18n.includes("Export receipt") &&
      i18n.includes("IG Shift preview was not baked into the exported file.") &&
      i18n.includes("IG Shiftプレビューは書き出し画像に焼き込まれていません"),
    "receipt disclosure present",
  ],
];

console.table(checks.map(([check, passed, value]) => ({ check, passed, value })));
if (checks.some(([, passed]) => !passed)) {
  process.exitCode = 1;
} else {
  console.log("All pipeline validation checks passed.");
}
