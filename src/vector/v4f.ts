// V4f — 4-component float32 vector.
//
// Backed by a `Float32Array` of length 4. Same conventions as V3f
// (see v3f.ts for the long-form rationale).

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2f } from "./v2f.js";
import { V3f } from "./v3f.js";
import { V4b } from "./v4b.js";

const F32_BYTES = 4;
const COMPONENT_COUNT = 4;
const BYTES = COMPONENT_COUNT * F32_BYTES;

export class V4f {
  static readonly __aardworxMathBrand: "V4f" = "V4f";

  /** @internal */
  readonly _data: Float32Array;

  /**
   * Construct a V4f from any combination of scalars and shorter
   * vectors that totals four components. Mirrors the GLSL/WGSL
   * `vec4(...)` promotion forms so users can write
   * `new V4f(v3, 1.0)` or `new V4f(uv, 0.0, 1.0)` from CPU or
   * shader code interchangeably.
   */
  constructor();
  constructor(x: number, y: number, z: number, w: number);
  constructor(xy: V2f, z: number, w: number);
  constructor(x: number, yz: V2f, w: number);
  constructor(x: number, y: number, zw: V2f);
  constructor(xy: V2f, zw: V2f);
  constructor(xyz: V3f, w: number);
  constructor(x: number, yzw: V3f);
  constructor(...args: ReadonlyArray<number | V2f | V3f>) {
    this._data = new Float32Array(4);
    let i = 0;
    for (const a of args) {
      if (i >= 4) break;
      if (typeof a === "number") {
        this._data[i++] = a;
      } else if (a instanceof V2f) {
        this._data[i++] = a.x;
        if (i < 4) this._data[i++] = a.y;
      } else if (a instanceof V3f) {
        this._data[i++] = a.x;
        if (i < 4) this._data[i++] = a.y;
        if (i < 4) this._data[i++] = a.z;
      }
    }
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V4f {
    const v = Object.create(V4f.prototype) as { _data: Float32Array };
    v._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V4f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  // ---------- factories ----------

  static readonly zero: V4f = new V4f(0, 0, 0, 0);
  static readonly one: V4f = new V4f(1, 1, 1, 1);
  static readonly unitX: V4f = new V4f(1, 0, 0, 0);
  static readonly unitY: V4f = new V4f(0, 1, 0, 0);
  static readonly unitZ: V4f = new V4f(0, 0, 1, 0);
  static readonly unitW: V4f = new V4f(0, 0, 0, 1);

  static splat(s: number): V4f { return new V4f(s, s, s, s); }

  static copy(other: V4f): V4f {
    return new V4f(other._data[0]!, other._data[1]!, other._data[2]!, other._data[3]!);
  }

  static fromArrayLike(arr: ArrayLike<number>, offset: number = 0): V4f {
    return new V4f(arr[offset]!, arr[offset + 1]!, arr[offset + 2]!, arr[offset + 3]!);
  }

  // ---------- component access ----------

  get x(): number { return this._data[0]!; }
  set x(v: number) { this._data[0] = v; }
  get y(): number { return this._data[1]!; }
  set y(v: number) { this._data[1] = v; }
  get z(): number { return this._data[2]!; }
  set z(v: number) { this._data[2] = v; }
  get w(): number { return this._data[3]!; }
  set w(v: number) { this._data[3] = v; }

  // ---------- additive group ----------

  add(other: V4f): V4f {
    return new V4f(
      this._data[0]! + other._data[0]!,
      this._data[1]! + other._data[1]!,
      this._data[2]! + other._data[2]!,
      this._data[3]! + other._data[3]!,
    );
  }

  sub(other: V4f): V4f {
    return new V4f(
      this._data[0]! - other._data[0]!,
      this._data[1]! - other._data[1]!,
      this._data[2]! - other._data[2]!,
      this._data[3]! - other._data[3]!,
    );
  }

  neg(): V4f {
    return new V4f(-this._data[0]!, -this._data[1]!, -this._data[2]!, -this._data[3]!);
  }

  // ---------- vector space ----------

  mul(other: V4f | number): V4f {
    if (typeof other === "number") {
      return new V4f(
        this._data[0]! * other, this._data[1]! * other,
        this._data[2]! * other, this._data[3]! * other,
      );
    }
    return new V4f(
      this._data[0]! * other._data[0]!,
      this._data[1]! * other._data[1]!,
      this._data[2]! * other._data[2]!,
      this._data[3]! * other._data[3]!,
    );
  }

  div(other: V4f | number): V4f {
    if (typeof other === "number") {
      const inv = 1 / other;
      return new V4f(
        this._data[0]! * inv, this._data[1]! * inv,
        this._data[2]! * inv, this._data[3]! * inv,
      );
    }
    return new V4f(
      this._data[0]! / other._data[0]!,
      this._data[1]! / other._data[1]!,
      this._data[2]! / other._data[2]!,
      this._data[3]! / other._data[3]!,
    );
  }

  mod(other: V4f | number): V4f {
    if (typeof other === "number") {
      return new V4f(
        this._data[0]! % other, this._data[1]! % other,
        this._data[2]! % other, this._data[3]! % other,
      );
    }
    return new V4f(
      this._data[0]! % other._data[0]!,
      this._data[1]! % other._data[1]!,
      this._data[2]! % other._data[2]!,
      this._data[3]! % other._data[3]!,
    );
  }

  // ---------- vector geometry ----------

  dot(other: V4f): number {
    return (
      this._data[0]! * other._data[0]! +
      this._data[1]! * other._data[1]! +
      this._data[2]! * other._data[2]! +
      this._data[3]! * other._data[3]!
    );
  }

  lengthSquared(): number {
    const x = this._data[0]!, y = this._data[1]!, z = this._data[2]!, w = this._data[3]!;
    return x * x + y * y + z * z + w * w;
  }

  length(): number {
    return Math.sqrt(this.lengthSquared());
  }

  distanceSquared(other: V4f): number {
    const dx = this._data[0]! - other._data[0]!;
    const dy = this._data[1]! - other._data[1]!;
    const dz = this._data[2]! - other._data[2]!;
    const dw = this._data[3]! - other._data[3]!;
    return dx * dx + dy * dy + dz * dz + dw * dw;
  }

  distance(other: V4f): number {
    return Math.sqrt(this.distanceSquared(other));
  }

  normalize(): V4f { return this.div(this.length()); }

  normalizeSafe(fallback: V4f = V4f.zero): V4f {
    const len = this.length();
    return len > 0 ? this.div(len) : fallback;
  }

  lerp(other: V4f, t: number): V4f {
    return new V4f(
      this._data[0]! + (other._data[0]! - this._data[0]!) * t,
      this._data[1]! + (other._data[1]! - this._data[1]!) * t,
      this._data[2]! + (other._data[2]! - this._data[2]!) * t,
      this._data[3]! + (other._data[3]! - this._data[3]!) * t,
    );
  }

  // ---------- component-wise math ----------

  abs(): V4f {
    return new V4f(
      Math.abs(this._data[0]!), Math.abs(this._data[1]!),
      Math.abs(this._data[2]!), Math.abs(this._data[3]!),
    );
  }

  floor(): V4f {
    return new V4f(
      Math.floor(this._data[0]!), Math.floor(this._data[1]!),
      Math.floor(this._data[2]!), Math.floor(this._data[3]!),
    );
  }

  ceil(): V4f {
    return new V4f(
      Math.ceil(this._data[0]!), Math.ceil(this._data[1]!),
      Math.ceil(this._data[2]!), Math.ceil(this._data[3]!),
    );
  }

  round(): V4f {
    return new V4f(
      Math.round(this._data[0]!), Math.round(this._data[1]!),
      Math.round(this._data[2]!), Math.round(this._data[3]!),
    );
  }

  fract(): V4f {
    return new V4f(
      this._data[0]! - Math.floor(this._data[0]!),
      this._data[1]! - Math.floor(this._data[1]!),
      this._data[2]! - Math.floor(this._data[2]!),
      this._data[3]! - Math.floor(this._data[3]!),
    );
  }

  sign(): V4f {
    return new V4f(
      Math.sign(this._data[0]!), Math.sign(this._data[1]!),
      Math.sign(this._data[2]!), Math.sign(this._data[3]!),
    );
  }

  min(other: V4f): V4f {
    return new V4f(
      Math.min(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
      Math.min(this._data[2]!, other._data[2]!),
      Math.min(this._data[3]!, other._data[3]!),
    );
  }

  max(other: V4f): V4f {
    return new V4f(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
      Math.max(this._data[2]!, other._data[2]!),
      Math.max(this._data[3]!, other._data[3]!),
    );
  }

  clamp(lo: V4f, hi: V4f): V4f {
    return new V4f(
      Math.min(Math.max(this._data[0]!, lo._data[0]!), hi._data[0]!),
      Math.min(Math.max(this._data[1]!, lo._data[1]!), hi._data[1]!),
      Math.min(Math.max(this._data[2]!, lo._data[2]!), hi._data[2]!),
      Math.min(Math.max(this._data[3]!, lo._data[3]!), hi._data[3]!),
    );
  }

  // ---------- reductions ----------

  minComp(): number {
    return Math.min(this._data[0]!, this._data[1]!, this._data[2]!, this._data[3]!);
  }

  maxComp(): number {
    return Math.max(this._data[0]!, this._data[1]!, this._data[2]!, this._data[3]!);
  }

  sumComp(): number {
    return this._data[0]! + this._data[1]! + this._data[2]! + this._data[3]!;
  }

  // ---------- component-wise comparison ----------

  lt(other: V4f): V4b {
    return new V4b(
      this._data[0]! < other._data[0]!, this._data[1]! < other._data[1]!,
      this._data[2]! < other._data[2]!, this._data[3]! < other._data[3]!,
    );
  }
  le(other: V4f): V4b {
    return new V4b(
      this._data[0]! <= other._data[0]!, this._data[1]! <= other._data[1]!,
      this._data[2]! <= other._data[2]!, this._data[3]! <= other._data[3]!,
    );
  }
  gt(other: V4f): V4b {
    return new V4b(
      this._data[0]! > other._data[0]!, this._data[1]! > other._data[1]!,
      this._data[2]! > other._data[2]!, this._data[3]! > other._data[3]!,
    );
  }
  ge(other: V4f): V4b {
    return new V4b(
      this._data[0]! >= other._data[0]!, this._data[1]! >= other._data[1]!,
      this._data[2]! >= other._data[2]!, this._data[3]! >= other._data[3]!,
    );
  }
  eq(other: V4f): V4b {
    return new V4b(
      this._data[0]! === other._data[0]!, this._data[1]! === other._data[1]!,
      this._data[2]! === other._data[2]!, this._data[3]! === other._data[3]!,
    );
  }
  neq(other: V4f): V4b {
    return new V4b(
      this._data[0]! !== other._data[0]!, this._data[1]! !== other._data[1]!,
      this._data[2]! !== other._data[2]!, this._data[3]! !== other._data[3]!,
    );
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V4f)) return false;
    return (
      this._data[0] === other._data[0] &&
      this._data[1] === other._data[1] &&
      this._data[2] === other._data[2] &&
      this._data[3] === other._data[3]
    );
  }

  approxEqual(other: V4f, eps: number): boolean {
    return (
      Math.abs(this._data[0]! - other._data[0]!) <= eps &&
      Math.abs(this._data[1]! - other._data[1]!) <= eps &&
      Math.abs(this._data[2]! - other._data[2]!) <= eps &&
      Math.abs(this._data[3]! - other._data[3]!) <= eps
    );
  }

  getHashCode(): number {
    let h = hashNumber(this._data[0]!);
    h = combineHash(h, hashNumber(this._data[1]!));
    h = combineHash(h, hashNumber(this._data[2]!));
    h = combineHash(h, hashNumber(this._data[3]!));
    return h;
  }

  toString(): string {
    return `V4f(${this._data[0]}, ${this._data[1]}, ${this._data[2]}, ${this._data[3]})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
    yield this._data[2]!;
    yield this._data[3]!;
  }

  toArray(): [number, number, number, number] {
    return [this._data[0]!, this._data[1]!, this._data[2]!, this._data[3]!];
  }

  // ---------- in-place / static-target variants (alloc-free) ----------

  static addInto(a: V4f, b: V4f, target: V4f): V4f {
    target._data[0] = a._data[0]! + b._data[0]!;
    target._data[1] = a._data[1]! + b._data[1]!;
    target._data[2] = a._data[2]! + b._data[2]!;
    target._data[3] = a._data[3]! + b._data[3]!;
    return target;
  }

  static subInto(a: V4f, b: V4f, target: V4f): V4f {
    target._data[0] = a._data[0]! - b._data[0]!;
    target._data[1] = a._data[1]! - b._data[1]!;
    target._data[2] = a._data[2]! - b._data[2]!;
    target._data[3] = a._data[3]! - b._data[3]!;
    return target;
  }

  static mulInto(a: V4f, b: V4f | number, target: V4f): V4f {
    if (typeof b === "number") {
      target._data[0] = a._data[0]! * b;
      target._data[1] = a._data[1]! * b;
      target._data[2] = a._data[2]! * b;
      target._data[3] = a._data[3]! * b;
    } else {
      target._data[0] = a._data[0]! * b._data[0]!;
      target._data[1] = a._data[1]! * b._data[1]!;
      target._data[2] = a._data[2]! * b._data[2]!;
      target._data[3] = a._data[3]! * b._data[3]!;
    }
    return target;
  }

  static copyInto(from: V4f, target: V4f): V4f {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    target._data[2] = from._data[2]!;
    target._data[3] = from._data[3]!;
    return target;
  }

  // ---------- operator overloads (boperators) ----------

  static "+"(a: V4f, b: V4f): V4f { return a.add(b); }
  static "-"(a: V4f, b: V4f): V4f;
  static "-"(a: V4f): V4f;
  static "-"(a: V4f, b?: V4f): V4f { return b ? a.sub(b) : a.neg(); }
  static "*"(a: V4f, b: V4f): V4f;
  static "*"(a: V4f, b: number): V4f;
  static "*"(a: number, b: V4f): V4f;
  static "*"(a: V4f | number, b: V4f | number): V4f {
    if (typeof a === "number") return (b as V4f).mul(a);
    return a.mul(b as V4f | number);
  }
  static "/"(a: V4f, b: V4f): V4f;
  static "/"(a: V4f, b: number): V4f;
  static "/"(a: V4f, b: V4f | number): V4f { return a.div(b); }

  "+="(o: V4f): void {
    this._data[0]! += o._data[0]!;
    this._data[1]! += o._data[1]!;
    this._data[2]! += o._data[2]!;
    this._data[3]! += o._data[3]!;
  }
  "-="(o: V4f): void {
    this._data[0]! -= o._data[0]!;
    this._data[1]! -= o._data[1]!;
    this._data[2]! -= o._data[2]!;
    this._data[3]! -= o._data[3]!;
  }
  "*="(o: V4f): void;
  "*="(o: number): void;
  "*="(o: V4f | number): void {
    if (typeof o === "number") { this._data[0]! *= o; this._data[1]! *= o; this._data[2]! *= o; this._data[3]! *= o; }
    else {
    this._data[0]! *= o._data[0]!;
    this._data[1]! *= o._data[1]!;
    this._data[2]! *= o._data[2]!;
    this._data[3]! *= o._data[3]!;
  }
  }
  "/="(o: V4f): void;
  "/="(o: number): void;
  "/="(o: V4f | number): void {
    if (typeof o === "number") { const inv = 1 / o; this._data[0]! *= inv; this._data[1]! *= inv; this._data[2]! *= inv; this._data[3]! *= inv; }
    else {
    this._data[0]! /= o._data[0]!;
    this._data[1]! /= o._data[1]!;
    this._data[2]! /= o._data[2]!;
    this._data[3]! /= o._data[3]!;
  }
  }
}

/** Convenience constructor alias: `V4fOf(x, y, z, w)`. */
export function V4fOf(x: number, y: number, z: number, w: number): V4f {
  return new V4f(x, y, z, w);
}
