import {openSync} from 'fontkit'

export function parseCoverage(fontPath: string) {
  if (!/symbols/.test(fontPath)) return

  const { characterSet } = openSync(fontPath)
  const ranges = characterSet.sort((a, b) => a - b).reduce((out, cp) => {
    const prev = out[out.length - 1];
    if (!prev || cp !== prev[1] + 1) {
      out.push([cp, cp])
    } else {
      prev[1] = cp
    }
    return out;
  }, [] as number[][])

  console.log(fontPath, ranges.map(([from, to]) =>
    from.toString(16) + (from === to ? '' : `-${to.toString(16)}`)
  ).join(','))
}
