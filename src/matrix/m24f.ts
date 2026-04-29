// M24f — 2 rows x 4 cols float32 matrix. Row-major storage.
// Notation matches Aardvark.Base: M{rows}{cols}{elem}.
// See m44f.ts for conventions.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V4f } from "../vector/v4f.js";
import { V2f } from "../vector/v2f.js";
import { M42f } from "./m42f.js";

const ROWS = 2;
const COLS = 4;
const COMPONENT_COUNT = ROWS * COLS;
const BYTES = COMPONENT_COUNT * 4;

export class M24f {
  static readonly __aardworxMathBrand: "M24f" = "M24f";

  /** @internal */
  readonly _data: Float32Array;

  constructor() {
    this._data = new Float32Array(COMPONENT_COUNT);
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): M24f {
    const m = Object.create(M24f.prototype) as { _data: Float32Array };
    m._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return m as M24f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;
  static readonly rows = ROWS;
  static readonly cols = COLS;

  static readonly zero: M24f = new M24f();

  static fromRows(rows: V4f[]): M24f {
    const m = new M24f();
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r]!;
      for (let c = 0; c < COLS; c++) m._data[r * COLS + c] = row._data[c]!;
    }
    return m;
  }

  static fromCols(cols: V2f[]): M24f {
    const m = new M24f();
    for (let c = 0; c < COLS; c++) {
      const col = cols[c]!;
      for (let r = 0; r < ROWS; r++) m._data[r * COLS + c] = col._data[r]!;
    }
    return m;
  }

  /** Build from a flat row-major array. */
  static fromArray(flat: ArrayLike<number>): M24f {
    const m = new M24f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = flat[i]!;
    return m;
  }

  static copy(other: M24f): M24f {
    const m = new M24f();
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

  /** Returns row r as a V4f (length = cols). */
  row(r: number): V4f {
    const o = r * COLS;
    return new V4f(this._data[o + 0]!, this._data[o + 1]!, this._data[o + 2]!, this._data[o + 3]!);
  }

  /** Returns column c as a V2f (length = rows). */
  col(c: number): V2f {
    return new V2f(this._data[0 + c]!, this._data[4 + c]!);
  }

  add(other: M24f): M24f {
    const m = new M24f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! + other._data[i]!;
    return m;
  }

  sub(other: M24f): M24f {
    const m = new M24f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! - other._data[i]!;
    return m;
  }

  neg(): M24f {
    const m = new M24f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = -this._data[i]!;
    return m;
  }

  mul(scalar: number): M24f;
  mul(v: V4f): V2f;
  mul(other: V4f | number): M24f | V2f {
    if (typeof other === "number") {
      const m = new M24f();
      for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! * other;
      return m;
    }
    const a = this._data;
    const x = other._data[0]!, y = other._data[1]!, z = other._data[2]!, w = other._data[3]!;
    return new V2f(
      a[0]! * x + a[1]! * y + a[2]! * z + a[3]! * w,
      a[4]! * x + a[5]! * y + a[6]! * z + a[7]! * w,
    );
  }

  transform(v: V4f): V2f {
    return this.mul(v);
  }

  transpose(): M42f {
    const out = new M42f();
    const a = this._data, r = out._data;
    // dst M42f has 4 rows, 2 cols; row-major dst index = row * 2 + col_dst.
    // src element at (row_src, col_src) -> dst at (col_src, row_src).
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        r[col * 2 + row] = a[row * 4 + col]!;
      }
    }
    return out;
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof M24f)) return false;
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: M24f, eps: number): boolean {
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
    return `M24f(${Array.from(this._data).join(", ")})`;
  }

  /** Yields elements in flat row-major order. */
  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < COMPONENT_COUNT; i++) yield this._data[i]!;
  }

  /** Returns a flat row-major array. */
  toArray(): number[] {
    return Array.from(this._data);
  }

  static addInto(a: M24f, b: M24f, target: M24f): M24f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! + b._data[i]!;
    return target;
  }

  static subInto(a: M24f, b: M24f, target: M24f): M24f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! - b._data[i]!;
    return target;
  }

  static mulInto(a: M24f, b: V4f, target: V2f): V2f;
  static mulInto(a: M24f, b: number, target: M24f): M24f;
  static mulInto(a: M24f, b: V4f | number, target: M24f | V2f): M24f | V2f {
    if (typeof b === "number") {
      const t = target as M24f;
      for (let i = 0; i < COMPONENT_COUNT; i++) t._data[i] = a._data[i]! * b;
      return t;
    }
    const t = target as V2f;
    const ad = a._data;
    const x = b._data[0]!, y = b._data[1]!, z = b._data[2]!, w = b._data[3]!;
    const r0 = ad[0]! * x + ad[1]! * y + ad[2]! * z + ad[3]! * w;
    const r1 = ad[4]! * x + ad[5]! * y + ad[6]! * z + ad[7]! * w;
    t._data[0] = r0; t._data[1] = r1;
    return t;
  }

  static copyInto(from: M24f, target: M24f): M24f {
    target._data.set(from._data);
    return target;
  }
}
