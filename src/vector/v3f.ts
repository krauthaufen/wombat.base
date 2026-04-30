// V3f — 3-component float32 vector.
//
// Backed by a `Float32Array` of length 3. Construction takes ownership
// of a fresh buffer; `V3f.viewOnto(buffer, byteOffset)` constructs an
// instance that aliases existing storage (used by V3fArray).
//
// Both forms share the same prototype, so every method works
// identically whether the V3f owns its bytes or views into a packed
// V3fArray.
//
// Precision: every write goes through `Float32Array`'s assignment,
// which rounds to nearest f32 — so `new V3f(1.1, 0, 0).x ===
// V3fArray.fromIterable([new V3f(1.1, 0, 0)]).get(0).x` always.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2f } from "./v2f.js";
import { V3b } from "./v3b.js";

const F32_BYTES = 4;
const COMPONENT_COUNT = 3;
const BYTES = COMPONENT_COUNT * F32_BYTES;

export class V3f {
  /** Brand: marks this class as an aardvark math type for the operator plugin. */
  static readonly __aardworxMathBrand: "V3f" = "V3f";

  /**
   * Backing storage. Length 3. Either freshly allocated (owned form)
   * or a subarray over a larger buffer (view form, returned by
   * `V3fArray.viewAt`).
   * @internal
   */
  readonly _data: Float32Array;

  /**
   * Construct a V3f from three scalars or a (V2f, scalar) /
   * (scalar, V2f) promotion. Mirrors the GLSL/WGSL `vec3(...)`
   * forms.
   */
  constructor();
  constructor(x: number, y: number, z: number);
  constructor(xy: V2f, z: number);
  constructor(x: number, yz: V2f);
  constructor(...args: ReadonlyArray<number | V2f>) {
    this._data = new Float32Array(3);
    let i = 0;
    for (const a of args) {
      if (i >= 3) break;
      if (typeof a === "number") {
        this._data[i++] = a;
      } else if (a instanceof V2f) {
        this._data[i++] = a.x;
        if (i < 3) this._data[i++] = a.y;
      }
    }
  }

  /**
   * Constructs a V3f that *aliases* the given buffer at the given
   * byte offset. Mutations write through to the buffer. Used
   * internally by V3fArray; rarely needed by users.
   */
  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V3f {
    const v = Object.create(V3f.prototype) as { _data: Float32Array };
    v._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V3f;
  }

  /** Number of components (always 3). */
  static readonly componentCount = COMPONENT_COUNT;
  /** Byte size of one V3f (12). */
  static readonly byteSize = BYTES;

  // ---------- factories ----------

  static readonly zero: V3f = new V3f(0, 0, 0);
  static readonly one: V3f = new V3f(1, 1, 1);
  static readonly unitX: V3f = new V3f(1, 0, 0);
  static readonly unitY: V3f = new V3f(0, 1, 0);
  static readonly unitZ: V3f = new V3f(0, 0, 1);

  /** Same value in all components. */
  static splat(s: number): V3f {
    return new V3f(s, s, s);
  }

  /** Copies an existing V3f. */
  static copy(other: V3f): V3f {
    return new V3f(other._data[0]!, other._data[1]!, other._data[2]!);
  }

  /** Reads three consecutive components from `arr` starting at `offset`. */
  static fromArrayLike(arr: ArrayLike<number>, offset: number = 0): V3f {
    return new V3f(arr[offset]!, arr[offset + 1]!, arr[offset + 2]!);
  }

  // ---------- component access ----------

  get x(): number { return this._data[0]!; }
  set x(v: number) { this._data[0] = v; }
  get y(): number { return this._data[1]!; }
  set y(v: number) { this._data[1] = v; }
  get z(): number { return this._data[2]!; }
  set z(v: number) { this._data[2] = v; }

  // ---------- additive group ----------

  add(other: V3f): V3f {
    return new V3f(
      this._data[0]! + other._data[0]!,
      this._data[1]! + other._data[1]!,
      this._data[2]! + other._data[2]!,
    );
  }

  sub(other: V3f): V3f {
    return new V3f(
      this._data[0]! - other._data[0]!,
      this._data[1]! - other._data[1]!,
      this._data[2]! - other._data[2]!,
    );
  }

  neg(): V3f {
    return new V3f(-this._data[0]!, -this._data[1]!, -this._data[2]!);
  }

  // ---------- vector space ----------

  /** Component-wise multiply by another vector OR scalar multiply. */
  mul(other: V3f | number): V3f {
    if (typeof other === "number") {
      return new V3f(
        this._data[0]! * other,
        this._data[1]! * other,
        this._data[2]! * other,
      );
    }
    return new V3f(
      this._data[0]! * other._data[0]!,
      this._data[1]! * other._data[1]!,
      this._data[2]! * other._data[2]!,
    );
  }

  div(other: V3f | number): V3f {
    if (typeof other === "number") {
      const inv = 1 / other;
      return new V3f(
        this._data[0]! * inv,
        this._data[1]! * inv,
        this._data[2]! * inv,
      );
    }
    return new V3f(
      this._data[0]! / other._data[0]!,
      this._data[1]! / other._data[1]!,
      this._data[2]! / other._data[2]!,
    );
  }

  mod(other: V3f | number): V3f {
    if (typeof other === "number") {
      return new V3f(
        this._data[0]! % other,
        this._data[1]! % other,
        this._data[2]! % other,
      );
    }
    return new V3f(
      this._data[0]! % other._data[0]!,
      this._data[1]! % other._data[1]!,
      this._data[2]! % other._data[2]!,
    );
  }

  // ---------- vector geometry ----------

  dot(other: V3f): number {
    return (
      this._data[0]! * other._data[0]! +
      this._data[1]! * other._data[1]! +
      this._data[2]! * other._data[2]!
    );
  }

  cross(other: V3f): V3f {
    const ax = this._data[0]!, ay = this._data[1]!, az = this._data[2]!;
    const bx = other._data[0]!, by = other._data[1]!, bz = other._data[2]!;
    return new V3f(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
  }

  lengthSquared(): number {
    const x = this._data[0]!, y = this._data[1]!, z = this._data[2]!;
    return x * x + y * y + z * z;
  }

  length(): number {
    return Math.sqrt(this.lengthSquared());
  }

  distanceSquared(other: V3f): number {
    const dx = this._data[0]! - other._data[0]!;
    const dy = this._data[1]! - other._data[1]!;
    const dz = this._data[2]! - other._data[2]!;
    return dx * dx + dy * dy + dz * dz;
  }

  distance(other: V3f): number {
    return Math.sqrt(this.distanceSquared(other));
  }

  /** Returns a unit-length vector. Result is `(NaN, NaN, NaN)` if `this` has length 0. */
  normalize(): V3f {
    return this.div(this.length());
  }

  /** Returns a unit-length vector, or the supplied fallback if `this` has length 0. */
  normalizeSafe(fallback: V3f = V3f.zero): V3f {
    const len = this.length();
    return len > 0 ? this.div(len) : fallback;
  }

  /** `this + (other - this) * t`, component-wise. */
  lerp(other: V3f, t: number): V3f {
    return new V3f(
      this._data[0]! + (other._data[0]! - this._data[0]!) * t,
      this._data[1]! + (other._data[1]! - this._data[1]!) * t,
      this._data[2]! + (other._data[2]! - this._data[2]!) * t,
    );
  }

  // ---------- component-wise math ----------

  abs(): V3f {
    return new V3f(
      Math.abs(this._data[0]!),
      Math.abs(this._data[1]!),
      Math.abs(this._data[2]!),
    );
  }

  floor(): V3f {
    return new V3f(
      Math.floor(this._data[0]!),
      Math.floor(this._data[1]!),
      Math.floor(this._data[2]!),
    );
  }

  ceil(): V3f {
    return new V3f(
      Math.ceil(this._data[0]!),
      Math.ceil(this._data[1]!),
      Math.ceil(this._data[2]!),
    );
  }

  round(): V3f {
    return new V3f(
      Math.round(this._data[0]!),
      Math.round(this._data[1]!),
      Math.round(this._data[2]!),
    );
  }

  fract(): V3f {
    return new V3f(
      this._data[0]! - Math.floor(this._data[0]!),
      this._data[1]! - Math.floor(this._data[1]!),
      this._data[2]! - Math.floor(this._data[2]!),
    );
  }

  sign(): V3f {
    return new V3f(
      Math.sign(this._data[0]!),
      Math.sign(this._data[1]!),
      Math.sign(this._data[2]!),
    );
  }

  min(other: V3f): V3f {
    return new V3f(
      Math.min(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
      Math.min(this._data[2]!, other._data[2]!),
    );
  }

  max(other: V3f): V3f {
    return new V3f(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
      Math.max(this._data[2]!, other._data[2]!),
    );
  }

  clamp(lo: V3f, hi: V3f): V3f {
    return new V3f(
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

  lt(other: V3f): V3b {
    return new V3b(
      this._data[0]! < other._data[0]!,
      this._data[1]! < other._data[1]!,
      this._data[2]! < other._data[2]!,
    );
  }
  le(other: V3f): V3b {
    return new V3b(
      this._data[0]! <= other._data[0]!,
      this._data[1]! <= other._data[1]!,
      this._data[2]! <= other._data[2]!,
    );
  }
  gt(other: V3f): V3b {
    return new V3b(
      this._data[0]! > other._data[0]!,
      this._data[1]! > other._data[1]!,
      this._data[2]! > other._data[2]!,
    );
  }
  ge(other: V3f): V3b {
    return new V3b(
      this._data[0]! >= other._data[0]!,
      this._data[1]! >= other._data[1]!,
      this._data[2]! >= other._data[2]!,
    );
  }
  eq(other: V3f): V3b {
    return new V3b(
      this._data[0]! === other._data[0]!,
      this._data[1]! === other._data[1]!,
      this._data[2]! === other._data[2]!,
    );
  }
  neq(other: V3f): V3b {
    return new V3b(
      this._data[0]! !== other._data[0]!,
      this._data[1]! !== other._data[1]!,
      this._data[2]! !== other._data[2]!,
    );
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V3f)) return false;
    return (
      this._data[0] === other._data[0] &&
      this._data[1] === other._data[1] &&
      this._data[2] === other._data[2]
    );
  }

  approxEqual(other: V3f, eps: number): boolean {
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
    return `V3f(${this._data[0]}, ${this._data[1]}, ${this._data[2]})`;
  }

  // ---------- operator overloads (boperators) ----------

  static "+"(a: V3f, b: V3f): V3f { return a.add(b); }
  static "-"(a: V3f, b: V3f): V3f;
  static "-"(a: V3f): V3f;
  static "-"(a: V3f, b?: V3f): V3f { return b ? a.sub(b) : a.neg(); }
  static "*"(a: V3f, b: V3f): V3f;
  static "*"(a: V3f, b: number): V3f;
  static "*"(a: number, b: V3f): V3f;
  static "*"(a: V3f | number, b: V3f | number): V3f {
    if (typeof a === "number") return (b as V3f).mul(a);
    return a.mul(b as V3f | number);
  }
  static "/"(a: V3f, b: V3f): V3f;
  static "/"(a: V3f, b: number): V3f;
  static "/"(a: V3f, b: V3f | number): V3f { return a.div(b); }

  // Compound-assignment forms: boperators dispatches `v += w` to v["+="](w),
  // which must mutate `this` in place (the result of the call is discarded).
  "+="(o: V3f): void {
    this._data[0]! += o._data[0]!;
    this._data[1]! += o._data[1]!;
    this._data[2]! += o._data[2]!;
  }
  "-="(o: V3f): void {
    this._data[0]! -= o._data[0]!;
    this._data[1]! -= o._data[1]!;
    this._data[2]! -= o._data[2]!;
  }
  "*="(o: V3f): void;
  "*="(o: number): void;
  "*="(o: V3f | number): void {
    if (typeof o === "number") {
      this._data[0]! *= o;
      this._data[1]! *= o;
      this._data[2]! *= o;
    } else {
      this._data[0]! *= o._data[0]!;
      this._data[1]! *= o._data[1]!;
      this._data[2]! *= o._data[2]!;
    }
  }
  "/="(o: V3f): void;
  "/="(o: number): void;
  "/="(o: V3f | number): void {
    if (typeof o === "number") {
      const inv = 1 / o;
      this._data[0]! *= inv;
      this._data[1]! *= inv;
      this._data[2]! *= inv;
    } else {
      this._data[0]! /= o._data[0]!;
      this._data[1]! /= o._data[1]!;
      this._data[2]! /= o._data[2]!;
    }
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
  static addInto(a: V3f, b: V3f, target: V3f): V3f {
    target._data[0] = a._data[0]! + b._data[0]!;
    target._data[1] = a._data[1]! + b._data[1]!;
    target._data[2] = a._data[2]! + b._data[2]!;
    return target;
  }

  static subInto(a: V3f, b: V3f, target: V3f): V3f {
    target._data[0] = a._data[0]! - b._data[0]!;
    target._data[1] = a._data[1]! - b._data[1]!;
    target._data[2] = a._data[2]! - b._data[2]!;
    return target;
  }

  static mulInto(a: V3f, b: V3f | number, target: V3f): V3f {
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
  static copyInto(from: V3f, target: V3f): V3f {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    target._data[2] = from._data[2]!;
    return target;
  }
}

/** Convenience constructor alias: `V3fOf(x, y, z)`. */
export function V3fOf(x: number, y: number, z: number): V3f {
  return new V3f(x, y, z);
}
