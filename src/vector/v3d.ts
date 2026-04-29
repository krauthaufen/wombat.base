// V3d — 3-component float64 vector.
//
// Backed by a `Float64Array` of length 3. Construction takes ownership
// of a fresh buffer; `V3d.viewOnto(buffer, byteOffset)` constructs an
// instance that aliases existing storage (used by V3dArray).
//
// Both forms share the same prototype, so every method works
// identically whether the V3d owns its bytes or views into a packed
// V3dArray.
//
// Precision: every write goes through `Float64Array`'s assignment,
// which rounds to nearest f32 — so `new V3d(1.1, 0, 0).x ===
// V3dArray.fromIterable([new V3d(1.1, 0, 0)]).get(0).x` always.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V3b } from "./v3b.js";

const F64_BYTES = 8;
const COMPONENT_COUNT = 3;
const BYTES = COMPONENT_COUNT * F64_BYTES;

export class V3d {
  /** Brand: marks this class as an aardvark math type for the operator plugin. */
  static readonly __aardworxMathBrand: "V3d" = "V3d";

  /**
   * Backing storage. Length 3. Either freshly allocated (owned form)
   * or a subarray over a larger buffer (view form, returned by
   * `V3dArray.viewAt`).
   * @internal
   */
  readonly _data: Float64Array;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this._data = new Float64Array(3);
    this._data[0] = x;
    this._data[1] = y;
    this._data[2] = z;
  }

  /**
   * Constructs a V3d that *aliases* the given buffer at the given
   * byte offset. Mutations write through to the buffer. Used
   * internally by V3dArray; rarely needed by users.
   */
  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V3d {
    const v = Object.create(V3d.prototype) as { _data: Float64Array };
    v._data = new Float64Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V3d;
  }

  /** Number of components (always 3). */
  static readonly componentCount = COMPONENT_COUNT;
  /** Byte size of one V3d (12). */
  static readonly byteSize = BYTES;

  // ---------- factories ----------

  static readonly zero: V3d = new V3d(0, 0, 0);
  static readonly one: V3d = new V3d(1, 1, 1);
  static readonly unitX: V3d = new V3d(1, 0, 0);
  static readonly unitY: V3d = new V3d(0, 1, 0);
  static readonly unitZ: V3d = new V3d(0, 0, 1);

  /** Same value in all components. */
  static splat(s: number): V3d {
    return new V3d(s, s, s);
  }

  /** Copies an existing V3d. */
  static copy(other: V3d): V3d {
    return new V3d(other._data[0]!, other._data[1]!, other._data[2]!);
  }

  /** Reads three consecutive components from `arr` starting at `offset`. */
  static fromArrayLike(arr: ArrayLike<number>, offset: number = 0): V3d {
    return new V3d(arr[offset]!, arr[offset + 1]!, arr[offset + 2]!);
  }

  // ---------- component access ----------

  get x(): number { return this._data[0]!; }
  set x(v: number) { this._data[0] = v; }
  get y(): number { return this._data[1]!; }
  set y(v: number) { this._data[1] = v; }
  get z(): number { return this._data[2]!; }
  set z(v: number) { this._data[2] = v; }

  // ---------- additive group ----------

  add(other: V3d): V3d {
    return new V3d(
      this._data[0]! + other._data[0]!,
      this._data[1]! + other._data[1]!,
      this._data[2]! + other._data[2]!,
    );
  }

  sub(other: V3d): V3d {
    return new V3d(
      this._data[0]! - other._data[0]!,
      this._data[1]! - other._data[1]!,
      this._data[2]! - other._data[2]!,
    );
  }

  neg(): V3d {
    return new V3d(-this._data[0]!, -this._data[1]!, -this._data[2]!);
  }

  // ---------- vector space ----------

  /** Component-wise multiply by another vector OR scalar multiply. */
  mul(other: V3d | number): V3d {
    if (typeof other === "number") {
      return new V3d(
        this._data[0]! * other,
        this._data[1]! * other,
        this._data[2]! * other,
      );
    }
    return new V3d(
      this._data[0]! * other._data[0]!,
      this._data[1]! * other._data[1]!,
      this._data[2]! * other._data[2]!,
    );
  }

  div(other: V3d | number): V3d {
    if (typeof other === "number") {
      const inv = 1 / other;
      return new V3d(
        this._data[0]! * inv,
        this._data[1]! * inv,
        this._data[2]! * inv,
      );
    }
    return new V3d(
      this._data[0]! / other._data[0]!,
      this._data[1]! / other._data[1]!,
      this._data[2]! / other._data[2]!,
    );
  }

  mod(other: V3d | number): V3d {
    if (typeof other === "number") {
      return new V3d(
        this._data[0]! % other,
        this._data[1]! % other,
        this._data[2]! % other,
      );
    }
    return new V3d(
      this._data[0]! % other._data[0]!,
      this._data[1]! % other._data[1]!,
      this._data[2]! % other._data[2]!,
    );
  }

  // ---------- vector geometry ----------

  dot(other: V3d): number {
    return (
      this._data[0]! * other._data[0]! +
      this._data[1]! * other._data[1]! +
      this._data[2]! * other._data[2]!
    );
  }

  cross(other: V3d): V3d {
    const ax = this._data[0]!, ay = this._data[1]!, az = this._data[2]!;
    const bx = other._data[0]!, by = other._data[1]!, bz = other._data[2]!;
    return new V3d(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
  }

  lengthSquared(): number {
    const x = this._data[0]!, y = this._data[1]!, z = this._data[2]!;
    return x * x + y * y + z * z;
  }

  length(): number {
    return Math.sqrt(this.lengthSquared());
  }

  distanceSquared(other: V3d): number {
    const dx = this._data[0]! - other._data[0]!;
    const dy = this._data[1]! - other._data[1]!;
    const dz = this._data[2]! - other._data[2]!;
    return dx * dx + dy * dy + dz * dz;
  }

  distance(other: V3d): number {
    return Math.sqrt(this.distanceSquared(other));
  }

  /** Returns a unit-length vector. Result is `(NaN, NaN, NaN)` if `this` has length 0. */
  normalize(): V3d {
    return this.div(this.length());
  }

  /** Returns a unit-length vector, or the supplied fallback if `this` has length 0. */
  normalizeSafe(fallback: V3d = V3d.zero): V3d {
    const len = this.length();
    return len > 0 ? this.div(len) : fallback;
  }

  /** `this + (other - this) * t`, component-wise. */
  lerp(other: V3d, t: number): V3d {
    return new V3d(
      this._data[0]! + (other._data[0]! - this._data[0]!) * t,
      this._data[1]! + (other._data[1]! - this._data[1]!) * t,
      this._data[2]! + (other._data[2]! - this._data[2]!) * t,
    );
  }

  // ---------- component-wise math ----------

  abs(): V3d {
    return new V3d(
      Math.abs(this._data[0]!),
      Math.abs(this._data[1]!),
      Math.abs(this._data[2]!),
    );
  }

  floor(): V3d {
    return new V3d(
      Math.floor(this._data[0]!),
      Math.floor(this._data[1]!),
      Math.floor(this._data[2]!),
    );
  }

  ceil(): V3d {
    return new V3d(
      Math.ceil(this._data[0]!),
      Math.ceil(this._data[1]!),
      Math.ceil(this._data[2]!),
    );
  }

  round(): V3d {
    return new V3d(
      Math.round(this._data[0]!),
      Math.round(this._data[1]!),
      Math.round(this._data[2]!),
    );
  }

  fract(): V3d {
    return new V3d(
      this._data[0]! - Math.floor(this._data[0]!),
      this._data[1]! - Math.floor(this._data[1]!),
      this._data[2]! - Math.floor(this._data[2]!),
    );
  }

  sign(): V3d {
    return new V3d(
      Math.sign(this._data[0]!),
      Math.sign(this._data[1]!),
      Math.sign(this._data[2]!),
    );
  }

  min(other: V3d): V3d {
    return new V3d(
      Math.min(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
      Math.min(this._data[2]!, other._data[2]!),
    );
  }

  max(other: V3d): V3d {
    return new V3d(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
      Math.max(this._data[2]!, other._data[2]!),
    );
  }

  clamp(lo: V3d, hi: V3d): V3d {
    return new V3d(
      Math.min(Math.max(this._data[0]!, lo._data[0]!), hi._data[0]!),
      Math.min(Math.max(this._data[1]!, lo._data[1]!), hi._data[1]!),
      Math.min(Math.max(this._data[2]!, lo._data[2]!), hi._data[2]!),
    );
  }

  // ---------- reductions ----------

  minComp(): number {
    return Math.min(this._data[0]!, this._data[1]!, this._data[2]!);
  }

  maxComp(): number {
    return Math.max(this._data[0]!, this._data[1]!, this._data[2]!);
  }

  sumComp(): number {
    return this._data[0]! + this._data[1]! + this._data[2]!;
  }

  // ---------- component-wise comparison ----------

  lt(other: V3d): V3b {
    return new V3b(
      this._data[0]! < other._data[0]!,
      this._data[1]! < other._data[1]!,
      this._data[2]! < other._data[2]!,
    );
  }
  le(other: V3d): V3b {
    return new V3b(
      this._data[0]! <= other._data[0]!,
      this._data[1]! <= other._data[1]!,
      this._data[2]! <= other._data[2]!,
    );
  }
  gt(other: V3d): V3b {
    return new V3b(
      this._data[0]! > other._data[0]!,
      this._data[1]! > other._data[1]!,
      this._data[2]! > other._data[2]!,
    );
  }
  ge(other: V3d): V3b {
    return new V3b(
      this._data[0]! >= other._data[0]!,
      this._data[1]! >= other._data[1]!,
      this._data[2]! >= other._data[2]!,
    );
  }
  eq(other: V3d): V3b {
    return new V3b(
      this._data[0]! === other._data[0]!,
      this._data[1]! === other._data[1]!,
      this._data[2]! === other._data[2]!,
    );
  }
  neq(other: V3d): V3b {
    return new V3b(
      this._data[0]! !== other._data[0]!,
      this._data[1]! !== other._data[1]!,
      this._data[2]! !== other._data[2]!,
    );
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V3d)) return false;
    return (
      this._data[0] === other._data[0] &&
      this._data[1] === other._data[1] &&
      this._data[2] === other._data[2]
    );
  }

  approxEqual(other: V3d, eps: number): boolean {
    return (
      Math.abs(this._data[0]! - other._data[0]!) <= eps &&
      Math.abs(this._data[1]! - other._data[1]!) <= eps &&
      Math.abs(this._data[2]! - other._data[2]!) <= eps
    );
  }

  getHashCode(): number {
    let h = hashNumber(this._data[0]!);
    h = combineHash(h, hashNumber(this._data[1]!));
    h = combineHash(h, hashNumber(this._data[2]!));
    return h;
  }

  toString(): string {
    return `V3d(${this._data[0]}, ${this._data[1]}, ${this._data[2]})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
    yield this._data[2]!;
  }

  toArray(): [number, number, number] {
    return [this._data[0]!, this._data[1]!, this._data[2]!];
  }

  // ---------- in-place / static-target variants (alloc-free) ----------

  /**
   * Adds `b` to `a` and writes the result into `target`. `target` may
   * alias `a` or `b`. Returns `target` for chaining.
   */
  static addInto(a: V3d, b: V3d, target: V3d): V3d {
    target._data[0] = a._data[0]! + b._data[0]!;
    target._data[1] = a._data[1]! + b._data[1]!;
    target._data[2] = a._data[2]! + b._data[2]!;
    return target;
  }

  static subInto(a: V3d, b: V3d, target: V3d): V3d {
    target._data[0] = a._data[0]! - b._data[0]!;
    target._data[1] = a._data[1]! - b._data[1]!;
    target._data[2] = a._data[2]! - b._data[2]!;
    return target;
  }

  static mulInto(a: V3d, b: V3d | number, target: V3d): V3d {
    if (typeof b === "number") {
      target._data[0] = a._data[0]! * b;
      target._data[1] = a._data[1]! * b;
      target._data[2] = a._data[2]! * b;
    } else {
      target._data[0] = a._data[0]! * b._data[0]!;
      target._data[1] = a._data[1]! * b._data[1]!;
      target._data[2] = a._data[2]! * b._data[2]!;
    }
    return target;
  }

  /** Copies `from` into `target`. */
  static copyInto(from: V3d, target: V3d): V3d {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    target._data[2] = from._data[2]!;
    return target;
  }
}

