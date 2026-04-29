// M44d — 4x4 float64 matrix.
//
// Backed by a `Float64Array` of length 16. Storage is ROW-MAJOR:
// element at row `r`, column `c` lives at `_data[r*4 + c]`.
// This matches Aardvark.Base.M44d.
//
// Multiplication convention: `M·v` with `v` as a column vector.
// Same conventions as V3d (see v3f.ts for the long-form rationale).

import { combineHash, hashNumber } from "../internal/hash.js";
import { V3d } from "../vector/v3d.js";
import { V4d } from "../vector/v4d.js";

const F64_BYTES = 8;
const ROWS = 4;
const COLS = 4;
const COMPONENT_COUNT = ROWS * COLS;
const BYTES = COMPONENT_COUNT * F64_BYTES;

export class M44d {
  static readonly __aardworxMathBrand: "M44d" = "M44d";

  /** @internal */
  readonly _data: Float64Array;

  constructor() {
    this._data = new Float64Array(COMPONENT_COUNT);
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): M44d {
    const m = Object.create(M44d.prototype) as { _data: Float64Array };
    m._data = new Float64Array(buffer, byteOffset, COMPONENT_COUNT);
    return m as M44d;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;
  static readonly rows = ROWS;
  static readonly cols = COLS;

  // ---------- factories ----------

  static readonly zero: M44d = new M44d();
  static readonly identity: M44d = (() => {
    const m = new M44d();
    m._data[0] = 1; m._data[5] = 1; m._data[10] = 1; m._data[15] = 1;
    return m;
  })();

  static fromRows(rows: V4d[]): M44d {
    const m = new M44d();
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r]!;
      m._data[r * COLS + 0] = row._data[0]!;
      m._data[r * COLS + 1] = row._data[1]!;
      m._data[r * COLS + 2] = row._data[2]!;
      m._data[r * COLS + 3] = row._data[3]!;
    }
    return m;
  }

  static fromCols(cols: V4d[]): M44d {
    const m = new M44d();
    for (let c = 0; c < COLS; c++) {
      const col = cols[c]!;
      m._data[0 * COLS + c] = col._data[0]!;
      m._data[1 * COLS + c] = col._data[1]!;
      m._data[2 * COLS + c] = col._data[2]!;
      m._data[3 * COLS + c] = col._data[3]!;
    }
    return m;
  }

  /** Build from a flat row-major array. */
  static fromArray(flat: ArrayLike<number>): M44d {
    const m = new M44d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = flat[i]!;
    return m;
  }

  static diagonal(v: V4d): M44d {
    const m = new M44d();
    m._data[0] = v._data[0]!;
    m._data[5] = v._data[1]!;
    m._data[10] = v._data[2]!;
    m._data[15] = v._data[3]!;
    return m;
  }

  static copy(other: M44d): M44d {
    const m = new M44d();
    m._data.set(other._data);
    return m;
  }

  // ---------- geometric construction ----------

  static translation(v: V3d): M44d {
    const m = M44d.copy(M44d.identity);
    m._data[3]  = v._data[0]!;
    m._data[7]  = v._data[1]!;
    m._data[11] = v._data[2]!;
    return m;
  }

  static scaling(v: V3d): M44d {
    const m = new M44d();
    m._data[0]  = v._data[0]!;
    m._data[5]  = v._data[1]!;
    m._data[10] = v._data[2]!;
    m._data[15] = 1;
    return m;
  }

  static scalingUniform(s: number): M44d {
    const m = new M44d();
    m._data[0] = s; m._data[5] = s; m._data[10] = s; m._data[15] = 1;
    return m;
  }

  static rotationX(rad: number): M44d {
    const c = Math.cos(rad), s = Math.sin(rad);
    const m = new M44d();
    m._data[0] = 1;
    m._data[5] = c;  m._data[6] = -s;
    m._data[9] = s;  m._data[10] = c;
    m._data[15] = 1;
    return m;
  }

  static rotationY(rad: number): M44d {
    const c = Math.cos(rad), s = Math.sin(rad);
    const m = new M44d();
    m._data[0] = c;  m._data[2] = s;
    m._data[5] = 1;
    m._data[8] = -s; m._data[10] = c;
    m._data[15] = 1;
    return m;
  }

  static rotationZ(rad: number): M44d {
    const c = Math.cos(rad), s = Math.sin(rad);
    const m = new M44d();
    m._data[0] = c;  m._data[1] = -s;
    m._data[4] = s;  m._data[5] = c;
    m._data[10] = 1;
    m._data[15] = 1;
    return m;
  }

  /**
   * Right-handed view matrix looking from `eye` toward `target` with
   * the given world-up vector. View looks down -Z in eye space.
   *
   * Row-major layout: rows are [right; upn; -forward; 0,0,0,1] with
   * translation in the last column.
   */
  static lookAt(eye: V3d, target: V3d, up: V3d): M44d {
    const fx = target._data[0]! - eye._data[0]!;
    const fy = target._data[1]! - eye._data[1]!;
    const fz = target._data[2]! - eye._data[2]!;
    let fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
    if (fl === 0) fl = 1;
    const fnx = fx / fl, fny = fy / fl, fnz = fz / fl;

    const ux = up._data[0]!, uy = up._data[1]!, uz = up._data[2]!;
    let rx = fny * uz - fnz * uy;
    let ry = fnz * ux - fnx * uz;
    let rz = fnx * uy - fny * ux;
    let rl = Math.sqrt(rx * rx + ry * ry + rz * rz);
    if (rl === 0) rl = 1;
    rx /= rl; ry /= rl; rz /= rl;

    const uxn = ry * fnz - rz * fny;
    const uyn = rz * fnx - rx * fnz;
    const uzn = rx * fny - ry * fnx;

    const ex = eye._data[0]!, ey = eye._data[1]!, ez = eye._data[2]!;
    const m = new M44d();
    const d = m._data;
    // row 0: right
    d[0]  = rx;   d[1]  = ry;   d[2]  = rz;   d[3]  = -(rx * ex + ry * ey + rz * ez);
    // row 1: up
    d[4]  = uxn;  d[5]  = uyn;  d[6]  = uzn;  d[7]  = -(uxn * ex + uyn * ey + uzn * ez);
    // row 2: -forward
    d[8]  = -fnx; d[9]  = -fny; d[10] = -fnz; d[11] =  (fnx * ex + fny * ey + fnz * ez);
    // row 3: 0 0 0 1
    d[12] = 0;    d[13] = 0;    d[14] = 0;    d[15] = 1;
    return m;
  }

  /**
   * Right-handed perspective projection mapping eye-space depth
   * `[-near, -far]` to NDC z `[-1, 1]` (OpenGL convention).
   */
  static perspectiveProjection(
    fovY: number,
    aspect: number,
    near: number,
    far: number,
  ): M44d {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    const m = new M44d();
    const d = m._data;
    // Row-major: M00 at 0, M11 at 5, M22 at 10, M23 at 11, M32 at 14, M33 at 15.
    d[0]  = f / aspect;          // M00
    d[5]  = f;                   // M11
    d[10] = (far + near) * nf;   // M22
    d[11] = 2 * far * near * nf; // M23
    d[14] = -1;                  // M32
    return m;
  }

  /**
   * Right-handed orthographic projection mapping the box
   * `[left, right] x [bottom, top] x [-near, -far]` to the NDC cube
   * `[-1, 1]^3` (OpenGL convention).
   */
  static orthographicProjection(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
  ): M44d {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    const m = new M44d();
    const d = m._data;
    // Row-major: row 0 = [-2*lr, 0, 0, (l+r)*lr]; row 1 = [0, -2*bt, 0, (t+b)*bt];
    // row 2 = [0, 0, 2*nf, (f+n)*nf]; row 3 = [0,0,0,1].
    d[0]  = -2 * lr;
    d[3]  = (left + right) * lr;
    d[5]  = -2 * bt;
    d[7]  = (top + bottom) * bt;
    d[10] = 2 * nf;
    d[11] = (far + near) * nf;
    d[15] = 1;
    return m;
  }

  // ---------- element accessors (row-major: index = r*4 + c) ----------

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
  get M22(): number { return this._data[10]!; }  set M22(v: number) { this._data[10] = v; }
  get M23(): number { return this._data[11]!; }  set M23(v: number) { this._data[11] = v; }
  get M30(): number { return this._data[12]!; }  set M30(v: number) { this._data[12] = v; }
  get M31(): number { return this._data[13]!; }  set M31(v: number) { this._data[13] = v; }
  get M32(): number { return this._data[14]!; }  set M32(v: number) { this._data[14] = v; }
  get M33(): number { return this._data[15]!; }  set M33(v: number) { this._data[15] = v; }

  // ---------- row / col access ----------

  row(r: number): V4d {
    const o = r * COLS;
    return new V4d(
      this._data[o + 0]!,
      this._data[o + 1]!,
      this._data[o + 2]!,
      this._data[o + 3]!,
    );
  }

  col(c: number): V4d {
    return new V4d(
      this._data[0 * COLS + c]!,
      this._data[1 * COLS + c]!,
      this._data[2 * COLS + c]!,
      this._data[3 * COLS + c]!,
    );
  }

  // ---------- additive group ----------

  add(other: M44d): M44d {
    const m = new M44d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! + other._data[i]!;
    return m;
  }

  sub(other: M44d): M44d {
    const m = new M44d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! - other._data[i]!;
    return m;
  }

  neg(): M44d {
    const m = new M44d();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = -this._data[i]!;
    return m;
  }

  // ---------- multiplication ----------

  /** Element-wise scalar multiply. */
  mul(scalar: number): M44d;
  /** Matrix-times-column-vector. */
  mul(v: V4d): V4d;
  /** Matrix-matrix multiply. */
  mul(other: M44d): M44d;
  mul(other: M44d | V4d | number): M44d | V4d {
    if (typeof other === "number") {
      const m = new M44d();
      for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! * other;
      return m;
    }
    if (other instanceof V4d) {
      const a = this._data;
      const x = other._data[0]!, y = other._data[1]!, z = other._data[2]!, w = other._data[3]!;
      return new V4d(
        a[0]!  * x + a[1]!  * y + a[2]!  * z + a[3]!  * w,
        a[4]!  * x + a[5]!  * y + a[6]!  * z + a[7]!  * w,
        a[8]!  * x + a[9]!  * y + a[10]! * z + a[11]! * w,
        a[12]! * x + a[13]! * y + a[14]! * z + a[15]! * w,
      );
    }
    // M * M
    const a = this._data, b = other._data;
    const m = new M44d();
    const r = m._data;
    for (let row = 0; row < 4; row++) {
      const a0 = a[row * 4 + 0]!, a1 = a[row * 4 + 1]!, a2 = a[row * 4 + 2]!, a3 = a[row * 4 + 3]!;
      r[row * 4 + 0] = a0 * b[0]! + a1 * b[4]! + a2 * b[8]!  + a3 * b[12]!;
      r[row * 4 + 1] = a0 * b[1]! + a1 * b[5]! + a2 * b[9]!  + a3 * b[13]!;
      r[row * 4 + 2] = a0 * b[2]! + a1 * b[6]! + a2 * b[10]! + a3 * b[14]!;
      r[row * 4 + 3] = a0 * b[3]! + a1 * b[7]! + a2 * b[11]! + a3 * b[15]!;
    }
    return m;
  }

  transform(v: V4d): V4d {
    return this.mul(v);
  }

  /** Transforms a 3D point: implicit w=1, divides by output w. */
  transformPos(v: V3d): V3d {
    const a = this._data;
    const x = v._data[0]!, y = v._data[1]!, z = v._data[2]!;
    const ox = a[0]!  * x + a[1]!  * y + a[2]!  * z + a[3]!;
    const oy = a[4]!  * x + a[5]!  * y + a[6]!  * z + a[7]!;
    const oz = a[8]!  * x + a[9]!  * y + a[10]! * z + a[11]!;
    const ow = a[12]! * x + a[13]! * y + a[14]! * z + a[15]!;
    const inv = ow !== 0 ? 1 / ow : 1;
    return new V3d(ox * inv, oy * inv, oz * inv);
  }

  /** Transforms a 3D direction: implicit w=0, ignores translation. */
  transformDir(v: V3d): V3d {
    const a = this._data;
    const x = v._data[0]!, y = v._data[1]!, z = v._data[2]!;
    return new V3d(
      a[0]! * x + a[1]! * y + a[2]!  * z,
      a[4]! * x + a[5]! * y + a[6]!  * z,
      a[8]! * x + a[9]! * y + a[10]! * z,
    );
  }

  // ---------- transpose / determinant / inverse ----------

  transpose(): M44d {
    const m = new M44d();
    const a = this._data, r = m._data;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        r[col * 4 + row] = a[row * 4 + col]!;
      }
    }
    return m;
  }

  determinant(): number {
    const a = this._data;
    const m00 = a[0]!,  m01 = a[1]!,  m02 = a[2]!,  m03 = a[3]!;
    const m10 = a[4]!,  m11 = a[5]!,  m12 = a[6]!,  m13 = a[7]!;
    const m20 = a[8]!,  m21 = a[9]!,  m22 = a[10]!, m23 = a[11]!;
    const m30 = a[12]!, m31 = a[13]!, m32 = a[14]!, m33 = a[15]!;

    const s0 = m00 * m11 - m10 * m01;
    const s1 = m00 * m21 - m20 * m01;
    const s2 = m00 * m31 - m30 * m01;
    const s3 = m10 * m21 - m20 * m11;
    const s4 = m10 * m31 - m30 * m11;
    const s5 = m20 * m31 - m30 * m21;
    const c5 = m22 * m33 - m32 * m23;
    const c4 = m12 * m33 - m32 * m13;
    const c3 = m12 * m23 - m22 * m13;
    const c2 = m02 * m33 - m32 * m03;
    const c1 = m02 * m23 - m22 * m03;
    const c0 = m02 * m13 - m12 * m03;

    return s0 * c5 - s1 * c4 + s2 * c3 + s3 * c2 - s4 * c1 + s5 * c0;
  }

  inverse(): M44d {
    const a = this._data;
    const m00 = a[0]!,  m01 = a[1]!,  m02 = a[2]!,  m03 = a[3]!;
    const m10 = a[4]!,  m11 = a[5]!,  m12 = a[6]!,  m13 = a[7]!;
    const m20 = a[8]!,  m21 = a[9]!,  m22 = a[10]!, m23 = a[11]!;
    const m30 = a[12]!, m31 = a[13]!, m32 = a[14]!, m33 = a[15]!;

    const s0 = m00 * m11 - m10 * m01;
    const s1 = m00 * m21 - m20 * m01;
    const s2 = m00 * m31 - m30 * m01;
    const s3 = m10 * m21 - m20 * m11;
    const s4 = m10 * m31 - m30 * m11;
    const s5 = m20 * m31 - m30 * m21;
    const c5 = m22 * m33 - m32 * m23;
    const c4 = m12 * m33 - m32 * m13;
    const c3 = m12 * m23 - m22 * m13;
    const c2 = m02 * m33 - m32 * m03;
    const c1 = m02 * m23 - m22 * m03;
    const c0 = m02 * m13 - m12 * m03;

    const det = s0 * c5 - s1 * c4 + s2 * c3 + s3 * c2 - s4 * c1 + s5 * c0;
    if (det === 0) throw new Error("[M44d] inverse: singular matrix");
    const inv = 1 / det;

    const r = new M44d();
    const d = r._data;
    // d[r*4 + c] = inverse[r][c]
    d[0]  = ( m11 * c5 - m21 * c4 + m31 * c3) * inv;
    d[1]  = (-m01 * c5 + m21 * c2 - m31 * c1) * inv;
    d[2]  = ( m01 * c4 - m11 * c2 + m31 * c0) * inv;
    d[3]  = (-m01 * c3 + m11 * c1 - m21 * c0) * inv;

    d[4]  = (-m10 * c5 + m20 * c4 - m30 * c3) * inv;
    d[5]  = ( m00 * c5 - m20 * c2 + m30 * c1) * inv;
    d[6]  = (-m00 * c4 + m10 * c2 - m30 * c0) * inv;
    d[7]  = ( m00 * c3 - m10 * c1 + m20 * c0) * inv;

    d[8]  = ( m13 * s5 - m23 * s4 + m33 * s3) * inv;
    d[9]  = (-m03 * s5 + m23 * s2 - m33 * s1) * inv;
    d[10] = ( m03 * s4 - m13 * s2 + m33 * s0) * inv;
    d[11] = (-m03 * s3 + m13 * s1 - m23 * s0) * inv;

    d[12] = (-m12 * s5 + m22 * s4 - m32 * s3) * inv;
    d[13] = ( m02 * s5 - m22 * s2 + m32 * s1) * inv;
    d[14] = (-m02 * s4 + m12 * s2 - m32 * s0) * inv;
    d[15] = ( m02 * s3 - m12 * s1 + m22 * s0) * inv;

    return r;
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof M44d)) return false;
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: M44d, eps: number): boolean {
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
    return `M44d(${Array.from(this._data).join(", ")})`;
  }

  /** Yields elements in flat row-major order. */
  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < COMPONENT_COUNT; i++) yield this._data[i]!;
  }

  /** Returns a flat row-major array. */
  toArray(): number[] {
    return Array.from(this._data);
  }

  // ---------- in-place / static-target variants ----------

  static addInto(a: M44d, b: M44d, target: M44d): M44d {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! + b._data[i]!;
    return target;
  }

  static subInto(a: M44d, b: M44d, target: M44d): M44d {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! - b._data[i]!;
    return target;
  }

  static mulInto(a: M44d, b: M44d, target: M44d): M44d;
  static mulInto(a: M44d, b: V4d, target: V4d): V4d;
  static mulInto(a: M44d, b: number, target: M44d): M44d;
  static mulInto(a: M44d, b: M44d | V4d | number, target: M44d | V4d): M44d | V4d {
    if (typeof b === "number") {
      const t = target as M44d;
      for (let i = 0; i < COMPONENT_COUNT; i++) t._data[i] = a._data[i]! * b;
      return t;
    }
    if (b instanceof V4d) {
      const t = target as V4d;
      const ad = a._data;
      const x = b._data[0]!, y = b._data[1]!, z = b._data[2]!, w = b._data[3]!;
      const r0 = ad[0]!  * x + ad[1]!  * y + ad[2]!  * z + ad[3]!  * w;
      const r1 = ad[4]!  * x + ad[5]!  * y + ad[6]!  * z + ad[7]!  * w;
      const r2 = ad[8]!  * x + ad[9]!  * y + ad[10]! * z + ad[11]! * w;
      const r3 = ad[12]! * x + ad[13]! * y + ad[14]! * z + ad[15]! * w;
      t._data[0] = r0; t._data[1] = r1; t._data[2] = r2; t._data[3] = r3;
      return t;
    }
    const t = target as M44d;
    const ad = a._data, bd = b._data;
    const tmp = new Float64Array(COMPONENT_COUNT);
    for (let row = 0; row < 4; row++) {
      const a0 = ad[row * 4 + 0]!, a1 = ad[row * 4 + 1]!, a2 = ad[row * 4 + 2]!, a3 = ad[row * 4 + 3]!;
      tmp[row * 4 + 0] = a0 * bd[0]! + a1 * bd[4]! + a2 * bd[8]!  + a3 * bd[12]!;
      tmp[row * 4 + 1] = a0 * bd[1]! + a1 * bd[5]! + a2 * bd[9]!  + a3 * bd[13]!;
      tmp[row * 4 + 2] = a0 * bd[2]! + a1 * bd[6]! + a2 * bd[10]! + a3 * bd[14]!;
      tmp[row * 4 + 3] = a0 * bd[3]! + a1 * bd[7]! + a2 * bd[11]! + a3 * bd[15]!;
    }
    t._data.set(tmp);
    return t;
  }

  static copyInto(from: M44d, target: M44d): M44d {
    target._data.set(from._data);
    return target;
  }

  static transformPosInto(m: M44d, v: V3d, target: V3d): V3d {
    const a = m._data;
    const x = v._data[0]!, y = v._data[1]!, z = v._data[2]!;
    const ox = a[0]!  * x + a[1]!  * y + a[2]!  * z + a[3]!;
    const oy = a[4]!  * x + a[5]!  * y + a[6]!  * z + a[7]!;
    const oz = a[8]!  * x + a[9]!  * y + a[10]! * z + a[11]!;
    const ow = a[12]! * x + a[13]! * y + a[14]! * z + a[15]!;
    const inv = ow !== 0 ? 1 / ow : 1;
    target._data[0] = ox * inv;
    target._data[1] = oy * inv;
    target._data[2] = oz * inv;
    return target;
  }

  static transformDirInto(m: M44d, v: V3d, target: V3d): V3d {
    const a = m._data;
    const x = v._data[0]!, y = v._data[1]!, z = v._data[2]!;
    target._data[0] = a[0]! * x + a[1]! * y + a[2]!  * z;
    target._data[1] = a[4]! * x + a[5]! * y + a[6]!  * z;
    target._data[2] = a[8]! * x + a[9]! * y + a[10]! * z;
    return target;
  }
}
