// M44f — 4x4 float32 matrix.
//
// Backed by a `Float32Array` of length 16. Storage is ROW-MAJOR:
// element at row `r`, column `c` lives at `_data[r*4 + c]`.
// This matches Aardvark.Base.M44d.
//
// Multiplication convention: `M·v` with `v` as a column vector.
// Same conventions as V3f (see v3f.ts for the long-form rationale).

import { combineHash, hashNumber } from "../internal/hash.js";
import { unpackVecs } from "../internal/varargs.js";
import { V3f } from "../vector/v3f.js";
import { V4f } from "../vector/v4f.js";
import { M33f } from "./m33f.js";

const F32_BYTES = 4;
const ROWS = 4;
const COLS = 4;
const COMPONENT_COUNT = ROWS * COLS;
const BYTES = COMPONENT_COUNT * F32_BYTES;

export class M44f {
  static readonly __aardworxMathBrand: "M44f" = "M44f";

  /** @internal */
  readonly _data: Float32Array;

  constructor() {
    this._data = new Float32Array(COMPONENT_COUNT);
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): M44f {
    const m = Object.create(M44f.prototype) as { _data: Float32Array };
    m._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return m as M44f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;
  static readonly rows = ROWS;
  static readonly cols = COLS;

  // ---------- factories ----------

  static readonly zero: M44f = new M44f();
  static readonly identity: M44f = (() => {
    const m = new M44f();
    m._data[0] = 1; m._data[5] = 1; m._data[10] = 1; m._data[15] = 1;
    return m;
  })();

  static fromRows(rows: ReadonlyArray<V4f>): M44f;
  static fromRows(r0: V4f, r1: V4f, r2: V4f, r3: V4f): M44f;
  static fromRows(...args: V4f[] | [ReadonlyArray<V4f>]): M44f {
    const rows = unpackVecs<V4f>(args);
    const m = new M44f();
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r]!;
      m._data[r * COLS + 0] = row._data[0]!;
      m._data[r * COLS + 1] = row._data[1]!;
      m._data[r * COLS + 2] = row._data[2]!;
      m._data[r * COLS + 3] = row._data[3]!;
    }
    return m;
  }

  static fromCols(cols: ReadonlyArray<V4f>): M44f;
  static fromCols(c0: V4f, c1: V4f, c2: V4f, c3: V4f): M44f;
  static fromCols(...args: V4f[] | [ReadonlyArray<V4f>]): M44f {
    const cols = unpackVecs<V4f>(args);
    const m = new M44f();
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
  static fromArray(flat: ArrayLike<number>): M44f {
    const m = new M44f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = flat[i]!;
    return m;
  }

  static diagonal(v: V4f): M44f {
    const m = new M44f();
    m._data[0] = v._data[0]!;
    m._data[5] = v._data[1]!;
    m._data[10] = v._data[2]!;
    m._data[15] = v._data[3]!;
    return m;
  }

  static copy(other: M44f): M44f {
    const m = new M44f();
    m._data.set(other._data);
    return m;
  }

  // ---------- geometric construction ----------

  static translation(v: V3f): M44f;
  static translation(tx: number, ty: number, tz: number): M44f;
  static translation(a: V3f | number, b?: number, c?: number): M44f {
    const m = M44f.copy(M44f.identity);
    if (typeof a === "number") {
      m._data[3] = a; m._data[7] = b!; m._data[11] = c!;
    } else {
      m._data[3] = a._data[0]!; m._data[7] = a._data[1]!; m._data[11] = a._data[2]!;
    }
    return m;
  }

  static scaling(v: V3f): M44f;
  static scaling(sx: number, sy: number, sz: number): M44f;
  static scaling(a: V3f | number, b?: number, c?: number): M44f {
    const m = new M44f();
    if (typeof a === "number") {
      m._data[0] = a; m._data[5] = b!; m._data[10] = c!;
    } else {
      m._data[0] = a._data[0]!; m._data[5] = a._data[1]!; m._data[10] = a._data[2]!;
    }
    m._data[15] = 1;
    return m;
  }

  static scalingUniform(s: number): M44f {
    const m = new M44f();
    m._data[0] = s; m._data[5] = s; m._data[10] = s; m._data[15] = 1;
    return m;
  }

  /** Shear along the x-axis: x' = x + factorY*y + factorZ*z. */
  static shearYZ(factorY: number, factorZ: number): M44f {
    const m = M44f.copy(M44f.identity);
    m._data[1] = factorY; m._data[2] = factorZ;
    return m;
  }
  /** Shear along the y-axis: y' = y + factorX*x + factorZ*z. */
  static shearXZ(factorX: number, factorZ: number): M44f {
    const m = M44f.copy(M44f.identity);
    m._data[4] = factorX; m._data[6] = factorZ;
    return m;
  }
  /** Shear along the z-axis: z' = z + factorX*x + factorY*y. */
  static shearXY(factorX: number, factorY: number): M44f {
    const m = M44f.copy(M44f.identity);
    m._data[8] = factorX; m._data[9] = factorY;
    return m;
  }

  static rotationX(rad: number): M44f {
    const c = Math.cos(rad), s = Math.sin(rad);
    const m = new M44f();
    // row 0: [1, 0, 0, 0]
    m._data[0] = 1;
    // row 1: [0, c, -s, 0]
    m._data[5] = c;  m._data[6] = -s;
    // row 2: [0, s,  c, 0]
    m._data[9] = s;  m._data[10] = c;
    // row 3: [0, 0, 0, 1]
    m._data[15] = 1;
    return m;
  }

  static rotationY(rad: number): M44f {
    const c = Math.cos(rad), s = Math.sin(rad);
    const m = new M44f();
    // row 0: [ c, 0, s, 0]
    m._data[0] = c;  m._data[2] = s;
    // row 1: [ 0, 1, 0, 0]
    m._data[5] = 1;
    // row 2: [-s, 0, c, 0]
    m._data[8] = -s; m._data[10] = c;
    m._data[15] = 1;
    return m;
  }

  static rotationZ(rad: number): M44f {
    const c = Math.cos(rad), s = Math.sin(rad);
    const m = new M44f();
    // row 0: [c, -s, 0, 0]
    m._data[0] = c;  m._data[1] = -s;
    // row 1: [s,  c, 0, 0]
    m._data[4] = s;  m._data[5] = c;
    m._data[10] = 1;
    m._data[15] = 1;
    return m;
  }

  /** Rotation around an arbitrary axis (Rodrigues), embedded in a 4x4. */
  static rotation(axis: V3f, rad: number): M44f {
    const m3 = M33f.fromRotationAxisAngle(axis, rad);
    const m = new M44f();
    m._data[0]  = m3._data[0]!; m._data[1]  = m3._data[1]!; m._data[2]  = m3._data[2]!;
    m._data[4]  = m3._data[3]!; m._data[5]  = m3._data[4]!; m._data[6]  = m3._data[5]!;
    m._data[8]  = m3._data[6]!; m._data[9]  = m3._data[7]!; m._data[10] = m3._data[8]!;
    m._data[15] = 1;
    return m;
  }

  /** Rotation from yaw/pitch/roll (Z·Y·X intrinsic). */
  static rotationEuler(yaw: number, pitch: number, roll: number): M44f {
    return M44f.rotationZ(yaw).mul(M44f.rotationY(pitch)).mul(M44f.rotationX(roll));
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

  row(r: number): V4f {
    const o = r * COLS;
    return new V4f(
      this._data[o + 0]!,
      this._data[o + 1]!,
      this._data[o + 2]!,
      this._data[o + 3]!,
    );
  }

  col(c: number): V4f {
    return new V4f(
      this._data[0 * COLS + c]!,
      this._data[1 * COLS + c]!,
      this._data[2 * COLS + c]!,
      this._data[3 * COLS + c]!,
    );
  }

  // ---------- additive group ----------

  add(other: M44f): M44f {
    const m = new M44f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! + other._data[i]!;
    return m;
  }

  sub(other: M44f): M44f {
    const m = new M44f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! - other._data[i]!;
    return m;
  }

  neg(): M44f {
    const m = new M44f();
    for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = -this._data[i]!;
    return m;
  }

  // ---------- multiplication ----------

  /** Element-wise scalar multiply. */
  mul(scalar: number): M44f;
  /** Matrix-times-column-vector. */
  mul(v: V4f): V4f;
  /** Matrix-matrix multiply. */
  mul(other: M44f): M44f;
  mul(other: M44f | V4f | number): M44f | V4f {
    if (typeof other === "number") {
      const m = new M44f();
      for (let i = 0; i < COMPONENT_COUNT; i++) m._data[i] = this._data[i]! * other;
      return m;
    }
    if (other instanceof V4f) {
      const a = this._data;
      const x = other._data[0]!, y = other._data[1]!, z = other._data[2]!, w = other._data[3]!;
      return new V4f(
        a[0]!  * x + a[1]!  * y + a[2]!  * z + a[3]!  * w,
        a[4]!  * x + a[5]!  * y + a[6]!  * z + a[7]!  * w,
        a[8]!  * x + a[9]!  * y + a[10]! * z + a[11]! * w,
        a[12]! * x + a[13]! * y + a[14]! * z + a[15]! * w,
      );
    }
    // M * M: r[r*4+k] = sum_c a[r*4+c] * b[c*4+k]
    const a = this._data, b = other._data;
    const m = new M44f();
    const r = m._data;
    for (let row = 0; row < 4; row++) {
      const a0 = a[row * 4 + 0]!, a1 = a[row * 4 + 1]!, a2 = a[row * 4 + 2]!, a3 = a[row * 4 + 3]!;
      r[row * 4 + 0] = a0 * b[0]!  + a1 * b[4]! + a2 * b[8]!  + a3 * b[12]!;
      r[row * 4 + 1] = a0 * b[1]!  + a1 * b[5]! + a2 * b[9]!  + a3 * b[13]!;
      r[row * 4 + 2] = a0 * b[2]!  + a1 * b[6]! + a2 * b[10]! + a3 * b[14]!;
      r[row * 4 + 3] = a0 * b[3]!  + a1 * b[7]! + a2 * b[11]! + a3 * b[15]!;
    }
    return m;
  }

  transform(v: V4f): V4f {
    return this.mul(v);
  }

  /** Transforms a 3D point: implicit w=1, divides by output w. */
  transformPos(v: V3f): V3f {
    const a = this._data;
    const x = v._data[0]!, y = v._data[1]!, z = v._data[2]!;
    const ox = a[0]!  * x + a[1]!  * y + a[2]!  * z + a[3]!;
    const oy = a[4]!  * x + a[5]!  * y + a[6]!  * z + a[7]!;
    const oz = a[8]!  * x + a[9]!  * y + a[10]! * z + a[11]!;
    const ow = a[12]! * x + a[13]! * y + a[14]! * z + a[15]!;
    const inv = ow !== 0 ? 1 / ow : 1;
    return new V3f(ox * inv, oy * inv, oz * inv);
  }

  /** Transforms a 3D direction: implicit w=0, ignores translation. */
  transformDir(v: V3f): V3f {
    const a = this._data;
    const x = v._data[0]!, y = v._data[1]!, z = v._data[2]!;
    return new V3f(
      a[0]! * x + a[1]! * y + a[2]!  * z,
      a[4]! * x + a[5]! * y + a[6]!  * z,
      a[8]! * x + a[9]! * y + a[10]! * z,
    );
  }

  // ---------- transpose / determinant / inverse ----------

  transpose(): M44f {
    const m = new M44f();
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
    // m{r}{c} = a[r*4 + c]
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

  inverse(): M44f {
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
    if (det === 0) throw new Error("[M44f] inverse: singular matrix");
    const inv = 1 / det;

    const r = new M44f();
    const d = r._data;
    // d[r*4 + c] = inverse[r][c]
    d[0]  = ( m11 * c5 - m21 * c4 + m31 * c3) * inv; // (0,0)
    d[1]  = (-m01 * c5 + m21 * c2 - m31 * c1) * inv; // (0,1)
    d[2]  = ( m01 * c4 - m11 * c2 + m31 * c0) * inv; // (0,2)
    d[3]  = (-m01 * c3 + m11 * c1 - m21 * c0) * inv; // (0,3)

    d[4]  = (-m10 * c5 + m20 * c4 - m30 * c3) * inv; // (1,0)
    d[5]  = ( m00 * c5 - m20 * c2 + m30 * c1) * inv; // (1,1)
    d[6]  = (-m00 * c4 + m10 * c2 - m30 * c0) * inv; // (1,2)
    d[7]  = ( m00 * c3 - m10 * c1 + m20 * c0) * inv; // (1,3)

    d[8]  = ( m13 * s5 - m23 * s4 + m33 * s3) * inv; // (2,0)
    d[9]  = (-m03 * s5 + m23 * s2 - m33 * s1) * inv; // (2,1)
    d[10] = ( m03 * s4 - m13 * s2 + m33 * s0) * inv; // (2,2)
    d[11] = (-m03 * s3 + m13 * s1 - m23 * s0) * inv; // (2,3)

    d[12] = (-m12 * s5 + m22 * s4 - m32 * s3) * inv; // (3,0)
    d[13] = ( m02 * s5 - m22 * s2 + m32 * s1) * inv; // (3,1)
    d[14] = (-m02 * s4 + m12 * s2 - m32 * s0) * inv; // (3,2)
    d[15] = ( m02 * s3 - m12 * s1 + m22 * s0) * inv; // (3,3)

    return r;
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof M44f)) return false;
    for (let i = 0; i < COMPONENT_COUNT; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: M44f, eps: number): boolean {
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
    return `M44f(${Array.from(this._data).join(", ")})`;
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

  static addInto(a: M44f, b: M44f, target: M44f): M44f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! + b._data[i]!;
    return target;
  }

  static subInto(a: M44f, b: M44f, target: M44f): M44f {
    for (let i = 0; i < COMPONENT_COUNT; i++) target._data[i] = a._data[i]! - b._data[i]!;
    return target;
  }

  static mulInto(a: M44f, b: M44f, target: M44f): M44f;
  static mulInto(a: M44f, b: V4f, target: V4f): V4f;
  static mulInto(a: M44f, b: number, target: M44f): M44f;
  static mulInto(a: M44f, b: M44f | V4f | number, target: M44f | V4f): M44f | V4f {
    if (typeof b === "number") {
      const t = target as M44f;
      for (let i = 0; i < COMPONENT_COUNT; i++) t._data[i] = a._data[i]! * b;
      return t;
    }
    if (b instanceof V4f) {
      const t = target as V4f;
      const ad = a._data;
      const x = b._data[0]!, y = b._data[1]!, z = b._data[2]!, w = b._data[3]!;
      const r0 = ad[0]!  * x + ad[1]!  * y + ad[2]!  * z + ad[3]!  * w;
      const r1 = ad[4]!  * x + ad[5]!  * y + ad[6]!  * z + ad[7]!  * w;
      const r2 = ad[8]!  * x + ad[9]!  * y + ad[10]! * z + ad[11]! * w;
      const r3 = ad[12]! * x + ad[13]! * y + ad[14]! * z + ad[15]! * w;
      t._data[0] = r0; t._data[1] = r1; t._data[2] = r2; t._data[3] = r3;
      return t;
    }
    const t = target as M44f;
    const ad = a._data, bd = b._data;
    // result may alias either a or b; buffer through a temp
    const tmp = new Float32Array(COMPONENT_COUNT);
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

  static copyInto(from: M44f, target: M44f): M44f {
    target._data.set(from._data);
    return target;
  }

  static transformPosInto(m: M44f, v: V3f, target: V3f): V3f {
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

  static transformDirInto(m: M44f, v: V3f, target: V3f): V3f {
    const a = m._data;
    const x = v._data[0]!, y = v._data[1]!, z = v._data[2]!;
    target._data[0] = a[0]! * x + a[1]! * y + a[2]!  * z;
    target._data[1] = a[4]! * x + a[5]! * y + a[6]!  * z;
    target._data[2] = a[8]! * x + a[9]! * y + a[10]! * z;
    return target;
  }

  // ---------- operator overloads (boperators) ----------

  static "+"(a: M44f, b: M44f): M44f { return a.add(b); }
  static "-"(a: M44f, b: M44f): M44f;
  static "-"(a: M44f): M44f;
  static "-"(a: M44f, b?: M44f): M44f { return b ? a.sub(b) : a.neg(); }
  static "*"(a: M44f, b: M44f): M44f;
  static "*"(a: M44f, b: V4f): V4f;
  static "*"(a: M44f, b: number): M44f;
  static "*"(a: number, b: M44f): M44f;
  static "*"(a: M44f | number, b: M44f | V4f | number): M44f | V4f {
    if (typeof a === "number") return (b as M44f).mul(a);
    return (a as { mul(o: M44f | V4f | number): M44f | V4f }).mul(b);
  }

  "+="(o: M44f): void {
    this._data[0]! += o._data[0]!;
    this._data[1]! += o._data[1]!;
    this._data[2]! += o._data[2]!;
    this._data[3]! += o._data[3]!;
    this._data[4]! += o._data[4]!;
    this._data[5]! += o._data[5]!;
    this._data[6]! += o._data[6]!;
    this._data[7]! += o._data[7]!;
    this._data[8]! += o._data[8]!;
    this._data[9]! += o._data[9]!;
    this._data[10]! += o._data[10]!;
    this._data[11]! += o._data[11]!;
    this._data[12]! += o._data[12]!;
    this._data[13]! += o._data[13]!;
    this._data[14]! += o._data[14]!;
    this._data[15]! += o._data[15]!;
  }
  "-="(o: M44f): void {
    this._data[0]! -= o._data[0]!;
    this._data[1]! -= o._data[1]!;
    this._data[2]! -= o._data[2]!;
    this._data[3]! -= o._data[3]!;
    this._data[4]! -= o._data[4]!;
    this._data[5]! -= o._data[5]!;
    this._data[6]! -= o._data[6]!;
    this._data[7]! -= o._data[7]!;
    this._data[8]! -= o._data[8]!;
    this._data[9]! -= o._data[9]!;
    this._data[10]! -= o._data[10]!;
    this._data[11]! -= o._data[11]!;
    this._data[12]! -= o._data[12]!;
    this._data[13]! -= o._data[13]!;
    this._data[14]! -= o._data[14]!;
    this._data[15]! -= o._data[15]!;
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
    this._data[9]! *= o;
    this._data[10]! *= o;
    this._data[11]! *= o;
    this._data[12]! *= o;
    this._data[13]! *= o;
    this._data[14]! *= o;
    this._data[15]! *= o;
  }
}
