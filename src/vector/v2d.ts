// V2d — 2-component float64 vector.
//
// Backed by a `Float64Array` of length 2. Same conventions as V3f
// (see v3f.ts for the long-form rationale).

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2b } from "./v2b.js";

const F64_BYTES = 8;
const COMPONENT_COUNT = 2;
const BYTES = COMPONENT_COUNT * F64_BYTES;

export class V2d {
  /** Brand: marks this class as an aardvark math type for the operator plugin. */
  static readonly __aardworxMathBrand: "V2d" = "V2d";

  /** @internal */
  readonly _data: Float64Array;

  constructor(x: number = 0, y: number = 0) {
    this._data = new Float64Array(2);
    this._data[0] = x;
    this._data[1] = y;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V2d {
    const v = Object.create(V2d.prototype) as { _data: Float64Array };
    v._data = new Float64Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V2d;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  // ---------- factories ----------

  static readonly zero: V2d = new V2d(0, 0);
  static readonly one: V2d = new V2d(1, 1);
  static readonly unitX: V2d = new V2d(1, 0);
  static readonly unitY: V2d = new V2d(0, 1);

  static splat(s: number): V2d { return new V2d(s, s); }

  static copy(other: V2d): V2d {
    return new V2d(other._data[0]!, other._data[1]!);
  }

  static fromArrayLike(arr: ArrayLike<number>, offset: number = 0): V2d {
    return new V2d(arr[offset]!, arr[offset + 1]!);
  }

  // ---------- component access ----------

  get x(): number { return this._data[0]!; }
  set x(v: number) { this._data[0] = v; }
  get y(): number { return this._data[1]!; }
  set y(v: number) { this._data[1] = v; }

  // ---------- additive group ----------

  add(other: V2d): V2d {
    return new V2d(this._data[0]! + other._data[0]!, this._data[1]! + other._data[1]!);
  }

  sub(other: V2d): V2d {
    return new V2d(this._data[0]! - other._data[0]!, this._data[1]! - other._data[1]!);
  }

  neg(): V2d {
    return new V2d(-this._data[0]!, -this._data[1]!);
  }

  // ---------- vector space ----------

  mul(other: V2d | number): V2d {
    if (typeof other === "number") {
      return new V2d(this._data[0]! * other, this._data[1]! * other);
    }
    return new V2d(this._data[0]! * other._data[0]!, this._data[1]! * other._data[1]!);
  }

  div(other: V2d | number): V2d {
    if (typeof other === "number") {
      const inv = 1 / other;
      return new V2d(this._data[0]! * inv, this._data[1]! * inv);
    }
    return new V2d(this._data[0]! / other._data[0]!, this._data[1]! / other._data[1]!);
  }

  mod(other: V2d | number): V2d {
    if (typeof other === "number") {
      return new V2d(this._data[0]! % other, this._data[1]! % other);
    }
    return new V2d(this._data[0]! % other._data[0]!, this._data[1]! % other._data[1]!);
  }

  // ---------- vector geometry ----------

  dot(other: V2d): number {
    return this._data[0]! * other._data[0]! + this._data[1]! * other._data[1]!;
  }

  /** Scalar perp-dot (z-component of the 3D cross). */
  crossZ(other: V2d): number {
    return this._data[0]! * other._data[1]! - this._data[1]! * other._data[0]!;
  }

  lengthSquared(): number {
    const x = this._data[0]!, y = this._data[1]!;
    return x * x + y * y;
  }

  length(): number {
    return Math.sqrt(this.lengthSquared());
  }

  distanceSquared(other: V2d): number {
    const dx = this._data[0]! - other._data[0]!;
    const dy = this._data[1]! - other._data[1]!;
    return dx * dx + dy * dy;
  }

  distance(other: V2d): number {
    return Math.sqrt(this.distanceSquared(other));
  }

  normalize(): V2d { return this.div(this.length()); }

  normalizeSafe(fallback: V2d = V2d.zero): V2d {
    const len = this.length();
    return len > 0 ? this.div(len) : fallback;
  }

  lerp(other: V2d, t: number): V2d {
    return new V2d(
      this._data[0]! + (other._data[0]! - this._data[0]!) * t,
      this._data[1]! + (other._data[1]! - this._data[1]!) * t,
    );
  }

  // ---------- component-wise math ----------

  abs(): V2d { return new V2d(Math.abs(this._data[0]!), Math.abs(this._data[1]!)); }
  floor(): V2d { return new V2d(Math.floor(this._data[0]!), Math.floor(this._data[1]!)); }
  ceil(): V2d { return new V2d(Math.ceil(this._data[0]!), Math.ceil(this._data[1]!)); }
  round(): V2d { return new V2d(Math.round(this._data[0]!), Math.round(this._data[1]!)); }
  fract(): V2d {
    return new V2d(
      this._data[0]! - Math.floor(this._data[0]!),
      this._data[1]! - Math.floor(this._data[1]!),
    );
  }
  sign(): V2d { return new V2d(Math.sign(this._data[0]!), Math.sign(this._data[1]!)); }

  min(other: V2d): V2d {
    return new V2d(
      Math.min(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
    );
  }

  max(other: V2d): V2d {
    return new V2d(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
    );
  }

  clamp(lo: V2d, hi: V2d): V2d {
    return new V2d(
      Math.min(Math.max(this._data[0]!, lo._data[0]!), hi._data[0]!),
      Math.min(Math.max(this._data[1]!, lo._data[1]!), hi._data[1]!),
    );
  }

  // ---------- reductions ----------

  minComp(): number { return Math.min(this._data[0]!, this._data[1]!); }
  maxComp(): number { return Math.max(this._data[0]!, this._data[1]!); }
  sumComp(): number { return this._data[0]! + this._data[1]!; }

  // ---------- component-wise comparison ----------

  lt(other: V2d): V2b { return new V2b(this._data[0]! < other._data[0]!, this._data[1]! < other._data[1]!); }
  le(other: V2d): V2b { return new V2b(this._data[0]! <= other._data[0]!, this._data[1]! <= other._data[1]!); }
  gt(other: V2d): V2b { return new V2b(this._data[0]! > other._data[0]!, this._data[1]! > other._data[1]!); }
  ge(other: V2d): V2b { return new V2b(this._data[0]! >= other._data[0]!, this._data[1]! >= other._data[1]!); }
  eq(other: V2d): V2b { return new V2b(this._data[0]! === other._data[0]!, this._data[1]! === other._data[1]!); }
  neq(other: V2d): V2b { return new V2b(this._data[0]! !== other._data[0]!, this._data[1]! !== other._data[1]!); }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V2d)) return false;
    return this._data[0] === other._data[0] && this._data[1] === other._data[1];
  }

  approxEqual(other: V2d, eps: number): boolean {
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

  toString(): string {
    return `V2d(${this._data[0]}, ${this._data[1]})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
  }

  toArray(): [number, number] {
    return [this._data[0]!, this._data[1]!];
  }

  // ---------- in-place / static-target variants (alloc-free) ----------

  static addInto(a: V2d, b: V2d, target: V2d): V2d {
    target._data[0] = a._data[0]! + b._data[0]!;
    target._data[1] = a._data[1]! + b._data[1]!;
    return target;
  }

  static subInto(a: V2d, b: V2d, target: V2d): V2d {
    target._data[0] = a._data[0]! - b._data[0]!;
    target._data[1] = a._data[1]! - b._data[1]!;
    return target;
  }

  static mulInto(a: V2d, b: V2d | number, target: V2d): V2d {
    if (typeof b === "number") {
      target._data[0] = a._data[0]! * b;
      target._data[1] = a._data[1]! * b;
    } else {
      target._data[0] = a._data[0]! * b._data[0]!;
      target._data[1] = a._data[1]! * b._data[1]!;
    }
    return target;
  }

  static copyInto(from: V2d, target: V2d): V2d {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    return target;
  }
}

