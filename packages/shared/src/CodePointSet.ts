export interface ICodePointSet {
  add(codePoint: number): void;

  has(codePoint: number): boolean;

  serialize(): string;

  deserialize(string: string): void;
}

/*
Build: 0.013251333964576603
Query: 0.652602325533038
 */
export class CodePointSet implements ICodePointSet {
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
