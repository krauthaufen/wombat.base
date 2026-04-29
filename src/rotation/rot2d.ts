// Rot2d — 2D rotation as a single scalar `radians`.
//
// Backed by a `Float64Array` of length 1 so the storage layout is
// uniform with the rest of the package and arrays of Rot2d can pack.

import { hashNumber } from "../internal/hash.js";
import { V2d } from "../vector/v2d.js";
import { M22d } from "../matrix/m22d.js";
import { M33d } from "../matrix/m33d.js";

const F64_BYTES = 8;
const COMPONENT_COUNT = 1;
const BYTES = COMPONENT_COUNT * F64_BYTES;

export class Rot2d {
  static readonly __aardworxMathBrand: "Rot2d" = "Rot2d";

  /** @internal */
  readonly _data: Float64Array;

  constructor(radians: number = 0) {
    this._data = new Float64Array(1);
    this._data[0] = radians;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): Rot2d {
    const r = Object.create(Rot2d.prototype) as { _data: Float64Array };
    r._data = new Float64Array(buffer, byteOffset, COMPONENT_COUNT);
    return r as Rot2d;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  // ---------- factories ----------

  static readonly identity: Rot2d = new Rot2d(0);

  static fromRadians(rad: number): Rot2d { return new Rot2d(rad); }
  static fromDegrees(deg: number): Rot2d { return new Rot2d(deg * (Math.PI / 180)); }
  /** Alias for `fromRadians`. */
  static rotation(rad: number): Rot2d { return new Rot2d(rad); }

  // ---------- component access ----------

  get radians(): number { return this._data[0]!; }
  set radians(v: number) { this._data[0] = v; }

  // ---------- group ----------

  /** Composition: angle addition. */
  mul(other: Rot2d): Rot2d {
    return new Rot2d(this._data[0]! + other._data[0]!);
  }

  inverse(): Rot2d {
    return new Rot2d(-this._data[0]!);
  }

  // ---------- vector action ----------

  transform(v: V2d): V2d {
    const a = this._data[0]!;
    const c = Math.cos(a), s = Math.sin(a);
    const x = v._data[0]!, y = v._data[1]!;
    return new V2d(c * x - s * y, s * x + c * y);
  }

  // ---------- interpolation ----------

  /**
   * Spherical interpolation. For 2D rotations the shortest-path
   * angular interpolation is the same as linear interpolation across
   * the wrapped angle delta.
   */
  slerp(other: Rot2d, t: number): Rot2d {
    let d = other._data[0]! - this._data[0]!;
    // wrap into (-π, π] so we always take the shortest arc
    d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    return new Rot2d(this._data[0]! + d * t);
  }

  /** Linear interpolation across the raw angle (no shortest-path wrap). */
  lerp(other: Rot2d, t: number): Rot2d {
    return new Rot2d(this._data[0]! + (other._data[0]! - this._data[0]!) * t);
  }

  // ---------- conversions ----------

  toMatrix(): M22d {
    const a = this._data[0]!;
    const c = Math.cos(a), s = Math.sin(a);
    const m = new M22d();
    m._data[0] = c;  m._data[1] = -s;
    m._data[2] = s;  m._data[3] = c;
    return m;
  }

  /** Homogeneous 3x3 form for 2D affine pipelines. */
  toMatrixHomogeneous(): M33d {
    const a = this._data[0]!;
    const c = Math.cos(a), s = Math.sin(a);
    const m = new M33d();
    const d = m._data;
    d[0] = c;  d[1] = -s; d[2] = 0;
    d[3] = s;  d[4] =  c; d[5] = 0;
    d[6] = 0;  d[7] =  0; d[8] = 1;
    return m;
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Rot2d)) return false;
    return this._data[0] === other._data[0];
  }

  approxEqual(other: Rot2d, eps: number): boolean {
    return Math.abs(this._data[0]! - other._data[0]!) <= eps;
  }

  getHashCode(): number {
    return hashNumber(this._data[0]!);
  }

  toString(): string {
    return `Rot2d(${this._data[0]})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
  }

  toArray(): [number] { return [this._data[0]!]; }

  // ---------- alloc-free static variants ----------

  static mulInto(a: Rot2d, b: Rot2d, target: Rot2d): Rot2d {
    target._data[0] = a._data[0]! + b._data[0]!;
    return target;
  }

  static inverseInto(a: Rot2d, target: Rot2d): Rot2d {
    target._data[0] = -a._data[0]!;
    return target;
  }

  static transformInto(r: Rot2d, v: V2d, target: V2d): V2d {
    const a = r._data[0]!;
    const c = Math.cos(a), s = Math.sin(a);
    const x = v._data[0]!, y = v._data[1]!;
    target._data[0] = c * x - s * y;
    target._data[1] = s * x + c * y;
    return target;
  }

  static copyInto(from: Rot2d, target: Rot2d): Rot2d {
    target._data[0] = from._data[0]!;
    return target;
  }

  // ---------- operator overloads (boperators) ----------

  static "*"(a: Rot2d, b: Rot2d): Rot2d { return a.mul(b); }
}

