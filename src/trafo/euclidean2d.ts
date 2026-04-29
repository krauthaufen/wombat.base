// Euclidean2d — 2D rigid-body transformation: Rot2d + V2d translation.
// Action: `transform(p) = rot * p + trans`.

import { V2d } from "../vector/v2d.js";
import { Rot2d } from "../rotation/rot2d.js";
import { M33d } from "../matrix/m33d.js";
import { combineHash } from "../internal/hash.js";
import { Trafo2d } from "./trafo2d.js";

export class Euclidean2d {
  static readonly __aardworxMathBrand: "Euclidean2d" = "Euclidean2d";

  /** @internal */
  readonly _rot: Rot2d;
  /** @internal */
  readonly _trans: V2d;

  constructor(rot: Rot2d = Rot2d.identity, trans: V2d = V2d.zero) {
    this._rot = new Rot2d(rot.radians);
    this._trans = V2d.copy(trans);
  }

  static readonly identity: Euclidean2d = new Euclidean2d(Rot2d.identity, V2d.zero);

  static fromRotation(r: Rot2d): Euclidean2d { return new Euclidean2d(r, V2d.zero); }
  static fromTranslation(t: V2d): Euclidean2d { return new Euclidean2d(Rot2d.identity, t); }
  static fromRotationAndTranslation(r: Rot2d, t: V2d): Euclidean2d {
    return new Euclidean2d(r, t);
  }

  get rot(): Rot2d { return this._rot; }
  get trans(): V2d { return this._trans; }

  transform(p: V2d): V2d { return this._rot.transform(p).add(this._trans); }
  transformPos(p: V2d): V2d { return this.transform(p); }
  transformDir(d: V2d): V2d { return this._rot.transform(d); }

  mul(other: Euclidean2d): Euclidean2d {
    return new Euclidean2d(
      this._rot.mul(other._rot),
      this._rot.transform(other._trans).add(this._trans),
    );
  }

  then(other: Euclidean2d): Euclidean2d { return other.mul(this); }

  inverse(): Euclidean2d {
    const ri = this._rot.inverse();
    return new Euclidean2d(ri, ri.transform(this._trans).neg());
  }

  toMatrix(): M33d {
    const a = this._rot.radians;
    const c = Math.cos(a), s = Math.sin(a);
    const m = new M33d();
    const d = m._data;
    d[0] = c;  d[1] = -s; d[2] = this._trans.x;
    d[3] = s;  d[4] =  c; d[5] = this._trans.y;
    d[6] = 0;  d[7] =  0; d[8] = 1;
    return m;
  }

  toTrafo2d(): Trafo2d {
    return Trafo2d.fromMatrices(this.toMatrix(), this.inverse().toMatrix());
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Euclidean2d)) return false;
    return this._rot.equals(other._rot) && this._trans.equals(other._trans);
  }

  approxEqual(other: Euclidean2d, eps: number): boolean {
    return this._rot.approxEqual(other._rot, eps)
        && this._trans.approxEqual(other._trans, eps);
  }

  getHashCode(): number {
    return combineHash(this._rot.getHashCode(), this._trans.getHashCode());
  }

  toString(): string {
    return `Euclidean2d(${this._rot.toString()}, ${this._trans.toString()})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield* this._rot;
    yield* this._trans;
  }
}
