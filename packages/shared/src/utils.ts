import { BucketRange, EncodedCoverage } from "./types";

const BUCKET_BIT_SIZE = 7
export const BUCKET_SIZE = 2 ** BUCKET_BIT_SIZE
const BUCKET_POSITION_MASK = (1 << BUCKET_BIT_SIZE) - 1
const BUCKET_START_MASK = ~BUCKET_POSITION_MASK


export function getBucketStringForCodePoint (codePoint: number): string {
  const [floor, ceil] = getBucketForCodePoint(codePoint)
  const outputBase = 16
  return `${floor.toString(outputBase)}-${ceil.toString(outputBase)}`
}


export function getBucketForCodePoint (codePoint: number): BucketRange {
  const floor = codePoint & BUCKET_START_MASK
  const ceil = floor + (1 << BUCKET_BIT_SIZE) - 1
  return [floor, ceil]
}

export function getPlaneForCodePoint(codePoint: number): number {
  return (codePoint & 0xff0000) / 0x10000
}

export function getBucketJsonPathForCodePoint(codePoint: number): string {
  return `index/plane${getPlaneForCodePoint(codePoint)}/${getBucketStringForCodePoint(codePoint)}.json`
}

const COVERAGE_ENCODING_BITS_PER_CHAR = 6
const COVERAGE_ENCODING_START = 0x30

export function encodeBucketCoverage(ranges: number[][], [bucketStart, bucketEnd]: BucketRange): EncodedCoverage {
  const chars = new Uint8Array(Math.ceil(BUCKET_SIZE / COVERAGE_ENCODING_BITS_PER_CHAR))
  for (let [start, end = start] of ranges) {
    start = Math.max(start, bucketStart)
    end = Math.min(end, bucketEnd)
    for (let i = start; i <= end; i++) {
      const pos = i - bucketStart
      chars[(pos / COVERAGE_ENCODING_BITS_PER_CHAR) | 0] |= (1 << (pos % COVERAGE_ENCODING_BITS_PER_CHAR))
    }
  }
  return String.fromCodePoint.apply(null, Array.from(chars.map(n => n + COVERAGE_ENCODING_START)))
    .replace(new RegExp(`${String.fromCodePoint(COVERAGE_ENCODING_START)}+$`), '')
}

export function isCodePointInBucketCoverage(codePoint: number, coverageStr: EncodedCoverage): boolean {
  const pos = codePoint & BUCKET_POSITION_MASK
  let bits = coverageStr.codePointAt((pos / COVERAGE_ENCODING_BITS_PER_CHAR) | 0)
  bits = (bits || COVERAGE_ENCODING_START) - COVERAGE_ENCODING_START
  return (bits & (1 << (pos % COVERAGE_ENCODING_BITS_PER_CHAR))) !== 0
}

// TEST
// for (let i = 0; i < 0x10ffff; i++) {
//   const [start, end] = getBucketForCodePoint(i)
//   const str = encodeBucketCoverage([[i, i]], start, end)
//   // console.log(str)
//   // console.log(isCodePointInBucketCoverage(i, str, 0), isCodePointInBucketCoverage(i + 1, str, 0))
//   if (!isCodePointInBucketCoverage(i, str)) {
//     throw i + '-' + str
//   }
// }
// {
//   const codePoint = 0x4ef6
//   const [start, end] = getBucketForCodePoint(codePoint)
//   const ranges = parseCssUnicodeRangeString("3127-3129,3131,3134,3137,3139,3141-3142,3145,3147-3148,314b,314d-314e,315c,3160-3161,3163-3164,3186,318d,3192,3196-3198,319e-319f,3220-3229,3231,3268,3297,3299,32a3,338e-338f,3395,339c-339e,33c4,33d1-33d2,33d5,3434,34dc,34ee,353e,355d,3566,3575,3592,35a0-35a1,35ad,35ce,36a2,36ab,38a8,3dab,3de7,3deb,3e1a,3f1b,3f6d,4495,4723,48fa,4ca3,4e02,4e04-4e06,4e0c,4e0f,4e15,4e17,4e1f-4e21,4e26,4e29,4e2c,4e2f,4e31,4e35,4e37,4e3c,4e3f-4e42,4e44,4e46-4e47,4e57,4e5a-4e5c,4e64-4e65,4e67,4e69,4e6d,4e78,4e7f-4e82,4e85,4e87,4e8a,4e8d,4e93,4e96,4e98-4e99,4e9c,4e9e-4ea0,4ea2-4ea3,4ea5,4eb0-4eb1,4eb3-4eb6")
//   const str = encodeBucketCoverage(ranges, start, end)
//   console.log(str)
//   console.log(isCodePointInBucketCoverage(codePoint, str))
// }
