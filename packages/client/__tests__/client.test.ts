import 'jest'
import sampleText from "./__data__/_sample-text";
import { resolve } from "node:path";
import { clearCache, ClientOptions, getFontsForString } from "../src";
import { statSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { file as brotliSizeFromFile } from "brotli-size";
import { file as gzipSizeFromFile } from "gzip-size";
import { FontCategory } from "@unicode-font-resolver/shared";

const dataSansUrl = resolve(__dirname, "../../data-sans");
const dataSerifUrl = resolve(__dirname, "../../data-serif");

describe('Client', () => {

  let totalFiles: number;
  let totalBytesRaw: number;
  let totalBytesGzip: number;
  let totalBytesBrotli: number;
  let fontFiles: Set<string>;
  let fontBytes: number;

  beforeEach(() => {
    totalFiles = 0;
    totalBytesRaw = 0;
    totalBytesGzip = 0;
    totalBytesBrotli = 0;
    fontFiles = new Set();
    fontBytes = 0;

    // Suuuuper minimal fetch polyfill that loads from local filesystem and
    // tracks bytes loaded for stats
    // @ts-ignore
    globalThis.fetch = async function(url: string) {
      const text = await readFile(url, { encoding: "utf8" });
      totalFiles++;
      totalBytesRaw += (await stat(url)).size;
      totalBytesGzip += await gzipSizeFromFile(url);
      totalBytesBrotli += await brotliSizeFromFile(url);
      return {
        async json() {
          return JSON.parse(text);
        }
      };
    };
  });

  afterEach(() => {
    clearCache();
  });

  async function doQuery(text: string, opts: ClientOptions) {
    // console.time("query");
    const result = await getFontsForString(text, { dataSansUrl, dataSerifUrl, ...opts });
    // console.timeEnd("query");
    return {
      fontUrls: result.fontUrls.map(url =>
        url.replace(dataSansUrl, 'data-sans').replace(dataSerifUrl, 'data-serif')
      ),
      chars: result.chars,
    };
  }

  for (const category of ['sans-serif', 'serif'] as FontCategory[]) {
    for (const [name, text] of Object.entries(sampleText)) {
      test(`Query - ${name} = ${category}`, async () => {
        const result = await doQuery(text, {
          category,
          dataSansUrl,
          dataSerifUrl,
          lang: name === 'Japanese' ? 'ja' : undefined,
        });
        for (const f of result.fontUrls) {
          fontFiles.add(f);
          fontBytes += statSync(resolve(__dirname, '../../' + f)).size
          // same: fontBytes += await gzipSizeFromFile(dataUrl + f);
        }
        expect(new Set(result.chars).size).toEqual(result.fontUrls.length)
        expect(result.chars.length).toEqual(text.length);
        expect(result).toMatchSnapshot();

        console.log(`=== Metadata Loaded: ${name} ${category} ===\n`
          + `${totalFiles} files\n`
          + `${totalBytesRaw} bytes uncompressed\n`
          + `${totalBytesGzip} bytes gzipped\n`
          + `${totalBytesBrotli} bytes brotli\n`

          + `=== Fonts Loaded ===\n`
          + `${fontFiles.size} files\n`
          + `${fontBytes} bytes\n`
        );
      });
    }
  }

  // console.log([...new Set(fontIds)].join('\n'))
  // console.log(fontIds.map((id, i) => `${text.codePointAt(i).toString(16)} - ${id}`).join('\n'))

  // console.log(Object.keys(cache).join('\n'))


  // console.log(`${Object.keys(cache).length} metadata files loaded`)
  // console.log(`${[...new Set(fonts.map(f => f.id))].length} woff files loaded`)

  // console.log(`${totalBytesRaw} total bytes uncompressed`)
  // console.log(`${totalBytesGzip} total bytes gzipped`)
  // console.log(`${totalBytesBrotli} total bytes brotli`)
  // const gzippedSizes = await Promise.all(Object.values(cache).map(v => gzipSize(JSON.stringify(v))))
  // console.log(`${gzippedSizes.reduce((sum, n) => n + sum, 0)} gzipped metadata bytes loaded`)
  // const brotliSizes = Object.values(cache).map(v => brotliSize.sync(JSON.stringify(v)))
  // console.log(`${brotliSizes.reduce((sum, n) => n + sum, 0)} brotli metadata bytes loaded`)
  // console.log(`${Object.values(cache).reduce((sum, obj) => sum + JSON.stringify(obj).length, 0)} bytes loaded`)
});
