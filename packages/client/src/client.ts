import {
  getBucketJsonPathForCodePoint,
  isCodePointInBucketCoverage,
  CodePointSet,
  FontData,
  BucketData, FontStyle, FontCategory, forEachCodePointInString, FontWeight
} from "@unicode-font-resolver/shared";

import {version as dataVersion} from '@unicode-font-resolver/data/package.json';

let bucketDataCache: { [url: string]: BucketData } = {};
let fontMetaCache: { [url: string]: FontData } = {};
const codePointSets = new WeakMap();

const DEFAULT_DATA_URL = `https://cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver@v${dataVersion}/packages/data`


function codePointSetForFont(font: FontData) {
  let set = codePointSets.get(font);
  if (!set) {
    set = new CodePointSet()
    forEachCodePointInString(font.ranges, cp => set.add(cp))
    codePointSets.set(font, set);
  }
  return set;
}

export type ClientOptions = {
  lang?: string;
  category?: FontCategory;
  style?: FontStyle;
  weight?: number;
  dataUrl?: string;
}

type Result = {
  fontUrls: string[],
  chars: Uint8Array
}

export function getFontsForString(
  textString: string,
  options: ClientOptions = {}
): Promise<Result> {
  const {
    lang = 'en',
    category = 'sans-serif',
    style = 'normal',
    weight = 400,
  }: ClientOptions = options;
  const dataUrl = (options.dataUrl || DEFAULT_DATA_URL).replace(/\/$/g, ""); // strip trailing slash

  const fontUrlIndices = new Map<string, number>()
  const fontIndices = new Uint8Array(textString.length)
  const woffUrlsCache: { [fontId: string]: string } = {};
  const langRegexResults: { [regex: string]: boolean } = {};

  const charResolutions = new Array<string>(textString.length);
  const requests = new Map<string, Promise<void>>()

  // Resolve each character to a bucket, and load those bucket files
  for (let i = 0; i < textString.length; i++) {
    const codePoint = textString.codePointAt(i) as number;
    const bucketPath = getBucketJsonPathForCodePoint(codePoint);
    charResolutions[i] = bucketPath;
    if (!bucketDataCache[bucketPath] && !requests.has(bucketPath)) {
      requests.set(
        bucketPath,
        loadJSON<BucketData>(`${dataUrl}/${bucketPath}`).then(json => {
          bucketDataCache[bucketPath] = json;
        })
      );
    }
    if (codePoint > 0xffff) i++;
  }
  return Promise.all(requests.values()).then(() => {
    requests.clear();

    // Resolve each character to a font in that bucket, and load those font meta files
    for (let i = 0; i < textString.length; i++) {
      const codePoint = textString.codePointAt(i) as number;
      let resolvedFontName: string | null = null;
      const bucket: BucketData = bucketDataCache[charResolutions[i]];

      langLoop: for (let langRE in bucket) {
        let langMatches = langRegexResults[langRE];
        if (langMatches === undefined) {
          langMatches = langRegexResults[langRE] = new RegExp(langRE).test(lang);
        }
        if (langMatches) {
          for (let fontName in bucket[langRE]) {
            if (isCodePointInBucketCoverage(codePoint, bucket[langRE][fontName])) {
              resolvedFontName = fontName;
              break langLoop;
            }
          }
        }
      }

      // No coverage - fallback
      // TODO - Should we do this fallback or just leave it empty for downstream handling?
      if (!resolvedFontName) {
        console.debug(`No font coverage for U+${codePoint.toString(16)}`);
        resolvedFontName = 'latin';
      }

      charResolutions[i] = resolvedFontName;
      if (!fontMetaCache[resolvedFontName] && !requests.has(resolvedFontName)) {
        requests.set(
          resolvedFontName,
          loadJSON<FontData>(`${dataUrl}/font-meta/${resolvedFontName}.json`).then(json => {
            fontMetaCache[resolvedFontName!] = json;
          }),
        )
      }

      if (codePoint > 0xffff) i++;
    }
    return Promise.all(requests.values());
  }).then(() => {
    // Resolve each character to an individual woff file from that font
    let fontMeta: FontData | null = null;
    for (let i = 0; i < textString.length; i++) {
      const codePoint = textString.codePointAt(i) as number;

      // carry forward previous font if it matches or is whitespace
      // ideally this will usually be true
      if (fontMeta && (isWhitespace(codePoint) || codePointSetForFont(fontMeta).has(codePoint))) {
        fontIndices[i] = fontIndices[i - 1];
      } else {
        fontMeta = fontMetaCache[charResolutions[i]];
        // Select a closest-match face and cache
        let woffUrl = woffUrlsCache[fontMeta.id]
        if (!woffUrl) {
          const { typeforms } = fontMeta;
          const validCategory = findValidKey(typeforms, category, 'sans-serif') as FontCategory;
          const validStyle = findValidKey(typeforms[validCategory]!, style, 'normal') as FontStyle;
          const validWeight = findNearestNumber(typeforms[validCategory]?.[validStyle] as number[], weight);
          woffUrl = woffUrlsCache[fontMeta.id] = `${dataUrl}/font-files/${fontMeta.id}/${validCategory}.${validStyle}.${validWeight}.woff`
        }
        let fontIndex = fontUrlIndices.get(woffUrl)
        if (fontIndex == null) {
          fontIndex = fontUrlIndices.size
          fontUrlIndices.set(woffUrl, fontIndex);
        }
        fontIndices[i] = fontIndex;
      }
      if (codePoint > 0xffff) {
        i++;
        fontIndices[i] = fontIndices[i - 1];
      }
    }
    return {
      fontUrls: Array.from(fontUrlIndices.keys()),
      chars: fontIndices,
    }
  });
}

export function clearCache() {
  bucketDataCache = {};
  fontMetaCache = {};
}

function loadJSON<T>(path: string): Promise<T> {
  return fetch(path).then(response => response.json() as T);
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
