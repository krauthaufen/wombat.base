// M33f — 3x3 float32 matrix. Row-major storage.
// See m44f.ts for conventions.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2f } from "../vector/v2f.js";
import { V3f } from "../vector/v3f.js";

const ROWS = 3;
const COLS = 3;
const COMPONENT_COUNT = ROWS * COLS;
const BYTES = COMPONENT_COUNT * 4;

export class M33f {
  static readonly __aardworxMathBrand: "M33f" = "M33f";

  /** @internal */
  readonly _data: Float32Array;

  constructor() {
    this._data = new Float32Array(COMPONENT_COUNT);
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): M33f {
    const m = Object.create(M33f.prototype) as { _data: Float32Array };
    m._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return m as M33f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;
  static readonly rows = ROWS;
  static readonly cols = COLS;

  static readonly zero: M33f = new M33f();
  static readonly identity: M33f = (() => {
    const m = new M33f();
    m._data[0] = 1; m._data[4] = 1; m._data[8] = 1;
    return m;
  })();

  static fromRows(rows: V3f[]): M33f {
    const m = new M33f();
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r]!;
      m._data[r * COLS + 0] = row._data[0]!;
      m._data[r * COLS + 1] = row._data[1]!;
      m._data[r * COLS + 2] = row._data[2]!;
    }
    return m;
  }

  static fromCols(cols: V3f[]): M33f {
    const m = new M33f();
    for (let c = 0; c < COLS; c++) {
      const col = cols[c]!;
      m._data[0 * COLS + c] = col._data[0]!;
      m._data[1 * COLS + c] = col._data[1]!;
      m._data[2 * COLS + c] = col._data[2]!;
    }
    return m;
  }

  /** Build from a flat row-major array. */
  static fromArray(flat: ArrayLike<number>): M33f {
    const m = new M33f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = flat[i]!;
    return m;
  }

  static diagonal(v: V3f): M33f {
    const m = new M33f();
    m._data[0] = v._data[0]!;
    m._data[4] = v._data[1]!;
    m._data[8] = v._data[2]!;
    return m;
  }

  static copy(other: M33f): M33f {
    const m = new M33f();
    m._data.set(other._data);
    return m;
  }

  /** Rodrigues' rotation formula: rotation matrix from a unit axis and angle. */
  static fromRotationAxisAngle(axis: V3f, rad: number): M33f {
    const x = axis._data[0]!, y = axis._data[1]!, z = axis._data[2]!;
    const c = Math.cos(rad), s = Math.sin(rad), t = 1 - c;
    const m = new M33f();
    const d = m._data;
    // row-major: index = r*3 + c
    d[0] = t * x * x + c;        // M00
    d[1] = t * x * y - s * z;    // M01
    d[2] = t * x * z + s * y;    // M02
    d[3] = t * x * y + s * z;    // M10
    d[4] = t * y * y + c;        // M11
    d[5] = t * y * z - s * x;    // M12
    d[6] = t * x * z - s * y;    // M20
    d[7] = t * y * z + s * x;    // M21
    d[8] = t * z * z + c;        // M22
    return m;
  }

  // ---------- 2D-homogeneous factories (M33 used as a 2D transform) ----------

  static translation(v: V2f): M33f;
  static translation(tx: number, ty: number): M33f;
  static translation(a: V2f | number, b?: number): M33f {
    const m = M33f.copy(M33f.identity);
    if (typeof a === "number") { m._data[2] = a; m._data[5] = b!; }
    else { m._data[2] = a._data[0]!; m._data[5] = a._data[1]!; }
    return m;
  }

  static scaling(v: V2f): M33f;
  static scaling(sx: number, sy: number): M33f;
  static scaling(a: V2f | number, b?: number): M33f {
    const m = new M33f();
    if (typeof a === "number") { m._data[0] = a; m._data[4] = b!; }
    else { m._data[0] = a._data[0]!; m._data[4] = a._data[1]!; }
    m._data[8] = 1;
    return m;
  }

  static scalingUniform(s: number): M33f {
    const m = new M33f();
    m._data[0] = s; m._data[4] = s; m._data[8] = 1;
    return m;
  }

  static rotation(rad: number): M33f {
    const c = Math.cos(rad), s = Math.sin(rad);
    const m = new M33f();
    m._data[0] = c;  m._data[1] = -s;
    m._data[3] = s;  m._data[4] = c;
    m._data[8] = 1;
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

  row(r: number): V3f {
    const o = r * COLS;
    return new V3f(this._data[o]!, this._data[o + 1]!, this._data[o + 2]!);
  }

  col(c: number): V3f {
    return new V3f(
      this._data[0 * COLS + c]!,
      this._data[1 * COLS + c]!,
      this._data[2 * COLS + c]!,
    );
  }

  add(other: M33f): M33f {
    const m = new M33f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! + other._data[i]!;
    return m;
  }

  sub(other: M33f): M33f {
    const m = new M33f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! - other._data[i]!;
    return m;
  }

  neg(): M33f {
    const m = new M33f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = -this._data[i]!;
    return m;
  }

  mul(scalar: number): M33f;
  mul(v: V3f): V3f;
  mul(other: M33f): M33f;
  mul(other: M33f | V3f | number): M33f | V3f {
    if (typeof other === "number") {
      const m = new M33f();
      for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! * other;
      return m;
    }
    if (other instanceof V3f) {
      const a = this._data;
      const x = other._data[0]!, y = other._data[1]!, z = other._data[2]!;
      return new V3f(
        a[0]! * x + a[1]! * y + a[2]! * z,
        a[3]! * x + a[4]! * y + a[5]! * z,
        a[6]! * x + a[7]! * y + a[8]! * z,
      );
    }
    const a = this._data, b = other._data;
    const m = new M33f();
    const r = m._data;
    for (let row = 0; row < 3; row++) {
      const a0 = a[row * 3 + 0]!, a1 = a[row * 3 + 1]!, a2 = a[row * 3 + 2]!;
      r[row * 3 + 0] = a0 * b[0]! + a1 * b[3]! + a2 * b[6]!;
      r[row * 3 + 1] = a0 * b[1]! + a1 * b[4]! + a2 * b[7]!;
      r[row * 3 + 2] = a0 * b[2]! + a1 * b[5]! + a2 * b[8]!;
    }
    return m;
  }

  transform(v: V3f): V3f {
    return this.mul(v);
  }

  transpose(): M33f {
    const m = new M33f();
    const a = this._data, r = m._data;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        r[col * 3 + row] = a[row * 3 + col]!;
      }
    }
    return m;
  }

  determinant(): number {
    const a = this._data;
    // m{r}{c} = a[r*3+c]
    const m00 = a[0]!, m01 = a[1]!, m02 = a[2]!;
    const m10 = a[3]!, m11 = a[4]!, m12 = a[5]!;
    const m20 = a[6]!, m21 = a[7]!, m22 = a[8]!;
    return (
      m00 * (m11 * m22 - m21 * m12) -
      m01 * (m10 * m22 - m20 * m12) +
      m02 * (m10 * m21 - m20 * m11)
    );
  }

  inverse(): M33f {
    const a = this._data;
    const m00 = a[0]!, m01 = a[1]!, m02 = a[2]!;
    const m10 = a[3]!, m11 = a[4]!, m12 = a[5]!;
    const m20 = a[6]!, m21 = a[7]!, m22 = a[8]!;
    const c00 =  (m11 * m22 - m21 * m12);
    const c01 = -(m10 * m22 - m20 * m12);
    const c02 =  (m10 * m21 - m20 * m11);
    const det = m00 * c00 + m01 * c01 + m02 * c02;
    if (det === 0) throw new Error("[M33f] inverse: singular matrix");
    const inv = 1 / det;
    const c10 = -(m01 * m22 - m21 * m02);
    const c11 =  (m00 * m22 - m20 * m02);
    const c12 = -(m00 * m21 - m20 * m01);
    const c20 =  (m01 * m12 - m11 * m02);
    const c21 = -(m00 * m12 - m10 * m02);
    const c22 =  (m00 * m11 - m10 * m01);
    const m = new M33f();
    const d = m._data;
    // adjugate = transpose of cofactor matrix; row-major: d[r*3+c] = cof(c,r)/det
    d[0] = c00 * inv;  d[1] = c10 * inv;  d[2] = c20 * inv;
    d[3] = c01 * inv;  d[4] = c11 * inv;  d[5] = c21 * inv;
    d[6] = c02 * inv;  d[7] = c12 * inv;  d[8] = c22 * inv;
    return m;
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof M33f)) return false;
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: M33f, eps: number): boolean {
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
    return `M33f(${Array.from(this._data).join(", ")})`;
  }

  /** Yields elements in flat row-major order. */
  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < COMPONENT_COUNT; i++) yield this._data[i]!;
  }

  /** Returns a flat row-major array. */
  toArray(): number[] {
    return Array.from(this._data);
  }

  static addInto(a: M33f, b: M33f, target: M33f): M33f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! + b._data[i]!;
    return target;
  }

  static subInto(a: M33f, b: M33f, target: M33f): M33f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! - b._data[i]!;
    return target;
  }

  static mulInto(a: M33f, b: M33f, target: M33f): M33f;
  static mulInto(a: M33f, b: V3f, target: V3f): V3f;
  static mulInto(a: M33f, b: number, target: M33f): M33f;
  static mulInto(a: M33f, b: M33f | V3f | number, target: M33f | V3f): M33f | V3f {
    if (typeof b === "number") {
      const t = target as M33f;
      for (let i = 0; i < COMPONENT_COUNT; i++) t._data[i] = a._data[i]! * b;
      return t;
    }
    if (b instanceof V3f) {
      const t = target as V3f;
      const ad = a._data;
      const x = b._data[0]!, y = b._data[1]!, z = b._data[2]!;
      const r0 = ad[0]! * x + ad[1]! * y + ad[2]! * z;
      const r1 = ad[3]! * x + ad[4]! * y + ad[5]! * z;
      const r2 = ad[6]! * x + ad[7]! * y + ad[8]! * z;
      t._data[0] = r0; t._data[1] = r1; t._data[2] = r2;
      return t;
    }
    const t = target as M33f;
    const ad = a._data, bd = b._data;
    const tmp = new Float32Array(COMPONENT_COUNT);
    for (let row = 0; row < 3; row++) {
      const a0 = ad[row * 3 + 0]!, a1 = ad[row * 3 + 1]!, a2 = ad[row * 3 + 2]!;
      tmp[row * 3 + 0] = a0 * bd[0]! + a1 * bd[3]! + a2 * bd[6]!;
      tmp[row * 3 + 1] = a0 * bd[1]! + a1 * bd[4]! + a2 * bd[7]!;
      tmp[row * 3 + 2] = a0 * bd[2]! + a1 * bd[5]! + a2 * bd[8]!;
    }
    t._data.set(tmp);
    return t;
  }

  static copyInto(from: M33f, target: M33f): M33f {
    target._data.set(from._data);
    return target;
  }

  // ---------- operator overloads (boperators) ----------

  static "+"(a: M33f, b: M33f): M33f { return a.add(b); }
  static "-"(a: M33f, b: M33f): M33f;
  static "-"(a: M33f): M33f;
  static "-"(a: M33f, b?: M33f): M33f { return b ? a.sub(b) : a.neg(); }
  static "*"(a: M33f, b: M33f): M33f;
  static "*"(a: M33f, b: V3f): V3f;
  static "*"(a: M33f, b: number): M33f;
  static "*"(a: number, b: M33f): M33f;
  static "*"(a: M33f | number, b: M33f | V3f | number): M33f | V3f {
    if (typeof a === "number") return (b as M33f).mul(a);
    return (a as { mul(o: M33f | V3f | number): M33f | V3f }).mul(b);
  }

  "+="(o: M33f): void {
    this._data[0]! += o._data[0]!;
    this._data[1]! += o._data[1]!;
    this._data[2]! += o._data[2]!;
    this._data[3]! += o._data[3]!;
    this._data[4]! += o._data[4]!;
    this._data[5]! += o._data[5]!;
    this._data[6]! += o._data[6]!;
    this._data[7]! += o._data[7]!;
    this._data[8]! += o._data[8]!;
  }
  "-="(o: M33f): void {
    this._data[0]! -= o._data[0]!;
    this._data[1]! -= o._data[1]!;
    this._data[2]! -= o._data[2]!;
    this._data[3]! -= o._data[3]!;
    this._data[4]! -= o._data[4]!;
    this._data[5]! -= o._data[5]!;
    this._data[6]! -= o._data[6]!;
    this._data[7]! -= o._data[7]!;
    this._data[8]! -= o._data[8]!;
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
    this._data[8]! *= o;
  }
}
