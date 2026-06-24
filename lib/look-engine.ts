import type { LookKey } from "./types";

export type RgbPixel = readonly [number, number, number];

export function transformLookPixel(
  pixel: RgbPixel,
  look: LookKey,
  strength: number,
): RgbPixel {
  if (look === "none" || strength <= 0) return pixel;

  const [originalR, originalG, originalB] = pixel;
  const luma = pixelLuma(pixel);
  const max = Math.max(originalR, originalG, originalB);
  const min = Math.min(originalR, originalG, originalB);
  const saturation = max <= 0.00001 ? 0 : (max - min) / max;
  const hue = rgbHue(originalR, originalG, originalB, max, min);
  const skin = skinWeight(hue, saturation, luma);
  const amount = lookAmount(strength);

  const lookPixel =
    look === "soft"
      ? softClassic(pixel, hue, saturation, luma, skin)
      : look === "deep"
        ? deepClassic(pixel, hue, saturation, luma, skin)
        : nightBlack(pixel, hue, saturation, luma, skin);

  return [
    clamp01(mix(originalR, lookPixel[0], amount)),
    clamp01(mix(originalG, lookPixel[1], amount)),
    clamp01(mix(originalB, lookPixel[2], amount)),
  ];
}

export function pixelLuma([r, g, b]: RgbPixel) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function softClassic(
  pixel: RgbPixel,
  hue: number,
  saturation: number,
  luma: number,
  skin: number,
): RgbPixel {
  const shadow = Math.pow(1 - luma, 2.15);
  const mid = Math.sin(Math.PI * clamp01(luma));
  const highlight = Math.pow(luma, 3.2);
  const tone = filmTone(luma, {
    toe: 0.092,
    toePivot: 0.33,
    midContrast: -0.035,
    shoulder: 0.032,
    whiteSoftness: 0.018,
  });
  const toned = applyLuma(pixel, tone);
  let [r, g, b] = toned;

  const red = hueBell(hue, 0.01, 0.06) + hueBell(hue, 0.985, 0.035);
  const yellow = hueBell(hue, 0.12, 0.08);
  const green = hueBell(hue, 0.31, 0.12);
  const blue = hueBell(hue, 0.62, 0.13);
  const saturationScale =
    0.92 -
    green * 0.12 -
    blue * 0.07 -
    red * 0.035 +
    skin * 0.12 +
    yellow * 0.035;
  [r, g, b] = applySaturation([r, g, b], saturationScale);

  r += 0.038 * mid + 0.012 * yellow - 0.012 * green;
  g += 0.006 * mid + 0.01 * yellow - 0.004 * blue;
  b -= 0.032 * mid + 0.012 * yellow - 0.006 * shadow;

  // Preserve believable skin: warm but not orange, lifted but not waxy.
  if (skin > 0) {
    const skinTone = applyLuma(pixel, mix(luma, luma + 0.012, skin));
    r = mix(r, skinTone[0] + 0.014, skin * 0.58);
    g = mix(g, skinTone[1] + 0.004, skin * 0.42);
    b = mix(b, skinTone[2] - 0.008, skin * 0.52);
  }

  // Soft Classic should feel airy, not flat: keep a thin highlight glow.
  r += 0.012 * highlight;
  g += 0.006 * highlight;
  b += 0.002 * highlight;

  return softClip([r, g, b], saturation);
}

function deepClassic(
  pixel: RgbPixel,
  hue: number,
  saturation: number,
  luma: number,
  skin: number,
): RgbPixel {
  const shadow = Math.pow(1 - luma, 2.35);
  const lowerMid = Math.exp(-Math.pow((luma - 0.42) / 0.24, 2));
  const highlight = Math.pow(luma, 2.9);
  const tone = filmTone(luma, {
    toe: -0.045,
    toePivot: 0.24,
    midContrast: 0.145,
    shoulder: 0.055,
    whiteSoftness: 0.035,
  }) - 0.026 * lowerMid;
  let [r, g, b] = applyLuma(pixel, tone);

  const red = hueBell(hue, 0.0, 0.065) + hueBell(hue, 0.985, 0.04);
  const yellow = hueBell(hue, 0.13, 0.08);
  const green = hueBell(hue, 0.33, 0.13);
  const blue = hueBell(hue, 0.62, 0.14);
  const saturationScale = 0.75 - green * 0.16 - blue * 0.12 - red * 0.045 + yellow * 0.035 + skin * 0.12;
  [r, g, b] = applySaturation([r, g, b], saturationScale);

  // Dense Leica-like color: cool black point, slightly warm upper mids.
  r += -0.032 * shadow + 0.026 * highlight + 0.012 * yellow;
  g += 0.004 * shadow + 0.006 * highlight + 0.004 * yellow - 0.008 * green;
  b += 0.058 * shadow - 0.024 * highlight + 0.012 * blue;

  // Classic reds are rich but controlled, avoiding digital neon.
  if (red > 0.05) {
    const l = pixelLuma([r, g, b]);
    r = mix(r, l + (r - l) * 0.86, red * 0.6);
    g -= 0.006 * red;
  }

  if (skin > 0) {
    const protectedTone = applyLuma(pixel, mix(luma, luma - 0.006, 0.35));
    r = mix(r, protectedTone[0] + 0.006, skin * 0.58);
    g = mix(g, protectedTone[1], skin * 0.48);
    b = mix(b, protectedTone[2] - 0.008, skin * 0.5);
  }

  return softClip([r, g, b], saturation);
}

function nightBlack(
  pixel: RgbPixel,
  hue: number,
  saturation: number,
  luma: number,
  skin: number,
): RgbPixel {
  const shadow = Math.pow(1 - luma, 2.65);
  const deepShadow = Math.pow(1 - luma, 4.2);
  const mid = Math.sin(Math.PI * clamp01(luma));
  const highlight = Math.pow(luma, 3.35);
  const tone = filmTone(luma, {
    toe: -0.075,
    toePivot: 0.28,
    midContrast: 0.085,
    shoulder: 0.072,
    whiteSoftness: 0.048,
  }) - 0.022 * deepShadow;
  let [r, g, b] = applyLuma(pixel, tone);

  const red = hueBell(hue, 0.0, 0.07) + hueBell(hue, 0.985, 0.04);
  const yellow = hueBell(hue, 0.12, 0.09);
  const green = hueBell(hue, 0.34, 0.13);
  const blue = hueBell(hue, 0.62, 0.16);
  const saturationScale = 0.72 - green * 0.08 - blue * 0.06 + yellow * 0.08 + red * 0.03 + skin * 0.16;
  [r, g, b] = applySaturation([r, g, b], saturationScale);

  // Signature split: deep cyan/teal shadows and brass highlights.
  r += -0.072 * shadow + 0.092 * highlight + 0.014 * yellow;
  g += 0.044 * shadow + 0.034 * highlight + 0.01 * yellow;
  b += 0.104 * shadow - 0.078 * highlight + 0.014 * blue - 0.014 * yellow;

  // Blue/green night scenes should be moody, not radioactive.
  if (green + blue > 0.05) {
    const l = pixelLuma([r, g, b]);
    r = mix(r, l + (r - l) * 0.82, (green + blue) * 0.38);
    g = mix(g, l + (g - l) * 0.92, green * 0.3);
  }

  if (skin > 0) {
    const protectedTone = applyLuma(pixel, luma - 0.004 * mid);
    r = mix(r, protectedTone[0] + 0.01, skin * 0.7);
    g = mix(g, protectedTone[1] + 0.002, skin * 0.58);
    b = mix(b, protectedTone[2] - 0.014, skin * 0.66);
  }

  return softClip([r, g, b], saturation);
}

function lookAmount(strength: number) {
  // More expressive slider response: 70 feels clearly styled, 100 pushes just
  // beyond the designed target while soft clipping keeps it usable.
  const value = clamp01(strength);
  return Math.min(1.16, Math.pow(value, 0.78) * 1.12);
}

function filmTone(
  luma: number,
  {
    toe,
    toePivot,
    midContrast,
    shoulder,
    whiteSoftness,
  }: {
    toe: number;
    toePivot: number;
    midContrast: number;
    shoulder: number;
    whiteSoftness: number;
  },
) {
  const centered = luma - 0.5;
  const contrast = luma + centered * (midContrast * (1 - Math.abs(centered) * 1.25));
  const toeShape = Math.pow(clamp01(1 - luma / toePivot), 1.85);
  const shoulderShape = Math.pow(clamp01((luma - 0.72) / 0.28), 1.6);
  const whiteRoll = Math.pow(clamp01((luma - 0.88) / 0.12), 1.8);
  return clamp01(contrast + toe * toeShape - shoulder * shoulderShape - whiteSoftness * whiteRoll);
}

function applyLuma(pixel: RgbPixel, targetLuma: number): RgbPixel {
  const current = pixelLuma(pixel);
  if (current < 0.0001) return [targetLuma, targetLuma, targetLuma];
  const scale = targetLuma / current;
  return [pixel[0] * scale, pixel[1] * scale, pixel[2] * scale];
}

function applySaturation(pixel: RgbPixel, scale: number): RgbPixel {
  const luma = pixelLuma(pixel);
  return [
    luma + (pixel[0] - luma) * scale,
    luma + (pixel[1] - luma) * scale,
    luma + (pixel[2] - luma) * scale,
  ];
}

function softClip(pixel: RgbPixel, originalSaturation: number): RgbPixel {
  const shoulder = originalSaturation > 0.72 ? 0.985 : 0.992;
  return pixel.map((channel) => {
    if (channel < 0) return 0.002 + Math.tanh(channel * 0.9) * 0.002;
    if (channel > shoulder) {
      return shoulder + Math.tanh((channel - shoulder) * 2.1) * (1 - shoulder);
    }
    return channel;
  }) as unknown as RgbPixel;
}

function hueBell(hue: number, center: number, width: number) {
  const distance = circularHueDistance(hue, center);
  return Math.exp(-Math.pow(distance / width, 2));
}

function circularHueDistance(a: number, b: number) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 1 - diff);
}

function rgbHue(r: number, g: number, b: number, max: number, min: number) {
  const delta = max - min;
  if (delta < 0.00001) return 0;
  if (max === r) return (((g - b) / delta) % 6 + 6) % 6 / 6;
  if (max === g) return ((b - r) / delta + 2) / 6;
  return ((r - g) / delta + 4) / 6;
}

function skinWeight(hue: number, saturation: number, luma: number) {
  if (saturation < 0.08 || luma < 0.12 || luma > 0.92) return 0;
  const warmHue = hueBell(hue, 0.075, 0.072);
  const redHue = hueBell(hue, 0.018, 0.048);
  return clamp01(Math.max(warmHue, redHue * 0.72)) * clamp01((saturation - 0.08) / 0.23);
}

function mix(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
