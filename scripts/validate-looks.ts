import { pixelLuma, transformLookPixel, type RgbPixel } from "../lib/look-engine.ts";
import type { LookKey } from "../lib/types.ts";

const samples: Record<string, RgbPixel> = {
  shadowNeutral: [0.12, 0.12, 0.12],
  midGray: [0.5, 0.5, 0.5],
  skin: [0.72, 0.52, 0.43],
  red: [0.8, 0.12, 0.1],
  warmHighlight: [0.9, 0.72, 0.5],
  blue: [0.12, 0.3, 0.65],
};
const looks: Exclude<LookKey, "none">[] = ["soft", "deep", "night"];
const outputs = Object.fromEntries(
  looks.map((look) => [
    look,
    Object.fromEntries(
      Object.entries(samples).map(([name, pixel]) => [name, transformLookPixel(pixel, look, 0.7)]),
    ),
  ]),
) as Record<Exclude<LookKey, "none">, Record<string, RgbPixel>>;
const strongOutputs = Object.fromEntries(
  looks.map((look) => [
    look,
    Object.fromEntries(
      Object.entries(samples).map(([name, pixel]) => [name, transformLookPixel(pixel, look, 1)]),
    ),
  ]),
) as Record<Exclude<LookKey, "none">, Record<string, RgbPixel>>;

function distance(a: RgbPixel, b: RgbPixel) {
  return Math.sqrt(a.reduce((sum, value, index) => sum + Math.pow(value - b[index], 2), 0));
}

function saturation([r, g, b]: RgbPixel) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function averageLookDistance(a: Exclude<LookKey, "none">, b: Exclude<LookKey, "none">) {
  return (
    Object.keys(samples).reduce((sum, name) => sum + distance(outputs[a][name], outputs[b][name]), 0) /
    Object.keys(samples).length
  );
}

function averageDistanceFromOriginal(look: Exclude<LookKey, "none">, output = outputs) {
  return (
    Object.keys(samples).reduce((sum, name) => sum + distance(output[look][name], samples[name]), 0) /
    Object.keys(samples).length
  );
}

const checks: [string, boolean, number | string][] = [
  [
    "Soft Classic opens neutral shadows",
    pixelLuma(outputs.soft.shadowNeutral) > pixelLuma(samples.shadowNeutral),
    pixelLuma(outputs.soft.shadowNeutral) - pixelLuma(samples.shadowNeutral),
  ],
  [
    "Deep Classic suppresses saturated blue",
    saturation(outputs.deep.blue) < saturation(samples.blue),
    saturation(outputs.deep.blue),
  ],
  [
    "Deep Classic cools neutral shadows",
    outputs.deep.shadowNeutral[2] - outputs.deep.shadowNeutral[0] > 0.015,
    outputs.deep.shadowNeutral[2] - outputs.deep.shadowNeutral[0],
  ],
  [
    "Night Black creates stronger teal shadow separation",
    outputs.night.shadowNeutral[2] - outputs.night.shadowNeutral[0] > 0.045,
    outputs.night.shadowNeutral[2] - outputs.night.shadowNeutral[0],
  ],
  [
    "Night Black retains warm highlight separation",
    outputs.night.warmHighlight[0] - outputs.night.warmHighlight[2] > 0.24,
    outputs.night.warmHighlight[0] - outputs.night.warmHighlight[2],
  ],
  [
    "Soft and Deep remain visibly distinct",
    averageLookDistance("soft", "deep") > 0.075,
    averageLookDistance("soft", "deep"),
  ],
  [
    "Deep and Night remain visibly distinct",
    averageLookDistance("deep", "night") > 0.045,
    averageLookDistance("deep", "night"),
  ],
  [
    "Slider high end becomes meaningfully more expressive",
    looks.every((look) => averageDistanceFromOriginal(look, strongOutputs) > averageDistanceFromOriginal(look) * 1.18),
    Math.min(...looks.map((look) => averageDistanceFromOriginal(look, strongOutputs) / averageDistanceFromOriginal(look))),
  ],
  [
    "Soft Classic keeps skin warmer than Deep Classic",
    outputs.soft.skin[0] - outputs.soft.skin[2] > outputs.deep.skin[0] - outputs.deep.skin[2],
    (outputs.soft.skin[0] - outputs.soft.skin[2]) - (outputs.deep.skin[0] - outputs.deep.skin[2]),
  ],
  [
    "Skin luminance remains protected in all looks",
    looks.every((look) => Math.abs(pixelLuma(outputs[look].skin) - pixelLuma(samples.skin)) < 0.065),
    Math.max(...looks.map((look) => Math.abs(pixelLuma(outputs[look].skin) - pixelLuma(samples.skin)))),
  ],
  [
    "Representative colors avoid hard clipping",
    looks.every((look) =>
      Object.values(outputs[look]).every((pixel) => pixel.every((channel) => channel > 0 && channel < 1)),
    ),
    "0 < channel < 1",
  ],
];

console.table(
  checks.map(([name, passed, value]) => ({
    check: name,
    passed,
    value: typeof value === "number" ? value.toFixed(4) : value,
  })),
);

if (checks.some(([, passed]) => !passed)) {
  process.exitCode = 1;
} else {
  console.log("All look-engine validation checks passed.");
}

const benchmarkStart = performance.now();
let benchmarkPixel: RgbPixel = [0.72, 0.52, 0.43];
for (let index = 0; index < 1080 * 1440; index += 1) {
  benchmarkPixel = transformLookPixel(benchmarkPixel, looks[index % looks.length], 0.7);
}
const benchmarkMs = performance.now() - benchmarkStart;
console.log(`1.56 MP look-engine benchmark: ${benchmarkMs.toFixed(1)} ms`);
if (benchmarkMs > 1800) {
  console.error("Look engine is too slow for the target mobile export budget.");
  process.exitCode = 1;
}
