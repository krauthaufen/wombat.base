// Rot2f — 2D rotation as a single scalar `radians` (float32).
//
// Backed by a `Float32Array` of length 1 so the storage layout is
// uniform with the rest of the package.

import { hashNumber } from "../internal/hash.js";
import { V2f } from "../vector/v2f.js";
import { M22f } from "../matrix/m22f.js";
import { M33f } from "../matrix/m33f.js";

const F32_BYTES = 4;
const COMPONENT_COUNT = 1;
const BYTES = COMPONENT_COUNT * F32_BYTES;

export class Rot2f {
  static readonly __aardworxMathBrand: "Rot2f" = "Rot2f";

  /** @internal */
  readonly _data: Float32Array;

  constructor(radians: number = 0) {
    this._data = new Float32Array(1);
    this._data[0] = radians;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): Rot2f {
    const r = Object.create(Rot2f.prototype) as { _data: Float32Array };
    r._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return r as Rot2f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  // ---------- factories ----------

  static readonly identity: Rot2f = new Rot2f(0);

  static fromRadians(rad: number): Rot2f { return new Rot2f(rad); }
  static fromDegrees(deg: number): Rot2f { return new Rot2f(deg * (Math.PI / 180)); }

  // ---------- component access (rounds to f32 on write) ----------

  get radians(): number { return this._data[0]!; }
  set radians(v: number) { this._data[0] = v; }

  // ---------- group ----------

  mul(other: Rot2f): Rot2f {
    return new Rot2f(this._data[0]! + other._data[0]!);
  }

  inverse(): Rot2f {
    return new Rot2f(-this._data[0]!);
  }

  // ---------- vector action ----------

  transform(v: V2f): V2f {
    const a = this._data[0]!;
    const c = Math.cos(a), s = Math.sin(a);
    const x = v._data[0]!, y = v._data[1]!;
    return new V2f(c * x - s * y, s * x + c * y);
  }

  // ---------- interpolation ----------

  slerp(other: Rot2f, t: number): Rot2f {
    let d = other._data[0]! - this._data[0]!;
    d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    return new Rot2f(this._data[0]! + d * t);
  }

  lerp(other: Rot2f, t: number): Rot2f {
    return new Rot2f(this._data[0]! + (other._data[0]! - this._data[0]!) * t);
  }

  // ---------- conversions ----------

  toMatrix(): M22f {
    const a = this._data[0]!;
    const c = Math.cos(a), s = Math.sin(a);
    const m = new M22f();
    m._data[0] = c;  m._data[1] = -s;
    m._data[2] = s;  m._data[3] = c;
    return m;
  }

  toMatrixHomogeneous(): M33f {
    const a = this._data[0]!;
    const c = Math.cos(a), s = Math.sin(a);
    const m = new M33f();
    const d = m._data;
    d[0] = c;  d[1] = -s; d[2] = 0;
    d[3] = s;  d[4] =  c; d[5] = 0;
    d[6] = 0;  d[7] =  0; d[8] = 1;
    return m;
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Rot2f)) return false;
    return this._data[0] === other._data[0];
  }

  approxEqual(other: Rot2f, eps: number): boolean {
    return Math.abs(this._data[0]! - other._data[0]!) <= eps;
  }

  getHashCode(): number {
    return hashNumber(this._data[0]!);
  }

  toString(): string {
    return `Rot2f(${this._data[0]})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
  }

  toArray(): [number] { return [this._data[0]!]; }

  // ---------- alloc-free static variants ----------

  static mulInto(a: Rot2f, b: Rot2f, target: Rot2f): Rot2f {
    target._data[0] = a._data[0]! + b._data[0]!;
    return target;
  }

  static inverseInto(a: Rot2f, target: Rot2f): Rot2f {
    target._data[0] = -a._data[0]!;
    return target;
  }

  static transformInto(r: Rot2f, v: V2f, target: V2f): V2f {
    const a = r._data[0]!;
    const c = Math.cos(a), s = Math.sin(a);
    const x = v._data[0]!, y = v._data[1]!;
    target._data[0] = c * x - s * y;
    target._data[1] = s * x + c * y;
    return target;
  }

  static copyInto(from: Rot2f, target: Rot2f): Rot2f {
    target._data[0] = from._data[0]!;
    return target;
  }
}
