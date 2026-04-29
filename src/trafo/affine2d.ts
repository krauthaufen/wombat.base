// Affine2d — general 2D affine: M22d linear + V2d translation.

import { V2d } from "../vector/v2d.js";
import { M22d } from "../matrix/m22d.js";
import { M33d } from "../matrix/m33d.js";
import { combineHash } from "../internal/hash.js";
import { Trafo2d } from "./trafo2d.js";

export class Affine2d {
  static readonly __aardworxMathBrand: "Affine2d" = "Affine2d";

  /** @internal */
  readonly _linear: M22d;
  /** @internal */
  readonly _trans: V2d;

  constructor(linear: M22d = M22d.identity, trans: V2d = V2d.zero) {
    this._linear = M22d.copy(linear);
    this._trans = V2d.copy(trans);
  }

  static readonly identity: Affine2d = new Affine2d(M22d.identity, V2d.zero);

  static fromLinearAndTranslation(m: M22d, t: V2d): Affine2d {
    return new Affine2d(m, t);
  }

  get linear(): M22d { return this._linear; }
  get trans(): V2d { return this._trans; }

  transform(p: V2d): V2d { return this._linear.transform(p).add(this._trans); }
  transformPos(p: V2d): V2d { return this.transform(p); }
  transformDir(d: V2d): V2d { return this._linear.transform(d); }

  mul(other: Affine2d): Affine2d {
    return new Affine2d(
      this._linear.mul(other._linear),
      this._linear.transform(other._trans).add(this._trans),
    );
  }

  then(other: Affine2d): Affine2d { return other.mul(this); }

  inverse(): Affine2d {
    const li = this._linear.inverse();
    return new Affine2d(li, li.transform(this._trans).neg());
  }

  toMatrix(): M33d {
    const m = new M33d();
    const ld = this._linear._data, md = m._data;
    md[0] = ld[0]!; md[1] = ld[1]!; md[2] = this._trans.x;
    md[3] = ld[2]!; md[4] = ld[3]!; md[5] = this._trans.y;
    md[6] = 0;      md[7] = 0;      md[8] = 1;
    return m;
  }

  toTrafo2d(): Trafo2d {
    return Trafo2d.fromMatrices(this.toMatrix(), this.inverse().toMatrix());
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Affine2d)) return false;
    return this._linear.equals(other._linear) && this._trans.equals(other._trans);
  }

  approxEqual(other: Affine2d, eps: number): boolean {
    return this._linear.approxEqual(other._linear, eps)
        && this._trans.approxEqual(other._trans, eps);
  }

  getHashCode(): number {
    return combineHash(this._linear.getHashCode(), this._trans.getHashCode());
  }

  toString(): string {
    return `Affine2d(${this._linear.toString()}, ${this._trans.toString()})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield* this._linear;
    yield* this._trans;
  }
}
