// V3ui — 3-component uint32 vector.
//
// Backed by an `Uint32Array` of length 3. Components are truncated
// toward zero on assignment (TypedArray semantics — no manual `| 0`).
// length/distance return plain JS numbers (floats); that's fine.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V3b } from "./v3b.js";

const U32_BYTES = 4;
const COMPONENT_COUNT = 3;
const BYTES = COMPONENT_COUNT * U32_BYTES;

export class V3ui {
  static readonly __aardworxMathBrand: "V3ui" = "V3ui";

  /** @internal */
  readonly _data: Uint32Array;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this._data = new Uint32Array(3);
    this._data[0] = x;
    this._data[1] = y;
    this._data[2] = z;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V3ui {
    const v = Object.create(V3ui.prototype) as { _data: Uint32Array };
    v._data = new Uint32Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V3ui;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  // ---------- factories ----------

  static readonly zero: V3ui = new V3ui(0, 0, 0);
  static readonly one: V3ui = new V3ui(1, 1, 1);
  static readonly unitX: V3ui = new V3ui(1, 0, 0);
  static readonly unitY: V3ui = new V3ui(0, 1, 0);
  static readonly unitZ: V3ui = new V3ui(0, 0, 1);

  static splat(s: number): V3ui { return new V3ui(s, s, s); }

  static copy(other: V3ui): V3ui {
    return new V3ui(other._data[0]!, other._data[1]!, other._data[2]!);
  }

  static fromArrayLike(arr: ArrayLike<number>, offset: number = 0): V3ui {
    return new V3ui(arr[offset]!, arr[offset + 1]!, arr[offset + 2]!);
  }

  // ---------- component access ----------

  get x(): number { return this._data[0]!; }
  set x(v: number) { this._data[0] = v; }
  get y(): number { return this._data[1]!; }
  set y(v: number) { this._data[1] = v; }
  get z(): number { return this._data[2]!; }
  set z(v: number) { this._data[2] = v; }

  // ---------- additive group ----------

  add(other: V3ui): V3ui {
    return new V3ui(
      this._data[0]! + other._data[0]!,
      this._data[1]! + other._data[1]!,
      this._data[2]! + other._data[2]!,
    );
  }

  sub(other: V3ui): V3ui {
    return new V3ui(
      this._data[0]! - other._data[0]!,
      this._data[1]! - other._data[1]!,
      this._data[2]! - other._data[2]!,
    );
  }


  // ---------- vector space ----------

  mul(other: V3ui | number): V3ui {
    if (typeof other === "number") {
      return new V3ui(this._data[0]! * other, this._data[1]! * other, this._data[2]! * other);
    }
    return new V3ui(
      this._data[0]! * other._data[0]!,
      this._data[1]! * other._data[1]!,
      this._data[2]! * other._data[2]!,
    );
  }

  div(other: V3ui | number): V3ui {
    if (typeof other === "number") {
      return new V3ui(this._data[0]! / other, this._data[1]! / other, this._data[2]! / other);
    }
    return new V3ui(
      this._data[0]! / other._data[0]!,
      this._data[1]! / other._data[1]!,
      this._data[2]! / other._data[2]!,
    );
  }

  mod(other: V3ui | number): V3ui {
    if (typeof other === "number") {
      return new V3ui(this._data[0]! % other, this._data[1]! % other, this._data[2]! % other);
    }
    return new V3ui(
      this._data[0]! % other._data[0]!,
      this._data[1]! % other._data[1]!,
      this._data[2]! % other._data[2]!,
    );
  }

  // ---------- bitwise ----------

  bitAnd(other: V3ui | number): V3ui {
    if (typeof other === "number") {
      return new V3ui(this._data[0]! & other, this._data[1]! & other, this._data[2]! & other);
    }
    return new V3ui(
      this._data[0]! & other._data[0]!,
      this._data[1]! & other._data[1]!,
      this._data[2]! & other._data[2]!,
    );
  }

  bitOr(other: V3ui | number): V3ui {
    if (typeof other === "number") {
      return new V3ui(this._data[0]! | other, this._data[1]! | other, this._data[2]! | other);
    }
    return new V3ui(
      this._data[0]! | other._data[0]!,
      this._data[1]! | other._data[1]!,
      this._data[2]! | other._data[2]!,
    );
  }

  bitXor(other: V3ui | number): V3ui {
    if (typeof other === "number") {
      return new V3ui(this._data[0]! ^ other, this._data[1]! ^ other, this._data[2]! ^ other);
    }
    return new V3ui(
      this._data[0]! ^ other._data[0]!,
      this._data[1]! ^ other._data[1]!,
      this._data[2]! ^ other._data[2]!,
    );
  }

  bitNot(): V3ui {
    return new V3ui(~this._data[0]!, ~this._data[1]!, ~this._data[2]!);
  }

  shiftLeft(s: number): V3ui {
    return new V3ui(this._data[0]! << s, this._data[1]! << s, this._data[2]! << s);
  }

  shiftRight(s: number): V3ui {
    return new V3ui(this._data[0]! >> s, this._data[1]! >> s, this._data[2]! >> s);
  }

  // ---------- vector geometry ----------

  dot(other: V3ui): number {
    return (
      this._data[0]! * other._data[0]! +
      this._data[1]! * other._data[1]! +
      this._data[2]! * other._data[2]!
    );
  }

  cross(other: V3ui): V3ui {
    const ax = this._data[0]!, ay = this._data[1]!, az = this._data[2]!;
    const bx = other._data[0]!, by = other._data[1]!, bz = other._data[2]!;
    return new V3ui(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
  }

  lengthSquared(): number {
    const x = this._data[0]!, y = this._data[1]!, z = this._data[2]!;
    return x * x + y * y + z * z;
  }

  length(): number {
    return Math.sqrt(this.lengthSquared());
  }

  distanceSquared(other: V3ui): number {
    const dx = this._data[0]! - other._data[0]!;
    const dy = this._data[1]! - other._data[1]!;
    const dz = this._data[2]! - other._data[2]!;
    return dx * dx + dy * dy + dz * dz;
  }

  distance(other: V3ui): number {
    return Math.sqrt(this.distanceSquared(other));
  }

  // ---------- component-wise math ----------

  abs(): V3ui {
    return new V3ui(Math.abs(this._data[0]!), Math.abs(this._data[1]!), Math.abs(this._data[2]!));
  }

  floor(): V3ui { return V3ui.copy(this); }
  ceil(): V3ui { return V3ui.copy(this); }
  round(): V3ui { return V3ui.copy(this); }
  /** Integers have no fractional part; returns zero. */
  fract(): V3ui { return V3ui.zero; }

  sign(): V3ui {
    return new V3ui(Math.sign(this._data[0]!), Math.sign(this._data[1]!), Math.sign(this._data[2]!));
  }

  min(other: V3ui): V3ui {
    return new V3ui(
      Math.min(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
      Math.min(this._data[2]!, other._data[2]!),
    );
  }

  max(other: V3ui): V3ui {
    return new V3ui(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
      Math.max(this._data[2]!, other._data[2]!),
    );
  }

  clamp(lo: V3ui, hi: V3ui): V3ui {
    return new V3ui(
      Math.min(Math.max(this._data[0]!, lo._data[0]!), hi._data[0]!),
      Math.min(Math.max(this._data[1]!, lo._data[1]!), hi._data[1]!),
      Math.min(Math.max(this._data[2]!, lo._data[2]!), hi._data[2]!),
    );
  }

  // ---------- reductions ----------

  minComp(): number { return Math.min(this._data[0]!, this._data[1]!, this._data[2]!); }
  maxComp(): number { return Math.max(this._data[0]!, this._data[1]!, this._data[2]!); }
  sumComp(): number { return this._data[0]! + this._data[1]! + this._data[2]!; }

  // ---------- component-wise comparison ----------

  lt(other: V3ui): V3b {
    return new V3b(
      this._data[0]! < other._data[0]!,
      this._data[1]! < other._data[1]!,
      this._data[2]! < other._data[2]!,
    );
  }
  le(other: V3ui): V3b {
    return new V3b(
      this._data[0]! <= other._data[0]!,
      this._data[1]! <= other._data[1]!,
      this._data[2]! <= other._data[2]!,
    );
  }
  gt(other: V3ui): V3b {
    return new V3b(
      this._data[0]! > other._data[0]!,
      this._data[1]! > other._data[1]!,
      this._data[2]! > other._data[2]!,
    );
  }
  ge(other: V3ui): V3b {
    return new V3b(
      this._data[0]! >= other._data[0]!,
      this._data[1]! >= other._data[1]!,
      this._data[2]! >= other._data[2]!,
    );
  }
  eq(other: V3ui): V3b {
    return new V3b(
      this._data[0]! === other._data[0]!,
      this._data[1]! === other._data[1]!,
      this._data[2]! === other._data[2]!,
    );
  }
  neq(other: V3ui): V3b {
    return new V3b(
      this._data[0]! !== other._data[0]!,
      this._data[1]! !== other._data[1]!,
      this._data[2]! !== other._data[2]!,
    );
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V3ui)) return false;
    return (
      this._data[0] === other._data[0] &&
      this._data[1] === other._data[1] &&
      this._data[2] === other._data[2]
    );
  }

  approxEqual(other: V3ui, eps: number): boolean {
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
    return `V3ui(${this._data[0]}, ${this._data[1]}, ${this._data[2]})`;
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

  static addInto(a: V3ui, b: V3ui, target: V3ui): V3ui {
    target._data[0] = a._data[0]! + b._data[0]!;
    target._data[1] = a._data[1]! + b._data[1]!;
    target._data[2] = a._data[2]! + b._data[2]!;
    return target;
  }

  static subInto(a: V3ui, b: V3ui, target: V3ui): V3ui {
    target._data[0] = a._data[0]! - b._data[0]!;
    target._data[1] = a._data[1]! - b._data[1]!;
    target._data[2] = a._data[2]! - b._data[2]!;
    return target;
  }

  static mulInto(a: V3ui, b: V3ui | number, target: V3ui): V3ui {
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

  static copyInto(from: V3ui, target: V3ui): V3ui {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    target._data[2] = from._data[2]!;
    return target;
  }

  // ---------- operator overloads (boperators) ----------

  static "+"(a: V3ui, b: V3ui): V3ui { return a.add(b); }
  static "-"(a: V3ui, b: V3ui): V3ui { return a.sub(b); }
  static "*"(a: V3ui, b: V3ui): V3ui;
  static "*"(a: V3ui, b: number): V3ui;
  static "*"(a: number, b: V3ui): V3ui;
  static "*"(a: V3ui | number, b: V3ui | number): V3ui {
    if (typeof a === "number") return (b as V3ui).mul(a);
    return a.mul(b as V3ui | number);
  }
  static "/"(a: V3ui, b: V3ui): V3ui;
  static "/"(a: V3ui, b: number): V3ui;
  static "/"(a: V3ui, b: V3ui | number): V3ui { return a.div(b); }

  "+="(o: V3ui): void {
    this._data[0]! += o._data[0]!;
    this._data[1]! += o._data[1]!;
    this._data[2]! += o._data[2]!;
  }
  "-="(o: V3ui): void {
    this._data[0]! -= o._data[0]!;
    this._data[1]! -= o._data[1]!;
    this._data[2]! -= o._data[2]!;
  }
  "*="(o: V3ui): void;
  "*="(o: number): void;
  "*="(o: V3ui | number): void {
    if (typeof o === "number") { this._data[0]! *= o; this._data[1]! *= o; this._data[2]! *= o; }
    else {
    this._data[0]! *= o._data[0]!;
    this._data[1]! *= o._data[1]!;
    this._data[2]! *= o._data[2]!;
  }
  }
  "/="(o: V3ui): void;
  "/="(o: number): void;
  "/="(o: V3ui | number): void {
    if (typeof o === "number") { const inv = 1 / o; this._data[0]! *= inv; this._data[1]! *= inv; this._data[2]! *= inv; }
    else {
    this._data[0]! /= o._data[0]!;
    this._data[1]! /= o._data[1]!;
    this._data[2]! /= o._data[2]!;
  }
  }
}
