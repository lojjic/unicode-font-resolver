import { parseCssUnicodeRangeString } from "./css";

export class CodePointSet {
  public min = Infinity
  public max = -Infinity
  public readonly data: Uint16Array[]

  private readonly leafMask: number
  private readonly topShift: number
  private readonly midLevels: number[]

  constructor (
    bitCounts = [4, 2, 2, 2, 3, 4]
    // bitCounts = [4, 2, 3, 4, 4]
  ) {
    this.leafMask = (1 << bitCounts[0]) - 1
    this.topShift = bitCounts.reduce((sum, n) => sum + n, 0)
    this.midLevels = bitCounts.slice(1).reverse()
    // console.log(this.topShift, this.midLevels, this.leafMask)
    this.data = [this.makeBranchArray(1 << (21 - this.topShift))]
  }

  static fromCssString(str: string): CodePointSet {
    const set = new CodePointSet()
    for (const [start, end = start] of parseCssUnicodeRangeString(str)) {
      for (let i = start; i <= end; i++) {
        set.add(i)
      }
    }
    return set
  }

  private makeBranchArray (size: number) {
    return new Uint16Array(size)
  }

  private makeLeafArray (size: number) {
    return new Uint16Array(size)
  }

  public add (start: number, end: number = start): void {
    for (let codepoint = start; codepoint <= end; codepoint++) {
      this.min = Math.min(this.min, codepoint)
      this.max = Math.max(this.min, codepoint)
      let dataIndex = 0
      let node = this.data[dataIndex]
      let shift = this.topShift
      let index = codepoint >> shift
      for (let i = 0; i < this.midLevels.length; i++) {
        const bits = this.midLevels[i]
        dataIndex = node[index]
        if (!dataIndex) {
          dataIndex = this.data.length
          node[index] = dataIndex
          this.data.push(i === this.midLevels.length - 1 ? this.makeLeafArray(1 << bits) : this.makeBranchArray(1 << bits))
        }
        node = this.data[dataIndex]
        shift -= bits
        index = (codepoint & (((1 << bits) - 1) << shift)) >> shift
      }
      node[index] = (node[index] || 0) | (1 << (codepoint & this.leafMask)) // leaf bits

      // plane -> 16 -> 16 -> 16 -> leaf16
      // let index = codepoint >> 16 // unicode plane
      // node = node[index] || (node[index] = this.makeArray(16))
      // index = (codepoint & (15 << 12)) >> 12
      // node = node[index] || (node[index] = this.makeArray(16))
      // index = (codepoint & (15 << 8)) >> 8
      // node = node[index] || (node[index] = this.makeArray(16))
      // index = (codepoint & (15 << 4)) >> 4
      // node[index] = (node[index] || 0) | (1 << (codepoint & 15)) // leaf bits

      // quarter-plane -> 16 -> 16 -> leaf64
      // let index = codepoint >> 14
      // node = node[index] || (node[index] = this.makeArray(16))
      // index = (codepoint & (15 << 10)) >> 10
      // node = node[index] || (node[index] = this.makeArray(16))
      // index = (codepoint & (15 << 6)) >> 6
      // node[index] = (node[index] || 0) | (1 << (codepoint & 63)) // leaf bits

      // 16th-plane -> 8 -> 8 -> leaf64
      // let index = codepoint >> 12
      // node = node[index] || (node[index] = this.makeArray(8))
      // index = (codepoint & (7 << 9)) >> 9
      // node = node[index] || (node[index] = this.makeArray(8))
      // index = (codepoint & (7 << 6)) >> 6
      // node[index] = (node[index] || 0) | (1 << (codepoint & 63)) // leaf bits

      // half-plane -> 32 -> 32 -> leaf32
      // let index = codepoint >> 15
      // node = node[index] || (node[index] = this.makeArray(32))
      // index = (codepoint & (31 << 10)) >> 10
      // node = node[index] || (node[index] = this.makeArray(32))
      // index = (codepoint & (31 << 5)) >> 5
      // node[index] = (node[index] || 0) | (1 << (codepoint & 31)) // leaf bits

      // plane -> 8 -> 8 -> 8 -> 8 -> leaf16
      // let index = codepoint >> 16
      // node = node[index] || (node[index] = this.makeArray(8))
      // index = (codepoint & (7 << 13)) >> 13
      // node = node[index] || (node[index] = this.makeArray(8))
      // index = (codepoint & (7 << 10)) >> 10
      // node = node[index] || (node[index] = this.makeArray(8))
      // index = (codepoint & (7 << 7)) >> 7
      // node = node[index] || (node[index] = this.makeArray(8))
      // index = (codepoint & (7 << 4)) >> 4
      // node[index] = (node[index] || 0) | (1 << (codepoint & 15)) // leaf bits
    }
  }

  public has (codePoint: number): boolean {
    let node = this.data[0]
    let shift = this.topShift
    let index = codePoint >> shift
    for (const bits of this.midLevels) {
      if (node[index] === 0) return false
      node = this.data[node[index]]
      shift -= bits
      index = (codePoint & (((1 << bits) - 1) << shift)) >> shift
    }
    return ((node[index] || 0) & (1 << (codePoint & this.leafMask))) !== 0
  }
}
