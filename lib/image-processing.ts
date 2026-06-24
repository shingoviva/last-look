import { EXPORT_SIZES, ratioValue } from "./constants";
import { transformLookPixel } from "./look-engine";
import type { CompareMode, ImageItem, LookKey } from "./types";

type RenderOptions = {
  width: number;
  height: number;
  compare?: CompareMode;
};

type Canvas2DContextOptions = CanvasRenderingContext2DSettings & {
  colorSpace?: "srgb" | "display-p3";
  colorType?: "unorm8" | "float16";
};

type DecodedCanvasSource = ImageBitmap | HTMLImageElement;

const instagramShiftCache = new Map<string, Promise<DecodedCanvasSource>>();
const SHIFT_CACHE_LIMIT = 12;

export function getSrgbContext(
  canvas: HTMLCanvasElement,
  options: { readFrequently?: boolean; alpha?: boolean } = {},
) {
  const attributes: Canvas2DContextOptions = {
    alpha: options.alpha ?? false,
    colorSpace: "srgb",
    colorType: "unorm8",
    willReadFrequently: options.readFrequently ?? false,
  };
  return (
    canvas.getContext("2d", attributes as CanvasRenderingContext2DSettings) ??
    canvas.getContext("2d", {
      alpha: options.alpha ?? false,
      willReadFrequently: options.readFrequently ?? false,
    })
  );
}

export function createSrgbCanvas(width: number, height: number, readFrequently = false) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = getSrgbContext(canvas, { readFrequently, alpha: false });
  if (!ctx) throw new Error("Canvas is unavailable.");
  return { canvas, ctx };
}

export async function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function blobToCanvasSource(blob: Blob): Promise<DecodedCanvasSource> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob, {
        colorSpaceConversion: "default",
        imageOrientation: "from-image",
        premultiplyAlpha: "default",
      });
    } catch {
      // Safari and older Chromium versions can reject one or more decode options.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image."))),
      type,
      quality,
    );
  });
}

function shiftCacheKey(item: ImageItem) {
  const settings = item.settings;
  return [
    "shift-v2",
    item.id,
    item.width,
    item.height,
    settings.ratio,
    settings.fitMode,
    settings.padding,
    settings.look,
    settings.strength,
    settings.safeGuard ? "guard" : "raw",
    settings.zoom.toFixed(3),
    settings.x.toFixed(3),
    settings.y.toFixed(3),
  ].join(":");
}

export function renderInstagramShiftSource(item: ImageItem) {
  const key = shiftCacheKey(item);
  const cached = instagramShiftCache.get(key);
  if (cached) return cached;

  const result = (async () => {
    // First encode represents LAST LOOK's upload-ready JPEG. The second encode
    // is the practical platform-side recompression simulation.
    const safeExport = await renderToBlob(item);
    const decodedExport = await blobToCanvasSource(safeExport);
    const [width, height] = getExportSize(item);
    const { canvas, ctx } = createSrgbCanvas(width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decodedExport, 0, 0, width, height);
    if (typeof ImageBitmap !== "undefined" && decodedExport instanceof ImageBitmap) decodedExport.close();
    const platformJpeg = await canvasToBlob(canvas, "image/jpeg", 0.82);
    return blobToCanvasSource(platformJpeg);
  })();

  instagramShiftCache.set(key, result);
  if (instagramShiftCache.size > SHIFT_CACHE_LIMIT) {
    const oldestKey = instagramShiftCache.keys().next().value;
    if (oldestKey) {
      instagramShiftCache.delete(oldestKey);
    }
  }
  result.catch(() => instagramShiftCache.delete(key));
  return result;
}

export function drawSourceCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  const sourceWidth =
    source instanceof HTMLImageElement ? source.naturalWidth : "width" in source ? Number(source.width) : width;
  const sourceHeight =
    source instanceof HTMLImageElement ? source.naturalHeight : "height" in source ? Number(source.height) : height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
}

export function drawProcessed(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  item: ImageItem,
  options: RenderOptions,
) {
  const { width, height, compare = "edited" } = options;
  const settings = item.settings;
  ctx.save();
  drawBaseImage(ctx, source, item, width, height);

  const activeLook = compare === "original" ? "none" : settings.look;
  const activeStrength = compare === "original" ? 0 : settings.strength;
  applyLookAndTexture(ctx, width, height, activeLook, activeStrength);
  if (compare !== "original" && settings.safeGuard) {
    applySafeGuard(ctx, width, height);
  }

  ctx.restore();
}

function drawBaseImage(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  item: ImageItem,
  width: number,
  height: number,
) {
  const settings = item.settings;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = settings.padding === "black" ? "#050505" : "#f5f4f0";
  ctx.fillRect(0, 0, width, height);

  const sourceWidth =
    source instanceof HTMLImageElement ? source.naturalWidth : "width" in source ? Number(source.width) : item.width;
  const sourceHeight =
    source instanceof HTMLImageElement ? source.naturalHeight : "height" in source ? Number(source.height) : item.height;
  const fillScale = Math.max(width / sourceWidth, height / sourceHeight);
  const fitScale = Math.min(width / sourceWidth, height / sourceHeight);
  const baseScale = settings.fitMode === "fit" ? fitScale : fillScale;
  const scale = baseScale * settings.zoom;
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  const maxX = Math.max(0, (drawnWidth - width) / 2);
  const maxY = Math.max(0, (drawnHeight - height) / 2);
  const offsetX = settings.fitMode === "fit" ? 0 : settings.x * maxX;
  const offsetY = settings.fitMode === "fit" ? 0 : settings.y * maxY;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    (width - drawnWidth) / 2 + offsetX,
    (height - drawnHeight) / 2 + offsetY,
    drawnWidth,
    drawnHeight,
  );
}

function applyLookAndTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  look: LookKey,
  strength: number,
) {
  if (look === "none" || strength <= 0) return;
  applyLookOnly(ctx, width, height, look, strength);
  applyGrain(ctx, width, height, look === "night" ? 0.055 : 0.025, strength / 100);
}

function applyLookOnly(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  look: LookKey,
  strength: number,
) {
  if (look === "none" || strength <= 0) return;
  applyLeicaLook(ctx, width, height, look, strength / 100);
}

function applySafeGuard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  for (let index = 0; index < data.length; index += 4) {
    const r0 = data[index] / 255;
    const g0 = data[index + 1] / 255;
    const b0 = data[index + 2] / 255;
    const luma = r0 * 0.2126 + g0 * 0.7152 + b0 * 0.0722;
    const max = Math.max(r0, g0, b0);
    const min = Math.min(r0, g0, b0);
    const saturation = max <= 0.0001 ? 0 : (max - min) / max;

    const shadowLift = 0.036 * Math.pow(1 - clamp01(luma / 0.34), 2.1);
    const highlightHold = 0.018 * Math.pow(clamp01((luma - 0.82) / 0.18), 1.8);
    const satTame = saturation > 0.62 ? 1 - Math.min(0.14, (saturation - 0.62) * 0.32) : 1;
    const targetLuma = clamp01(luma + shadowLift - highlightHold);

    const scale = luma > 0.0001 ? targetLuma / luma : 1;
    let r = r0 * scale;
    let g = g0 * scale;
    let b = b0 * scale;
    const adjustedLuma = r * 0.2126 + g * 0.7152 + b * 0.0722;
    r = adjustedLuma + (r - adjustedLuma) * satTame;
    g = adjustedLuma + (g - adjustedLuma) * satTame;
    b = adjustedLuma + (b - adjustedLuma) * satTame;

    data[index] = Math.round(clamp01(r) * 255);
    data[index + 1] = Math.round(clamp01(g) * 255);
    data[index + 2] = Math.round(clamp01(b) * 255);
  }
  ctx.putImageData(image, 0, 0);
}

function applyLeicaLook(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  look: LookKey,
  strength: number,
) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  for (let index = 0; index < data.length; index += 4) {
    const originalR = data[index] / 255;
    const originalG = data[index + 1] / 255;
    const originalB = data[index + 2] / 255;
    const [r, g, b] = transformLookPixel([originalR, originalG, originalB], look, strength);
    data[index] = Math.round(255 * r);
    data[index + 1] = Math.round(255 * g);
    data[index + 2] = Math.round(255 * b);
  }
  ctx.putImageData(image, 0, 0);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function applyGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
  strength: number,
) {
  const count = Math.floor((width * height) / 900);
  ctx.save();
  ctx.globalAlpha = amount * strength;
  for (let i = 0; i < count; i += 1) {
    const seed = Math.sin(i * 91.731 + width * 0.17 + height * 0.31) * 43758.5453;
    const random = seed - Math.floor(seed);
    const value = random > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgb(${value} ${value} ${value})`;
    const xSeed = Math.sin(i * 17.17 + 3.1) * 143758.41;
    const ySeed = Math.sin(i * 43.73 + 7.4) * 91357.17;
    const size = (random * 1.2 + 0.35);
    ctx.fillRect((xSeed - Math.floor(xSeed)) * width, (ySeed - Math.floor(ySeed)) * height, size, size);
  }
  ctx.restore();
}

export function getExportSize(item: ImageItem): [number, number] {
  if (item.settings.ratio !== "original") return EXPORT_SIZES[item.settings.ratio];
  const longEdge = Math.min(1920, Math.max(item.width, item.height));
  const ratio = ratioValue("original", item);
  return ratio >= 1
    ? [longEdge, Math.round(longEdge / ratio)]
    : [Math.round(longEdge * ratio), longEdge];
}

async function loadExportSource(item: ImageItem): Promise<DecodedCanvasSource> {
  if (item.file.size > 0 && typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(item.file, {
        colorSpaceConversion: "default",
        imageOrientation: "from-image",
        premultiplyAlpha: "default",
      });
    } catch {
      // Fall back to the browser-decoded object URL.
    }
  }
  return loadImage(item.url);
}

function progressiveDownsample(source: HTMLCanvasElement, width: number, height: number) {
  let current = source;
  while (current.width > width * 1.8 || current.height > height * 1.8) {
    const nextWidth = Math.max(width, Math.round(current.width / 2));
    const nextHeight = Math.max(height, Math.round(current.height / 2));
    const next = createSrgbCanvas(nextWidth, nextHeight);
    next.ctx.imageSmoothingEnabled = true;
    next.ctx.imageSmoothingQuality = "high";
    next.ctx.drawImage(current, 0, 0, nextWidth, nextHeight);
    current = next.canvas;
  }
  if (current.width === width && current.height === height) return current;
  const target = createSrgbCanvas(width, height, true);
  target.ctx.imageSmoothingEnabled = true;
  target.ctx.imageSmoothingQuality = "high";
  target.ctx.drawImage(current, 0, 0, width, height);
  return target.canvas;
}

function applyOutputSharpening(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount = 0.42,
  threshold = 2.2,
) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const length = width * height;
  const luma = new Float32Array(length);
  const horizontal = new Float32Array(length);

  for (let pixel = 0, index = 0; pixel < length; pixel += 1, index += 4) {
    luma[pixel] = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
  }
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const left = row + Math.max(0, x - 1);
      const center = row + x;
      const right = row + Math.min(width - 1, x + 1);
      horizontal[center] = (luma[left] + luma[center] * 2 + luma[right]) / 4;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const top = Math.max(0, y - 1) * width + x;
      const bottom = Math.min(height - 1, y + 1) * width + x;
      const blurred = (horizontal[top] + horizontal[pixel] * 2 + horizontal[bottom]) / 4;
      const detail = luma[pixel] - blurred;
      if (Math.abs(detail) < threshold) continue;

      const shadowGuard = clamp01((luma[pixel] - 12) / 42);
      const highlightGuard = 1 - clamp01((luma[pixel] - 218) / 34) * 0.65;
      const adjustment = detail * amount * shadowGuard * highlightGuard;
      const index = pixel * 4;
      data[index] = Math.round(Math.max(0, Math.min(255, data[index] + adjustment)));
      data[index + 1] = Math.round(Math.max(0, Math.min(255, data[index + 1] + adjustment)));
      data[index + 2] = Math.round(Math.max(0, Math.min(255, data[index + 2] + adjustment)));
    }
  }
  ctx.putImageData(image, 0, 0);
}

async function renderExportCanvas(item: ImageItem) {
  const [width, height] = getExportSize(item);
  const source = await loadExportSource(item);
  const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const canSupersample = sourceWidth >= width * 1.35 && sourceHeight >= height * 1.35;
  const factor = canSupersample ? 2 : 1;
  const base = createSrgbCanvas(width * factor, height * factor);
  drawBaseImage(base.ctx, source, item, base.canvas.width, base.canvas.height);
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();

  const canvas = progressiveDownsample(base.canvas, width, height);
  const ctx = getSrgbContext(canvas, { readFrequently: true, alpha: false });
  if (!ctx) throw new Error("Canvas is unavailable.");
  applyLookOnly(ctx, width, height, item.settings.look, item.settings.strength);
  if (item.settings.safeGuard) applySafeGuard(ctx, width, height);
  applyOutputSharpening(ctx, width, height);
  if (item.settings.look !== "none" && item.settings.strength > 0) {
    applyGrain(
      ctx,
      width,
      height,
      item.settings.look === "night" ? 0.055 : 0.025,
      item.settings.strength / 100,
    );
  }
  return canvas;
}

export async function renderToBlob(item: ImageItem) {
  const canvas = await renderExportCanvas(item);
  return canvasToBlob(canvas, "image/jpeg", 0.9);
}

export function outputName(item: ImageItem, index?: number) {
  const base = item.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-");
  return `${base || "image"}_lastlook${index === undefined ? "" : `_${String(index + 1).padStart(2, "0")}`}.jpg`;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
