// Affine3d — general affine 3D transformation: linear M33d plus
// translation V3d. Action on a point: `transform(p) = linear * p + trans`.

import { V3d } from "../vector/v3d.js";
import { V4d } from "../vector/v4d.js";
import { M33d } from "../matrix/m33d.js";
import { M44d } from "../matrix/m44d.js";
import { Rot3d } from "../rotation/rot3d.js";
import { Shift3d } from "./shift3d.js";
import { Scale3d } from "./scale3d.js";
import { Euclidean3d } from "./euclidean3d.js";
import { Similarity3d } from "./similarity3d.js";
import { combineHash } from "../internal/hash.js";
import { Trafo3d } from "./trafo3d.js";

const DEG_TO_RAD = Math.PI / 180;

// Convert an Euclidean3d to its equivalent Affine3d.
function euclideanToAffine(e: Euclidean3d): Affine3d {
  return new Affine3d(e.rot.toMatrix(), e.trans);
}
// Convert a Similarity3d to its equivalent Affine3d.
function similarityToAffine(s: Similarity3d): Affine3d {
  return new Affine3d(s.rot.toMatrix().mul(s.scale), s.trans);
}

export class Affine3d {
  static readonly __aardworxMathBrand: "Affine3d" = "Affine3d";

  /** @internal */
  readonly _linear: M33d;
  /** @internal */
  readonly _trans: V3d;

  constructor(linear: M33d = M33d.identity, trans: V3d = V3d.zero) {
    this._linear = M33d.copy(linear);
    this._trans = V3d.copy(trans);
  }

  static readonly identity: Affine3d = new Affine3d(M33d.identity, V3d.zero);

  static fromLinearAndTranslation(m: M33d, t: V3d): Affine3d {
    return new Affine3d(m, t);
  }

  // ---------- translation ----------

  static translation(v: V3d): Affine3d;
  static translation(tx: number, ty: number, tz: number): Affine3d;
  static translation(shift: Shift3d): Affine3d;
  static translation(a: V3d | number | Shift3d, b?: number, c?: number): Affine3d {
    let v: V3d;
    if (typeof a === "number") v = new V3d(a, b!, c!);
    else if (a instanceof Shift3d) v = a.offset;
    else v = a;
    return new Affine3d(M33d.identity, v);
  }

  // ---------- scaling ----------

  static scaling(v: V3d): Affine3d;
  static scaling(sx: number, sy: number, sz: number): Affine3d;
  static scaling(s: number): Affine3d;
  static scaling(scale: Scale3d): Affine3d;
  static scaling(a: V3d | number | Scale3d, b?: number, c?: number): Affine3d {
    let v: V3d;
    if (typeof a === "number") {
      v = b === undefined ? new V3d(a, a, a) : new V3d(a, b, c!);
    } else if (a instanceof Scale3d) {
      v = a.scale;
    } else {
      v = a;
    }
    return new Affine3d(M33d.diagonal(v), V3d.zero);
  }

  // ---------- rotation ----------

  static rotation(axis: V3d, rad: number): Affine3d;
  static rotation(rot: Rot3d): Affine3d;
  static rotation(a: V3d | Rot3d, rad?: number): Affine3d {
    if (a instanceof Rot3d) return new Affine3d(a.toMatrix(), V3d.zero);
    return new Affine3d(M33d.fromRotationAxisAngle(a, rad!), V3d.zero);
  }
  static rotationInDegrees(axis: V3d, deg: number): Affine3d {
    return Affine3d.rotation(axis, deg * DEG_TO_RAD);
  }
  static rotationX(rad: number): Affine3d {
    return new Affine3d(M33d.fromRotationAxisAngle(new V3d(1, 0, 0), rad), V3d.zero);
  }
  static rotationXInDegrees(deg: number): Affine3d { return Affine3d.rotationX(deg * DEG_TO_RAD); }
  static rotationY(rad: number): Affine3d {
    return new Affine3d(M33d.fromRotationAxisAngle(new V3d(0, 1, 0), rad), V3d.zero);
  }
  static rotationYInDegrees(deg: number): Affine3d { return Affine3d.rotationY(deg * DEG_TO_RAD); }
  static rotationZ(rad: number): Affine3d {
    return new Affine3d(M33d.fromRotationAxisAngle(new V3d(0, 0, 1), rad), V3d.zero);
  }
  static rotationZInDegrees(deg: number): Affine3d { return Affine3d.rotationZ(deg * DEG_TO_RAD); }

  static rotationEuler(roll: number, pitch: number, yaw: number): Affine3d;
  static rotationEuler(rollPitchYaw: V3d): Affine3d;
  static rotationEuler(a: number | V3d, pitch?: number, yaw?: number): Affine3d {
    let r: number, p: number, y: number;
    if (typeof a === "number") { r = a; p = pitch!; y = yaw!; }
    else { r = a.x; p = a.y; y = a.z; }
    return Affine3d.rotationZ(y).mul(Affine3d.rotationY(p)).mul(Affine3d.rotationX(r));
  }
  static rotationEulerInDegrees(roll: number, pitch: number, yaw: number): Affine3d;
  static rotationEulerInDegrees(rollPitchYaw: V3d): Affine3d;
  static rotationEulerInDegrees(a: number | V3d, pitch?: number, yaw?: number): Affine3d {
    if (typeof a === "number") {
      return Affine3d.rotationEuler(a * DEG_TO_RAD, pitch! * DEG_TO_RAD, yaw! * DEG_TO_RAD);
    }
    return Affine3d.rotationEuler(a.mul(DEG_TO_RAD));
  }
  static rotateInto(from: V3d, into: V3d): Affine3d {
    return Affine3d.rotation(Rot3d.fromTwoVectors(from, into));
  }

  // ---------- shear ----------

  static shearYZ(factorY: number, factorZ: number): Affine3d {
    const m = M33d.copy(M33d.identity);
    m._data[1] = factorY; m._data[2] = factorZ;
    return new Affine3d(m, V3d.zero);
  }
  static shearXZ(factorX: number, factorZ: number): Affine3d {
    const m = M33d.copy(M33d.identity);
    m._data[3] = factorX; m._data[5] = factorZ;
    return new Affine3d(m, V3d.zero);
  }
  static shearXY(factorX: number, factorY: number): Affine3d {
    const m = M33d.copy(M33d.identity);
    m._data[6] = factorX; m._data[7] = factorY;
    return new Affine3d(m, V3d.zero);
  }

  get linear(): M33d { return this._linear; }
  get trans(): V3d { return this._trans; }

  // ---------- transformations ----------

  transform(p: V3d): V3d { return this._linear.transform(p).add(this._trans); }
  transformPos(p: V3d): V3d { return this.transform(p); }
  transformDir(d: V3d): V3d { return this._linear.transform(d); }

  // ---------- algebra ----------

  mul(other: Affine3d): Affine3d {
    // (a.linear * b.linear) and (a.linear * b.trans + a.trans)
    return new Affine3d(
      this._linear.mul(other._linear),
      this._linear.transform(other._trans).add(this._trans),
    );
  }

  then(other: Affine3d): Affine3d { return other.mul(this); }

  inverse(): Affine3d {
    const li = this._linear.inverse();
    return new Affine3d(li, li.transform(this._trans).neg());
  }

  // ---------- conversions ----------

  toMatrix(): M44d {
    const m = new M44d();
    const ld = this._linear._data, md = m._data;
    md[0]  = ld[0]!; md[1]  = ld[1]!; md[2]  = ld[2]!; md[3]  = this._trans.x;
    md[4]  = ld[3]!; md[5]  = ld[4]!; md[6]  = ld[5]!; md[7]  = this._trans.y;
    md[8]  = ld[6]!; md[9]  = ld[7]!; md[10] = ld[8]!; md[11] = this._trans.z;
    md[12] = 0;      md[13] = 0;      md[14] = 0;      md[15] = 1;
    return m;
  }

  toTrafo3d(): Trafo3d {
    return Trafo3d.fromMatrices(this.toMatrix(), this.inverse().toMatrix());
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Affine3d)) return false;
    return this._linear.equals(other._linear) && this._trans.equals(other._trans);
  }

  approxEqual(other: Affine3d, eps: number): boolean {
    return this._linear.approxEqual(other._linear, eps)
        && this._trans.approxEqual(other._trans, eps);
  }

  getHashCode(): number {
    return combineHash(this._linear.getHashCode(), this._trans.getHashCode());
  }

  toString(): string {
    return `Affine3d(${this._linear.toString()}, ${this._trans.toString()})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield* this._linear;
    yield* this._trans;
  }

  // ---------- operator overloads (boperators) ----------

  static "*"(a: Affine3d, b: Affine3d): Affine3d;
  static "*"(a: Affine3d, b: M44d): M44d;
  static "*"(a: M44d, b: Affine3d): M44d;
  static "*"(a: Affine3d, v: V4d): V4d;
  static "*"(a: Affine3d, b: Euclidean3d): Affine3d;
  static "*"(a: Euclidean3d, b: Affine3d): Affine3d;
  static "*"(a: Affine3d, b: Rot3d): Affine3d;
  static "*"(a: Rot3d, b: Affine3d): Affine3d;
  static "*"(a: Affine3d, b: Scale3d): Affine3d;
  static "*"(a: Scale3d, b: Affine3d): Affine3d;
  static "*"(a: Affine3d, b: Shift3d): Affine3d;
  static "*"(a: Shift3d, b: Affine3d): Affine3d;
  static "*"(a: Affine3d, b: Similarity3d): Affine3d;
  static "*"(a: Similarity3d, b: Affine3d): Affine3d;
  static "*"(
    a: Affine3d | M44d | Euclidean3d | Rot3d | Scale3d | Shift3d | Similarity3d,
    b: Affine3d | M44d | V4d | Euclidean3d | Rot3d | Scale3d | Shift3d | Similarity3d,
  ): Affine3d | M44d | V4d {
    if (a instanceof Affine3d) {
      if (b instanceof Affine3d) return a.mul(b);
      if (b instanceof M44d) return a.toMatrix().mul(b);
      if (b instanceof V4d) return a.toMatrix().mul(b);
      if (b instanceof Euclidean3d) return a.mul(euclideanToAffine(b));
      if (b instanceof Similarity3d) return a.mul(similarityToAffine(b));
      if (b instanceof Rot3d) return new Affine3d(a.linear.mul(b.toMatrix()), a.trans);
      if (b instanceof Scale3d) return new Affine3d(a.linear.mul(M33d.diagonal(b.scale)), a.trans);
      if (b instanceof Shift3d) return new Affine3d(a.linear, a.linear.transform(b.offset).add(a.trans));
    }
    if (a instanceof M44d) return a.mul((b as Affine3d).toMatrix());
    const ba = b as Affine3d;
    if (a instanceof Euclidean3d) return euclideanToAffine(a).mul(ba);
    if (a instanceof Similarity3d) return similarityToAffine(a).mul(ba);
    if (a instanceof Rot3d) return new Affine3d(a.toMatrix().mul(ba.linear), a.transform(ba.trans));
    if (a instanceof Scale3d) {
      return new Affine3d(M33d.diagonal(a.scale).mul(ba.linear), ba.trans.mul(a.scale));
    }
    if (a instanceof Shift3d) return new Affine3d(ba.linear, ba.trans.add(a.offset));
    throw new Error("Affine3d.*: unreachable");
  }
}
