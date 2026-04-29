// V4d — 4-component float64 vector.
//
// Backed by a `Float64Array` of length 4. Same conventions as V3f
// (see v3f.ts for the long-form rationale).

import { combineHash, hashNumber } from "../internal/hash.js";
import { V4b } from "./v4b.js";

const F64_BYTES = 8;
const COMPONENT_COUNT = 4;
const BYTES = COMPONENT_COUNT * F64_BYTES;

export class V4d {
  static readonly __aardworxMathBrand: "V4d" = "V4d";

  /** @internal */
  readonly _data: Float64Array;

  constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 0) {
    this._data = new Float64Array(4);
    this._data[0] = x;
    this._data[1] = y;
    this._data[2] = z;
    this._data[3] = w;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V4d {
    const v = Object.create(V4d.prototype) as { _data: Float64Array };
    v._data = new Float64Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V4d;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  // ---------- factories ----------

  static readonly zero: V4d = new V4d(0, 0, 0, 0);
  static readonly one: V4d = new V4d(1, 1, 1, 1);
  static readonly unitX: V4d = new V4d(1, 0, 0, 0);
  static readonly unitY: V4d = new V4d(0, 1, 0, 0);
  static readonly unitZ: V4d = new V4d(0, 0, 1, 0);
  static readonly unitW: V4d = new V4d(0, 0, 0, 1);

  static splat(s: number): V4d { return new V4d(s, s, s, s); }

  static copy(other: V4d): V4d {
    return new V4d(other._data[0]!, other._data[1]!, other._data[2]!, other._data[3]!);
  }

  static fromArrayLike(arr: ArrayLike<number>, offset: number = 0): V4d {
    return new V4d(arr[offset]!, arr[offset + 1]!, arr[offset + 2]!, arr[offset + 3]!);
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

  add(other: V4d): V4d {
    return new V4d(
      this._data[0]! + other._data[0]!,
      this._data[1]! + other._data[1]!,
      this._data[2]! + other._data[2]!,
      this._data[3]! + other._data[3]!,
    );
  }

  sub(other: V4d): V4d {
    return new V4d(
      this._data[0]! - other._data[0]!,
      this._data[1]! - other._data[1]!,
      this._data[2]! - other._data[2]!,
      this._data[3]! - other._data[3]!,
    );
  }

  neg(): V4d {
    return new V4d(-this._data[0]!, -this._data[1]!, -this._data[2]!, -this._data[3]!);
  }

  // ---------- vector space ----------

  mul(other: V4d | number): V4d {
    if (typeof other === "number") {
      return new V4d(
        this._data[0]! * other, this._data[1]! * other,
        this._data[2]! * other, this._data[3]! * other,
      );
    }
    return new V4d(
      this._data[0]! * other._data[0]!,
      this._data[1]! * other._data[1]!,
      this._data[2]! * other._data[2]!,
      this._data[3]! * other._data[3]!,
    );
  }

  div(other: V4d | number): V4d {
    if (typeof other === "number") {
      const inv = 1 / other;
      return new V4d(
        this._data[0]! * inv, this._data[1]! * inv,
        this._data[2]! * inv, this._data[3]! * inv,
      );
    }
    return new V4d(
      this._data[0]! / other._data[0]!,
      this._data[1]! / other._data[1]!,
      this._data[2]! / other._data[2]!,
      this._data[3]! / other._data[3]!,
    );
  }

  mod(other: V4d | number): V4d {
    if (typeof other === "number") {
      return new V4d(
        this._data[0]! % other, this._data[1]! % other,
        this._data[2]! % other, this._data[3]! % other,
      );
    }
    return new V4d(
      this._data[0]! % other._data[0]!,
      this._data[1]! % other._data[1]!,
      this._data[2]! % other._data[2]!,
      this._data[3]! % other._data[3]!,
    );
  }

  // ---------- vector geometry ----------

  dot(other: V4d): number {
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

  distanceSquared(other: V4d): number {
    const dx = this._data[0]! - other._data[0]!;
    const dy = this._data[1]! - other._data[1]!;
    const dz = this._data[2]! - other._data[2]!;
    const dw = this._data[3]! - other._data[3]!;
    return dx * dx + dy * dy + dz * dz + dw * dw;
  }

  distance(other: V4d): number {
    return Math.sqrt(this.distanceSquared(other));
  }

  normalize(): V4d { return this.div(this.length()); }

  normalizeSafe(fallback: V4d = V4d.zero): V4d {
    const len = this.length();
    return len > 0 ? this.div(len) : fallback;
  }

  lerp(other: V4d, t: number): V4d {
    return new V4d(
      this._data[0]! + (other._data[0]! - this._data[0]!) * t,
      this._data[1]! + (other._data[1]! - this._data[1]!) * t,
      this._data[2]! + (other._data[2]! - this._data[2]!) * t,
      this._data[3]! + (other._data[3]! - this._data[3]!) * t,
    );
  }

  // ---------- component-wise math ----------

  abs(): V4d {
    return new V4d(
      Math.abs(this._data[0]!), Math.abs(this._data[1]!),
      Math.abs(this._data[2]!), Math.abs(this._data[3]!),
    );
  }

  floor(): V4d {
    return new V4d(
      Math.floor(this._data[0]!), Math.floor(this._data[1]!),
      Math.floor(this._data[2]!), Math.floor(this._data[3]!),
    );
  }

  ceil(): V4d {
    return new V4d(
      Math.ceil(this._data[0]!), Math.ceil(this._data[1]!),
      Math.ceil(this._data[2]!), Math.ceil(this._data[3]!),
    );
  }

  round(): V4d {
    return new V4d(
      Math.round(this._data[0]!), Math.round(this._data[1]!),
      Math.round(this._data[2]!), Math.round(this._data[3]!),
    );
  }

  fract(): V4d {
    return new V4d(
      this._data[0]! - Math.floor(this._data[0]!),
      this._data[1]! - Math.floor(this._data[1]!),
      this._data[2]! - Math.floor(this._data[2]!),
      this._data[3]! - Math.floor(this._data[3]!),
    );
  }

  sign(): V4d {
    return new V4d(
      Math.sign(this._data[0]!), Math.sign(this._data[1]!),
      Math.sign(this._data[2]!), Math.sign(this._data[3]!),
    );
  }

  min(other: V4d): V4d {
    return new V4d(
      Math.min(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
      Math.min(this._data[2]!, other._data[2]!),
      Math.min(this._data[3]!, other._data[3]!),
    );
  }

  max(other: V4d): V4d {
    return new V4d(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
      Math.max(this._data[2]!, other._data[2]!),
      Math.max(this._data[3]!, other._data[3]!),
    );
  }

  clamp(lo: V4d, hi: V4d): V4d {
    return new V4d(
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

  lt(other: V4d): V4b {
    return new V4b(
      this._data[0]! < other._data[0]!, this._data[1]! < other._data[1]!,
      this._data[2]! < other._data[2]!, this._data[3]! < other._data[3]!,
    );
  }
  le(other: V4d): V4b {
    return new V4b(
      this._data[0]! <= other._data[0]!, this._data[1]! <= other._data[1]!,
      this._data[2]! <= other._data[2]!, this._data[3]! <= other._data[3]!,
    );
  }
  gt(other: V4d): V4b {
    return new V4b(
      this._data[0]! > other._data[0]!, this._data[1]! > other._data[1]!,
      this._data[2]! > other._data[2]!, this._data[3]! > other._data[3]!,
    );
  }
  ge(other: V4d): V4b {
    return new V4b(
      this._data[0]! >= other._data[0]!, this._data[1]! >= other._data[1]!,
      this._data[2]! >= other._data[2]!, this._data[3]! >= other._data[3]!,
    );
  }
  eq(other: V4d): V4b {
    return new V4b(
      this._data[0]! === other._data[0]!, this._data[1]! === other._data[1]!,
      this._data[2]! === other._data[2]!, this._data[3]! === other._data[3]!,
    );
  }
  neq(other: V4d): V4b {
    return new V4b(
      this._data[0]! !== other._data[0]!, this._data[1]! !== other._data[1]!,
      this._data[2]! !== other._data[2]!, this._data[3]! !== other._data[3]!,
    );
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V4d)) return false;
    return (
      this._data[0] === other._data[0] &&
      this._data[1] === other._data[1] &&
      this._data[2] === other._data[2] &&
      this._data[3] === other._data[3]
    );
  }

  approxEqual(other: V4d, eps: number): boolean {
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
    return `V4d(${this._data[0]}, ${this._data[1]}, ${this._data[2]}, ${this._data[3]})`;
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

  static addInto(a: V4d, b: V4d, target: V4d): V4d {
    target._data[0] = a._data[0]! + b._data[0]!;
    target._data[1] = a._data[1]! + b._data[1]!;
    target._data[2] = a._data[2]! + b._data[2]!;
    target._data[3] = a._data[3]! + b._data[3]!;
    return target;
  }

  static subInto(a: V4d, b: V4d, target: V4d): V4d {
    target._data[0] = a._data[0]! - b._data[0]!;
    target._data[1] = a._data[1]! - b._data[1]!;
    target._data[2] = a._data[2]! - b._data[2]!;
    target._data[3] = a._data[3]! - b._data[3]!;
    return target;
  }

  static mulInto(a: V4d, b: V4d | number, target: V4d): V4d {
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

  static copyInto(from: V4d, target: V4d): V4d {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    target._data[2] = from._data[2]!;
    target._data[3] = from._data[3]!;
    return target;
  }

  // ---------- operator overloads (boperators) ----------

  static "+"(a: V4d, b: V4d): V4d { return a.add(b); }
  static "-"(a: V4d, b: V4d): V4d;
  static "-"(a: V4d): V4d;
  static "-"(a: V4d, b?: V4d): V4d { return b ? a.sub(b) : a.neg(); }
  static "*"(a: V4d, b: V4d): V4d;
  static "*"(a: V4d, b: number): V4d;
  static "*"(a: number, b: V4d): V4d;
  static "*"(a: V4d | number, b: V4d | number): V4d {
    if (typeof a === "number") return (b as V4d).mul(a);
    return a.mul(b as V4d | number);
  }
  static "/"(a: V4d, b: V4d): V4d;
  static "/"(a: V4d, b: number): V4d;
  static "/"(a: V4d, b: V4d | number): V4d { return a.div(b); }

  "+="(o: V4d): void {
    this._data[0]! += o._data[0]!;
    this._data[1]! += o._data[1]!;
    this._data[2]! += o._data[2]!;
    this._data[3]! += o._data[3]!;
  }
  "-="(o: V4d): void {
    this._data[0]! -= o._data[0]!;
    this._data[1]! -= o._data[1]!;
    this._data[2]! -= o._data[2]!;
    this._data[3]! -= o._data[3]!;
  }
  "*="(o: V4d): void;
  "*="(o: number): void;
  "*="(o: V4d | number): void {
    if (typeof o === "number") { this._data[0]! *= o; this._data[1]! *= o; this._data[2]! *= o; this._data[3]! *= o; }
    else {
    this._data[0]! *= o._data[0]!;
    this._data[1]! *= o._data[1]!;
    this._data[2]! *= o._data[2]!;
    this._data[3]! *= o._data[3]!;
  }
  }
  "/="(o: V4d): void;
  "/="(o: number): void;
  "/="(o: V4d | number): void {
    if (typeof o === "number") { const inv = 1 / o; this._data[0]! *= inv; this._data[1]! *= inv; this._data[2]! *= inv; this._data[3]! *= inv; }
    else {
    this._data[0]! /= o._data[0]!;
    this._data[1]! /= o._data[1]!;
    this._data[2]! /= o._data[2]!;
    this._data[3]! /= o._data[3]!;
  }
  }
}

