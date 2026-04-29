// Euclidean3d — rigid-body transformation: rotation followed by
// translation. Stored as a Rot3d (unit quaternion) plus a V3d offset.
//
// Action on a point: `transform(p) = rot * p + trans`.
// Composition: `a.mul(b).transform(v) = a.transform(b.transform(v))`,
// which yields `rot = a.rot * b.rot` and `trans = a.rot * b.trans + a.trans`.

import { V3d } from "../vector/v3d.js";
import { Rot3d } from "../rotation/rot3d.js";
import { M44d } from "../matrix/m44d.js";
import { combineHash } from "../internal/hash.js";
import { Trafo3d } from "./trafo3d.js";

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
}
