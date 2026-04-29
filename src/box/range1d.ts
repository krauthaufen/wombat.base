// Range1d — 1D float64 interval [min, max].
//
// Backed by a `Float64Array(2)` storing [min, max]. The "empty"
// sentinel is [+Inf, -Inf]. See range1f.ts for rationale.

import { combineHash, hashNumber } from "../internal/hash.js";

const F64_BYTES = 8;
const COMPONENT_COUNT = 2;
const BYTES = COMPONENT_COUNT * F64_BYTES;

export class Range1d {
  /** @internal */
  readonly _data: Float64Array;

  constructor(min: number = 0, max: number = 0) {
    this._data = new Float64Array(2);
    this._data[0] = min;
    this._data[1] = max;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): Range1d {
    const r = Object.create(Range1d.prototype) as { _data: Float64Array };
    r._data = new Float64Array(buffer, byteOffset, COMPONENT_COUNT);
    return r as Range1d;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  static get empty(): Range1d { return new Range1d(Infinity, -Infinity); }

  static fromMinMax(min: number, max: number): Range1d {
    return new Range1d(min, max);
  }

  static single(value: number): Range1d { return new Range1d(value, value); }

  static fromValues(values: Iterable<number>): Range1d {
    let mn = Infinity, mx = -Infinity;
    for (const v of values) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    return new Range1d(mn, mx);
  }

  get min(): number { return this._data[0]!; }
  set min(v: number) { this._data[0] = v; }
  get max(): number { return this._data[1]!; }
  set max(v: number) { this._data[1] = v; }

  isEmpty(): boolean { return this._data[0]! > this._data[1]!; }
  isValid(): boolean { return this._data[0]! <= this._data[1]!; }
  size(): number { return this._data[1]! - this._data[0]!; }
  center(): number { return (this._data[0]! + this._data[1]!) / 2; }

  contains(v: number | Range1d): boolean {
    if (typeof v === "number") {
      return v >= this._data[0]! && v <= this._data[1]!;
    }
    return v._data[0]! >= this._data[0]! && v._data[1]! <= this._data[1]!;
  }

  intersects(other: Range1d): boolean {
    return this._data[0]! <= other._data[1]! && other._data[0]! <= this._data[1]!;
  }

  extend(v: number | Range1d): Range1d {
    if (typeof v === "number") {
      return new Range1d(
        Math.min(this._data[0]!, v),
        Math.max(this._data[1]!, v),
      );
    }
    return new Range1d(
      Math.min(this._data[0]!, v._data[0]!),
      Math.max(this._data[1]!, v._data[1]!),
    );
  }

  intersection(other: Range1d): Range1d {
    return new Range1d(
      Math.max(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
    );
  }

  union(other: Range1d): Range1d { return this.extend(other); }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Range1d)) return false;
    return this._data[0] === other._data[0] && this._data[1] === other._data[1];
  }

  approxEqual(other: Range1d, eps: number): boolean {
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

  toString(): string { return `Range1d(${this._data[0]}, ${this._data[1]})`; }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
  }

  static extendInto(a: Range1d, v: number | Range1d, target: Range1d): Range1d {
    if (typeof v === "number") {
      target._data[0] = Math.min(a._data[0]!, v);
      target._data[1] = Math.max(a._data[1]!, v);
    } else {
      target._data[0] = Math.min(a._data[0]!, v._data[0]!);
      target._data[1] = Math.max(a._data[1]!, v._data[1]!);
    }
    return target;
  }

  static intersectionInto(a: Range1d, b: Range1d, target: Range1d): Range1d {
    target._data[0] = Math.max(a._data[0]!, b._data[0]!);
    target._data[1] = Math.min(a._data[1]!, b._data[1]!);
    return target;
  }

  static unionInto(a: Range1d, b: Range1d, target: Range1d): Range1d {
    target._data[0] = Math.min(a._data[0]!, b._data[0]!);
    target._data[1] = Math.max(a._data[1]!, b._data[1]!);
    return target;
  }
}
