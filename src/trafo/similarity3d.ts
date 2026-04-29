// Similarity3d — Euclidean3d composed with a uniform scalar scale.
//
// Action on a point: `transform(p) = euclidean.rot * (scale * p) + euclidean.trans`.
// I.e. scale-then-rotate-then-translate. This matches the convention
// where `Trafo3d.scaling(s) * euclidean.toMatrix()` is the homogeneous
// form, though we store the components rather than the matrix.

import { V3d } from "../vector/v3d.js";
import { V4d } from "../vector/v4d.js";
import { Rot3d } from "../rotation/rot3d.js";
import { M44d } from "../matrix/m44d.js";
import { Shift3d } from "./shift3d.js";
import { combineHash, hashNumber } from "../internal/hash.js";
import { Euclidean3d } from "./euclidean3d.js";
import { Trafo3d } from "./trafo3d.js";

const DEG_TO_RAD = Math.PI / 180;

export class Similarity3d {
  static readonly __aardworxMathBrand: "Similarity3d" = "Similarity3d";

  /** @internal */
  readonly _euclidean: Euclidean3d;
  /** @internal */
  readonly _scale: number;

  constructor(euclidean: Euclidean3d = Euclidean3d.identity, scale: number = 1) {
    this._euclidean = euclidean;
    this._scale = scale;
  }

  // Lazy initialiser — resolved on first access so the field doesn't trigger
  // a cycle if Euclidean3d is still mid-load when this module evaluates.
  private static _identity: Similarity3d | undefined;
  static get identity(): Similarity3d {
    return Similarity3d._identity ??= new Similarity3d(Euclidean3d.identity, 1);
  }

  static fromEuclideanAndScale(e: Euclidean3d, s: number): Similarity3d {
    return new Similarity3d(e, s);
  }

  static translation(v: V3d): Similarity3d;
  static translation(tx: number, ty: number, tz: number): Similarity3d;
  static translation(shift: Shift3d): Similarity3d;
  static translation(a: V3d | number | Shift3d, b?: number, c?: number): Similarity3d {
    let v: V3d;
    if (typeof a === "number") v = new V3d(a, b!, c!);
    else if (a instanceof Shift3d) v = a.offset;
    else v = a;
    return new Similarity3d(Euclidean3d.fromTranslation(v), 1);
  }

  static rotation(axis: V3d, rad: number): Similarity3d;
  static rotation(rot: Rot3d): Similarity3d;
  static rotation(a: V3d | Rot3d, rad?: number): Similarity3d {
    if (a instanceof Rot3d) return new Similarity3d(Euclidean3d.fromRotation(a), 1);
    return new Similarity3d(Euclidean3d.fromRotation(Rot3d.fromAxisAngle(a, rad!)), 1);
  }
  static rotationInDegrees(axis: V3d, deg: number): Similarity3d {
    return Similarity3d.rotation(axis, deg * DEG_TO_RAD);
  }
  static rotationX(rad: number): Similarity3d {
    return new Similarity3d(Euclidean3d.rotationX(rad), 1);
  }
  static rotationXInDegrees(deg: number): Similarity3d { return Similarity3d.rotationX(deg * DEG_TO_RAD); }
  static rotationY(rad: number): Similarity3d {
    return new Similarity3d(Euclidean3d.rotationY(rad), 1);
  }
  static rotationYInDegrees(deg: number): Similarity3d { return Similarity3d.rotationY(deg * DEG_TO_RAD); }
  static rotationZ(rad: number): Similarity3d {
    return new Similarity3d(Euclidean3d.rotationZ(rad), 1);
  }
  static rotationZInDegrees(deg: number): Similarity3d { return Similarity3d.rotationZ(deg * DEG_TO_RAD); }
  static rotateInto(from: V3d, into: V3d): Similarity3d {
    return Similarity3d.rotation(Rot3d.fromTwoVectors(from, into));
  }
  /** Uniform scaling. (Similarity is uniform-scale by definition.) */
  static scaling(s: number): Similarity3d {
    return new Similarity3d(Euclidean3d.identity, s);
  }

  get euclidean(): Euclidean3d { return this._euclidean; }
  get scale(): number { return this._scale; }
  get rot(): Rot3d { return this._euclidean.rot; }
  get trans(): V3d { return this._euclidean.trans; }

  // ---------- transformations ----------

  transform(p: V3d): V3d {
    return this._euclidean.rot.transform(p.mul(this._scale)).add(this._euclidean.trans);
  }
  transformPos(p: V3d): V3d { return this.transform(p); }
  transformDir(d: V3d): V3d {
    return this._euclidean.rot.transform(d.mul(this._scale));
  }

  // ---------- algebra ----------

  /**
   * Composition `a.mul(b)`: do `b` first, then `a`.
   * Result components:
   *   rot   = a.rot * b.rot
   *   scale = a.scale * b.scale
   *   trans = a.scale * (a.rot * b.trans) + a.trans
   * (Note the `a.scale` factor on the translated `b.trans` because the
   * outer transform's scale is applied after `b` is fully evaluated.)
   */
  mul(other: Similarity3d): Similarity3d {
    const a = this, b = other;
    const newRot = a._euclidean.rot.mul(b._euclidean.rot);
    const newTrans = a._euclidean.rot.transform(b._euclidean.trans).mul(a._scale).add(a._euclidean.trans);
    return new Similarity3d(
      Euclidean3d.fromRotationAndTranslation(newRot, newTrans),
      a._scale * b._scale,
    );
  }

  then(other: Similarity3d): Similarity3d { return other.mul(this); }

  inverse(): Similarity3d {
    const invScale = 1 / this._scale;
    const invRot = this._euclidean.rot.inverse();
    const invTrans = invRot.transform(this._euclidean.trans).mul(-invScale);
    return new Similarity3d(
      Euclidean3d.fromRotationAndTranslation(invRot, invTrans),
      invScale,
    );
  }

  // ---------- conversions ----------

  toMatrix(): M44d {
    const m = this._euclidean.rot.toMatrixHomogeneous();
    const d = m._data;
    const s = this._scale;
    d[0] = d[0]! * s; d[1] = d[1]! * s; d[2]  = d[2]!  * s;
    d[4] = d[4]! * s; d[5] = d[5]! * s; d[6]  = d[6]!  * s;
    d[8] = d[8]! * s; d[9] = d[9]! * s; d[10] = d[10]! * s;
    d[3]  = this._euclidean.trans.x;
    d[7]  = this._euclidean.trans.y;
    d[11] = this._euclidean.trans.z;
    return m;
  }

  toTrafo3d(): Trafo3d {
    return Trafo3d.fromMatrices(this.toMatrix(), this.inverse().toMatrix());
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Similarity3d)) return false;
    return this._euclidean.equals(other._euclidean) && this._scale === other._scale;
  }

  approxEqual(other: Similarity3d, eps: number): boolean {
    return this._euclidean.approxEqual(other._euclidean, eps)
        && Math.abs(this._scale - other._scale) <= eps;
  }

  getHashCode(): number {
    return combineHash(this._euclidean.getHashCode(), hashNumber(this._scale));
  }

  toString(): string {
    return `Similarity3d(${this._euclidean.toString()}, ${this._scale})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield* this._euclidean;
    yield this._scale;
  }

  // ---------- operator overloads (boperators) ----------

  static "*"(a: Similarity3d, b: Similarity3d): Similarity3d;
  static "*"(a: Similarity3d, b: M44d): M44d;
  static "*"(a: Similarity3d, v: V4d): V4d;
  static "*"(a: Similarity3d, b: Rot3d): Similarity3d;
  static "*"(a: Rot3d, b: Similarity3d): Similarity3d;
  static "*"(a: Similarity3d, b: Shift3d): Similarity3d;
  static "*"(a: Shift3d, b: Similarity3d): Similarity3d;
  static "*"(a: Similarity3d, b: Euclidean3d): Similarity3d;
  static "*"(a: Euclidean3d, b: Similarity3d): Similarity3d;
  static "*"(
    a: Similarity3d | Rot3d | Shift3d | Euclidean3d,
    b: Similarity3d | M44d | V4d | Rot3d | Shift3d | Euclidean3d,
  ): Similarity3d | M44d | V4d {
    if (a instanceof Similarity3d) {
      if (b instanceof Similarity3d) return a.mul(b);
      if (b instanceof M44d) return a.toMatrix().mul(b);
      if (b instanceof V4d) return a.toMatrix().mul(b);
      if (b instanceof Rot3d) {
        return new Similarity3d(new Euclidean3d(a.rot.mul(b), a.trans), a.scale);
      }
      if (b instanceof Shift3d) {
        const scaledOffset = b.offset.mul(a.scale);
        const newEuc = new Euclidean3d(a.rot, a.rot.transform(scaledOffset).add(a.trans));
        return new Similarity3d(newEuc, a.scale);
      }
      if (b instanceof Euclidean3d) {
        return a.mul(new Similarity3d(b, 1));
      }
    }
    const s = b as Similarity3d;
    if (a instanceof Rot3d) {
      return new Similarity3d(new Euclidean3d(a.mul(s.rot), a.transform(s.trans)), s.scale);
    }
    if (a instanceof Shift3d) {
      return new Similarity3d(new Euclidean3d(s.rot, s.trans.add(a.offset)), s.scale);
    }
    if (a instanceof Euclidean3d) {
      return new Similarity3d(a, 1).mul(s);
    }
    throw new Error("Similarity3d.*: unreachable");
  }
}
