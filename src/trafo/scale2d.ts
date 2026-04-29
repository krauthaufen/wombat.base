// Scale2d — non-uniform 2D scale about the origin.

import { V2d } from "../vector/v2d.js";
import { M33d } from "../matrix/m33d.js";
import { Trafo2d } from "./trafo2d.js";

export class Scale2d {
  static readonly __aardworxMathBrand: "Scale2d" = "Scale2d";

  /** @internal */
  readonly _scale: V2d;

  constructor(scale: V2d = V2d.one) {
    this._scale = V2d.copy(scale);
  }

  static readonly identity: Scale2d = new Scale2d(V2d.one);

  static uniform(s: number): Scale2d { return new Scale2d(new V2d(s, s)); }
  static from(v: V2d): Scale2d { return new Scale2d(v); }

  static scaling(v: V2d): Scale2d;
  static scaling(sx: number, sy: number): Scale2d;
  static scaling(s: number): Scale2d;
  static scaling(a: V2d | number, b?: number): Scale2d {
    if (typeof a === "number") {
      if (b === undefined) return new Scale2d(new V2d(a, a));
      return new Scale2d(new V2d(a, b));
    }
    return new Scale2d(a);
  }

  get scale(): V2d { return this._scale; }

  transform(p: V2d): V2d { return p.mul(this._scale); }
  transformPos(p: V2d): V2d { return this.transform(p); }
  transformDir(d: V2d): V2d { return d.mul(this._scale); }

  mul(other: Scale2d): Scale2d {
    return new Scale2d(this._scale.mul(other._scale));
  }

  inverse(): Scale2d {
    return new Scale2d(new V2d(1 / this._scale.x, 1 / this._scale.y));
  }

  toMatrix(): M33d {
    const m = new M33d();
    m._data[0] = this._scale.x;
    m._data[4] = this._scale.y;
    m._data[8] = 1;
    return m;
  }

  toTrafo2d(): Trafo2d {
    const inv = new M33d();
    inv._data[0] = 1 / this._scale.x;
    inv._data[4] = 1 / this._scale.y;
    inv._data[8] = 1;
    return Trafo2d.fromMatrices(this.toMatrix(), inv);
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Scale2d)) return false;
    return this._scale.equals(other._scale);
  }

  approxEqual(other: Scale2d, eps: number): boolean {
    return this._scale.approxEqual(other._scale, eps);
  }

  getHashCode(): number { return this._scale.getHashCode(); }
  toString(): string { return `Scale2d(${this._scale.toString()})`; }

  *[Symbol.iterator](): Iterator<number> { yield* this._scale; }

  // ---------- operator overloads (boperators) ----------

  static "*"(a: Scale2d, b: Scale2d): Scale2d { return a.mul(b); }
}
