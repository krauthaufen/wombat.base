// V2f — 2-component float32 vector.
//
// Backed by a `Float32Array` of length 2. Same conventions as V3f
// (see v3f.ts for the long-form rationale).

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2b } from "./v2b.js";

const F32_BYTES = 4;
const COMPONENT_COUNT = 2;
const BYTES = COMPONENT_COUNT * F32_BYTES;

export class V2f {
  /** Brand: marks this class as an aardvark math type for the operator plugin. */
  static readonly __aardworxMathBrand: "V2f" = "V2f";

  /** @internal */
  readonly _data: Float32Array;

  constructor(x: number = 0, y: number = 0) {
    this._data = new Float32Array(2);
    this._data[0] = x;
    this._data[1] = y;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V2f {
    const v = Object.create(V2f.prototype) as { _data: Float32Array };
    v._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V2f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  // ---------- factories ----------

  static readonly zero: V2f = new V2f(0, 0);
  static readonly one: V2f = new V2f(1, 1);
  static readonly unitX: V2f = new V2f(1, 0);
  static readonly unitY: V2f = new V2f(0, 1);

  static splat(s: number): V2f { return new V2f(s, s); }

  static copy(other: V2f): V2f {
    return new V2f(other._data[0]!, other._data[1]!);
  }

  static fromArrayLike(arr: ArrayLike<number>, offset: number = 0): V2f {
    return new V2f(arr[offset]!, arr[offset + 1]!);
  }

  // ---------- component access ----------

  get x(): number { return this._data[0]!; }
  set x(v: number) { this._data[0] = v; }
  get y(): number { return this._data[1]!; }
  set y(v: number) { this._data[1] = v; }

  // ---------- additive group ----------

  add(other: V2f): V2f {
    return new V2f(this._data[0]! + other._data[0]!, this._data[1]! + other._data[1]!);
  }

  sub(other: V2f): V2f {
    return new V2f(this._data[0]! - other._data[0]!, this._data[1]! - other._data[1]!);
  }

  neg(): V2f {
    return new V2f(-this._data[0]!, -this._data[1]!);
  }

  // ---------- vector space ----------

  mul(other: V2f | number): V2f {
    if (typeof other === "number") {
      return new V2f(this._data[0]! * other, this._data[1]! * other);
    }
    return new V2f(this._data[0]! * other._data[0]!, this._data[1]! * other._data[1]!);
  }

  div(other: V2f | number): V2f {
    if (typeof other === "number") {
      const inv = 1 / other;
      return new V2f(this._data[0]! * inv, this._data[1]! * inv);
    }
    return new V2f(this._data[0]! / other._data[0]!, this._data[1]! / other._data[1]!);
  }

  mod(other: V2f | number): V2f {
    if (typeof other === "number") {
      return new V2f(this._data[0]! % other, this._data[1]! % other);
    }
    return new V2f(this._data[0]! % other._data[0]!, this._data[1]! % other._data[1]!);
  }

  // ---------- vector geometry ----------

  dot(other: V2f): number {
    return this._data[0]! * other._data[0]! + this._data[1]! * other._data[1]!;
  }

  /** Scalar perp-dot (z-component of the 3D cross). */
  crossZ(other: V2f): number {
    return this._data[0]! * other._data[1]! - this._data[1]! * other._data[0]!;
  }

  lengthSquared(): number {
    const x = this._data[0]!, y = this._data[1]!;
    return x * x + y * y;
  }

  length(): number {
    return Math.sqrt(this.lengthSquared());
  }

  distanceSquared(other: V2f): number {
    const dx = this._data[0]! - other._data[0]!;
    const dy = this._data[1]! - other._data[1]!;
    return dx * dx + dy * dy;
  }

  distance(other: V2f): number {
    return Math.sqrt(this.distanceSquared(other));
  }

  normalize(): V2f { return this.div(this.length()); }

  normalizeSafe(fallback: V2f = V2f.zero): V2f {
    const len = this.length();
    return len > 0 ? this.div(len) : fallback;
  }

  lerp(other: V2f, t: number): V2f {
    return new V2f(
      this._data[0]! + (other._data[0]! - this._data[0]!) * t,
      this._data[1]! + (other._data[1]! - this._data[1]!) * t,
    );
  }

  // ---------- component-wise math ----------

  abs(): V2f { return new V2f(Math.abs(this._data[0]!), Math.abs(this._data[1]!)); }
  floor(): V2f { return new V2f(Math.floor(this._data[0]!), Math.floor(this._data[1]!)); }
  ceil(): V2f { return new V2f(Math.ceil(this._data[0]!), Math.ceil(this._data[1]!)); }
  round(): V2f { return new V2f(Math.round(this._data[0]!), Math.round(this._data[1]!)); }
  fract(): V2f {
    return new V2f(
      this._data[0]! - Math.floor(this._data[0]!),
      this._data[1]! - Math.floor(this._data[1]!),
    );
  }
  sign(): V2f { return new V2f(Math.sign(this._data[0]!), Math.sign(this._data[1]!)); }

  min(other: V2f): V2f {
    return new V2f(
      Math.min(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
    );
  }

  max(other: V2f): V2f {
    return new V2f(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
    );
  }

  clamp(lo: V2f, hi: V2f): V2f {
    return new V2f(
      Math.min(Math.max(this._data[0]!, lo._data[0]!), hi._data[0]!),
      Math.min(Math.max(this._data[1]!, lo._data[1]!), hi._data[1]!),
    );
  }

  // ---------- reductions ----------

  minComp(): number { return Math.min(this._data[0]!, this._data[1]!); }
  maxComp(): number { return Math.max(this._data[0]!, this._data[1]!); }
  sumComp(): number { return this._data[0]! + this._data[1]!; }

  // ---------- component-wise comparison ----------

  lt(other: V2f): V2b { return new V2b(this._data[0]! < other._data[0]!, this._data[1]! < other._data[1]!); }
  le(other: V2f): V2b { return new V2b(this._data[0]! <= other._data[0]!, this._data[1]! <= other._data[1]!); }
  gt(other: V2f): V2b { return new V2b(this._data[0]! > other._data[0]!, this._data[1]! > other._data[1]!); }
  ge(other: V2f): V2b { return new V2b(this._data[0]! >= other._data[0]!, this._data[1]! >= other._data[1]!); }
  eq(other: V2f): V2b { return new V2b(this._data[0]! === other._data[0]!, this._data[1]! === other._data[1]!); }
  neq(other: V2f): V2b { return new V2b(this._data[0]! !== other._data[0]!, this._data[1]! !== other._data[1]!); }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V2f)) return false;
    return this._data[0] === other._data[0] && this._data[1] === other._data[1];
  }

  approxEqual(other: V2f, eps: number): boolean {
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
    return `V2f(${this._data[0]}, ${this._data[1]})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
  }

  toArray(): [number, number] {
    return [this._data[0]!, this._data[1]!];
  }

  // ---------- in-place / static-target variants (alloc-free) ----------

  static addInto(a: V2f, b: V2f, target: V2f): V2f {
    target._data[0] = a._data[0]! + b._data[0]!;
    target._data[1] = a._data[1]! + b._data[1]!;
    return target;
  }

  static subInto(a: V2f, b: V2f, target: V2f): V2f {
    target._data[0] = a._data[0]! - b._data[0]!;
    target._data[1] = a._data[1]! - b._data[1]!;
    return target;
  }

  static mulInto(a: V2f, b: V2f | number, target: V2f): V2f {
    if (typeof b === "number") {
      target._data[0] = a._data[0]! * b;
      target._data[1] = a._data[1]! * b;
    } else {
      target._data[0] = a._data[0]! * b._data[0]!;
      target._data[1] = a._data[1]! * b._data[1]!;
    }
    return target;
  }

  static copyInto(from: V2f, target: V2f): V2f {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    return target;
  }
}

/** Convenience constructor alias: `V2fOf(x, y)`. */
export function V2fOf(x: number, y: number): V2f {
  return new V2f(x, y);
}
