export function parseCssUnicodeRangeString(rangesString: string): number[][] {
  return rangesString.replace(/U\+/gi, "")
    .replace(/^,+|,+$/g, "") // strip leading/trailing commas
    .split(/,+/) // allows double commas
    .map(rangeStr => rangeStr.split("-").map(s => parseInt(s.trim(), 16)));
}

function forEachRangeInString(str: string, cb: (start: number, end: number) => void) {
  parseCssUnicodeRangeString(str).forEach(([start, end = start]) => {
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
