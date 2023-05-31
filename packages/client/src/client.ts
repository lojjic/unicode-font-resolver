import {
  getBucketJsonPathForCodePoint,
  isCodePointInBucketCoverage,
  CodePointSet,
  FontData,
  BucketData, FontStyle, FontCategory, forEachCodePointInString, FontWeight
} from "@unicode-font-resolver/shared";

import {version} from '../package.json';

let bucketDataCache: { [url: string]: BucketData } = {};
let fontInfoCache: { [url: string]: FontInfo } = {};
const codePointSets = new WeakMap();

export const DEFAULT_DATA_SANS_URL = `https://jsdelivr.com/npm/@unicode-font-resolver/data-sans@${version}`;
export const DEFAULT_DATA_SERIF_URL = `https://jsdelivr.com/npm/@unicode-font-resolver/data-serif@${version}`;


function codePointSetForFont(font: FontData) {
  let set = codePointSets.get(font);
  if (!set) {
    codePointSets.set(font, (set = CodePointSet.fromCssString(font.ranges)));
  }
  return set;
}

export type ClientOptions = {
  lang?: string;
  category?: FontCategory;
  style?: FontStyle;
  weight?: number;
  dataSansUrl?: string;
  dataSerifUrl?: string;
}

type Result = {
  fontUrls: string[],
  chars: Uint8Array
}
type FontInfo = {
  baseUrl: string,
  meta: FontData,
  woffUrl?: string,
};

export async function getFontsForString(
  string: string,
  options?: ClientOptions
): Promise<Result> {
  let { lang, category, style, weight, dataSansUrl, dataSerifUrl }: ClientOptions = Object.assign({
    lang: "en",
    category: "sans-serif",
    style: "normal",
    weight: 400,
    dataSansUrl: DEFAULT_DATA_SANS_URL,
    dataSerifUrl: DEFAULT_DATA_SERIF_URL,
  }, options);
  dataSansUrl = dataSansUrl.replace(/\/$/g, "");
  dataSerifUrl = dataSerifUrl.replace(/\/$/g, "");
  const dataUrls = category === 'serif' ? [dataSerifUrl, dataSansUrl] : [dataSansUrl]

  let prevFontInfo: FontInfo | null = null;
  const fontUrlIndices = new Map<string, number>()
  const chars = [];
  const woffUrlsCache: { [fontId: string]: string } = {};
  const langRegexResults: { [regex: string]: boolean } = {};
  for (let i = 0; i < string.length; i++) {
    const codePoint = string.codePointAt(i) as number;
    let fontInfo: FontInfo | null = null;

    // carry forward previous font if it matches or is whitespace
    // ideally this will usually be true
    if (prevFontInfo && (isWhitespace(codePoint) || codePointSetForFont(prevFontInfo.meta).has(codePoint))) {
      fontInfo = prevFontInfo;
    }

    if (!fontInfo) {
      let fontMetaUrl: string | null = null;
      let baseUrl = dataUrls[0];
      categoriesLoop: for (baseUrl of dataUrls) {
        const bucketUrl: string = `${baseUrl}/${getBucketJsonPathForCodePoint(codePoint)}`;
        const bucket: BucketData = bucketDataCache[bucketUrl] || (bucketDataCache[bucketUrl] = await loadJSON<BucketData>(bucketUrl));

        for (let langRE in bucket) {
          let langMatches = langRegexResults[langRE];
          if (langMatches === undefined) {
            langMatches = langRegexResults[langRE] = new RegExp(langRE).test(lang);
          }
          if (langMatches) {
            for (let fontName in bucket[langRE]) {
              const coverage = bucket[langRE][fontName];
              if (isCodePointInBucketCoverage(codePoint, coverage)) {
                fontMetaUrl = `${baseUrl}/font-meta/${fontName}.json`;
                break categoriesLoop;
              }
            }
          }
        }
      }

      // No coverage - fallback
      // TODO - Should we choose a fallback font here or just leave it empty for downstream handling?
      if (!fontMetaUrl) {
        console.debug(`No font coverage for U+${codePoint.toString(16)}`);
        fontMetaUrl = `${dataSansUrl}/font-meta/latin.json`;
      }

      fontInfo = fontInfoCache[fontMetaUrl] || (fontInfoCache[fontMetaUrl] = {
        baseUrl,
        meta: await loadJSON<FontData>(fontMetaUrl),
      });

      // sanity check - TODO remove
      if (!codePointSetForFont(fontInfo.meta).has(codePoint)) {
        throw new Error(`Resolved to font without coverage: U+${codePoint.toString(16)} -> ${fontInfo.meta.id}`);
      }

      prevFontInfo = fontInfo;
    }

    // Select a closest-match face and cache
    let {woffUrl} = fontInfo;
    if (!woffUrl) {
      const {typeforms} = fontInfo.meta;
      const validCategory = findValidKey(typeforms, category, 'sans-serif') as FontCategory;
      const validStyle = findValidKey(typeforms[validCategory]!, style, 'normal') as FontStyle;
      const validWeight = findNearestNumber(typeforms[validCategory]?.[validStyle] as number[], weight);
      woffUrl = fontInfo.woffUrl = `${fontInfo.baseUrl}/font-files/${fontInfo.meta.id}/${validCategory}.${validStyle}.${validWeight}.woff`
    }

    let fontIndex = fontUrlIndices.get(woffUrl)
    if (fontIndex == null) {
      fontIndex = fontUrlIndices.size
      fontUrlIndices.set(woffUrl, fontIndex);
    }
    chars.push(fontIndex);
    if (i > 0xffff) {
      chars.push(fontIndex);
      i++;
    }
  }
  return {
    fontUrls: Array.from(fontUrlIndices.keys()),
    chars: new Uint8Array(chars),
  }
}

export function clearCache() {
  bucketDataCache = {};
  fontInfoCache = {};
}

async function loadJSON<T>(path: string): Promise<T> {
  const response = await fetch(path);
  return await response.json() as T;
}

function firstKey(obj: Record<string, any>): string | undefined {
  for (const i in obj) return i;
}

function findValidKey(obj: Record<string, any>, preferredKey: string, fallbackKey: string) {
  return obj[preferredKey] ? preferredKey : obj[fallbackKey] ? fallbackKey : firstKey(obj);
}

function findNearestNumber(candidates: number[], target: number) {
  let nearest = target;
  if (!candidates.includes(nearest)) {
    nearest = Infinity;
    for (let n in candidates) {
      if (Math.abs(+n - target) < Math.abs(nearest - target)) {
        nearest = +n;
      }
    }
  }
  return nearest;
}

let whitespaceSet: Set<number>;
function isWhitespace(codePoint: number) {
  if (!whitespaceSet) {
    whitespaceSet = new Set();
    // Set of unicode chars with White_Space=yes
    forEachCodePointInString("9-D,20,85,A0,1680,2000-200A,2028-202F,205F,3000", cp => {
      whitespaceSet.add(cp);
    });
  }
  return whitespaceSet.has(codePoint);
}
