// === Various experiments in CodePointSet implementations ===
// Aspects to compare/balance:
// - Insertion speed
// - Query speed
// - Size in memory
// - Serialization size
// - Implementation code simplicity

import { ICodePointSet } from "../CodePointSet";


/*
Build: 0.013251333964576603
Query: 0.652602325533038

Simplest for sure. Likely not the smallest in memory.
 */
export class MapCodePointSet implements ICodePointSet {
  private buckets = new Map<number, number>();

  public add(codePoint: number): void {
    const bucket = codePoint >> 5;
    this.buckets.set(bucket, (this.buckets.get(bucket) || 0) | (1 << (codePoint & 31)));
  }

  public has(codePoint: number): boolean {
    const bitset = this.buckets.get(codePoint >> 5);
    return bitset !== undefined && (bitset & (1 << (codePoint & 31))) !== 0;
  }

  public serialize(): string {
    const entries: string[] = [];
    this.buckets.forEach((val, key) => {
      entries.push(`${(+key).toString(36)}:${val.toString(36)}`);
    });
    return entries.join(",");
  }

  public deserialize(str: string): void {
    this.buckets.clear();
    str.split(",").forEach(entry => {
      const parts = entry.split(":");
      this.buckets.set(parseInt(parts[0], 36), parseInt(parts[1], 36));
    });
  }
}


/*
fast but not so memory efficient?
Build: 0.011851814677039411
Query: 0.3970560379488817
 */
export class BackwardCodePointSet implements ICodePointSet {
  public readonly data: number[][] = [];

  add(codePoint: number): void {
    const bin = this.data[codePoint & 0b11111] || (this.data[codePoint & 0b11111] = []);
    bin.push(codePoint >> 5);
  }

  has(codePoint: number): boolean {
    const bin = this.data[codePoint & 0b11111];
    return bin && bin.includes(codePoint >> 5);
  }

  serialize(): string {
    throw new Error("Method not implemented.");
  }

  deserialize(s: string): void {
    throw new Error("Method not implemented.");
  }
}

/*
super slow!
Build: 0.1449024478594462
Query: 42.094492063901136
 */
export class BinarySearchCodePointSet implements ICodePointSet {
  public data: Array<[number, number]> = []; // Like Map<bucket,bitset>.entries

  public add(codePoint: number): void {
    const bucketIndex = this.findBucketIndex(codePoint >> 5);
    let bucket = this.data[bucketIndex];
    if (!bucket || bucket[0] !== (codePoint >> 5)) {
      bucket = [codePoint >> 5, 0];
      this.data.splice(bucketIndex, 0, bucket);
    }
    bucket[1] |= (1 << (codePoint & 31));
  }

  private findBucketIndex(bucket: number) {
    const { data } = this;
    let left = 0;
    let right = data.length - 1;
    if (right < 0) return 0;
    while (left < right) {
      const mid = Math.floor((right + left) / 2);
      if (data[mid][0] < bucket) {
        left = mid + 1;
      } else if (data[mid][0] > bucket) {
        right = mid - 1;
      } else {
        return mid;
      }
    }
    return data[left][0] >= bucket ? left : left + 1;
  }

  public has(codePoint: number): boolean {
    const bucketIndex = this.findBucketIndex(codePoint >> 5);
    if (bucketIndex < this.data.length) {
      const bucket = this.data[bucketIndex];
      return bucket[0] === (codePoint >> 5) && (bucket[1] & (1 << (codePoint & 31))) !== 0;
    }
    return false;
  }

  serialize(): string {
    throw new Error("Method not implemented.");
  }

  deserialize(s: string): void {
    throw new Error("Method not implemented.");
  }
}

/*
Build: 0.01562800752782376
Query: 0.34642758621976383

This performs well, but isn't particulary compact due to a lot of sparse branch arrays.
 */
class FiveBitCodePointSet implements ICodePointSet {
  public readonly data: Array<Int32Array | Uint8Array> = [new Uint8Array(32)];

  add(codePoint: number): void {
    const { data } = this;
    let node = data[0];
    let index = node[codePoint >> 15] || (node[codePoint >> 15] = data.length);
    node = data[index] || (data[index] = new Uint8Array(32));
    index = node[(codePoint >> 10) & 31] || (node[(codePoint >> 10) & 31] = data.length);
    node = data[index] || (data[index] = new Int32Array(32));
    node[(codePoint >> 5) & 31] |= (1 << (codePoint & 31));
  }

  has(codePoint: number): boolean {
    const { data } = this;
    let node = data[0];
    let index = node[codePoint >> 15];
    if (!index) return false;
    node = data[index];
    index = node[(codePoint >> 10) & 31];
    if (!index) return false;
    node = data[index];
    return (node[(codePoint >> 5) & 31] & (1 << (codePoint & 31))) !== 0;
  }

  serialize(): string {
    return JSON.stringify(this.data, (key, value) => {
      return value.byteLength ? [...value] : value;
    });
  }

  deserialize(s: string): void {
    throw new Error("Method not implemented.");
  }
}

/*
Too much looping
Build: 0.03160906450770726
Query: 0.711208278330687
*/
class BeerBrainCodePointSet implements ICodePointSet {
  // Array of int32s
  // Each number either encodes a leaf bitset, or two indices of the next nodes in the binary tree
  private data = new Int32Array(16);
  private size = 0;

  public add(codePoint: number): void {
    let { data } = this;
    let index = 0;
    let bitMask = 1 << 20;
    do {
      let nextIndex = (codePoint & bitMask) ? (data[index] >> 16) : (data[index] & 0xffff);
      if (nextIndex === 0) {
        nextIndex = ++this.size;
        if (nextIndex >= data.length) {
          data = new Int32Array(data.length + 16);
          data.set(this.data);
          this.data = data;
        }
        data[index] |= (codePoint & bitMask) ? (nextIndex << 16) : nextIndex;
        data[nextIndex] = 0;
      }
      index = nextIndex;
      bitMask >>= 1;
    } while (bitMask > 31);
    data[index] |= (1 << (codePoint & 31));
  }

  has(codePoint: number): boolean {
    const { data } = this;
    let index = 0;
    let bitMask = 1 << 20;
    do {
      index = (codePoint & bitMask) ? (data[index] >> 16) : (data[index] & 0xffff);
      if (index === 0 || index >= data.length) return false;
      bitMask >>= 1;
    } while (bitMask > 31);
    return (data[index] & (1 << (codePoint & 31))) !== 0;
  }

  serialize(): string {
    return [...this.data].map(n => n.toString(16)).join(",");
  }

  deserialize(s: string): void {
    throw new Error("Method not implemented.");
  }
}

/*
Build: 0.010087010087996628
Query: 0.3514328526559277
 */
class HashTableCodePointSet implements ICodePointSet {
  private entryCapacity = 0;
  private entryCount = 0;
  private bucketMask = 0;
  public data!: Int32Array; // [...buckets, ...[key, value, nextEntry]]

  constructor(count = 16) {
    this.resize(count);
  }

  public add(codePoint: number): void {
    this.insert(codePoint >> 5, 1 << (codePoint & 31));
  }

  private insert(key: number, bitset: number) {
    let { data, bucketMask } = this;
    const bucket = key & bucketMask;
    let entryIndex = data[bucket];
    while (entryIndex !== 0 && data[entryIndex] !== key) {
      entryIndex = data[entryIndex + 2];
    }
    if (entryIndex === 0) {
      if (this.entryCount + 1 > this.entryCapacity) {
        this.resize(this.entryCount + 1);
        this.insert(key, bitset);
        return;
      }
      entryIndex = bucketMask + 1 + (this.entryCount++ * 3);
      data[entryIndex] = key;
      data[entryIndex + 2] = data[bucket];
      data[bucket] = entryIndex;
    }
    data[entryIndex + 1] |= bitset;
  }

  public has(codePoint: number): boolean {
    const { data, bucketMask } = this;
    const key = codePoint >> 5;
    let entryIndex = data[key & bucketMask];
    while (entryIndex !== 0) {
      if (data[entryIndex] === key) {
        return (data[entryIndex + 1] & (1 << (codePoint & 31))) !== 0;
      }
      entryIndex = data[entryIndex + 2];
    }
    return false;
  }

  private resize(entryCount: number) {
    const { data: oldData, bucketMask: oldBucketMask } = this;
    this.entryCapacity = 2 ** Math.ceil(Math.log2(entryCount));
    this.data = new Int32Array(this.entryCapacity * 3.5);
    this.bucketMask = this.entryCapacity / 2 - 1;
    if (oldData) {
      this.entryCount = 0;
      for (let i = oldBucketMask + 1; i < oldData.length; i += 3) {
        this.insert(oldData[i], oldData[i + 1]);
      }
    }
  }

  public serialize(): string {
    const out = new Array(this.data.length);
    this.data.forEach((n, i, data) => out[i] = data[i].toString(36));
    return out.join(",").replace(/(,0)+$/g, "");
  }

  public deserialize(s: string): void {
    throw new Error("Method not implemented.");
  }
}

/*
Build: 0.12101764081051788
Query: 0.6570273730613733
 */
class TieredCodePointSet implements ICodePointSet {
  public min = Infinity;
  public max = -Infinity;
  public readonly data: Uint16Array[];

  private readonly leafMask: number;
  private readonly topShift: number;
  private readonly midLevels: number[];

  constructor(
    bitCounts = [4, 2, 2, 2, 3, 4]
    // bitCounts = [4, 2, 3, 4, 4]
  ) {
    this.leafMask = (1 << bitCounts[0]) - 1;
    this.topShift = bitCounts.reduce((sum, n) => sum + n, 0);
    this.midLevels = bitCounts.slice(1).reverse();
    // console.log(this.topShift, this.midLevels, this.leafMask)
    this.data = [this.makeBranchArray(1 << (21 - this.topShift))];
  }

  serialize(): string {
    throw new Error("Method not implemented.");
  }

  deserialize(s: string): void {
    throw new Error("Method not implemented.");
  }

  private makeBranchArray(size: number) {
    return new Uint16Array(size);
  }

  private makeLeafArray(size: number) {
    return new Uint16Array(size);
  }

  public add(codePoint: number): void {
    this.min = Math.min(this.min, codePoint);
    this.max = Math.max(this.min, codePoint);
    let dataIndex = 0;
    let node = this.data[dataIndex];
    let shift = this.topShift;
    let index = codePoint >> shift;
    for (let i = 0; i < this.midLevels.length; i++) {
      const bits = this.midLevels[i];
      dataIndex = node[index];
      if (!dataIndex) {
        dataIndex = this.data.length;
        node[index] = dataIndex;
        this.data.push(i === this.midLevels.length - 1 ? this.makeLeafArray(1 << bits) : this.makeBranchArray(1 << bits));
      }
      node = this.data[dataIndex];
      shift -= bits;
      index = (codePoint & (((1 << bits) - 1) << shift)) >> shift;
    }
    node[index] = (node[index] || 0) | (1 << (codePoint & this.leafMask)); // leaf bits

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

  public has(codePoint: number): boolean {
    let node = this.data[0];
    let shift = this.topShift;
    let index = codePoint >> shift;
    for (const bits of this.midLevels) {
      if (node[index] === 0) return false;
      node = this.data[node[index]];
      shift -= bits;
      index = (codePoint & (((1 << bits) - 1) << shift)) >> shift;
    }
    return ((node[index] || 0) & (1 << (codePoint & this.leafMask))) !== 0;
  }
}

