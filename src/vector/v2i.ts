// V2i — 2-component int32 vector.
//
// Backed by an `Int32Array` of length 2. Components are truncated
// toward zero on assignment (TypedArray semantics).

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2b } from "./v2b.js";

const I32_BYTES = 4;
const COMPONENT_COUNT = 2;
const BYTES = COMPONENT_COUNT * I32_BYTES;

export class V2i {
  static readonly __aardworxMathBrand: "V2i" = "V2i";

  /** @internal */
  readonly _data: Int32Array;

  constructor(x: number = 0, y: number = 0) {
    this._data = new Int32Array(2);
    this._data[0] = x;
    this._data[1] = y;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V2i {
    const v = Object.create(V2i.prototype) as { _data: Int32Array };
    v._data = new Int32Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V2i;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  static readonly zero: V2i = new V2i(0, 0);
  static readonly one: V2i = new V2i(1, 1);
  static readonly unitX: V2i = new V2i(1, 0);
  static readonly unitY: V2i = new V2i(0, 1);

  static splat(s: number): V2i { return new V2i(s, s); }

  static copy(other: V2i): V2i {
    return new V2i(other._data[0]!, other._data[1]!);
  }

  static fromArrayLike(arr: ArrayLike<number>, offset: number = 0): V2i {
    return new V2i(arr[offset]!, arr[offset + 1]!);
  }

  get x(): number { return this._data[0]!; }
  set x(v: number) { this._data[0] = v; }
  get y(): number { return this._data[1]!; }
  set y(v: number) { this._data[1] = v; }

  add(other: V2i): V2i {
    return new V2i(this._data[0]! + other._data[0]!, this._data[1]! + other._data[1]!);
  }
  sub(other: V2i): V2i {
    return new V2i(this._data[0]! - other._data[0]!, this._data[1]! - other._data[1]!);
  }
  neg(): V2i { return new V2i(-this._data[0]!, -this._data[1]!); }

  mul(other: V2i | number): V2i {
    if (typeof other === "number") {
      return new V2i(this._data[0]! * other, this._data[1]! * other);
    }
    return new V2i(this._data[0]! * other._data[0]!, this._data[1]! * other._data[1]!);
  }

  div(other: V2i | number): V2i {
    if (typeof other === "number") {
      return new V2i(this._data[0]! / other, this._data[1]! / other);
    }
    return new V2i(this._data[0]! / other._data[0]!, this._data[1]! / other._data[1]!);
  }

  mod(other: V2i | number): V2i {
    if (typeof other === "number") {
      return new V2i(this._data[0]! % other, this._data[1]! % other);
    }
    return new V2i(this._data[0]! % other._data[0]!, this._data[1]! % other._data[1]!);
  }

  // ---------- bitwise ----------

  bitAnd(other: V2i | number): V2i {
    if (typeof other === "number") return new V2i(this._data[0]! & other, this._data[1]! & other);
    return new V2i(this._data[0]! & other._data[0]!, this._data[1]! & other._data[1]!);
  }
  bitOr(other: V2i | number): V2i {
    if (typeof other === "number") return new V2i(this._data[0]! | other, this._data[1]! | other);
    return new V2i(this._data[0]! | other._data[0]!, this._data[1]! | other._data[1]!);
  }
  bitXor(other: V2i | number): V2i {
    if (typeof other === "number") return new V2i(this._data[0]! ^ other, this._data[1]! ^ other);
    return new V2i(this._data[0]! ^ other._data[0]!, this._data[1]! ^ other._data[1]!);
  }
  bitNot(): V2i { return new V2i(~this._data[0]!, ~this._data[1]!); }
  shiftLeft(s: number): V2i { return new V2i(this._data[0]! << s, this._data[1]! << s); }
  shiftRight(s: number): V2i { return new V2i(this._data[0]! >> s, this._data[1]! >> s); }

  dot(other: V2i): number {
    return this._data[0]! * other._data[0]! + this._data[1]! * other._data[1]!;
  }

  /** Scalar perp-dot. */
  crossZ(other: V2i): number {
    return this._data[0]! * other._data[1]! - this._data[1]! * other._data[0]!;
  }

  lengthSquared(): number {
    const x = this._data[0]!, y = this._data[1]!;
    return x * x + y * y;
  }
  length(): number { return Math.sqrt(this.lengthSquared()); }
  distanceSquared(other: V2i): number {
    const dx = this._data[0]! - other._data[0]!;
    const dy = this._data[1]! - other._data[1]!;
    return dx * dx + dy * dy;
  }
  distance(other: V2i): number { return Math.sqrt(this.distanceSquared(other)); }

  abs(): V2i { return new V2i(Math.abs(this._data[0]!), Math.abs(this._data[1]!)); }
  floor(): V2i { return V2i.copy(this); }
  ceil(): V2i { return V2i.copy(this); }
  round(): V2i { return V2i.copy(this); }
  fract(): V2i { return V2i.zero; }
  sign(): V2i { return new V2i(Math.sign(this._data[0]!), Math.sign(this._data[1]!)); }

  min(other: V2i): V2i {
    return new V2i(
      Math.min(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
    );
  }
  max(other: V2i): V2i {
    return new V2i(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
    );
  }
  clamp(lo: V2i, hi: V2i): V2i {
    return new V2i(
      Math.min(Math.max(this._data[0]!, lo._data[0]!), hi._data[0]!),
      Math.min(Math.max(this._data[1]!, lo._data[1]!), hi._data[1]!),
    );
  }

  minComp(): number { return Math.min(this._data[0]!, this._data[1]!); }
  maxComp(): number { return Math.max(this._data[0]!, this._data[1]!); }
  sumComp(): number { return this._data[0]! + this._data[1]!; }

  lt(other: V2i): V2b { return new V2b(this._data[0]! < other._data[0]!, this._data[1]! < other._data[1]!); }
  le(other: V2i): V2b { return new V2b(this._data[0]! <= other._data[0]!, this._data[1]! <= other._data[1]!); }
  gt(other: V2i): V2b { return new V2b(this._data[0]! > other._data[0]!, this._data[1]! > other._data[1]!); }
  ge(other: V2i): V2b { return new V2b(this._data[0]! >= other._data[0]!, this._data[1]! >= other._data[1]!); }
  eq(other: V2i): V2b { return new V2b(this._data[0]! === other._data[0]!, this._data[1]! === other._data[1]!); }
  neq(other: V2i): V2b { return new V2b(this._data[0]! !== other._data[0]!, this._data[1]! !== other._data[1]!); }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V2i)) return false;
    return this._data[0] === other._data[0] && this._data[1] === other._data[1];
  }

  approxEqual(other: V2i, eps: number): boolean {
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

  toString(): string { return `V2i(${this._data[0]}, ${this._data[1]})`; }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
  }

  toArray(): [number, number] {
    return [this._data[0]!, this._data[1]!];
  }

  static addInto(a: V2i, b: V2i, target: V2i): V2i {
    target._data[0] = a._data[0]! + b._data[0]!;
    target._data[1] = a._data[1]! + b._data[1]!;
    return target;
  }
  static subInto(a: V2i, b: V2i, target: V2i): V2i {
    target._data[0] = a._data[0]! - b._data[0]!;
    target._data[1] = a._data[1]! - b._data[1]!;
    return target;
  }
  static mulInto(a: V2i, b: V2i | number, target: V2i): V2i {
    if (typeof b === "number") {
      target._data[0] = a._data[0]! * b;
      target._data[1] = a._data[1]! * b;
    } else {
      target._data[0] = a._data[0]! * b._data[0]!;
      target._data[1] = a._data[1]! * b._data[1]!;
    }
    return target;
  }
  static copyInto(from: V2i, target: V2i): V2i {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    return target;
  }

  // ---------- operator overloads (boperators) ----------

  static "+"(a: V2i, b: V2i): V2i { return a.add(b); }
  static "-"(a: V2i, b: V2i): V2i;
  static "-"(a: V2i): V2i;
  static "-"(a: V2i, b?: V2i): V2i { return b ? a.sub(b) : a.neg(); }
  static "*"(a: V2i, b: V2i): V2i;
  static "*"(a: V2i, b: number): V2i;
  static "*"(a: number, b: V2i): V2i;
  static "*"(a: V2i | number, b: V2i | number): V2i {
    if (typeof a === "number") return (b as V2i).mul(a);
    return a.mul(b as V2i | number);
  }
  static "/"(a: V2i, b: V2i): V2i;
  static "/"(a: V2i, b: number): V2i;
  static "/"(a: V2i, b: V2i | number): V2i { return a.div(b); }

  "+="(o: V2i): void {
    this._data[0]! += o._data[0]!;
    this._data[1]! += o._data[1]!;
  }
  "-="(o: V2i): void {
    this._data[0]! -= o._data[0]!;
    this._data[1]! -= o._data[1]!;
  }
  "*="(o: V2i): void;
  "*="(o: number): void;
  "*="(o: V2i | number): void {
    if (typeof o === "number") { this._data[0]! *= o; this._data[1]! *= o; }
    else {
    this._data[0]! *= o._data[0]!;
    this._data[1]! *= o._data[1]!;
  }
  }
  "/="(o: V2i): void;
  "/="(o: number): void;
  "/="(o: V2i | number): void {
    if (typeof o === "number") { const inv = 1 / o; this._data[0]! *= inv; this._data[1]! *= inv; }
    else {
    this._data[0]! /= o._data[0]!;
    this._data[1]! /= o._data[1]!;
  }
  }
}
