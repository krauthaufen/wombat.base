// M42f — 4 rows x 2 cols float32 matrix. Row-major storage.
// Notation matches Aardvark.Base: M{rows}{cols}{elem}.
// See m44f.ts for conventions.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2f } from "../vector/v2f.js";
import { V4f } from "../vector/v4f.js";
import { M24f } from "./m24f.js";

const ROWS = 4;
const COLS = 2;
const COMPONENT_COUNT = ROWS * COLS;
const BYTES = COMPONENT_COUNT * 4;

export class M42f {
  static readonly __aardworxMathBrand: "M42f" = "M42f";

  /** @internal */
  readonly _data: Float32Array;

  constructor() {
    this._data = new Float32Array(COMPONENT_COUNT);
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): M42f {
    const m = Object.create(M42f.prototype) as { _data: Float32Array };
    m._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return m as M42f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;
  static readonly rows = ROWS;
  static readonly cols = COLS;

  static readonly zero: M42f = new M42f();

  static fromRows(rows: V2f[]): M42f {
    const m = new M42f();
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r]!;
      for (let c = 0; c < COLS; c++) m._data[r * COLS + c] = row._data[c]!;
    }
    return m;
  }

  static fromCols(cols: V4f[]): M42f {
    const m = new M42f();
    for (let c = 0; c < COLS; c++) {
      const col = cols[c]!;
      for (let r = 0; r < ROWS; r++) m._data[r * COLS + c] = col._data[r]!;
    }
    return m;
  }

  /** Build from a flat row-major array. */
  static fromArray(flat: ArrayLike<number>): M42f {
    const m = new M42f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = flat[i]!;
    return m;
  }

  static copy(other: M42f): M42f {
    const m = new M42f();
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
  get M30(): number { return this._data[6]!; }   set M30(v: number) { this._data[6] = v; }
  get M31(): number { return this._data[7]!; }   set M31(v: number) { this._data[7] = v; }

  /** Returns row r as a V2f (length = cols). */
  row(r: number): V2f {
    const o = r * COLS;
    return new V2f(this._data[o + 0]!, this._data[o + 1]!);
  }

  /** Returns column c as a V4f (length = rows). */
  col(c: number): V4f {
    return new V4f(this._data[0 + c]!, this._data[2 + c]!, this._data[4 + c]!, this._data[6 + c]!);
  }

  add(other: M42f): M42f {
    const m = new M42f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! + other._data[i]!;
    return m;
  }

  sub(other: M42f): M42f {
    const m = new M42f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! - other._data[i]!;
    return m;
  }

  neg(): M42f {
    const m = new M42f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = -this._data[i]!;
    return m;
  }

  mul(scalar: number): M42f;
  mul(v: V2f): V4f;
  mul(other: V2f | number): M42f | V4f {
    if (typeof other === "number") {
      const m = new M42f();
      for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! * other;
      return m;
    }
    const a = this._data;
    const x = other._data[0]!, y = other._data[1]!;
    return new V4f(
      a[0]! * x + a[1]! * y,
      a[2]! * x + a[3]! * y,
      a[4]! * x + a[5]! * y,
      a[6]! * x + a[7]! * y,
    );
  }

  transform(v: V2f): V4f {
    return this.mul(v);
  }

  transpose(): M24f {
    const out = new M24f();
    const a = this._data, r = out._data;
    // dst M24f has 2 rows, 4 cols; row-major dst index = row * 4 + col_dst.
    // src element at (row_src, col_src) -> dst at (col_src, row_src).
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        r[col * 4 + row] = a[row * 2 + col]!;
      }
    }
    return out;
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof M42f)) return false;
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: M42f, eps: number): boolean {
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
    return `M42f(${Array.from(this._data).join(", ")})`;
  }

  /** Yields elements in flat row-major order. */
  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < COMPONENT_COUNT; i++) yield this._data[i]!;
  }

  /** Returns a flat row-major array. */
  toArray(): number[] {
    return Array.from(this._data);
  }

  static addInto(a: M42f, b: M42f, target: M42f): M42f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! + b._data[i]!;
    return target;
  }

  static subInto(a: M42f, b: M42f, target: M42f): M42f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! - b._data[i]!;
    return target;
  }

  static mulInto(a: M42f, b: V2f, target: V4f): V4f;
  static mulInto(a: M42f, b: number, target: M42f): M42f;
  static mulInto(a: M42f, b: V2f | number, target: M42f | V4f): M42f | V4f {
    if (typeof b === "number") {
      const t = target as M42f;
      for (let i = 0; i < COMPONENT_COUNT; i++) t._data[i] = a._data[i]! * b;
      return t;
    }
    const t = target as V4f;
    const ad = a._data;
    const x = b._data[0]!, y = b._data[1]!;
    const r0 = ad[0]! * x + ad[1]! * y;
    const r1 = ad[2]! * x + ad[3]! * y;
    const r2 = ad[4]! * x + ad[5]! * y;
    const r3 = ad[6]! * x + ad[7]! * y;
    t._data[0] = r0; t._data[1] = r1; t._data[2] = r2; t._data[3] = r3;
    return t;
  }

  static copyInto(from: M42f, target: M42f): M42f {
    target._data.set(from._data);
    return target;
  }

  // ---------- operator overloads (boperators) ----------

  static "+"(a: M42f, b: M42f): M42f { return a.add(b); }
  static "-"(a: M42f, b: M42f): M42f;
  static "-"(a: M42f): M42f;
  static "-"(a: M42f, b?: M42f): M42f { return b ? a.sub(b) : a.neg(); }
  static "*"(a: M42f, b: V2f): V4f;
  static "*"(a: M42f, b: number): M42f;
  static "*"(a: number, b: M42f): M42f;
  static "*"(a: M42f | number, b: M42f | V2f | number): M42f | V4f {
    if (typeof a === "number") return (b as M42f).mul(a);
    return (a as { mul(o: V2f | number): M42f | V4f }).mul(b as V2f | number);
  }

  "+="(o: M42f): void {
    this._data[0]! += o._data[0]!;
    this._data[1]! += o._data[1]!;
    this._data[2]! += o._data[2]!;
    this._data[3]! += o._data[3]!;
    this._data[4]! += o._data[4]!;
    this._data[5]! += o._data[5]!;
    this._data[6]! += o._data[6]!;
    this._data[7]! += o._data[7]!;
  }
  "-="(o: M42f): void {
    this._data[0]! -= o._data[0]!;
    this._data[1]! -= o._data[1]!;
    this._data[2]! -= o._data[2]!;
    this._data[3]! -= o._data[3]!;
    this._data[4]! -= o._data[4]!;
    this._data[5]! -= o._data[5]!;
    this._data[6]! -= o._data[6]!;
    this._data[7]! -= o._data[7]!;
  }
  "*="(o: number): void {
    this._data[0]! *= o;
    this._data[1]! *= o;
    this._data[2]! *= o;
    this._data[3]! *= o;
    this._data[4]! *= o;
    this._data[5]! *= o;
    this._data[6]! *= o;
    this._data[7]! *= o;
  }
}
