// M22f — 2x2 float32 matrix. Row-major storage.
// See m44f.ts for conventions.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2f } from "../vector/v2f.js";

const ROWS = 2;
const COLS = 2;
const COMPONENT_COUNT = ROWS * COLS;
const BYTES = COMPONENT_COUNT * 4;

export class M22f {
  static readonly __aardworxMathBrand: "M22f" = "M22f";

  /** @internal */
  readonly _data: Float32Array;

  constructor() {
    this._data = new Float32Array(COMPONENT_COUNT);
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): M22f {
    const m = Object.create(M22f.prototype) as { _data: Float32Array };
    m._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return m as M22f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;
  static readonly rows = ROWS;
  static readonly cols = COLS;

  static readonly zero: M22f = new M22f();
  static readonly identity: M22f = (() => {
    const m = new M22f();
    m._data[0] = 1; m._data[3] = 1;
    return m;
  })();

  static fromRows(rows: V2f[]): M22f {
    const m = new M22f();
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r]!;
      m._data[r * COLS + 0] = row._data[0]!;
      m._data[r * COLS + 1] = row._data[1]!;
    }
    return m;
  }

  static fromCols(cols: V2f[]): M22f {
    const m = new M22f();
    for (let c = 0; c < COLS; c++) {
      const col = cols[c]!;
      m._data[0 * COLS + c] = col._data[0]!;
      m._data[1 * COLS + c] = col._data[1]!;
    }
    return m;
  }

  /** Build from a flat row-major array. */
  static fromArray(flat: ArrayLike<number>): M22f {
    const m = new M22f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = flat[i]!;
    return m;
  }

  static diagonal(v: V2f): M22f {
    const m = new M22f();
    m._data[0] = v._data[0]!;
    m._data[3] = v._data[1]!;
    return m;
  }

  static copy(other: M22f): M22f {
    const m = new M22f();
    m._data.set(other._data);
    return m;
  }

  // element accessors (row-major: index = r*2 + c)
  get M00(): number { return this._data[0]!; }   set M00(v: number) { this._data[0] = v; }
  get M01(): number { return this._data[1]!; }   set M01(v: number) { this._data[1] = v; }
  get M10(): number { return this._data[2]!; }   set M10(v: number) { this._data[2] = v; }
  get M11(): number { return this._data[3]!; }   set M11(v: number) { this._data[3] = v; }

  row(r: number): V2f {
    const o = r * COLS;
    return new V2f(this._data[o]!, this._data[o + 1]!);
  }

  col(c: number): V2f {
    return new V2f(this._data[0 * COLS + c]!, this._data[1 * COLS + c]!);
  }

  add(other: M22f): M22f {
    const m = new M22f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! + other._data[i]!;
    return m;
  }

  sub(other: M22f): M22f {
    const m = new M22f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! - other._data[i]!;
    return m;
  }

  neg(): M22f {
    const m = new M22f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = -this._data[i]!;
    return m;
  }

  mul(scalar: number): M22f;
  mul(v: V2f): V2f;
  mul(other: M22f): M22f;
  mul(other: M22f | V2f | number): M22f | V2f {
    if (typeof other === "number") {
      const m = new M22f();
      for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! * other;
      return m;
    }
    if (other instanceof V2f) {
      const a = this._data;
      const x = other._data[0]!, y = other._data[1]!;
      return new V2f(a[0]! * x + a[1]! * y, a[2]! * x + a[3]! * y);
    }
    const a = this._data, b = other._data;
    const m = new M22f();
    const r = m._data;
    // r[r*2+k] = sum_c a[r*2+c] * b[c*2+k]
    const a00 = a[0]!, a01 = a[1]!, a10 = a[2]!, a11 = a[3]!;
    const b00 = b[0]!, b01 = b[1]!, b10 = b[2]!, b11 = b[3]!;
    r[0] = a00 * b00 + a01 * b10;
    r[1] = a00 * b01 + a01 * b11;
    r[2] = a10 * b00 + a11 * b10;
    r[3] = a10 * b01 + a11 * b11;
    return m;
  }

  transform(v: V2f): V2f {
    return this.mul(v);
  }

  transpose(): M22f {
    const m = new M22f();
    m._data[0] = this._data[0]!;
    m._data[1] = this._data[2]!;
    m._data[2] = this._data[1]!;
    m._data[3] = this._data[3]!;
    return m;
  }

  determinant(): number {
    // M00*M11 - M01*M10
    return this._data[0]! * this._data[3]! - this._data[1]! * this._data[2]!;
  }

  inverse(): M22f {
    const det = this.determinant();
    if (det === 0) throw new Error("[M22f] inverse: singular matrix");
    const inv = 1 / det;
    const m = new M22f();
    // inverse = (1/det) * [[ M11, -M01], [-M10, M00]]
    m._data[0] =  this._data[3]! * inv;
    m._data[1] = -this._data[1]! * inv;
    m._data[2] = -this._data[2]! * inv;
    m._data[3] =  this._data[0]! * inv;
    return m;
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof M22f)) return false;
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: M22f, eps: number): boolean {
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
    return `M22f(${Array.from(this._data).join(", ")})`;
  }

  /** Yields elements in flat row-major order. */
  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < COMPONENT_COUNT; i++) yield this._data[i]!;
  }

  /** Returns a flat row-major array. */
  toArray(): number[] {
    return Array.from(this._data);
  }

  static addInto(a: M22f, b: M22f, target: M22f): M22f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! + b._data[i]!;
    return target;
  }

  static subInto(a: M22f, b: M22f, target: M22f): M22f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! - b._data[i]!;
    return target;
  }

  static mulInto(a: M22f, b: M22f, target: M22f): M22f;
  static mulInto(a: M22f, b: V2f, target: V2f): V2f;
  static mulInto(a: M22f, b: number, target: M22f): M22f;
  static mulInto(a: M22f, b: M22f | V2f | number, target: M22f | V2f): M22f | V2f {
    if (typeof b === "number") {
      const t = target as M22f;
      for (let i = 0; i < COMPONENT_COUNT; i++) t._data[i] = a._data[i]! * b;
      return t;
    }
    if (b instanceof V2f) {
      const t = target as V2f;
      const ad = a._data;
      const x = b._data[0]!, y = b._data[1]!;
      const r0 = ad[0]! * x + ad[1]! * y;
      const r1 = ad[2]! * x + ad[3]! * y;
      t._data[0] = r0; t._data[1] = r1;
      return t;
    }
    const t = target as M22f;
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

  static copyInto(from: M22f, target: M22f): M22f {
    target._data.set(from._data);
    return target;
  }
}
