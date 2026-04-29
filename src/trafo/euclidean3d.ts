// Euclidean3d — rigid-body transformation: rotation followed by
// translation. Stored as a Rot3d (unit quaternion) plus a V3d offset.
//
// Action on a point: `transform(p) = rot * p + trans`.
// Composition: `a.mul(b).transform(v) = a.transform(b.transform(v))`,
// which yields `rot = a.rot * b.rot` and `trans = a.rot * b.trans + a.trans`.

import { V3d } from "../vector/v3d.js";
import { V4d } from "../vector/v4d.js";
import { Rot3d } from "../rotation/rot3d.js";
import { M44d } from "../matrix/m44d.js";
import { Shift3d } from "./shift3d.js";
import { combineHash } from "../internal/hash.js";
import { Trafo3d } from "./trafo3d.js";

const DEG_TO_RAD = Math.PI / 180;

export class Euclidean3d {
  static readonly __aardworxMathBrand: "Euclidean3d" = "Euclidean3d";

  /** @internal */
  readonly _rot: Rot3d;
  /** @internal */
  readonly _trans: V3d;

  constructor(rot: Rot3d = Rot3d.identity, trans: V3d = V3d.zero) {
    this._rot = Rot3d.copy(rot);
    this._trans = V3d.copy(trans);
  }

  static readonly identity: Euclidean3d = new Euclidean3d(Rot3d.identity, V3d.zero);

  static fromRotation(r: Rot3d): Euclidean3d { return new Euclidean3d(r, V3d.zero); }
  static fromTranslation(t: V3d): Euclidean3d { return new Euclidean3d(Rot3d.identity, t); }
  static fromRotationAndTranslation(r: Rot3d, t: V3d): Euclidean3d {
    return new Euclidean3d(r, t);
  }

  // ---------- translation ----------

  static translation(v: V3d): Euclidean3d;
  static translation(tx: number, ty: number, tz: number): Euclidean3d;
  static translation(shift: Shift3d): Euclidean3d;
  static translation(a: V3d | number | Shift3d, b?: number, c?: number): Euclidean3d {
    let v: V3d;
    if (typeof a === "number") v = new V3d(a, b!, c!);
    else if (a instanceof Shift3d) v = a.offset;
    else v = a;
    return new Euclidean3d(Rot3d.identity, v);
  }

  // ---------- rotation ----------

  static rotation(axis: V3d, rad: number): Euclidean3d;
  static rotation(rot: Rot3d): Euclidean3d;
  static rotation(a: V3d | Rot3d, rad?: number): Euclidean3d {
    if (a instanceof Rot3d) return new Euclidean3d(a, V3d.zero);
    return new Euclidean3d(Rot3d.fromAxisAngle(a, rad!), V3d.zero);
  }
  static rotationInDegrees(axis: V3d, deg: number): Euclidean3d {
    return Euclidean3d.rotation(axis, deg * DEG_TO_RAD);
  }
  static rotationX(rad: number): Euclidean3d { return new Euclidean3d(Rot3d.rotationX(rad), V3d.zero); }
  static rotationXInDegrees(deg: number): Euclidean3d { return Euclidean3d.rotationX(deg * DEG_TO_RAD); }
  static rotationY(rad: number): Euclidean3d { return new Euclidean3d(Rot3d.rotationY(rad), V3d.zero); }
  static rotationYInDegrees(deg: number): Euclidean3d { return Euclidean3d.rotationY(deg * DEG_TO_RAD); }
  static rotationZ(rad: number): Euclidean3d { return new Euclidean3d(Rot3d.rotationZ(rad), V3d.zero); }
  static rotationZInDegrees(deg: number): Euclidean3d { return Euclidean3d.rotationZ(deg * DEG_TO_RAD); }

  static rotationEuler(roll: number, pitch: number, yaw: number): Euclidean3d;
  static rotationEuler(rollPitchYaw: V3d): Euclidean3d;
  static rotationEuler(a: number | V3d, pitch?: number, yaw?: number): Euclidean3d {
    let r: number, p: number, y: number;
    if (typeof a === "number") { r = a; p = pitch!; y = yaw!; }
    else { r = a.x; p = a.y; y = a.z; }
    return Euclidean3d.rotationZ(y).mul(Euclidean3d.rotationY(p)).mul(Euclidean3d.rotationX(r));
  }
  static rotationEulerInDegrees(roll: number, pitch: number, yaw: number): Euclidean3d;
  static rotationEulerInDegrees(rollPitchYaw: V3d): Euclidean3d;
  static rotationEulerInDegrees(a: number | V3d, pitch?: number, yaw?: number): Euclidean3d {
    if (typeof a === "number") {
      return Euclidean3d.rotationEuler(a * DEG_TO_RAD, pitch! * DEG_TO_RAD, yaw! * DEG_TO_RAD);
    }
    return Euclidean3d.rotationEuler(a.mul(DEG_TO_RAD));
  }
  static rotateInto(from: V3d, into: V3d): Euclidean3d {
    return new Euclidean3d(Rot3d.fromTwoVectors(from, into), V3d.zero);
  }

  get rot(): Rot3d { return this._rot; }
  get trans(): V3d { return this._trans; }

  // ---------- transformations ----------

  transform(p: V3d): V3d { return this._rot.transform(p).add(this._trans); }
  transformPos(p: V3d): V3d { return this.transform(p); }
  transformDir(d: V3d): V3d { return this._rot.transform(d); }

  // ---------- algebra ----------

  mul(other: Euclidean3d): Euclidean3d {
    return new Euclidean3d(
      this._rot.mul(other._rot),
      this._rot.transform(other._trans).add(this._trans),
    );
  }

  /** `a.then(b) === b.mul(a)`: do `this` first, then `other`. */
  then(other: Euclidean3d): Euclidean3d { return other.mul(this); }

  inverse(): Euclidean3d {
    const ri = this._rot.inverse();
    return new Euclidean3d(ri, ri.transform(this._trans).neg());
  }

  // ---------- conversions ----------

  toMatrix(): M44d {
    const m = this._rot.toMatrixHomogeneous();
    m._data[3]  = this._trans.x;
    m._data[7]  = this._trans.y;
    m._data[11] = this._trans.z;
    return m;
  }

  toTrafo3d(): Trafo3d {
    return Trafo3d.fromMatrices(this.toMatrix(), this.inverse().toMatrix());
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Euclidean3d)) return false;
    return this._rot.equals(other._rot) && this._trans.equals(other._trans);
  }

  approxEqual(other: Euclidean3d, eps: number): boolean {
    return this._rot.approxEqual(other._rot, eps)
        && this._trans.approxEqual(other._trans, eps);
  }

  getHashCode(): number {
    return combineHash(this._rot.getHashCode(), this._trans.getHashCode());
  }

  toString(): string {
    return `Euclidean3d(${this._rot.toString()}, ${this._trans.toString()})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield* this._rot;
    yield* this._trans;
  }

  // ---------- operator overloads (boperators) ----------

  static "*"(a: Euclidean3d, b: Euclidean3d): Euclidean3d;
  static "*"(a: Euclidean3d, b: M44d): M44d;
  static "*"(a: Euclidean3d, v: V4d): V4d;
  static "*"(a: Euclidean3d, b: Rot3d): Euclidean3d;
  static "*"(a: Rot3d, b: Euclidean3d): Euclidean3d;
  static "*"(a: Euclidean3d, b: Shift3d): Euclidean3d;
  static "*"(a: Shift3d, b: Euclidean3d): Euclidean3d;
  static "*"(
    a: Euclidean3d | Rot3d | Shift3d,
    b: Euclidean3d | M44d | V4d | Rot3d | Shift3d,
  ): Euclidean3d | M44d | V4d {
    if (a instanceof Euclidean3d) {
      if (b instanceof Euclidean3d) return a.mul(b);
      if (b instanceof M44d) return a.toMatrix().mul(b);
      if (b instanceof V4d) return a.toMatrix().mul(b);
      if (b instanceof Rot3d) return new Euclidean3d(a.rot.mul(b), a.trans);
      if (b instanceof Shift3d) return new Euclidean3d(a.rot, a.rot.transform(b.offset).add(a.trans));
    }
    const e = b as Euclidean3d;
    if (a instanceof Rot3d) return new Euclidean3d(a.mul(e.rot), a.transform(e.trans));
    if (a instanceof Shift3d) return new Euclidean3d(e.rot, e.trans.add(a.offset));
    throw new Error("Euclidean3d.*: unreachable");
  }
}
