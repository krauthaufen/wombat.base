// M32d — 3 rows x 2 cols float64 matrix. Row-major storage.
// Notation matches Aardvark.Base: M{rows}{cols}{elem}.
// See m44f.ts for conventions.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2d } from "../vector/v2d.js";
import { V3d } from "../vector/v3d.js";
import { M23d } from "./m23d.js";

const ROWS = 3;
const COLS = 2;
const COMPONENT_COUNT = ROWS * COLS;
const BYTES = COMPONENT_COUNT * 8;

export class M32d {
  static readonly __aardworxMathBrand: "M32d" = "M32d";

  /** @internal */
  readonly _data: Float64Array;

  constructor() {
    this._data = new Float64Array(COMPONENT_COUNT);
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): M32d {
    const m = Object.create(M32d.prototype) as { _data: Float64Array };
    m._data = new Float64Array(buffer, byteOffset, COMPONENT_COUNT);
    return m as M32d;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;
  static readonly rows = ROWS;
  static readonly cols = COLS;

  static readonly zero: M32d = new M32d();

  static fromRows(rows: V2d[]): M32d {
    const m = new M32d();
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r]!;
      for (let c = 0; c < COLS; c++) m._data[r * COLS + c] = row._data[c]!;
    }
    return m;
  }

  static fromCols(cols: V3d[]): M32d {
    const m = new M32d();
    for (let c = 0; c < COLS; c++) {
      const col = cols[c]!;
      for (let r = 0; r < ROWS; r++) m._data[r * COLS + c] = col._data[r]!;
    }
    return m;
  }

  /** Build from a flat row-major array. */
  static fromArray(flat: ArrayLike<number>): M32d {
    const m = new M32d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = flat[i]!;
    return m;
  }

  static copy(other: M32d): M32d {
    const m = new M32d();
    m._data.set(other._data);
    return m;
  }

  // element accessors (row-major: index = r*2 + c)
  get M00(): number { return this._data[0]!; }   set M00(v: number) { this._data[0] = v; }
  get M01(): number { return this._data[1]!; }   set M01(v: number) { this._data[1] = v; }
  get M10(): number { return this._data[2]!; }   set M10(v: number) { this._data[2] = v; }
  get M11(): number { return this._data[3]!; }   set M11(v: number) { this._data[3] = v; }
  get M20(): number { return this._data[4]!; }   set M20(v: number) { this._data[4] = v; }
  get M21(): number { return this._data[5]!; }   set M21(v: number) { this._data[5] = v; }

  /** Returns row r as a V2d (length = cols). */
  row(r: number): V2d {
    const o = r * COLS;
    return new V2d(this._data[o + 0]!, this._data[o + 1]!);
  }

  /** Returns column c as a V3d (length = rows). */
  col(c: number): V3d {
    return new V3d(this._data[0 + c]!, this._data[2 + c]!, this._data[4 + c]!);
  }

  add(other: M32d): M32d {
    const m = new M32d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! + other._data[i]!;
    return m;
  }

  sub(other: M32d): M32d {
    const m = new M32d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! - other._data[i]!;
    return m;
  }

  neg(): M32d {
    const m = new M32d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = -this._data[i]!;
    return m;
  }

  mul(scalar: number): M32d;
  mul(v: V2d): V3d;
  mul(other: V2d | number): M32d | V3d {
    if (typeof other === "number") {
      const m = new M32d();
      for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! * other;
      return m;
    }
    const a = this._data;
    const x = other._data[0]!, y = other._data[1]!;
    return new V3d(
      a[0]! * x + a[1]! * y,
      a[2]! * x + a[3]! * y,
      a[4]! * x + a[5]! * y,
    );
  }

  transform(v: V2d): V3d {
    return this.mul(v);
  }

  transpose(): M23d {
    const out = new M23d();
    const a = this._data, r = out._data;
    // dst M23d has 2 rows, 3 cols; row-major dst index = row * 3 + col_dst.
    // src element at (row_src, col_src) -> dst at (col_src, row_src).
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        r[col * 3 + row] = a[row * 2 + col]!;
      }
    }
    return out;
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof M32d)) return false;
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: M32d, eps: number): boolean {
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
    return `M32d(${Array.from(this._data).join(", ")})`;
  }

  /** Yields elements in flat row-major order. */
  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < COMPONENT_COUNT; i++) yield this._data[i]!;
  }

  /** Returns a flat row-major array. */
  toArray(): number[] {
    return Array.from(this._data);
  }

  static addInto(a: M32d, b: M32d, target: M32d): M32d {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! + b._data[i]!;
    return target;
  }

  static subInto(a: M32d, b: M32d, target: M32d): M32d {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! - b._data[i]!;
    return target;
  }

  static mulInto(a: M32d, b: V2d, target: V3d): V3d;
  static mulInto(a: M32d, b: number, target: M32d): M32d;
  static mulInto(a: M32d, b: V2d | number, target: M32d | V3d): M32d | V3d {
    if (typeof b === "number") {
      const t = target as M32d;
      for (let i = 0; i < COMPONENT_COUNT; i++) t._data[i] = a._data[i]! * b;
      return t;
    }
    const t = target as V3d;
    const ad = a._data;
    const x = b._data[0]!, y = b._data[1]!;
    const r0 = ad[0]! * x + ad[1]! * y;
    const r1 = ad[2]! * x + ad[3]! * y;
    const r2 = ad[4]! * x + ad[5]! * y;
    t._data[0] = r0; t._data[1] = r1; t._data[2] = r2;
    return t;
  }

  static copyInto(from: M32d, target: M32d): M32d {
    target._data.set(from._data);
    return target;
  }
}
