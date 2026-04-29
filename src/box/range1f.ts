// Range1f — 1D float32 interval [min, max].
//
// Backed by a `Float32Array(2)` storing [min, max]. The "empty"
// sentinel is [+Inf, -Inf] (the F# convention) so `extend(v)` on an
// empty range yields the singleton [v, v] without special-casing.
//
// Boxes do NOT carry the math operator brand (no meaningful
// box+box / box*scalar). Use the explicit methods.

import { combineHash, hashNumber } from "../internal/hash.js";

const F32_BYTES = 4;
const COMPONENT_COUNT = 2;
const BYTES = COMPONENT_COUNT * F32_BYTES;

export class Range1f {
  /** @internal */
  readonly _data: Float32Array;

  constructor(min: number = 0, max: number = 0) {
    this._data = new Float32Array(2);
    this._data[0] = min;
    this._data[1] = max;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): Range1f {
    const r = Object.create(Range1f.prototype) as { _data: Float32Array };
    r._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return r as Range1f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  static get empty(): Range1f { return new Range1f(Infinity, -Infinity); }

  static fromMinMax(min: number, max: number): Range1f {
    return new Range1f(min, max);
  }

  static single(value: number): Range1f { return new Range1f(value, value); }

  static fromValues(values: Iterable<number>): Range1f {
    let mn = Infinity, mx = -Infinity;
    for (const v of values) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    return new Range1f(mn, mx);
  }

  get min(): number { return this._data[0]!; }
  set min(v: number) { this._data[0] = v; }
  get max(): number { return this._data[1]!; }
  set max(v: number) { this._data[1] = v; }

  isEmpty(): boolean { return this._data[0]! > this._data[1]!; }
  isValid(): boolean { return this._data[0]! <= this._data[1]!; }
  size(): number { return this._data[1]! - this._data[0]!; }
  center(): number { return (this._data[0]! + this._data[1]!) / 2; }

  contains(v: number | Range1f): boolean {
    if (typeof v === "number") {
      return v >= this._data[0]! && v <= this._data[1]!;
    }
    return v._data[0]! >= this._data[0]! && v._data[1]! <= this._data[1]!;
  }

  intersects(other: Range1f): boolean {
    return this._data[0]! <= other._data[1]! && other._data[0]! <= this._data[1]!;
  }

  extend(v: number | Range1f): Range1f {
    if (typeof v === "number") {
      return new Range1f(
        Math.min(this._data[0]!, v),
        Math.max(this._data[1]!, v),
      );
    }
    return new Range1f(
      Math.min(this._data[0]!, v._data[0]!),
      Math.max(this._data[1]!, v._data[1]!),
    );
  }

  intersection(other: Range1f): Range1f {
    return new Range1f(
      Math.max(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
    );
  }

  union(other: Range1f): Range1f { return this.extend(other); }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Range1f)) return false;
    return this._data[0] === other._data[0] && this._data[1] === other._data[1];
  }

  approxEqual(other: Range1f, eps: number): boolean {
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

  toString(): string { return `Range1f(${this._data[0]}, ${this._data[1]})`; }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
  }

  static extendInto(a: Range1f, v: number | Range1f, target: Range1f): Range1f {
    if (typeof v === "number") {
      target._data[0] = Math.min(a._data[0]!, v);
      target._data[1] = Math.max(a._data[1]!, v);
    } else {
      target._data[0] = Math.min(a._data[0]!, v._data[0]!);
      target._data[1] = Math.max(a._data[1]!, v._data[1]!);
    }
    return target;
  }

  static intersectionInto(a: Range1f, b: Range1f, target: Range1f): Range1f {
    target._data[0] = Math.max(a._data[0]!, b._data[0]!);
    target._data[1] = Math.min(a._data[1]!, b._data[1]!);
    return target;
  }

  static unionInto(a: Range1f, b: Range1f, target: Range1f): Range1f {
    target._data[0] = Math.min(a._data[0]!, b._data[0]!);
    target._data[1] = Math.max(a._data[1]!, b._data[1]!);
    return target;
  }
}
