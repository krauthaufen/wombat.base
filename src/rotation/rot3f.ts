// Rot3f — unit quaternion in (W, X, Y, Z) storage order, float32.
//
// Backed by a `Float32Array` of length 4. See rot3d.ts for the
// long-form rationale; this file is the f32 mirror.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V3f } from "../vector/v3f.js";
import { M33f } from "../matrix/m33f.js";
import { M44f } from "../matrix/m44f.js";

export type { EulerOrder } from "./rot3d.js";
import type { EulerOrder } from "./rot3d.js";

const F32_BYTES = 4;
const COMPONENT_COUNT = 4;
const BYTES = COMPONENT_COUNT * F32_BYTES;

function axisQuat(axis: 0 | 1 | 2, rad: number): [number, number, number, number] {
  const h = rad * 0.5;
  const c = Math.cos(h), s = Math.sin(h);
  if (axis === 0) return [c, s, 0, 0];
  if (axis === 1) return [c, 0, s, 0];
  return [c, 0, 0, s];
}

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

export class Rot3f {
  static readonly __aardworxMathBrand: "Rot3f" = "Rot3f";

  /** @internal storage = [W, X, Y, Z] */
  readonly _data: Float32Array;

  constructor(w: number = 1, x: number = 0, y: number = 0, z: number = 0) {
    this._data = new Float32Array(4);
    this._data[0] = w;
    this._data[1] = x;
    this._data[2] = y;
    this._data[3] = z;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): Rot3f {
    const r = Object.create(Rot3f.prototype) as { _data: Float32Array };
    r._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return r as Rot3f;
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

  static readonly identity: Rot3f = new Rot3f(1, 0, 0, 0);

  static fromAxisAngle(axis: V3f, rad: number): Rot3f {
    let ax = axis._data[0]!, ay = axis._data[1]!, az = axis._data[2]!;
    const len = Math.sqrt(ax * ax + ay * ay + az * az);
    if (len === 0) return new Rot3f(1, 0, 0, 0);
    ax /= len; ay /= len; az /= len;
    const h = rad * 0.5;
    const s = Math.sin(h);
    return new Rot3f(Math.cos(h), ax * s, ay * s, az * s);
  }

  /** Alias for `fromAxisAngle`. */
  static rotation(axis: V3f, rad: number): Rot3f { return Rot3f.fromAxisAngle(axis, rad); }
  static rotationInDegrees(axis: V3f, deg: number): Rot3f {
    return Rot3f.fromAxisAngle(axis, deg * (Math.PI / 180));
  }
  static rotateInto(from: V3f, into: V3f): Rot3f {
    return Rot3f.fromTwoVectors(from, into);
  }

  static rotationX(rad: number): Rot3f {
    const h = rad * 0.5;
    return new Rot3f(Math.cos(h), Math.sin(h), 0, 0);
  }
  static rotationXInDegrees(deg: number): Rot3f { return Rot3f.rotationX(deg * (Math.PI / 180)); }
  static rotationY(rad: number): Rot3f {
    const h = rad * 0.5;
    return new Rot3f(Math.cos(h), 0, Math.sin(h), 0);
  }
  static rotationYInDegrees(deg: number): Rot3f { return Rot3f.rotationY(deg * (Math.PI / 180)); }
  static rotationZ(rad: number): Rot3f {
    const h = rad * 0.5;
    return new Rot3f(Math.cos(h), 0, 0, Math.sin(h));
  }
  static rotationZInDegrees(deg: number): Rot3f { return Rot3f.rotationZ(deg * (Math.PI / 180)); }

  static fromEuler(roll: number, pitch: number, yaw: number, order: EulerOrder = "xyz"): Rot3f {
    const a0 = AXIS_INDEX[order[0]!]!;
    const a1 = AXIS_INDEX[order[1]!]!;
    const a2 = AXIS_INDEX[order[2]!]!;
    const [w0, x0, y0, z0] = axisQuat(a0, roll);
    const [w1, x1, y1, z1] = axisQuat(a1, pitch);
    const [w2, x2, y2, z2] = axisQuat(a2, yaw);
    const [w01, x01, y01, z01] = qMul(w0, x0, y0, z0, w1, x1, y1, z1);
    const [w, x, y, z] = qMul(w01, x01, y01, z01, w2, x2, y2, z2);
    return new Rot3f(w, x, y, z);
  }

  static fromYawPitchRoll(yaw: number, pitch: number, roll: number): Rot3f {
    return Rot3f.fromEuler(yaw, pitch, roll, "yxz");
  }

  static fromMatrix(m: M33f): Rot3f {
    const d = m._data;
    const m00 = d[0]!, m01 = d[1]!, m02 = d[2]!;
    const m10 = d[3]!, m11 = d[4]!, m12 = d[5]!;
    const m20 = d[6]!, m21 = d[7]!, m22 = d[8]!;
    const trace = m00 + m11 + m22;
    let w: number, x: number, y: number, z: number;
    if (trace > 0) {
      const s = Math.sqrt(trace + 1) * 2;
      w = 0.25 * s;
      x = (m21 - m12) / s;
      y = (m02 - m20) / s;
      z = (m10 - m01) / s;
    } else if (m00 > m11 && m00 > m22) {
      const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
      w = (m21 - m12) / s;
      x = 0.25 * s;
      y = (m01 + m10) / s;
      z = (m02 + m20) / s;
    } else if (m11 > m22) {
      const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
      w = (m02 - m20) / s;
      x = (m01 + m10) / s;
      y = 0.25 * s;
      z = (m12 + m21) / s;
    } else {
      const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
      w = (m10 - m01) / s;
      x = (m02 + m20) / s;
      y = (m12 + m21) / s;
      z = 0.25 * s;
    }
    return new Rot3f(w, x, y, z);
  }

  static fromTwoVectors(from: V3f, to: V3f): Rot3f {
    let fx = from._data[0]!, fy = from._data[1]!, fz = from._data[2]!;
    let tx = to._data[0]!, ty = to._data[1]!, tz = to._data[2]!;
    const fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (fl === 0 || tl === 0) return new Rot3f(1, 0, 0, 0);
    fx /= fl; fy /= fl; fz /= fl;
    tx /= tl; ty /= tl; tz /= tl;
    const dot = fx * tx + fy * ty + fz * tz;
    if (dot > 0.999999) return new Rot3f(1, 0, 0, 0);
    if (dot < -0.999999) {
      let ax: number, ay: number, az: number;
      if (Math.abs(fx) < 0.9) { ax = 1; ay = 0; az = 0; }
      else { ax = 0; ay = 1; az = 0; }
      let ox = fy * az - fz * ay;
      let oy = fz * ax - fx * az;
      let oz = fx * ay - fy * ax;
      const ol = Math.sqrt(ox * ox + oy * oy + oz * oz);
      ox /= ol; oy /= ol; oz /= ol;
      return new Rot3f(0, ox, oy, oz);
    }
    let hx = fx + tx, hy = fy + ty, hz = fz + tz;
    const hl = Math.sqrt(hx * hx + hy * hy + hz * hz);
    hx /= hl; hy /= hl; hz /= hl;
    const w = fx * hx + fy * hy + fz * hz;
    const cx = fy * hz - fz * hy;
    const cy = fz * hx - fx * hz;
    const cz = fx * hy - fy * hx;
    return new Rot3f(w, cx, cy, cz);
  }

  static copy(other: Rot3f): Rot3f {
    return new Rot3f(other._data[0]!, other._data[1]!, other._data[2]!, other._data[3]!);
  }

  // ---------- algebra ----------

  mul(other: Rot3f): Rot3f {
    const aw = this._data[0]!, ax = this._data[1]!, ay = this._data[2]!, az = this._data[3]!;
    const bw = other._data[0]!, bx = other._data[1]!, by = other._data[2]!, bz = other._data[3]!;
    return new Rot3f(
      aw * bw - ax * bx - ay * by - az * bz,
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
    );
  }

  conjugate(): Rot3f {
    return new Rot3f(this._data[0]!, -this._data[1]!, -this._data[2]!, -this._data[3]!);
  }

  inverse(): Rot3f {
    const w = this._data[0]!, x = this._data[1]!, y = this._data[2]!, z = this._data[3]!;
    const n2 = w * w + x * x + y * y + z * z;
    if (n2 === 0) return new Rot3f(1, 0, 0, 0);
    const inv = 1 / n2;
    return new Rot3f(w * inv, -x * inv, -y * inv, -z * inv);
  }

  lengthSquared(): number {
    const w = this._data[0]!, x = this._data[1]!, y = this._data[2]!, z = this._data[3]!;
    return w * w + x * x + y * y + z * z;
  }

  length(): number { return Math.sqrt(this.lengthSquared()); }

  normalize(): Rot3f {
    const len = this.length();
    if (len === 0) return new Rot3f(1, 0, 0, 0);
    const inv = 1 / len;
    return new Rot3f(
      this._data[0]! * inv,
      this._data[1]! * inv,
      this._data[2]! * inv,
      this._data[3]! * inv,
    );
  }

  // ---------- vector action ----------

  transform(v: V3f): V3f {
    const w = this._data[0]!, qx = this._data[1]!, qy = this._data[2]!, qz = this._data[3]!;
    const vx = v._data[0]!, vy = v._data[1]!, vz = v._data[2]!;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    return new V3f(
      vx + w * tx + (qy * tz - qz * ty),
      vy + w * ty + (qz * tx - qx * tz),
      vz + w * tz + (qx * ty - qy * tx),
    );
  }

  // ---------- interpolation ----------

  slerp(other: Rot3f, t: number): Rot3f {
    let bw = other._data[0]!, bx = other._data[1]!, by = other._data[2]!, bz = other._data[3]!;
    const aw = this._data[0]!, ax = this._data[1]!, ay = this._data[2]!, az = this._data[3]!;
    let dot = aw * bw + ax * bx + ay * by + az * bz;
    if (dot < 0) {
      bw = -bw; bx = -bx; by = -by; bz = -bz;
      dot = -dot;
    }
    if (dot > 0.9995) {
      const w = aw + (bw - aw) * t;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const z = az + (bz - az) * t;
      const len = Math.sqrt(w * w + x * x + y * y + z * z);
      if (len === 0) return new Rot3f(1, 0, 0, 0);
      const inv = 1 / len;
      return new Rot3f(w * inv, x * inv, y * inv, z * inv);
    }
    const theta0 = Math.acos(dot);
    const theta = theta0 * t;
    const sinT0 = Math.sin(theta0);
    const sinT  = Math.sin(theta);
    const s0 = Math.cos(theta) - dot * sinT / sinT0;
    const s1 = sinT / sinT0;
    return new Rot3f(
      aw * s0 + bw * s1,
      ax * s0 + bx * s1,
      ay * s0 + by * s1,
      az * s0 + bz * s1,
    );
  }

  nlerp(other: Rot3f, t: number): Rot3f {
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
    if (len === 0) return new Rot3f(1, 0, 0, 0);
    const inv = 1 / len;
    return new Rot3f(w * inv, x * inv, y * inv, z * inv);
  }

  // ---------- conversions ----------

  toAxisAngle(): { axis: V3f; angle: number } {
    let w = this._data[0]!, x = this._data[1]!, y = this._data[2]!, z = this._data[3]!;
    const n = Math.sqrt(w * w + x * x + y * y + z * z);
    if (n === 0) return { axis: new V3f(1, 0, 0), angle: 0 };
    w /= n; x /= n; y /= n; z /= n;
    const cw = Math.min(1, Math.max(-1, w));
    const angle = 2 * Math.acos(cw);
    const s = Math.sqrt(1 - cw * cw);
    if (s < 1e-6) return { axis: new V3f(1, 0, 0), angle };
    return { axis: new V3f(x / s, y / s, z / s), angle };
  }

  toMatrix(): M33f {
    const w = this._data[0]!, x = this._data[1]!, y = this._data[2]!, z = this._data[3]!;
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;
    const m = new M33f();
    const d = m._data;
    d[0] = 1 - 2 * (yy + zz);  d[1] =     2 * (xy - wz); d[2] =     2 * (xz + wy);
    d[3] =     2 * (xy + wz);  d[4] = 1 - 2 * (xx + zz); d[5] =     2 * (yz - wx);
    d[6] =     2 * (xz - wy);  d[7] =     2 * (yz + wx); d[8] = 1 - 2 * (xx + yy);
    return m;
  }

  toMatrixHomogeneous(): M44f {
    const w = this._data[0]!, x = this._data[1]!, y = this._data[2]!, z = this._data[3]!;
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;
    const m = new M44f();
    const d = m._data;
    d[0]  = 1 - 2 * (yy + zz);  d[1]  =     2 * (xy - wz); d[2]  =     2 * (xz + wy); d[3]  = 0;
    d[4]  =     2 * (xy + wz);  d[5]  = 1 - 2 * (xx + zz); d[6]  =     2 * (yz - wx); d[7]  = 0;
    d[8]  =     2 * (xz - wy);  d[9]  =     2 * (yz + wx); d[10] = 1 - 2 * (xx + yy); d[11] = 0;
    d[12] = 0;                  d[13] = 0;                 d[14] = 0;                 d[15] = 1;
    return m;
  }

  toEuler(order: EulerOrder = "xyz"): V3f {
    const m = this.toMatrix();
    const d = m._data;
    const get = (r: number, c: number) => d[r * 3 + c]!;
    let a: number, b: number, c: number;
    switch (order) {
      case "xyz": {
        b = Math.asin(Math.min(1, Math.max(-1, get(0, 2))));
        if (Math.abs(get(0, 2)) < 0.999999) {
          a = Math.atan2(-get(1, 2), get(2, 2));
          c = Math.atan2(-get(0, 1), get(0, 0));
        } else { a = Math.atan2(get(2, 1), get(1, 1)); c = 0; }
        break;
      }
      case "xzy": {
        b = Math.asin(Math.min(1, Math.max(-1, -get(0, 1))));
        if (Math.abs(get(0, 1)) < 0.999999) {
          a = Math.atan2(get(2, 1), get(1, 1));
          c = Math.atan2(get(0, 2), get(0, 0));
        } else { a = Math.atan2(-get(1, 2), get(2, 2)); c = 0; }
        break;
      }
      case "yxz": {
        b = Math.asin(Math.min(1, Math.max(-1, -get(1, 2))));
        if (Math.abs(get(1, 2)) < 0.999999) {
          a = Math.atan2(get(0, 2), get(2, 2));
          c = Math.atan2(get(1, 0), get(1, 1));
        } else { a = Math.atan2(-get(2, 0), get(0, 0)); c = 0; }
        break;
      }
      case "yzx": {
        b = Math.asin(Math.min(1, Math.max(-1, get(1, 0))));
        if (Math.abs(get(1, 0)) < 0.999999) {
          a = Math.atan2(-get(2, 0), get(0, 0));
          c = Math.atan2(-get(1, 2), get(1, 1));
        } else { a = Math.atan2(get(0, 2), get(2, 2)); c = 0; }
        break;
      }
      case "zxy": {
        b = Math.asin(Math.min(1, Math.max(-1, get(2, 1))));
        if (Math.abs(get(2, 1)) < 0.999999) {
          a = Math.atan2(-get(0, 1), get(1, 1));
          c = Math.atan2(-get(2, 0), get(2, 2));
        } else { a = Math.atan2(get(1, 0), get(0, 0)); c = 0; }
        break;
      }
      case "zyx": {
        b = Math.asin(Math.min(1, Math.max(-1, -get(2, 0))));
        if (Math.abs(get(2, 0)) < 0.999999) {
          a = Math.atan2(get(1, 0), get(0, 0));
          c = Math.atan2(get(2, 1), get(2, 2));
        } else { a = Math.atan2(-get(0, 1), get(1, 1)); c = 0; }
        break;
      }
    }
    return new V3f(a, b, c);
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Rot3f)) return false;
    return (
      this._data[0] === other._data[0] &&
      this._data[1] === other._data[1] &&
      this._data[2] === other._data[2] &&
      this._data[3] === other._data[3]
    );
  }

  approxEqual(other: Rot3f, eps: number): boolean {
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
    return `Rot3f(${this._data[0]}, ${this._data[1]}, ${this._data[2]}, ${this._data[3]})`;
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

  static mulInto(a: Rot3f, b: Rot3f, target: Rot3f): Rot3f {
    const aw = a._data[0]!, ax = a._data[1]!, ay = a._data[2]!, az = a._data[3]!;
    const bw = b._data[0]!, bx = b._data[1]!, by = b._data[2]!, bz = b._data[3]!;
    target._data[0] = aw * bw - ax * bx - ay * by - az * bz;
    target._data[1] = aw * bx + ax * bw + ay * bz - az * by;
    target._data[2] = aw * by - ax * bz + ay * bw + az * bx;
    target._data[3] = aw * bz + ax * by - ay * bx + az * bw;
    return target;
  }

  static inverseInto(a: Rot3f, target: Rot3f): Rot3f {
    const w = a._data[0]!, x = a._data[1]!, y = a._data[2]!, z = a._data[3]!;
    const n2 = w * w + x * x + y * y + z * z;
    const inv = n2 === 0 ? 0 : 1 / n2;
    target._data[0] =  w * inv;
    target._data[1] = -x * inv;
    target._data[2] = -y * inv;
    target._data[3] = -z * inv;
    return target;
  }

  static normalizeInto(a: Rot3f, target: Rot3f): Rot3f {
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

  static transformInto(q: Rot3f, v: V3f, target: V3f): V3f {
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

  static copyInto(from: Rot3f, target: Rot3f): Rot3f {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    target._data[2] = from._data[2]!;
    target._data[3] = from._data[3]!;
    return target;
  }

  // ---------- operator overloads (boperators) ----------

  static "*"(a: Rot3f, b: Rot3f): Rot3f { return a.mul(b); }
}
