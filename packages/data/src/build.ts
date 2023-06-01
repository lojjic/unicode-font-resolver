import { copyFileSync, existsSync, mkdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";

import * as download from "download";
import { getNotoFonts } from "./noto-fonts";
import {
  BucketData,
  FontCategory,
  FontData,
  FontStyle,
  forEachCodePointInString,
  parseCssUnicodeRangeString,
  BUCKET_SIZE,
  encodeBucketCoverage,
  getBucketForCodePoint,
  getBucketJsonPathForCodePoint,
  CodePointSet
} from "@unicode-font-resolver/shared";

export async function build(
  outputRootDir: string,
  cacheDir: string
) {
  const notoFonts = getNotoFonts();
  const indexOutputDir = `${outputRootDir}/codepoint-index`;
  const fontMetaOutputDir = `${outputRootDir}/font-meta`;
  const fontFilesOutputDir = `${outputRootDir}/font-files`;

  const bucketsData: { [bucket: string]: BucketData } = {};
  const fontMetaData: { [fontId: string]: FontData } = {};
  const fontsToDownload: Array<{ sourceUrl: string, localPath: string }> = [];

  const langFilters: Record<string, string> = {
    "noto-sc": "^(?!ja\\b|ko\\b|zh-Hant)",
    "noto-tc": "^zh-Hant$",
    "noto-jp": "^ja\\b",
    "noto-kr": "^ko\\b"
  };

  // Create empty objects for all buckets, we need a file for each so no 404s
  for (let i = 0; i < 0x10ffff; i += BUCKET_SIZE) {
    bucketsData[getBucketJsonPathForCodePoint(i)] = {};
  }

  // Index all the codepoints from the base noto-sans font; we'll treat these as
  // authoritative and exclude them as redundant from all other fonts
  const baseCodePoints = new CodePointSet();
  for (const range of [notoFonts["noto-sans"].unicodeRange.latin, notoFonts["noto-sans"].unicodeRange["latin-ext"]]) {
    forEachCodePointInString(range, cp => baseCodePoints.add(cp));
  }
  const allCodePoints = new CodePointSet();
  const codePointCounts: Array<{ font: string, count: number, cpsBytes: number }> = [];

  // Parse all fonts, adding them to appropriate buckets
  // let maxSubsetsInBucket = 0
  // let bucketStringLengths = new Map()
  // let maxBucketStringLength = 0
  for (let fontName in notoFonts) {
    const category: FontCategory = notoFonts[fontName].category as FontCategory; // sans vs serif

    for (let [subsetName, rangeString] of Object.entries<string>(notoFonts[fontName].unicodeRange)) {
      // Build a nice id for the subset, this will be the directory name
      const isBaseNoto = /^noto-(sans(-mono)?|serif)$/.test(fontName);
      let subsetId = fontName;
      if (subsetName !== fontName.replace(/noto-(sans|serif|naskh)-/, "")) {
        subsetId += "-" + subsetName.replace(/[\[\]]/g, "");
      }
      subsetId = subsetId.replace(/^noto-(sans(-mono)?|serif|naskh)?-?/, "");
      // const fontId = fontName.replace(/-(sans(-mono)?|serif|naskh)/, '')
      // let subsetId = fontId
      // if (subsetName !== fontName.replace(/noto-(sans|serif|naskh)-/, '')) {
      //   subsetId += '.' + subsetName.replace(/[\[\]]/g, '')
      // }

      // Drop purely redundant Latin subsets - this assumes that if they're using the Latin ranges
      // exactly as declared in the base Latin font, those chars are just being included for
      // redundancy and are not used within the font for ligatures/combined forms etc.
      // >>> Should verify this. <<<
      if (fontName !== "noto-sans" && fontName !== "noto-serif" && fontName !== "noto-sans-mono") {
        rangeString = rangeString
          .replace(notoFonts["noto-sans"].unicodeRange["latin"], "")
          .replace(notoFonts["noto-sans"].unicodeRange["latin-ext"], "")
          .replace(/^,|,$/g, "");
        if (!rangeString) continue;
      }
      if (!isBaseNoto && subsetName.startsWith("latin")) {
        continue;
      }

      // Build metadata for this font subset
      const meta = fontMetaData[subsetId] || (fontMetaData[subsetId] = {
        id: subsetId,
        ranges: rangeString.replace(/U\+/g, ""),
        typeforms: {}
      });
      if (rangeString.replace(/U\+/g, "") !== fontMetaData[subsetId].ranges) {
        console.warn(`WARN: Unicode range mismatch: ${fontName} -> ${subsetId}`);
        console.warn("A: " + rangeString.replace(/U\+/g, ""));
        console.warn("B: " + fontMetaData[subsetId].ranges);
      }
      if (meta.typeforms[category]) {
        console.warn(`WARN: Duplicate typeform category ${category}: ${fontName} -> ${subsetId}`);
      }
      const stylesObj = meta.typeforms[category] ??= {};
      notoFonts[fontName].styles.forEach((style: string) => {
        const weights: number[] = stylesObj[style as FontStyle] = [];
        notoFonts[fontName].weights.forEach((weight: number) => {
          const sourceUrl = notoFonts[fontName].variants[weight]?.[style]?.[subsetName]?.url?.woff;
          if (sourceUrl) {
            weights.push(weight);
            fontsToDownload.push({
              sourceUrl,
              localPath: `${fontFilesOutputDir}/${subsetId}/${category}.${style}.${weight}.woff`
            });
          }
        });
        // As object mapping weights to urls...
        // const weightsObj = stylesObj[style] ??= {}
        // json[fontName].weights.forEach((weight: number) => {
        //   const sourceUrl = json[fontName].variants[weight]?.[style]?.[subsetName]?.url?.woff
        //   if (sourceUrl) {
        //     const fileName = `${category}.${style}.${weight}.woff`
        //     weightsObj[weight] = sourceUrl
        //     fontsToDownload.push({
        //       sourceUrl,
        //       localPath: `${fontsOutputDir}/${subsetId}/${fileName}`,
        //     })
        //   }
        // })
      });

      let cpCount = 0;

      // Index the code points
      forEachCodePointInString(rangeString, codePoint => {
        // Dedupe, except for the base fonts. This should be safe because the indexes should only
        // be consulted for context-less characters, i.e. those that don't exist in the preceding
        // character's resolved font. Each font's unicodeRanges will still include dupes for that.
        // OOPS - we have to allow dupes across language variants, e.g. CJK
        // if (fontId !== 'noto' && allCodePoints.has(codePoint)) return;
        // allCodePoints.add(codePoint)
        if (!isBaseNoto && baseCodePoints.has(codePoint)) return;

        const bucketKey = getBucketJsonPathForCodePoint(codePoint);
        const bucketRange = getBucketForCodePoint(codePoint);
        const bucketObj = bucketsData[bucketKey] || (bucketsData[bucketKey] = {});
        const langRE = langFilters[fontName.replace(/-(sans|serif)/, "")] || ".*";
        const langObj = bucketObj[langRE] || (bucketObj[langRE] = {});
        if (!langObj[subsetId]) {
          langObj[subsetId] = encodeBucketCoverage(parseCssUnicodeRangeString(rangeString), bucketRange);
        }

        // maxSubsetsInBucket = Math.max(maxSubsetsInBucket, leaf.size)
        // bucketStringLengths.set(leaf, (bucketStringLengths.get(leaf) || 0) + rangeString.length)
        // maxBucketStringLength = Math.max(maxBucketStringLength, bucketStringLengths.get(leaf))
        allCodePoints.add(codePoint);
        cpCount++;
      });

      // if (cpCount > maxCodePoints.count) {
      //   maxCodePoints = {font: fontName, count: cpCount}
      // }
      codePointCounts.push({
        font: fontName,
        count: cpCount,
        cpsBytes: CodePointSet.fromCssString(rangeString).data.reduce((out, arr) => out + arr.byteLength, 0)
      });
    }
  }

  // Write out the files
  for (const dir of [fontMetaOutputDir, fontFilesOutputDir, indexOutputDir]) {
    if (existsSync(dir)) {
      rmdirSync(dir, { recursive: true });
    }
    mkdirSync(dir, { recursive: true });
  }
  for (let i = 0; i < 17; i++) {
    mkdirSync(`${indexOutputDir}/plane${i}`, { recursive: true });
  }
  for (let path in bucketsData) {
    writeFileSync(`${outputRootDir}/${path}`, stringify(bucketsData[path]));
  }
  for (let id in fontMetaData) {
    writeFileSync(`${fontMetaOutputDir}/${id}.json`, stringify(fontMetaData[id]));
    mkdirSync(`${fontFilesOutputDir}/${id}`, { recursive: true });
  }

  // Fetch all woffs
  for (const { sourceUrl, localPath } of fontsToDownload) {
    // Cache!
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    const cacheFile = sourceUrl.replace("https://fonts.gstatic.com/s/", "").replace(/\//g, "-");
    if (!existsSync(`${cacheDir}/${cacheFile}`)) {
      console.log(`Downloading ${sourceUrl}`);
      await download(sourceUrl, cacheDir, { filename: cacheFile });
    }
    copyFileSync(`${cacheDir}/${cacheFile}`, `${localPath}`);
  }

  // console.log(`Most subsets in a bucket: ${maxSubsetsInBucket}`)
  // console.log(`Longest range string in a bucket: ${maxBucketStringLength}`)

  // console.log(JSON.stringify(allCodePoints._data, (key, val) => val?.byteLength ? val.join(',') : val, 2))
  // console.log(`Full index ${allCodePoints._data.reduce((sum, arr) => sum + arr.byteLength, 0)} bytes`)
  console.log(codePointCounts
    .sort((a, b) => a.count - b.count)
    .map(({ font, count, cpsBytes }) => `${font}: ${count} -> ${cpsBytes}`)
    .join("\n")
  );

  // console.log(bucketsForCodePoint(0x1234))
  // console.log(bucketsForCodePoint(0x10234))
}

function stringify(data: any) {
  return JSON.stringify(data, null, 0);
}

build(".", "./.font-cache");

