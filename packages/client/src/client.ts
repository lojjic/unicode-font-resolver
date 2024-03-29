import {
  getBucketJsonPathForCodePoint,
  isCodePointInBucketCoverage,
  CodePointSet,
  FontData,
  BucketData,
  FontStyle,
  FontCategory,
  forEachCodePointInString,
  DataEnvelope,
} from "@unicode-font-resolver/shared";
import {version as dataVersion} from '@unicode-font-resolver/data/package.json';
import {version as schemaVersion} from '@unicode-font-resolver/data/schema-version.json'
import { detectLanguage } from "./detectLanguage";

let bucketDataCache: { [key: string]: BucketData } = {};
let fontMetaCache: { [key: string]: FontData } = {};
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
    lang = detectLanguage(textString),
    category = 'sans-serif',
    style = 'normal',
    weight = 400,
  }: ClientOptions = options;
  let dataUrl = (options.dataUrl || DEFAULT_DATA_URL).replace(/\/$/g, ""); // strip trailing slash

  const fontUrlIndices = new Map<string, number>()
  const fontIndices = new Uint8Array(textString.length)
  const woffUrlsCache: { [fontId: string]: string } = {};
  const langRegexResults: { [regex: string]: boolean } = {};

  const charResolutions = new Array<string>(textString.length);
  const requests = new Map<string, Promise<void>>()
  let loggedCustomDataFailure = false

  function loadJSON<T>(path: string): Promise<T> {
    let req = jsonCache.get(path) as Promise<T> | undefined
    if (!req) {
      req = fetch(dataUrl + '/' + path).then(response => {
        if (!response.ok) {
          throw new Error(response.statusText)
        }
        return response.json().then((json: DataEnvelope<T>) => {
          if (!Array.isArray(json) || json[0] !== schemaVersion) {
            throw new Error(`Incorrect schema version; need ${schemaVersion}, got ${json[0]}`)
          }
          return json[1];
        })
      }).catch((err) => {
        if (dataUrl !== DEFAULT_DATA_URL) {
          // Just log one failure per query
          if (!loggedCustomDataFailure) {
            console.error(`unicode-font-resolver: Failed loading from dataUrl "${dataUrl}", trying default CDN. ${err.message}`);
            loggedCustomDataFailure = true;
          }
          dataUrl = DEFAULT_DATA_URL;
          jsonCache.delete(path);
          return loadJSON<T>(path);
        }
        throw err;
      });
      jsonCache.set(path, req);
    }
    return req
  }

  // Resolve each character to a bucket, and load those bucket files
  for (let i = 0; i < textString.length; i++) {
    const codePoint = textString.codePointAt(i) as number;
    const bucketPath = getBucketJsonPathForCodePoint(codePoint);
    charResolutions[i] = bucketPath;
    if (!bucketDataCache[bucketPath] && !requests.has(bucketPath)) {
      requests.set(
        bucketPath,
        loadJSON<BucketData>(bucketPath).then(json => {
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

      // Check first for coverage in fonts matching the preferred lang
      let preferredLangRE: string | undefined;
      for (const langRE in bucket) {
        let langMatches = langRegexResults[langRE];
        if (langMatches === undefined) {
          langMatches = langRegexResults[langRE] = new RegExp(langRE).test(lang || 'en');
        }
        if (langMatches) {
          preferredLangRE = langRE;
          for (let fontName in bucket[langRE]) {
            if (isCodePointInBucketCoverage(codePoint, bucket[langRE][fontName])) {
              resolvedFontName = fontName;
              break;
            }
          }
          break;
        }
      }
      // If the lang hint didn't match any fonts, or those fonts didn't cover this
      // character, check the other languages. This is common in CJK.
      if (!resolvedFontName) {
        langLoop: for (const langRE in bucket) {
          if (langRE !== preferredLangRE) {
            for (let fontName in bucket[langRE]) {
              if (isCodePointInBucketCoverage(codePoint, bucket[langRE][fontName])) {
                resolvedFontName = fontName;
                break langLoop;
              }
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
          loadJSON<FontData>(`font-meta/${resolvedFontName}.json`).then(json => {
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

const jsonCache = new Map<string, Promise<any>>()

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
    for (let i = 0; i < candidates.length; i++) {
      if (Math.abs(candidates[i] - target) < Math.abs(nearest - target)) {
        nearest = candidates[i];
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
