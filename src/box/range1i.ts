// Range1i — 1D integer interval [min, max].
//
// Backed by an `Int32Array(2)` storing [min, max]. The "empty"
// sentinel is [INT32_MAX, INT32_MIN] (rather than +Inf/-Inf which
// Int32Array cannot represent). This preserves the F# convention
// that `Range1i.empty.extend(v)` yields the singleton range [v, v]
// without special-casing the first call: any real value v satisfies
// v < INT32_MAX and v > INT32_MIN, so min(empty.min, v) = v and
// max(empty.max, v) = v.
//
// Boxes do NOT carry the math operator brand: there's no
// box+box / box*scalar that the operator-rewrite plugin should
// expand. Use the explicit methods (`extend`, `union`, `intersection`).

import { combineHash, hashNumber } from "../internal/hash.js";

const I32_BYTES = 4;
const COMPONENT_COUNT = 2;
const BYTES = COMPONENT_COUNT * I32_BYTES;

const I32_MAX = 2147483647;
const I32_MIN = -2147483648;

export class Range1i {
  /** @internal */
  readonly _data: Int32Array;

  constructor(min: number = 0, max: number = 0) {
    this._data = new Int32Array(2);
    this._data[0] = min;
    this._data[1] = max;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): Range1i {
    const r = Object.create(Range1i.prototype) as { _data: Int32Array };
    r._data = new Int32Array(buffer, byteOffset, COMPONENT_COUNT);
    return r as Range1i;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  // ---------- factories ----------

  /**
   * Empty range: `[INT32_MAX, INT32_MIN]`. Designed so `extend(v)`
   * yields `[v, v]` for any int32 v without special-casing.
   */
  static get empty(): Range1i { return new Range1i(I32_MAX, I32_MIN); }

  static fromMinMax(min: number, max: number): Range1i {
    return new Range1i(min, max);
  }

  static single(value: number): Range1i {
    return new Range1i(value, value);
  }

  static fromValues(values: Iterable<number>): Range1i {
    let mn = I32_MAX, mx = I32_MIN;
    for (const v of values) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    return new Range1i(mn, mx);
  }

  // ---------- accessors ----------

  get min(): number { return this._data[0]!; }
  set min(v: number) { this._data[0] = v; }
  get max(): number { return this._data[1]!; }
  set max(v: number) { this._data[1] = v; }

  isEmpty(): boolean { return this._data[0]! > this._data[1]!; }
  isValid(): boolean { return this._data[0]! <= this._data[1]!; }
  size(): number { return this._data[1]! - this._data[0]!; }
  center(): number { return (this._data[0]! + this._data[1]!) / 2; }

  contains(v: number | Range1i): boolean {
    if (typeof v === "number") {
      return v >= this._data[0]! && v <= this._data[1]!;
    }
    return v._data[0]! >= this._data[0]! && v._data[1]! <= this._data[1]!;
  }

  intersects(other: Range1i): boolean {
    return this._data[0]! <= other._data[1]! && other._data[0]! <= this._data[1]!;
  }

  extend(v: number | Range1i): Range1i {
    if (typeof v === "number") {
      return new Range1i(
        Math.min(this._data[0]!, v),
        Math.max(this._data[1]!, v),
      );
    }
    return new Range1i(
      Math.min(this._data[0]!, v._data[0]!),
      Math.max(this._data[1]!, v._data[1]!),
    );
  }

  intersection(other: Range1i): Range1i {
    return new Range1i(
      Math.max(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
    );
  }

  union(other: Range1i): Range1i { return this.extend(other); }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Range1i)) return false;
    return this._data[0] === other._data[0] && this._data[1] === other._data[1];
  }

  approxEqual(other: Range1i, eps: number): boolean {
    return (
      Math.abs(this._data[0]! - other._data[0]!) <= eps &&
      Math.abs(this._data[1]! - other._data[1]!) <= eps
    );
  }

  getHashCode(): number {
    let h = hashNumber(this._data[0]!);
    h = combineHash(h, hashNumber(this._data[1]!));
    return h;
  }

  toString(): string { return `Range1i(${this._data[0]}, ${this._data[1]})`; }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
  }

  // ---------- alloc-free static variants ----------

  static extendInto(a: Range1i, v: number | Range1i, target: Range1i): Range1i {
    if (typeof v === "number") {
      target._data[0] = Math.min(a._data[0]!, v);
      target._data[1] = Math.max(a._data[1]!, v);
    } else {
      target._data[0] = Math.min(a._data[0]!, v._data[0]!);
      target._data[1] = Math.max(a._data[1]!, v._data[1]!);
    }
    return target;
  }

  static intersectionInto(a: Range1i, b: Range1i, target: Range1i): Range1i {
    target._data[0] = Math.max(a._data[0]!, b._data[0]!);
    target._data[1] = Math.min(a._data[1]!, b._data[1]!);
    return target;
  }

  static unionInto(a: Range1i, b: Range1i, target: Range1i): Range1i {
    target._data[0] = Math.min(a._data[0]!, b._data[0]!);
    target._data[1] = Math.max(a._data[1]!, b._data[1]!);
    return target;
  }
}
