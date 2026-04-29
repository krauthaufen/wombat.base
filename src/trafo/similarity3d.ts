// Similarity3d — Euclidean3d composed with a uniform scalar scale.
//
// Action on a point: `transform(p) = euclidean.rot * (scale * p) + euclidean.trans`.
// I.e. scale-then-rotate-then-translate. This matches the convention
// where `Trafo3d.scaling(s) * euclidean.toMatrix()` is the homogeneous
// form, though we store the components rather than the matrix.

import { V3d } from "../vector/v3d.js";
import { Rot3d } from "../rotation/rot3d.js";
import { M44d } from "../matrix/m44d.js";
import { combineHash, hashNumber } from "../internal/hash.js";
import { Euclidean3d } from "./euclidean3d.js";
import { Trafo3d } from "./trafo3d.js";

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

  static readonly identity: Similarity3d = new Similarity3d(Euclidean3d.identity, 1);

  static fromEuclideanAndScale(e: Euclidean3d, s: number): Similarity3d {
    return new Similarity3d(e, s);
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
}
