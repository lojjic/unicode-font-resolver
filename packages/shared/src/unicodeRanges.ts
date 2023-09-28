export function parseUnicodeRangeString(rangesString: string): number[][] {
  return rangesString.replace(/U\+/gi, "")
    .replace(/^,+|,+$/g, "") // strip leading/trailing commas
    .split(/,+/) // allows double commas
    .map(rangeStr => rangeStr.split("-").map(s => parseInt(s.trim(), 16)));
}

function forEachRangeInString(str: string, cb: (start: number, end: number) => void) {
  parseUnicodeRangeString(str).forEach(([start, end = start]) => {
    cb(start, end);
  });
}

export function forEachCodePointInString(str: string, cb: (codePoint: number) => void) {
  forEachRangeInString(str, (start, end) => {
    for (let i = start; i <= end; i++) {
      cb(i);
    }
  });
}

export function serializeUnicodeRangeString(codePoints: number[]): string {
  const ranges = codePoints.sort((a, b) => a - b).reduce((out, cp) => {
    const prev = out[out.length - 1];
    if (!prev || cp !== prev[1] + 1) {
      out.push([cp, cp])
    } else {
      prev[1] = cp
    }
    return out;
  }, [] as number[][])

  return ranges.map(([from, to]) =>
    (from.toString(16) + (from === to ? '' : `-${to.toString(16)}`))
  ).join(',').toUpperCase();
}
