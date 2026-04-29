// Affine3d — general affine 3D transformation: linear M33d plus
// translation V3d. Action on a point: `transform(p) = linear * p + trans`.

import { V3d } from "../vector/v3d.js";
import { M33d } from "../matrix/m33d.js";
import { M44d } from "../matrix/m44d.js";
import { combineHash } from "../internal/hash.js";
import { Trafo3d } from "./trafo3d.js";

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
}
