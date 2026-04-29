// M22d — 2x2 float64 matrix. Row-major storage.
// See m44f.ts for conventions.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2d } from "../vector/v2d.js";

const ROWS = 2;
const COLS = 2;
const COMPONENT_COUNT = ROWS * COLS;
const BYTES = COMPONENT_COUNT * 8;

export class M22d {
  static readonly __aardworxMathBrand: "M22d" = "M22d";

  /** @internal */
  readonly _data: Float64Array;

  constructor() {
    this._data = new Float64Array(COMPONENT_COUNT);
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): M22d {
    const m = Object.create(M22d.prototype) as { _data: Float64Array };
    m._data = new Float64Array(buffer, byteOffset, COMPONENT_COUNT);
    return m as M22d;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;
  static readonly rows = ROWS;
  static readonly cols = COLS;

  static readonly zero: M22d = new M22d();
  static readonly identity: M22d = (() => {
    const m = new M22d();
    m._data[0] = 1; m._data[3] = 1;
    return m;
  })();

  static fromRows(rows: V2d[]): M22d {
    const m = new M22d();
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r]!;
      m._data[r * COLS + 0] = row._data[0]!;
      m._data[r * COLS + 1] = row._data[1]!;
    }
    return m;
  }

  static fromCols(cols: V2d[]): M22d {
    const m = new M22d();
    for (let c = 0; c < COLS; c++) {
      const col = cols[c]!;
      m._data[0 * COLS + c] = col._data[0]!;
      m._data[1 * COLS + c] = col._data[1]!;
    }
    return m;
  }

  /** Build from a flat row-major array. */
  static fromArray(flat: ArrayLike<number>): M22d {
    const m = new M22d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = flat[i]!;
    return m;
  }

  static diagonal(v: V2d): M22d {
    const m = new M22d();
    m._data[0] = v._data[0]!;
    m._data[3] = v._data[1]!;
    return m;
  }

  static copy(other: M22d): M22d {
    const m = new M22d();
    m._data.set(other._data);
    return m;
  }

  // element accessors (row-major: index = r*2 + c)
  get M00(): number { return this._data[0]!; }   set M00(v: number) { this._data[0] = v; }
  get M01(): number { return this._data[1]!; }   set M01(v: number) { this._data[1] = v; }
  get M10(): number { return this._data[2]!; }   set M10(v: number) { this._data[2] = v; }
  get M11(): number { return this._data[3]!; }   set M11(v: number) { this._data[3] = v; }

  row(r: number): V2d {
    const o = r * COLS;
    return new V2d(this._data[o]!, this._data[o + 1]!);
  }

  col(c: number): V2d {
    return new V2d(this._data[0 * COLS + c]!, this._data[1 * COLS + c]!);
  }

  add(other: M22d): M22d {
    const m = new M22d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! + other._data[i]!;
    return m;
  }

  sub(other: M22d): M22d {
    const m = new M22d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! - other._data[i]!;
    return m;
  }

  neg(): M22d {
    const m = new M22d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = -this._data[i]!;
    return m;
  }

  mul(scalar: number): M22d;
  mul(v: V2d): V2d;
  mul(other: M22d): M22d;
  mul(other: M22d | V2d | number): M22d | V2d {
    if (typeof other === "number") {
      const m = new M22d();
      for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! * other;
      return m;
    }
    if (other instanceof V2d) {
      const a = this._data;
      const x = other._data[0]!, y = other._data[1]!;
      return new V2d(a[0]! * x + a[1]! * y, a[2]! * x + a[3]! * y);
    }
    const a = this._data, b = other._data;
    const m = new M22d();
    const r = m._data;
    const a00 = a[0]!, a01 = a[1]!, a10 = a[2]!, a11 = a[3]!;
    const b00 = b[0]!, b01 = b[1]!, b10 = b[2]!, b11 = b[3]!;
    r[0] = a00 * b00 + a01 * b10;
    r[1] = a00 * b01 + a01 * b11;
    r[2] = a10 * b00 + a11 * b10;
    r[3] = a10 * b01 + a11 * b11;
    return m;
  }

  transform(v: V2d): V2d {
    return this.mul(v);
  }

  transpose(): M22d {
    const m = new M22d();
    m._data[0] = this._data[0]!;
    m._data[1] = this._data[2]!;
    m._data[2] = this._data[1]!;
    m._data[3] = this._data[3]!;
    return m;
  }

  determinant(): number {
    return this._data[0]! * this._data[3]! - this._data[1]! * this._data[2]!;
  }

  inverse(): M22d {
    const det = this.determinant();
    if (det === 0) throw new Error("[M22d] inverse: singular matrix");
    const inv = 1 / det;
    const m = new M22d();
    m._data[0] =  this._data[3]! * inv;
    m._data[1] = -this._data[1]! * inv;
    m._data[2] = -this._data[2]! * inv;
    m._data[3] =  this._data[0]! * inv;
    return m;
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof M22d)) return false;
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: M22d, eps: number): boolean {
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (Math.abs(this._data[i]! - other._data[i]!) > eps) return false;
    }
    return true;
  }

  getHashCode(): number {
    let h = hashNumber(this._data[0]!);
    for (let i = 1; i < COMPONENT_COUNT; i++) h = combineHash(h, hashNumber(this._data[i]!));
    return h;
  }

  toString(): string {
    return `M22d(${Array.from(this._data).join(", ")})`;
  }

  /** Yields elements in flat row-major order. */
  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < COMPONENT_COUNT; i++) yield this._data[i]!;
  }

  /** Returns a flat row-major array. */
  toArray(): number[] {
    return Array.from(this._data);
  }

  static addInto(a: M22d, b: M22d, target: M22d): M22d {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! + b._data[i]!;
    return target;
  }

  static subInto(a: M22d, b: M22d, target: M22d): M22d {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! - b._data[i]!;
    return target;
  }

  static mulInto(a: M22d, b: M22d, target: M22d): M22d;
  static mulInto(a: M22d, b: V2d, target: V2d): V2d;
  static mulInto(a: M22d, b: number, target: M22d): M22d;
  static mulInto(a: M22d, b: M22d | V2d | number, target: M22d | V2d): M22d | V2d {
    if (typeof b === "number") {
      const t = target as M22d;
      for (let i = 0; i < COMPONENT_COUNT; i++) t._data[i] = a._data[i]! * b;
      return t;
    }
    if (b instanceof V2d) {
      const t = target as V2d;
      const ad = a._data;
      const x = b._data[0]!, y = b._data[1]!;
      const r0 = ad[0]! * x + ad[1]! * y;
      const r1 = ad[2]! * x + ad[3]! * y;
      t._data[0] = r0; t._data[1] = r1;
      return t;
    }
    const t = target as M22d;
    const ad = a._data, bd = b._data;
    const a00 = ad[0]!, a01 = ad[1]!, a10 = ad[2]!, a11 = ad[3]!;
    const b00 = bd[0]!, b01 = bd[1]!, b10 = bd[2]!, b11 = bd[3]!;
    const r0 = a00 * b00 + a01 * b10;
    const r1 = a00 * b01 + a01 * b11;
    const r2 = a10 * b00 + a11 * b10;
    const r3 = a10 * b01 + a11 * b11;
    t._data[0] = r0; t._data[1] = r1; t._data[2] = r2; t._data[3] = r3;
    return t;
  }

  static copyInto(from: M22d, target: M22d): M22d {
    target._data.set(from._data);
    return target;
  }
}
