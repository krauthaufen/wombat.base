// M23d — 2 rows x 3 cols float64 matrix. Row-major storage.
// Notation matches Aardvark.Base: M{rows}{cols}{elem}.
// See m44f.ts for conventions.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V3d } from "../vector/v3d.js";
import { V2d } from "../vector/v2d.js";
import { M32d } from "./m32d.js";

const ROWS = 2;
const COLS = 3;
const COMPONENT_COUNT = ROWS * COLS;
const BYTES = COMPONENT_COUNT * 8;

export class M23d {
  static readonly __aardworxMathBrand: "M23d" = "M23d";

  /** @internal */
  readonly _data: Float64Array;

  constructor() {
    this._data = new Float64Array(COMPONENT_COUNT);
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): M23d {
    const m = Object.create(M23d.prototype) as { _data: Float64Array };
    m._data = new Float64Array(buffer, byteOffset, COMPONENT_COUNT);
    return m as M23d;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;
  static readonly rows = ROWS;
  static readonly cols = COLS;

  static readonly zero: M23d = new M23d();

  static fromRows(rows: V3d[]): M23d {
    const m = new M23d();
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r]!;
      for (let c = 0; c < COLS; c++) m._data[r * COLS + c] = row._data[c]!;
    }
    return m;
  }

  static fromCols(cols: V2d[]): M23d {
    const m = new M23d();
    for (let c = 0; c < COLS; c++) {
      const col = cols[c]!;
      for (let r = 0; r < ROWS; r++) m._data[r * COLS + c] = col._data[r]!;
    }
    return m;
  }

  /** Build from a flat row-major array. */
  static fromArray(flat: ArrayLike<number>): M23d {
    const m = new M23d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = flat[i]!;
    return m;
  }

  static copy(other: M23d): M23d {
    const m = new M23d();
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

  /** Returns row r as a V3d (length = cols). */
  row(r: number): V3d {
    const o = r * COLS;
    return new V3d(this._data[o + 0]!, this._data[o + 1]!, this._data[o + 2]!);
  }

  /** Returns column c as a V2d (length = rows). */
  col(c: number): V2d {
    return new V2d(this._data[0 + c]!, this._data[3 + c]!);
  }

  add(other: M23d): M23d {
    const m = new M23d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! + other._data[i]!;
    return m;
  }

  sub(other: M23d): M23d {
    const m = new M23d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! - other._data[i]!;
    return m;
  }

  neg(): M23d {
    const m = new M23d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = -this._data[i]!;
    return m;
  }

  mul(scalar: number): M23d;
  mul(v: V3d): V2d;
  mul(other: V3d | number): M23d | V2d {
    if (typeof other === "number") {
      const m = new M23d();
      for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! * other;
      return m;
    }
    const a = this._data;
    const x = other._data[0]!, y = other._data[1]!, z = other._data[2]!;
    return new V2d(
      a[0]! * x + a[1]! * y + a[2]! * z,
      a[3]! * x + a[4]! * y + a[5]! * z,
    );
  }

  transform(v: V3d): V2d {
    return this.mul(v);
  }

  transpose(): M32d {
    const out = new M32d();
    const a = this._data, r = out._data;
    // dst M32d has 3 rows, 2 cols; row-major dst index = row * 2 + col_dst.
    // src element at (row_src, col_src) -> dst at (col_src, row_src).
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        r[col * 2 + row] = a[row * 3 + col]!;
      }
    }
    return out;
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof M23d)) return false;
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: M23d, eps: number): boolean {
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
    return `M23d(${Array.from(this._data).join(", ")})`;
  }

  /** Yields elements in flat row-major order. */
  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < COMPONENT_COUNT; i++) yield this._data[i]!;
  }

  /** Returns a flat row-major array. */
  toArray(): number[] {
    return Array.from(this._data);
  }

  static addInto(a: M23d, b: M23d, target: M23d): M23d {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! + b._data[i]!;
    return target;
  }

  static subInto(a: M23d, b: M23d, target: M23d): M23d {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! - b._data[i]!;
    return target;
  }

  static mulInto(a: M23d, b: V3d, target: V2d): V2d;
  static mulInto(a: M23d, b: number, target: M23d): M23d;
  static mulInto(a: M23d, b: V3d | number, target: M23d | V2d): M23d | V2d {
    if (typeof b === "number") {
      const t = target as M23d;
      for (let i = 0; i < COMPONENT_COUNT; i++) t._data[i] = a._data[i]! * b;
      return t;
    }
    const t = target as V2d;
    const ad = a._data;
    const x = b._data[0]!, y = b._data[1]!, z = b._data[2]!;
    const r0 = ad[0]! * x + ad[1]! * y + ad[2]! * z;
    const r1 = ad[3]! * x + ad[4]! * y + ad[5]! * z;
    t._data[0] = r0; t._data[1] = r1;
    return t;
  }

  static copyInto(from: M23d, target: M23d): M23d {
    target._data.set(from._data);
    return target;
  }

  // ---------- operator overloads (boperators) ----------

  static "+"(a: M23d, b: M23d): M23d { return a.add(b); }
  static "-"(a: M23d, b: M23d): M23d;
  static "-"(a: M23d): M23d;
  static "-"(a: M23d, b?: M23d): M23d { return b ? a.sub(b) : a.neg(); }
  static "*"(a: M23d, b: V3d): V2d;
  static "*"(a: M23d, b: number): M23d;
  static "*"(a: number, b: M23d): M23d;
  static "*"(a: M23d | number, b: M23d | V3d | number): M23d | V2d {
    if (typeof a === "number") return (b as M23d).mul(a);
    return (a as { mul(o: V3d | number): M23d | V2d }).mul(b as V3d | number);
  }

  "+="(o: M23d): void {
    this._data[0]! += o._data[0]!;
    this._data[1]! += o._data[1]!;
    this._data[2]! += o._data[2]!;
    this._data[3]! += o._data[3]!;
    this._data[4]! += o._data[4]!;
    this._data[5]! += o._data[5]!;
  }
  "-="(o: M23d): void {
    this._data[0]! -= o._data[0]!;
    this._data[1]! -= o._data[1]!;
    this._data[2]! -= o._data[2]!;
    this._data[3]! -= o._data[3]!;
    this._data[4]! -= o._data[4]!;
    this._data[5]! -= o._data[5]!;
  }
  "*="(o: number): void {
    this._data[0]! *= o;
    this._data[1]! *= o;
    this._data[2]! *= o;
    this._data[3]! *= o;
    this._data[4]! *= o;
    this._data[5]! *= o;
  }
}
