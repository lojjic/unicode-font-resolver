import type { FontObjectV2 } from "google-font-metadata";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function getNotoFonts() {
  // We get errors about require vs import if we try to just
  // `import {APIv2} from 'google-font-metadata'` like normal ... until I can
  // figure out why, I'll use this big hammer to load it manually.
  const fullJSON: FontObjectV2 = JSON.parse(readFileSync(
    resolve(__dirname, `../../../node_modules/google-font-metadata/data/google-fonts-v2.json`),
    { encoding: "utf8" }
  ));

  // Noto fonts we don't want to include for various reasons
  const excludedFonts = [
    "noto-color-emoji",
    "noto-sans-display",
    "noto-sans-devanagari", // covered in base noto-sans family (same is not true for noto-serif)
    "noto-sans-symbols-2", // redundant with noto-sans-symbols
    "noto-serif-display",
    "noto-kufi-arabic", // similar to sans for larger display
    "noto-nastaliq-urdu", // cursive arabic, same ranges, maybe urdu lang specific?
    "noto-rashi-hebrew", // semi-cursive serif
    "noto-sans-hk", // very similar to traditional chinese, no lang code?
    "noto-serif-hk", // very similar to traditional chinese, no lang code?
    "noto-sans-adlam-unjoined",
    "noto-sans-lao-looped",
  ];

  const notoFonts: FontObjectV2 = {};
  for (let fontName in fullJSON) {
    if (fontName.match(/^noto-/) && !excludedFonts.includes(fontName)) {
      notoFonts[fontName] = fullJSON[fontName];
    }
  }
  return notoFonts;
}
