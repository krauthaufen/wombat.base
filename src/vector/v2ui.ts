// V2ui — 2-component uint32 vector.
//
// Backed by an `Uint32Array` of length 2. Components are truncated
// toward zero on assignment (TypedArray semantics).

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2b } from "./v2b.js";

const U32_BYTES = 4;
const COMPONENT_COUNT = 2;
const BYTES = COMPONENT_COUNT * U32_BYTES;

export class V2ui {
  static readonly __aardworxMathBrand: "V2ui" = "V2ui";

  /** @internal */
  readonly _data: Uint32Array;

  constructor(x: number = 0, y: number = 0) {
    this._data = new Uint32Array(2);
    this._data[0] = x;
    this._data[1] = y;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V2ui {
    const v = Object.create(V2ui.prototype) as { _data: Uint32Array };
    v._data = new Uint32Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V2ui;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  static readonly zero: V2ui = new V2ui(0, 0);
  static readonly one: V2ui = new V2ui(1, 1);
  static readonly unitX: V2ui = new V2ui(1, 0);
  static readonly unitY: V2ui = new V2ui(0, 1);

  static splat(s: number): V2ui { return new V2ui(s, s); }

  static copy(other: V2ui): V2ui {
    return new V2ui(other._data[0]!, other._data[1]!);
  }

  static fromArrayLike(arr: ArrayLike<number>, offset: number = 0): V2ui {
    return new V2ui(arr[offset]!, arr[offset + 1]!);
  }

  get x(): number { return this._data[0]!; }
  set x(v: number) { this._data[0] = v; }
  get y(): number { return this._data[1]!; }
  set y(v: number) { this._data[1] = v; }

  add(other: V2ui): V2ui {
    return new V2ui(this._data[0]! + other._data[0]!, this._data[1]! + other._data[1]!);
  }
  sub(other: V2ui): V2ui {
    return new V2ui(this._data[0]! - other._data[0]!, this._data[1]! - other._data[1]!);
  }

  mul(other: V2ui | number): V2ui {
    if (typeof other === "number") {
      return new V2ui(this._data[0]! * other, this._data[1]! * other);
    }
    return new V2ui(this._data[0]! * other._data[0]!, this._data[1]! * other._data[1]!);
  }

  div(other: V2ui | number): V2ui {
    if (typeof other === "number") {
      return new V2ui(this._data[0]! / other, this._data[1]! / other);
    }
    return new V2ui(this._data[0]! / other._data[0]!, this._data[1]! / other._data[1]!);
  }

  mod(other: V2ui | number): V2ui {
    if (typeof other === "number") {
      return new V2ui(this._data[0]! % other, this._data[1]! % other);
    }
    return new V2ui(this._data[0]! % other._data[0]!, this._data[1]! % other._data[1]!);
  }

  // ---------- bitwise ----------

  bitAnd(other: V2ui | number): V2ui {
    if (typeof other === "number") return new V2ui(this._data[0]! & other, this._data[1]! & other);
    return new V2ui(this._data[0]! & other._data[0]!, this._data[1]! & other._data[1]!);
  }
  bitOr(other: V2ui | number): V2ui {
    if (typeof other === "number") return new V2ui(this._data[0]! | other, this._data[1]! | other);
    return new V2ui(this._data[0]! | other._data[0]!, this._data[1]! | other._data[1]!);
  }
  bitXor(other: V2ui | number): V2ui {
    if (typeof other === "number") return new V2ui(this._data[0]! ^ other, this._data[1]! ^ other);
    return new V2ui(this._data[0]! ^ other._data[0]!, this._data[1]! ^ other._data[1]!);
  }
  bitNot(): V2ui { return new V2ui(~this._data[0]!, ~this._data[1]!); }
  shiftLeft(s: number): V2ui { return new V2ui(this._data[0]! << s, this._data[1]! << s); }
  shiftRight(s: number): V2ui { return new V2ui(this._data[0]! >> s, this._data[1]! >> s); }

  dot(other: V2ui): number {
    return this._data[0]! * other._data[0]! + this._data[1]! * other._data[1]!;
  }

  /** Scalar perp-dot. */
  crossZ(other: V2ui): number {
    return this._data[0]! * other._data[1]! - this._data[1]! * other._data[0]!;
  }

  lengthSquared(): number {
    const x = this._data[0]!, y = this._data[1]!;
    return x * x + y * y;
  }
  length(): number { return Math.sqrt(this.lengthSquared()); }
  distanceSquared(other: V2ui): number {
    const dx = this._data[0]! - other._data[0]!;
    const dy = this._data[1]! - other._data[1]!;
    return dx * dx + dy * dy;
  }
  distance(other: V2ui): number { return Math.sqrt(this.distanceSquared(other)); }

  abs(): V2ui { return new V2ui(Math.abs(this._data[0]!), Math.abs(this._data[1]!)); }
  floor(): V2ui { return V2ui.copy(this); }
  ceil(): V2ui { return V2ui.copy(this); }
  round(): V2ui { return V2ui.copy(this); }
  fract(): V2ui { return V2ui.zero; }
  sign(): V2ui { return new V2ui(Math.sign(this._data[0]!), Math.sign(this._data[1]!)); }

  min(other: V2ui): V2ui {
    return new V2ui(
      Math.min(this._data[0]!, other._data[0]!),
      Math.min(this._data[1]!, other._data[1]!),
    );
  }
  max(other: V2ui): V2ui {
    return new V2ui(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
    );
  }
  clamp(lo: V2ui, hi: V2ui): V2ui {
    return new V2ui(
      Math.min(Math.max(this._data[0]!, lo._data[0]!), hi._data[0]!),
      Math.min(Math.max(this._data[1]!, lo._data[1]!), hi._data[1]!),
    );
  }

  minComp(): number { return Math.min(this._data[0]!, this._data[1]!); }
  maxComp(): number { return Math.max(this._data[0]!, this._data[1]!); }
  sumComp(): number { return this._data[0]! + this._data[1]!; }

  lt(other: V2ui): V2b { return new V2b(this._data[0]! < other._data[0]!, this._data[1]! < other._data[1]!); }
  le(other: V2ui): V2b { return new V2b(this._data[0]! <= other._data[0]!, this._data[1]! <= other._data[1]!); }
  gt(other: V2ui): V2b { return new V2b(this._data[0]! > other._data[0]!, this._data[1]! > other._data[1]!); }
  ge(other: V2ui): V2b { return new V2b(this._data[0]! >= other._data[0]!, this._data[1]! >= other._data[1]!); }
  eq(other: V2ui): V2b { return new V2b(this._data[0]! === other._data[0]!, this._data[1]! === other._data[1]!); }
  neq(other: V2ui): V2b { return new V2b(this._data[0]! !== other._data[0]!, this._data[1]! !== other._data[1]!); }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V2ui)) return false;
    return this._data[0] === other._data[0] && this._data[1] === other._data[1];
  }

  approxEqual(other: V2ui, eps: number): boolean {
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

  toString(): string { return `V2ui(${this._data[0]}, ${this._data[1]})`; }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
  }

  toArray(): [number, number] {
    return [this._data[0]!, this._data[1]!];
  }

  static addInto(a: V2ui, b: V2ui, target: V2ui): V2ui {
    target._data[0] = a._data[0]! + b._data[0]!;
    target._data[1] = a._data[1]! + b._data[1]!;
    return target;
  }
  static subInto(a: V2ui, b: V2ui, target: V2ui): V2ui {
    target._data[0] = a._data[0]! - b._data[0]!;
    target._data[1] = a._data[1]! - b._data[1]!;
    return target;
  }
  static mulInto(a: V2ui, b: V2ui | number, target: V2ui): V2ui {
    if (typeof b === "number") {
      target._data[0] = a._data[0]! * b;
      target._data[1] = a._data[1]! * b;
    } else {
      target._data[0] = a._data[0]! * b._data[0]!;
      target._data[1] = a._data[1]! * b._data[1]!;
    }
    return target;
  }
  static copyInto(from: V2ui, target: V2ui): V2ui {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    return target;
  }

  // ---------- operator overloads (boperators) ----------

  static "+"(a: V2ui, b: V2ui): V2ui { return a.add(b); }
  static "-"(a: V2ui, b: V2ui): V2ui { return a.sub(b); }
  static "*"(a: V2ui, b: V2ui): V2ui;
  static "*"(a: V2ui, b: number): V2ui;
  static "*"(a: number, b: V2ui): V2ui;
  static "*"(a: V2ui | number, b: V2ui | number): V2ui {
    if (typeof a === "number") return (b as V2ui).mul(a);
    return a.mul(b as V2ui | number);
  }
  static "/"(a: V2ui, b: V2ui): V2ui;
  static "/"(a: V2ui, b: number): V2ui;
  static "/"(a: V2ui, b: V2ui | number): V2ui { return a.div(b); }

  "+="(o: V2ui): void {
    this._data[0]! += o._data[0]!;
    this._data[1]! += o._data[1]!;
  }
  "-="(o: V2ui): void {
    this._data[0]! -= o._data[0]!;
    this._data[1]! -= o._data[1]!;
  }
  "*="(o: V2ui): void;
  "*="(o: number): void;
  "*="(o: V2ui | number): void {
    if (typeof o === "number") { this._data[0]! *= o; this._data[1]! *= o; }
    else {
    this._data[0]! *= o._data[0]!;
    this._data[1]! *= o._data[1]!;
  }
  }
  "/="(o: V2ui): void;
  "/="(o: number): void;
  "/="(o: V2ui | number): void {
    if (typeof o === "number") { const inv = 1 / o; this._data[0]! *= inv; this._data[1]! *= inv; }
    else {
    this._data[0]! /= o._data[0]!;
    this._data[1]! /= o._data[1]!;
  }
  }
}
