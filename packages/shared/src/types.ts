export type BucketRange = [bucketStart: number, bucketEnd: number]
export type EncodedCoverage = string;
export type FontStyle = 'normal' | 'italic'
export type FontCategory = 'sans-serif' | 'serif' | 'monospace';
export type UnicodeRangesString = string;
export type FontWeight = number;

export type FontData = {
  id: string,
  ranges: UnicodeRangesString,
  typeforms: {
    [C in FontCategory]?: {
      [S in FontStyle]?: FontWeight[]
      // [S in FontStyle]?: {
      //   [weight: string]: typeof URL.prototype.href
      // }
    }
  }
}

export type BucketData = {
  [langFilter: string]: {
    [fontId: string]: EncodedCoverage
  }
}
