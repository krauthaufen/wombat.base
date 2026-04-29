// M34f — 3 rows x 4 cols float32 matrix. Row-major storage.
// Notation matches Aardvark.Base: M{rows}{cols}{elem}.
// See m44f.ts for conventions.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V4f } from "../vector/v4f.js";
import { V3f } from "../vector/v3f.js";
import { M43f } from "./m43f.js";

const ROWS = 3;
const COLS = 4;
const COMPONENT_COUNT = ROWS * COLS;
const BYTES = COMPONENT_COUNT * 4;

export class M34f {
  static readonly __aardworxMathBrand: "M34f" = "M34f";

  /** @internal */
  readonly _data: Float32Array;

  constructor() {
    this._data = new Float32Array(COMPONENT_COUNT);
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): M34f {
    const m = Object.create(M34f.prototype) as { _data: Float32Array };
    m._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return m as M34f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;
  static readonly rows = ROWS;
  static readonly cols = COLS;

  static readonly zero: M34f = new M34f();

  static fromRows(rows: V4f[]): M34f {
    const m = new M34f();
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r]!;
      for (let c = 0; c < COLS; c++) m._data[r * COLS + c] = row._data[c]!;
    }
    return m;
  }

  static fromCols(cols: V3f[]): M34f {
    const m = new M34f();
    for (let c = 0; c < COLS; c++) {
      const col = cols[c]!;
      for (let r = 0; r < ROWS; r++) m._data[r * COLS + c] = col._data[r]!;
    }
    return m;
  }

  /** Build from a flat row-major array. */
  static fromArray(flat: ArrayLike<number>): M34f {
    const m = new M34f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = flat[i]!;
    return m;
  }

  static copy(other: M34f): M34f {
    const m = new M34f();
    m._data.set(other._data);
    return m;
  }

  // element accessors (row-major: index = r*4 + c)
  get M00(): number { return this._data[0]!; }   set M00(v: number) { this._data[0] = v; }
  get M01(): number { return this._data[1]!; }   set M01(v: number) { this._data[1] = v; }
  get M02(): number { return this._data[2]!; }   set M02(v: number) { this._data[2] = v; }
  get M03(): number { return this._data[3]!; }   set M03(v: number) { this._data[3] = v; }
  get M10(): number { return this._data[4]!; }   set M10(v: number) { this._data[4] = v; }
  get M11(): number { return this._data[5]!; }   set M11(v: number) { this._data[5] = v; }
  get M12(): number { return this._data[6]!; }   set M12(v: number) { this._data[6] = v; }
  get M13(): number { return this._data[7]!; }   set M13(v: number) { this._data[7] = v; }
  get M20(): number { return this._data[8]!; }   set M20(v: number) { this._data[8] = v; }
  get M21(): number { return this._data[9]!; }   set M21(v: number) { this._data[9] = v; }
  get M22(): number { return this._data[10]!; }   set M22(v: number) { this._data[10] = v; }
  get M23(): number { return this._data[11]!; }   set M23(v: number) { this._data[11] = v; }

  /** Returns row r as a V4f (length = cols). */
  row(r: number): V4f {
    const o = r * COLS;
    return new V4f(this._data[o + 0]!, this._data[o + 1]!, this._data[o + 2]!, this._data[o + 3]!);
  }

  /** Returns column c as a V3f (length = rows). */
  col(c: number): V3f {
    return new V3f(this._data[0 + c]!, this._data[4 + c]!, this._data[8 + c]!);
  }

  add(other: M34f): M34f {
    const m = new M34f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! + other._data[i]!;
    return m;
  }

  sub(other: M34f): M34f {
    const m = new M34f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! - other._data[i]!;
    return m;
  }

  neg(): M34f {
    const m = new M34f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = -this._data[i]!;
    return m;
  }

  mul(scalar: number): M34f;
  mul(v: V4f): V3f;
  mul(other: V4f | number): M34f | V3f {
    if (typeof other === "number") {
      const m = new M34f();
      for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! * other;
      return m;
    }
    const a = this._data;
    const x = other._data[0]!, y = other._data[1]!, z = other._data[2]!, w = other._data[3]!;
    return new V3f(
      a[0]! * x + a[1]! * y + a[2]! * z + a[3]! * w,
      a[4]! * x + a[5]! * y + a[6]! * z + a[7]! * w,
      a[8]! * x + a[9]! * y + a[10]! * z + a[11]! * w,
    );
  }

  transform(v: V4f): V3f {
    return this.mul(v);
  }

  transpose(): M43f {
    const out = new M43f();
    const a = this._data, r = out._data;
    // dst M43f has 4 rows, 3 cols; row-major dst index = row * 3 + col_dst.
    // src element at (row_src, col_src) -> dst at (col_src, row_src).
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        r[col * 3 + row] = a[row * 4 + col]!;
      }
    }
    return out;
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof M34f)) return false;
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: M34f, eps: number): boolean {
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
    return `M34f(${Array.from(this._data).join(", ")})`;
  }

  /** Yields elements in flat row-major order. */
  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < COMPONENT_COUNT; i++) yield this._data[i]!;
  }

  /** Returns a flat row-major array. */
  toArray(): number[] {
    return Array.from(this._data);
  }

  static addInto(a: M34f, b: M34f, target: M34f): M34f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! + b._data[i]!;
    return target;
  }

  static subInto(a: M34f, b: M34f, target: M34f): M34f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! - b._data[i]!;
    return target;
  }

  static mulInto(a: M34f, b: V4f, target: V3f): V3f;
  static mulInto(a: M34f, b: number, target: M34f): M34f;
  static mulInto(a: M34f, b: V4f | number, target: M34f | V3f): M34f | V3f {
    if (typeof b === "number") {
      const t = target as M34f;
      for (let i = 0; i < COMPONENT_COUNT; i++) t._data[i] = a._data[i]! * b;
      return t;
    }
    const t = target as V3f;
    const ad = a._data;
    const x = b._data[0]!, y = b._data[1]!, z = b._data[2]!, w = b._data[3]!;
    const r0 = ad[0]! * x + ad[1]! * y + ad[2]! * z + ad[3]! * w;
    const r1 = ad[4]! * x + ad[5]! * y + ad[6]! * z + ad[7]! * w;
    const r2 = ad[8]! * x + ad[9]! * y + ad[10]! * z + ad[11]! * w;
    t._data[0] = r0; t._data[1] = r1; t._data[2] = r2;
    return t;
  }

  static copyInto(from: M34f, target: M34f): M34f {
    target._data.set(from._data);
    return target;
  }
}
