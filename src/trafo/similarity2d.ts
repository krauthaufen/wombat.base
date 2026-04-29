// Similarity2d — Euclidean2d composed with a uniform scalar scale.
// Action: scale-then-rotate-then-translate.

import { V2d } from "../vector/v2d.js";
import { Rot2d } from "../rotation/rot2d.js";
import { M33d } from "../matrix/m33d.js";
import { Shift2d } from "./shift2d.js";
import { combineHash, hashNumber } from "../internal/hash.js";
import { Euclidean2d } from "./euclidean2d.js";
import { Trafo2d } from "./trafo2d.js";

const DEG_TO_RAD = Math.PI / 180;

export class Similarity2d {
  static readonly __aardworxMathBrand: "Similarity2d" = "Similarity2d";

  /** @internal */
  readonly _euclidean: Euclidean2d;
  /** @internal */
  readonly _scale: number;

  constructor(euclidean: Euclidean2d = Euclidean2d.identity, scale: number = 1) {
    this._euclidean = euclidean;
    this._scale = scale;
  }

  static readonly identity: Similarity2d = new Similarity2d(Euclidean2d.identity, 1);

  static fromEuclideanAndScale(e: Euclidean2d, s: number): Similarity2d {
    return new Similarity2d(e, s);
  }

  static translation(v: V2d): Similarity2d;
  static translation(tx: number, ty: number): Similarity2d;
  static translation(shift: Shift2d): Similarity2d;
  static translation(a: V2d | number | Shift2d, b?: number): Similarity2d {
    let v: V2d;
    if (typeof a === "number") v = new V2d(a, b!);
    else if (a instanceof Shift2d) v = a.offset;
    else v = a;
    return new Similarity2d(Euclidean2d.fromTranslation(v), 1);
  }
  static rotation(rad: number): Similarity2d;
  static rotation(r: Rot2d): Similarity2d;
  static rotation(arg: number | Rot2d): Similarity2d {
    const r = typeof arg === "number" ? Rot2d.fromRadians(arg) : arg;
    return new Similarity2d(Euclidean2d.fromRotation(r), 1);
  }
  static rotationInDegrees(deg: number): Similarity2d {
    return Similarity2d.rotation(deg * DEG_TO_RAD);
  }
  /** Uniform scaling. */
  static scaling(s: number): Similarity2d {
    return new Similarity2d(Euclidean2d.identity, s);
  }

  get euclidean(): Euclidean2d { return this._euclidean; }
  get scale(): number { return this._scale; }
  get rot(): Rot2d { return this._euclidean.rot; }
  get trans(): V2d { return this._euclidean.trans; }

  transform(p: V2d): V2d {
    return this._euclidean.rot.transform(p.mul(this._scale)).add(this._euclidean.trans);
  }
  transformPos(p: V2d): V2d { return this.transform(p); }
  transformDir(d: V2d): V2d {
    return this._euclidean.rot.transform(d.mul(this._scale));
  }

  mul(other: Similarity2d): Similarity2d {
    const a = this, b = other;
    const newRot = a._euclidean.rot.mul(b._euclidean.rot);
    const newTrans = a._euclidean.rot.transform(b._euclidean.trans).mul(a._scale).add(a._euclidean.trans);
    return new Similarity2d(
      Euclidean2d.fromRotationAndTranslation(newRot, newTrans),
      a._scale * b._scale,
    );
  }

  then(other: Similarity2d): Similarity2d { return other.mul(this); }

  inverse(): Similarity2d {
    const invScale = 1 / this._scale;
    const invRot = this._euclidean.rot.inverse();
    const invTrans = invRot.transform(this._euclidean.trans).mul(-invScale);
    return new Similarity2d(
      Euclidean2d.fromRotationAndTranslation(invRot, invTrans),
      invScale,
    );
  }

  toMatrix(): M33d {
    const a = this._euclidean.rot.radians;
    const c = Math.cos(a), s = Math.sin(a);
    const sc = this._scale;
    const m = new M33d();
    const d = m._data;
    d[0] = c * sc; d[1] = -s * sc; d[2] = this._euclidean.trans.x;
    d[3] = s * sc; d[4] =  c * sc; d[5] = this._euclidean.trans.y;
    d[6] = 0;      d[7] =  0;      d[8] = 1;
    return m;
  }

  toTrafo2d(): Trafo2d {
    return Trafo2d.fromMatrices(this.toMatrix(), this.inverse().toMatrix());
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Similarity2d)) return false;
    return this._euclidean.equals(other._euclidean) && this._scale === other._scale;
  }

  approxEqual(other: Similarity2d, eps: number): boolean {
    return this._euclidean.approxEqual(other._euclidean, eps)
        && Math.abs(this._scale - other._scale) <= eps;
  }

  getHashCode(): number {
    return combineHash(this._euclidean.getHashCode(), hashNumber(this._scale));
  }

  toString(): string {
    return `Similarity2d(${this._euclidean.toString()}, ${this._scale})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield* this._euclidean;
    yield this._scale;
  }

  // ---------- operator overloads (boperators) ----------

  static "*"(a: Similarity2d, b: Similarity2d): Similarity2d { return a.mul(b); }
}
