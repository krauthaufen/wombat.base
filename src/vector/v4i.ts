// V4i — 4-component int32 vector.
//
// Backed by an `Int32Array` of length 4. Components are truncated
// toward zero on assignment (TypedArray semantics).

import { combineHash, hashNumber } from "../internal/hash.js";
import { V4b } from "./v4b.js";

const I32_BYTES = 4;
const COMPONENT_COUNT = 4;
const BYTES = COMPONENT_COUNT * I32_BYTES;

export class V4i {
  static readonly __aardworxMathBrand: "V4i" = "V4i";

  /** @internal */
  readonly _data: Int32Array;

  constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 0) {
    this._data = new Int32Array(4);
    this._data[0] = x;
    this._data[1] = y;
    this._data[2] = z;
    this._data[3] = w;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V4i {
    const v = Object.create(V4i.prototype) as { _data: Int32Array };
    v._data = new Int32Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V4i;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  static readonly zero: V4i = new V4i(0, 0, 0, 0);
  static readonly one: V4i = new V4i(1, 1, 1, 1);
  static readonly unitX: V4i = new V4i(1, 0, 0, 0);
  static readonly unitY: V4i = new V4i(0, 1, 0, 0);
  static readonly unitZ: V4i = new V4i(0, 0, 1, 0);
  static readonly unitW: V4i = new V4i(0, 0, 0, 1);

  static splat(s: number): V4i { return new V4i(s, s, s, s); }

  static copy(other: V4i): V4i {
    return new V4i(other._data[0]!, other._data[1]!, other._data[2]!, other._data[3]!);
  }

  static fromArrayLike(arr: ArrayLike<number>, offset: number = 0): V4i {
    return new V4i(arr[offset]!, arr[offset + 1]!, arr[offset + 2]!, arr[offset + 3]!);
  }

  get x(): number { return this._data[0]!; }
  set x(v: number) { this._data[0] = v; }
  get y(): number { return this._data[1]!; }
  set y(v: number) { this._data[1] = v; }
  get z(): number { return this._data[2]!; }
  set z(v: number) { this._data[2] = v; }
  get w(): number { return this._data[3]!; }
  set w(v: number) { this._data[3] = v; }

  add(other: V4i): V4i {
    return new V4i(
      this._data[0]! + other._data[0]!,
      this._data[1]! + other._data[1]!,
      this._data[2]! + other._data[2]!,
      this._data[3]! + other._data[3]!,
    );
  }
  sub(other: V4i): V4i {
    return new V4i(
      this._data[0]! - other._data[0]!,
      this._data[1]! - other._data[1]!,
      this._data[2]! - other._data[2]!,
      this._data[3]! - other._data[3]!,
    );
  }
  neg(): V4i {
    return new V4i(-this._data[0]!, -this._data[1]!, -this._data[2]!, -this._data[3]!);
  }

  mul(other: V4i | number): V4i {
    if (typeof other === "number") {
      return new V4i(
        this._data[0]! * other, this._data[1]! * other,
        this._data[2]! * other, this._data[3]! * other,
      );
    }
    return new V4i(
      this._data[0]! * other._data[0]!,
      this._data[1]! * other._data[1]!,
      this._data[2]! * other._data[2]!,
      this._data[3]! * other._data[3]!,
    );
  }

  div(other: V4i | number): V4i {
    if (typeof other === "number") {
      return new V4i(
        this._data[0]! / other, this._data[1]! / other,
        this._data[2]! / other, this._data[3]! / other,
      );
    }
    return new V4i(
      this._data[0]! / other._data[0]!,
      this._data[1]! / other._data[1]!,
      this._data[2]! / other._data[2]!,
      this._data[3]! / other._data[3]!,
    );
  }

  mod(other: V4i | number): V4i {
    if (typeof other === "number") {
      return new V4i(
        this._data[0]! % other, this._data[1]! % other,
        this._data[2]! % other, this._data[3]! % other,
      );
    }
    return new V4i(
      this._data[0]! % other._data[0]!,
      this._data[1]! % other._data[1]!,
      this._data[2]! % other._data[2]!,
      this._data[3]! % other._data[3]!,
    );
  }

  // ---------- bitwise ----------

  bitAnd(other: V4i | number): V4i {
    if (typeof other === "number") {
      return new V4i(
        this._data[0]! & other, this._data[1]! & other,
        this._data[2]! & other, this._data[3]! & other,
      );
    }
    return new V4i(
      this._data[0]! & other._data[0]!,
      this._data[1]! & other._data[1]!,
      this._data[2]! & other._data[2]!,
      this._data[3]! & other._data[3]!,
    );
  }
  bitOr(other: V4i | number): V4i {
    if (typeof other === "number") {
      return new V4i(
        this._data[0]! | other, this._data[1]! | other,
        this._data[2]! | other, this._data[3]! | other,
      );
    }
    return new V4i(
      this._data[0]! | other._data[0]!,
      this._data[1]! | other._data[1]!,
      this._data[2]! | other._data[2]!,
      this._data[3]! | other._data[3]!,
    );
  }
  bitXor(other: V4i | number): V4i {
    if (typeof other === "number") {
      return new V4i(
        this._data[0]! ^ other, this._data[1]! ^ other,
        this._data[2]! ^ other, this._data[3]! ^ other,
      );
    }
    return new V4i(
      this._data[0]! ^ other._data[0]!,
      this._data[1]! ^ other._data[1]!,
      this._data[2]! ^ other._data[2]!,
      this._data[3]! ^ other._data[3]!,
    );
  }
  bitNot(): V4i {
    return new V4i(~this._data[0]!, ~this._data[1]!, ~this._data[2]!, ~this._data[3]!);
  }
  shiftLeft(s: number): V4i {
    return new V4i(
      this._data[0]! << s, this._data[1]! << s,
      this._data[2]! << s, this._data[3]! << s,
    );
  }
  shiftRight(s: number): V4i {
    return new V4i(
      this._data[0]! >> s, this._data[1]! >> s,
      this._data[2]! >> s, this._data[3]! >> s,
    );
  }

  dot(other: V4i): number {
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
  length(): number { return Math.sqrt(this.lengthSquared()); }
  distanceSquared(other: V4i): number {
    const dx = this._data[0]! - other._data[0]!;
    const dy = this._data[1]! - other._data[1]!;
    const dz = this._data[2]! - other._data[2]!;
    const dw = this._data[3]! - other._data[3]!;
    return dx * dx + dy * dy + dz * dz + dw * dw;
  }
  distance(other: V4i): number { return Math.sqrt(this.distanceSquared(other)); }

  abs(): V4i {
    return new V4i(
      Math.abs(this._data[0]!), Math.abs(this._data[1]!),
      Math.abs(this._data[2]!), Math.abs(this._data[3]!),
    );
  }
  floor(): V4i { return V4i.copy(this); }
  ceil(): V4i { return V4i.copy(this); }
  round(): V4i { return V4i.copy(this); }
  fract(): V4i { return V4i.zero; }
  sign(): V4i {
    return new V4i(
      Math.sign(this._data[0]!), Math.sign(this._data[1]!),
      Math.sign(this._data[2]!), Math.sign(this._data[3]!),
    );
  }

  min(other: V4i): V4i {
    return new V4i(
      Math.min(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
      Math.min(this._data[2]!, other._data[2]!),
      Math.min(this._data[3]!, other._data[3]!),
    );
  }
  max(other: V4i): V4i {
    return new V4i(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
      Math.max(this._data[2]!, other._data[2]!),
      Math.max(this._data[3]!, other._data[3]!),
    );
  }
  clamp(lo: V4i, hi: V4i): V4i {
    return new V4i(
      Math.min(Math.max(this._data[0]!, lo._data[0]!), hi._data[0]!),
      Math.min(Math.max(this._data[1]!, lo._data[1]!), hi._data[1]!),
      Math.min(Math.max(this._data[2]!, lo._data[2]!), hi._data[2]!),
      Math.min(Math.max(this._data[3]!, lo._data[3]!), hi._data[3]!),
    );
  }

  minComp(): number {
    return Math.min(this._data[0]!, this._data[1]!, this._data[2]!, this._data[3]!);
  }
  maxComp(): number {
    return Math.max(this._data[0]!, this._data[1]!, this._data[2]!, this._data[3]!);
  }
  sumComp(): number {
    return this._data[0]! + this._data[1]! + this._data[2]! + this._data[3]!;
  }

  lt(other: V4i): V4b {
    return new V4b(
      this._data[0]! < other._data[0]!, this._data[1]! < other._data[1]!,
      this._data[2]! < other._data[2]!, this._data[3]! < other._data[3]!,
    );
  }
  le(other: V4i): V4b {
    return new V4b(
      this._data[0]! <= other._data[0]!, this._data[1]! <= other._data[1]!,
      this._data[2]! <= other._data[2]!, this._data[3]! <= other._data[3]!,
    );
  }
  gt(other: V4i): V4b {
    return new V4b(
      this._data[0]! > other._data[0]!, this._data[1]! > other._data[1]!,
      this._data[2]! > other._data[2]!, this._data[3]! > other._data[3]!,
    );
  }
  ge(other: V4i): V4b {
    return new V4b(
      this._data[0]! >= other._data[0]!, this._data[1]! >= other._data[1]!,
      this._data[2]! >= other._data[2]!, this._data[3]! >= other._data[3]!,
    );
  }
  eq(other: V4i): V4b {
    return new V4b(
      this._data[0]! === other._data[0]!, this._data[1]! === other._data[1]!,
      this._data[2]! === other._data[2]!, this._data[3]! === other._data[3]!,
    );
  }
  neq(other: V4i): V4b {
    return new V4b(
      this._data[0]! !== other._data[0]!, this._data[1]! !== other._data[1]!,
      this._data[2]! !== other._data[2]!, this._data[3]! !== other._data[3]!,
    );
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V4i)) return false;
    return (
      this._data[0] === other._data[0] &&
      this._data[1] === other._data[1] &&
      this._data[2] === other._data[2] &&
      this._data[3] === other._data[3]
    );
  }

  approxEqual(other: V4i, eps: number): boolean {
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
    return `V4i(${this._data[0]}, ${this._data[1]}, ${this._data[2]}, ${this._data[3]})`;
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

  static addInto(a: V4i, b: V4i, target: V4i): V4i {
    target._data[0] = a._data[0]! + b._data[0]!;
    target._data[1] = a._data[1]! + b._data[1]!;
    target._data[2] = a._data[2]! + b._data[2]!;
    target._data[3] = a._data[3]! + b._data[3]!;
    return target;
  }
  static subInto(a: V4i, b: V4i, target: V4i): V4i {
    target._data[0] = a._data[0]! - b._data[0]!;
    target._data[1] = a._data[1]! - b._data[1]!;
    target._data[2] = a._data[2]! - b._data[2]!;
    target._data[3] = a._data[3]! - b._data[3]!;
    return target;
  }
  static mulInto(a: V4i, b: V4i | number, target: V4i): V4i {
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
  static copyInto(from: V4i, target: V4i): V4i {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    target._data[2] = from._data[2]!;
    target._data[3] = from._data[3]!;
    return target;
  }
}
