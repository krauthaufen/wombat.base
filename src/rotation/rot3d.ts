// Rot3d — unit quaternion in (W, X, Y, Z) storage order, matching
// Aardvark.Base.Rot3d.
//
// Backed by a `Float64Array` of length 4. W is stored at index 0 so
// `_data[0]` is the scalar and `_data[1..3]` is the vector part.
//
// Multiplication follows the Hamilton convention. Vector rotation is
// active and right-handed: `q.transform(v) = q * v * q⁻¹`. This is
// consistent with `M33d.fromRotationAxisAngle(axis, rad)`.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V3d } from "../vector/v3d.js";
import { M33d } from "../matrix/m33d.js";
import { M44d } from "../matrix/m44d.js";

const F64_BYTES = 8;
const COMPONENT_COUNT = 4;
const BYTES = COMPONENT_COUNT * F64_BYTES;

/**
 * Order in which the per-axis rotations are *applied* when building a
 * rotation from three Euler angles. `"xyz"` means the resulting
 * rotation is `R_x(a) * R_y(b) * R_z(c)`, i.e. when applied to a
 * vector the rightmost rotation acts first (intrinsic XYZ in the
 * reverse reading, equivalent to extrinsic ZYX).
 */
export type EulerOrder = "xyz" | "xzy" | "yxz" | "yzx" | "zxy" | "zyx";

// helper: build per-axis quaternion (W, X, Y, Z)
function axisQuat(axis: 0 | 1 | 2, rad: number): [number, number, number, number] {
  const h = rad * 0.5;
  const c = Math.cos(h), s = Math.sin(h);
  if (axis === 0) return [c, s, 0, 0];
  if (axis === 1) return [c, 0, s, 0];
  return [c, 0, 0, s];
}

// Hamilton product on raw components, returns (w, x, y, z).
function qMul(
  aw: number, ax: number, ay: number, az: number,
  bw: number, bx: number, by: number, bz: number,
): [number, number, number, number] {
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

const AXIS_INDEX: Record<string, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export class Rot3d {
  static readonly __aardworxMathBrand: "Rot3d" = "Rot3d";

  /** @internal storage = [W, X, Y, Z] */
  readonly _data: Float64Array;

  constructor(w: number = 1, x: number = 0, y: number = 0, z: number = 0) {
    this._data = new Float64Array(4);
    this._data[0] = w;
    this._data[1] = x;
    this._data[2] = y;
    this._data[3] = z;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): Rot3d {
    const r = Object.create(Rot3d.prototype) as { _data: Float64Array };
    r._data = new Float64Array(buffer, byteOffset, COMPONENT_COUNT);
    return r as Rot3d;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  // ---------- component access ----------

  get w(): number { return this._data[0]!; }
  set w(v: number) { this._data[0] = v; }
  get x(): number { return this._data[1]!; }
  set x(v: number) { this._data[1] = v; }
  get y(): number { return this._data[2]!; }
  set y(v: number) { this._data[2] = v; }
  get z(): number { return this._data[3]!; }
  set z(v: number) { this._data[3] = v; }

  // ---------- factories ----------

  static readonly identity: Rot3d = new Rot3d(1, 0, 0, 0);

  /** Quaternion from a rotation axis (will be normalised) and an angle in radians. */
  static fromAxisAngle(axis: V3d, rad: number): Rot3d {
    let ax = axis._data[0]!, ay = axis._data[1]!, az = axis._data[2]!;
    const len = Math.sqrt(ax * ax + ay * ay + az * az);
    if (len === 0) return new Rot3d(1, 0, 0, 0);
    ax /= len; ay /= len; az /= len;
    const h = rad * 0.5;
    const s = Math.sin(h);
    return new Rot3d(Math.cos(h), ax * s, ay * s, az * s);
  }

  /**
   * Builds `R(order[0])(roll) * R(order[1])(pitch) * R(order[2])(yaw)`.
   * I.e. parameters are consumed left-to-right and multiplied
   * left-to-right; the rightmost rotation is the one applied to the
   * vector first.
   */
  static fromEuler(roll: number, pitch: number, yaw: number, order: EulerOrder = "xyz"): Rot3d {
    const a0 = AXIS_INDEX[order[0]!]!;
    const a1 = AXIS_INDEX[order[1]!]!;
    const a2 = AXIS_INDEX[order[2]!]!;
    const [w0, x0, y0, z0] = axisQuat(a0, roll);
    const [w1, x1, y1, z1] = axisQuat(a1, pitch);
    const [w2, x2, y2, z2] = axisQuat(a2, yaw);
    const [w01, x01, y01, z01] = qMul(w0, x0, y0, z0, w1, x1, y1, z1);
    const [w, x, y, z] = qMul(w01, x01, y01, z01, w2, x2, y2, z2);
    return new Rot3d(w, x, y, z);
  }

  /**
   * Convenience over `fromEuler`: yaw about Y, pitch about X, roll
   * about Z, applied as `R_y(yaw) * R_x(pitch) * R_z(roll)`.
   */
  static fromYawPitchRoll(yaw: number, pitch: number, roll: number): Rot3d {
    return Rot3d.fromEuler(yaw, pitch, roll, "yxz");
  }

  /** Shoemake's algorithm — quaternion from a (proper) rotation matrix. */
  static fromMatrix(m: M33d): Rot3d {
    const d = m._data;
    const m00 = d[0]!, m01 = d[1]!, m02 = d[2]!;
    const m10 = d[3]!, m11 = d[4]!, m12 = d[5]!;
    const m20 = d[6]!, m21 = d[7]!, m22 = d[8]!;
    const trace = m00 + m11 + m22;
    let w: number, x: number, y: number, z: number;
    if (trace > 0) {
      const s = Math.sqrt(trace + 1) * 2; // s = 4w
      w = 0.25 * s;
      x = (m21 - m12) / s;
      y = (m02 - m20) / s;
      z = (m10 - m01) / s;
    } else if (m00 > m11 && m00 > m22) {
      const s = Math.sqrt(1 + m00 - m11 - m22) * 2; // s = 4x
      w = (m21 - m12) / s;
      x = 0.25 * s;
      y = (m01 + m10) / s;
      z = (m02 + m20) / s;
    } else if (m11 > m22) {
      const s = Math.sqrt(1 + m11 - m00 - m22) * 2; // s = 4y
      w = (m02 - m20) / s;
      x = (m01 + m10) / s;
      y = 0.25 * s;
      z = (m12 + m21) / s;
    } else {
      const s = Math.sqrt(1 + m22 - m00 - m11) * 2; // s = 4z
      w = (m10 - m01) / s;
      x = (m02 + m20) / s;
      y = (m12 + m21) / s;
      z = 0.25 * s;
    }
    return new Rot3d(w, x, y, z);
  }

  /**
   * Shortest rotation taking `from` to `to`. Uses Stan Melax's
   * half-vector trick. Falls back to a 180° rotation about an axis
   * orthogonal to `from` when `from ≈ -to`.
   */
  static fromTwoVectors(from: V3d, to: V3d): Rot3d {
    let fx = from._data[0]!, fy = from._data[1]!, fz = from._data[2]!;
    let tx = to._data[0]!, ty = to._data[1]!, tz = to._data[2]!;
    const fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (fl === 0 || tl === 0) return new Rot3d(1, 0, 0, 0);
    fx /= fl; fy /= fl; fz /= fl;
    tx /= tl; ty /= tl; tz /= tl;
    const dot = fx * tx + fy * ty + fz * tz;
    if (dot > 0.999999) {
      return new Rot3d(1, 0, 0, 0);
    }
    if (dot < -0.999999) {
      // pick any axis orthogonal to from
      let ax: number, ay: number, az: number;
      if (Math.abs(fx) < 0.9) { ax = 1; ay = 0; az = 0; }
      else { ax = 0; ay = 1; az = 0; }
      // ortho = normalize(cross(from, ax))
      let ox = fy * az - fz * ay;
      let oy = fz * ax - fx * az;
      let oz = fx * ay - fy * ax;
      const ol = Math.sqrt(ox * ox + oy * oy + oz * oz);
      ox /= ol; oy /= ol; oz /= ol;
      // 180° rotation about ortho => quat (0, ortho)
      return new Rot3d(0, ox, oy, oz);
    }
    // half-vector h = normalize(from + to); q = (from·h, from × h)
    let hx = fx + tx, hy = fy + ty, hz = fz + tz;
    const hl = Math.sqrt(hx * hx + hy * hy + hz * hz);
    hx /= hl; hy /= hl; hz /= hl;
    const w = fx * hx + fy * hy + fz * hz;
    const cx = fy * hz - fz * hy;
    const cy = fz * hx - fx * hz;
    const cz = fx * hy - fy * hx;
    return new Rot3d(w, cx, cy, cz);
  }

  static copy(other: Rot3d): Rot3d {
    return new Rot3d(other._data[0]!, other._data[1]!, other._data[2]!, other._data[3]!);
  }

  // ---------- algebra ----------

  /** Hamilton product `this * other`. */
  mul(other: Rot3d): Rot3d {
    const aw = this._data[0]!, ax = this._data[1]!, ay = this._data[2]!, az = this._data[3]!;
    const bw = other._data[0]!, bx = other._data[1]!, by = other._data[2]!, bz = other._data[3]!;
    return new Rot3d(
      aw * bw - ax * bx - ay * by - az * bz,
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
    );
  }

  conjugate(): Rot3d {
    return new Rot3d(this._data[0]!, -this._data[1]!, -this._data[2]!, -this._data[3]!);
  }

  /** Inverse — for unit quaternions equals `conjugate`; otherwise `conjugate / |q|²`. */
  inverse(): Rot3d {
    const w = this._data[0]!, x = this._data[1]!, y = this._data[2]!, z = this._data[3]!;
    const n2 = w * w + x * x + y * y + z * z;
    if (n2 === 0) return new Rot3d(1, 0, 0, 0);
    const inv = 1 / n2;
    return new Rot3d(w * inv, -x * inv, -y * inv, -z * inv);
  }

  lengthSquared(): number {
    const w = this._data[0]!, x = this._data[1]!, y = this._data[2]!, z = this._data[3]!;
    return w * w + x * x + y * y + z * z;
  }

  length(): number { return Math.sqrt(this.lengthSquared()); }

  normalize(): Rot3d {
    const len = this.length();
    if (len === 0) return new Rot3d(1, 0, 0, 0);
    const inv = 1 / len;
    return new Rot3d(
      this._data[0]! * inv,
      this._data[1]! * inv,
      this._data[2]! * inv,
      this._data[3]! * inv,
    );
  }

  // ---------- vector action ----------

  /** Rotates `v` by this quaternion. Optimised cross-product form. */
  transform(v: V3d): V3d {
    const w = this._data[0]!, qx = this._data[1]!, qy = this._data[2]!, qz = this._data[3]!;
    const vx = v._data[0]!, vy = v._data[1]!, vz = v._data[2]!;
    // t = 2 * (q.xyz x v)
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    // result = v + w*t + q.xyz × t
    return new V3d(
      vx + w * tx + (qy * tz - qz * ty),
      vy + w * ty + (qz * tx - qx * tz),
      vz + w * tz + (qx * ty - qy * tx),
    );
  }

  // ---------- interpolation ----------

  /** Spherical linear interpolation. Falls back to nlerp when the inputs are very close. */
  slerp(other: Rot3d, t: number): Rot3d {
    let bw = other._data[0]!, bx = other._data[1]!, by = other._data[2]!, bz = other._data[3]!;
    const aw = this._data[0]!, ax = this._data[1]!, ay = this._data[2]!, az = this._data[3]!;
    let dot = aw * bw + ax * bx + ay * by + az * bz;
    if (dot < 0) {
      bw = -bw; bx = -bx; by = -by; bz = -bz;
      dot = -dot;
    }
    if (dot > 0.9995) {
      // very close — fall back to normalised lerp to avoid blowups
      const w = aw + (bw - aw) * t;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const z = az + (bz - az) * t;
      const len = Math.sqrt(w * w + x * x + y * y + z * z);
      if (len === 0) return new Rot3d(1, 0, 0, 0);
      const inv = 1 / len;
      return new Rot3d(w * inv, x * inv, y * inv, z * inv);
    }
    const theta0 = Math.acos(dot);
    const theta = theta0 * t;
    const sinT0 = Math.sin(theta0);
    const sinT  = Math.sin(theta);
    const s0 = Math.cos(theta) - dot * sinT / sinT0;
    const s1 = sinT / sinT0;
    return new Rot3d(
      aw * s0 + bw * s1,
      ax * s0 + bx * s1,
      ay * s0 + by * s1,
      az * s0 + bz * s1,
    );
  }

  /** Normalised linear interpolation. Cheaper than slerp; not constant velocity. */
  nlerp(other: Rot3d, t: number): Rot3d {
    let bw = other._data[0]!, bx = other._data[1]!, by = other._data[2]!, bz = other._data[3]!;
    const aw = this._data[0]!, ax = this._data[1]!, ay = this._data[2]!, az = this._data[3]!;
    if (aw * bw + ax * bx + ay * by + az * bz < 0) {
      bw = -bw; bx = -bx; by = -by; bz = -bz;
    }
    const w = aw + (bw - aw) * t;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const z = az + (bz - az) * t;
    const len = Math.sqrt(w * w + x * x + y * y + z * z);
    if (len === 0) return new Rot3d(1, 0, 0, 0);
    const inv = 1 / len;
    return new Rot3d(w * inv, x * inv, y * inv, z * inv);
  }

  // ---------- conversions ----------

  toAxisAngle(): { axis: V3d; angle: number } {
    // assume (approximately) unit quaternion
    let w = this._data[0]!, x = this._data[1]!, y = this._data[2]!, z = this._data[3]!;
    const n = Math.sqrt(w * w + x * x + y * y + z * z);
    if (n === 0) return { axis: new V3d(1, 0, 0), angle: 0 };
    w /= n; x /= n; y /= n; z /= n;
    const cw = Math.min(1, Math.max(-1, w));
    const angle = 2 * Math.acos(cw);
    const s = Math.sqrt(1 - cw * cw);
    if (s < 1e-9) return { axis: new V3d(1, 0, 0), angle };
    return { axis: new V3d(x / s, y / s, z / s), angle };
  }

  toMatrix(): M33d {
    const w = this._data[0]!, x = this._data[1]!, y = this._data[2]!, z = this._data[3]!;
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;
    const m = new M33d();
    const d = m._data;
    d[0] = 1 - 2 * (yy + zz);  d[1] =     2 * (xy - wz); d[2] =     2 * (xz + wy);
    d[3] =     2 * (xy + wz);  d[4] = 1 - 2 * (xx + zz); d[5] =     2 * (yz - wx);
    d[6] =     2 * (xz - wy);  d[7] =     2 * (yz + wx); d[8] = 1 - 2 * (xx + yy);
    return m;
  }

  toMatrixHomogeneous(): M44d {
    const w = this._data[0]!, x = this._data[1]!, y = this._data[2]!, z = this._data[3]!;
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;
    const m = new M44d();
    const d = m._data;
    d[0]  = 1 - 2 * (yy + zz);  d[1]  =     2 * (xy - wz); d[2]  =     2 * (xz + wy); d[3]  = 0;
    d[4]  =     2 * (xy + wz);  d[5]  = 1 - 2 * (xx + zz); d[6]  =     2 * (yz - wx); d[7]  = 0;
    d[8]  =     2 * (xz - wy);  d[9]  =     2 * (yz + wx); d[10] = 1 - 2 * (xx + yy); d[11] = 0;
    d[12] = 0;                  d[13] = 0;                 d[14] = 0;                 d[15] = 1;
    return m;
  }

  /**
   * Recovers the three Euler angles such that
   * `Rot3d.fromEuler(out.x, out.y, out.z, order)` equals this rotation
   * (up to sign/gimbal-lock ambiguity).
   */
  toEuler(order: EulerOrder = "xyz"): V3d {
    const m = this.toMatrix();
    const d = m._data;
    // generic extraction via matrix elements; per-order formulae
    // assume R = R_a(α) * R_b(β) * R_c(γ) with the matrix in row-major.
    const get = (r: number, c: number) => d[r * 3 + c]!;
    let a: number, b: number, c: number;
    switch (order) {
      case "xyz": {
        b = Math.asin(Math.min(1, Math.max(-1, get(0, 2))));
        if (Math.abs(get(0, 2)) < 0.999999) {
          a = Math.atan2(-get(1, 2), get(2, 2));
          c = Math.atan2(-get(0, 1), get(0, 0));
        } else {
          a = Math.atan2(get(2, 1), get(1, 1));
          c = 0;
        }
        break;
      }
      case "xzy": {
        b = Math.asin(Math.min(1, Math.max(-1, -get(0, 1))));
        if (Math.abs(get(0, 1)) < 0.999999) {
          a = Math.atan2(get(2, 1), get(1, 1));
          c = Math.atan2(get(0, 2), get(0, 0));
        } else {
          a = Math.atan2(-get(1, 2), get(2, 2));
          c = 0;
        }
        break;
      }
      case "yxz": {
        b = Math.asin(Math.min(1, Math.max(-1, -get(1, 2))));
        if (Math.abs(get(1, 2)) < 0.999999) {
          a = Math.atan2(get(0, 2), get(2, 2));
          c = Math.atan2(get(1, 0), get(1, 1));
        } else {
          a = Math.atan2(-get(2, 0), get(0, 0));
          c = 0;
        }
        break;
      }
      case "yzx": {
        b = Math.asin(Math.min(1, Math.max(-1, get(1, 0))));
        if (Math.abs(get(1, 0)) < 0.999999) {
          a = Math.atan2(-get(2, 0), get(0, 0));
          c = Math.atan2(-get(1, 2), get(1, 1));
        } else {
          a = Math.atan2(get(0, 2), get(2, 2));
          c = 0;
        }
        break;
      }
      case "zxy": {
        b = Math.asin(Math.min(1, Math.max(-1, get(2, 1))));
        if (Math.abs(get(2, 1)) < 0.999999) {
          a = Math.atan2(-get(0, 1), get(1, 1));
          c = Math.atan2(-get(2, 0), get(2, 2));
        } else {
          a = Math.atan2(get(1, 0), get(0, 0));
          c = 0;
        }
        break;
      }
      case "zyx": {
        b = Math.asin(Math.min(1, Math.max(-1, -get(2, 0))));
        if (Math.abs(get(2, 0)) < 0.999999) {
          a = Math.atan2(get(1, 0), get(0, 0));
          c = Math.atan2(get(2, 1), get(2, 2));
        } else {
          a = Math.atan2(-get(0, 1), get(1, 1));
          c = 0;
        }
        break;
      }
    }
    return new V3d(a, b, c);
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Rot3d)) return false;
    return (
      this._data[0] === other._data[0] &&
      this._data[1] === other._data[1] &&
      this._data[2] === other._data[2] &&
      this._data[3] === other._data[3]
    );
  }

  approxEqual(other: Rot3d, eps: number): boolean {
    return (
      Math.abs(this._data[0]! - other._data[0]!) <= eps &&
      Math.abs(this._data[1]! - other._data[1]!) <= eps &&
      Math.abs(this._data[2]! - other._data[2]!) <= eps &&
      Math.abs(this._data[3]! - other._data[3]!) <= eps
    );
  }

  getHashCode(): number {
    let h = hashNumber(this._data[0]!);
    h = combineHash(h, hashNumber(this._data[1]!));
    h = combineHash(h, hashNumber(this._data[2]!));
    h = combineHash(h, hashNumber(this._data[3]!));
    return h;
  }

  toString(): string {
    return `Rot3d(${this._data[0]}, ${this._data[1]}, ${this._data[2]}, ${this._data[3]})`;
  }

  /** Yields W, X, Y, Z in storage order. */
  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
    yield this._data[2]!;
    yield this._data[3]!;
  }

  toArray(): [number, number, number, number] {
    return [this._data[0]!, this._data[1]!, this._data[2]!, this._data[3]!];
  }

  // ---------- alloc-free static variants ----------

  static mulInto(a: Rot3d, b: Rot3d, target: Rot3d): Rot3d {
    const aw = a._data[0]!, ax = a._data[1]!, ay = a._data[2]!, az = a._data[3]!;
    const bw = b._data[0]!, bx = b._data[1]!, by = b._data[2]!, bz = b._data[3]!;
    target._data[0] = aw * bw - ax * bx - ay * by - az * bz;
    target._data[1] = aw * bx + ax * bw + ay * bz - az * by;
    target._data[2] = aw * by - ax * bz + ay * bw + az * bx;
    target._data[3] = aw * bz + ax * by - ay * bx + az * bw;
    return target;
  }

  static inverseInto(a: Rot3d, target: Rot3d): Rot3d {
    const w = a._data[0]!, x = a._data[1]!, y = a._data[2]!, z = a._data[3]!;
    const n2 = w * w + x * x + y * y + z * z;
    const inv = n2 === 0 ? 0 : 1 / n2;
    target._data[0] =  w * inv;
    target._data[1] = -x * inv;
    target._data[2] = -y * inv;
    target._data[3] = -z * inv;
    return target;
  }

  static normalizeInto(a: Rot3d, target: Rot3d): Rot3d {
    const w = a._data[0]!, x = a._data[1]!, y = a._data[2]!, z = a._data[3]!;
    const len = Math.sqrt(w * w + x * x + y * y + z * z);
    if (len === 0) {
      target._data[0] = 1; target._data[1] = 0; target._data[2] = 0; target._data[3] = 0;
      return target;
    }
    const inv = 1 / len;
    target._data[0] = w * inv;
    target._data[1] = x * inv;
    target._data[2] = y * inv;
    target._data[3] = z * inv;
    return target;
  }

  static transformInto(q: Rot3d, v: V3d, target: V3d): V3d {
    const w = q._data[0]!, qx = q._data[1]!, qy = q._data[2]!, qz = q._data[3]!;
    const vx = v._data[0]!, vy = v._data[1]!, vz = v._data[2]!;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    const rx = vx + w * tx + (qy * tz - qz * ty);
    const ry = vy + w * ty + (qz * tx - qx * tz);
    const rz = vz + w * tz + (qx * ty - qy * tx);
    target._data[0] = rx; target._data[1] = ry; target._data[2] = rz;
    return target;
  }

  static copyInto(from: Rot3d, target: Rot3d): Rot3d {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    target._data[2] = from._data[2]!;
    target._data[3] = from._data[3]!;
    return target;
  }
}
