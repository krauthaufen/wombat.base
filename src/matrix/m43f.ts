// M43f — 4 rows x 3 cols float32 matrix. Row-major storage.
// Notation matches Aardvark.Base: M{rows}{cols}{elem}.
// See m44f.ts for conventions.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V3f } from "../vector/v3f.js";
import { V4f } from "../vector/v4f.js";
import { M34f } from "./m34f.js";

const ROWS = 4;
const COLS = 3;
const COMPONENT_COUNT = ROWS * COLS;
const BYTES = COMPONENT_COUNT * 4;

export class M43f {
  static readonly __aardworxMathBrand: "M43f" = "M43f";

  /** @internal */
  readonly _data: Float32Array;

  constructor() {
    this._data = new Float32Array(COMPONENT_COUNT);
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): M43f {
    const m = Object.create(M43f.prototype) as { _data: Float32Array };
    m._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return m as M43f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;
  static readonly rows = ROWS;
  static readonly cols = COLS;

  static readonly zero: M43f = new M43f();

  static fromRows(rows: V3f[]): M43f {
    const m = new M43f();
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r]!;
      for (let c = 0; c < COLS; c++) m._data[r * COLS + c] = row._data[c]!;
    }
    return m;
  }

  static fromCols(cols: V4f[]): M43f {
    const m = new M43f();
    for (let c = 0; c < COLS; c++) {
      const col = cols[c]!;
      for (let r = 0; r < ROWS; r++) m._data[r * COLS + c] = col._data[r]!;
    }
    return m;
  }

  /** Build from a flat row-major array. */
  static fromArray(flat: ArrayLike<number>): M43f {
    const m = new M43f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = flat[i]!;
    return m;
  }

  static copy(other: M43f): M43f {
    const m = new M43f();
    m._data.set(other._data);
    return m;
  }

  // element accessors (row-major: index = r*3 + c)
  get M00(): number { return this._data[0]!; }   set M00(v: number) { this._data[0] = v; }
  get M01(): number { return this._data[1]!; }   set M01(v: number) { this._data[1] = v; }
  get M02(): number { return this._data[2]!; }   set M02(v: number) { this._data[2] = v; }
  get M10(): number { return this._data[3]!; }   set M10(v: number) { this._data[3] = v; }
  get M11(): number { return this._data[4]!; }   set M11(v: number) { this._data[4] = v; }
  get M12(): number { return this._data[5]!; }   set M12(v: number) { this._data[5] = v; }
  get M20(): number { return this._data[6]!; }   set M20(v: number) { this._data[6] = v; }
  get M21(): number { return this._data[7]!; }   set M21(v: number) { this._data[7] = v; }
  get M22(): number { return this._data[8]!; }   set M22(v: number) { this._data[8] = v; }
  get M30(): number { return this._data[9]!; }   set M30(v: number) { this._data[9] = v; }
  get M31(): number { return this._data[10]!; }   set M31(v: number) { this._data[10] = v; }
  get M32(): number { return this._data[11]!; }   set M32(v: number) { this._data[11] = v; }

  /** Returns row r as a V3f (length = cols). */
  row(r: number): V3f {
    const o = r * COLS;
    return new V3f(this._data[o + 0]!, this._data[o + 1]!, this._data[o + 2]!);
  }

  /** Returns column c as a V4f (length = rows). */
  col(c: number): V4f {
    return new V4f(this._data[0 + c]!, this._data[3 + c]!, this._data[6 + c]!, this._data[9 + c]!);
  }

  add(other: M43f): M43f {
    const m = new M43f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! + other._data[i]!;
    return m;
  }

  sub(other: M43f): M43f {
    const m = new M43f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! - other._data[i]!;
    return m;
  }

  neg(): M43f {
    const m = new M43f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = -this._data[i]!;
    return m;
  }

  mul(scalar: number): M43f;
  mul(v: V3f): V4f;
  mul(other: V3f | number): M43f | V4f {
    if (typeof other === "number") {
      const m = new M43f();
      for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! * other;
      return m;
    }
    const a = this._data;
    const x = other._data[0]!, y = other._data[1]!, z = other._data[2]!;
    return new V4f(
      a[0]! * x + a[1]! * y + a[2]! * z,
      a[3]! * x + a[4]! * y + a[5]! * z,
      a[6]! * x + a[7]! * y + a[8]! * z,
      a[9]! * x + a[10]! * y + a[11]! * z,
    );
  }

  transform(v: V3f): V4f {
    return this.mul(v);
  }

  transpose(): M34f {
    const out = new M34f();
    const a = this._data, r = out._data;
    // dst M34f has 3 rows, 4 cols; row-major dst index = row * 4 + col_dst.
    // src element at (row_src, col_src) -> dst at (col_src, row_src).
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        r[col * 4 + row] = a[row * 3 + col]!;
      }
    }
    return out;
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof M43f)) return false;
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: M43f, eps: number): boolean {
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
    return `M43f(${Array.from(this._data).join(", ")})`;
  }

  /** Yields elements in flat row-major order. */
  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < COMPONENT_COUNT; i++) yield this._data[i]!;
  }

  /** Returns a flat row-major array. */
  toArray(): number[] {
    return Array.from(this._data);
  }

  static addInto(a: M43f, b: M43f, target: M43f): M43f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! + b._data[i]!;
    return target;
  }

  static subInto(a: M43f, b: M43f, target: M43f): M43f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! - b._data[i]!;
    return target;
  }

  static mulInto(a: M43f, b: V3f, target: V4f): V4f;
  static mulInto(a: M43f, b: number, target: M43f): M43f;
  static mulInto(a: M43f, b: V3f | number, target: M43f | V4f): M43f | V4f {
    if (typeof b === "number") {
      const t = target as M43f;
      for (let i = 0; i < COMPONENT_COUNT; i++) t._data[i] = a._data[i]! * b;
      return t;
    }
    const t = target as V4f;
    const ad = a._data;
    const x = b._data[0]!, y = b._data[1]!, z = b._data[2]!;
    const r0 = ad[0]! * x + ad[1]! * y + ad[2]! * z;
    const r1 = ad[3]! * x + ad[4]! * y + ad[5]! * z;
    const r2 = ad[6]! * x + ad[7]! * y + ad[8]! * z;
    const r3 = ad[9]! * x + ad[10]! * y + ad[11]! * z;
    t._data[0] = r0; t._data[1] = r1; t._data[2] = r2; t._data[3] = r3;
    return t;
  }

  static copyInto(from: M43f, target: M43f): M43f {
    target._data.set(from._data);
    return target;
  }
}
