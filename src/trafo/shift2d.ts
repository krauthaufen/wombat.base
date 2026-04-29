// Shift2d — translation-only 2D transformation.

import { V2d } from "../vector/v2d.js";
import { M33d } from "../matrix/m33d.js";
import { Trafo2d } from "./trafo2d.js";

export class Shift2d {
  static readonly __aardworxMathBrand: "Shift2d" = "Shift2d";

  /** @internal */
  readonly _offset: V2d;

  constructor(offset: V2d = V2d.zero) {
    this._offset = V2d.copy(offset);
  }

  static readonly identity: Shift2d = new Shift2d(V2d.zero);

  static translation(v: V2d): Shift2d { return new Shift2d(v); }

  get offset(): V2d { return this._offset; }

  transform(p: V2d): V2d { return p.add(this._offset); }
  transformPos(p: V2d): V2d { return this.transform(p); }
  transformDir(d: V2d): V2d { return V2d.copy(d); }

  mul(other: Shift2d): Shift2d {
    return new Shift2d(this._offset.add(other._offset));
  }

  inverse(): Shift2d { return new Shift2d(this._offset.neg()); }

  toMatrix(): M33d {
    const m = M33d.copy(M33d.identity);
    m._data[2] = this._offset.x;
    m._data[5] = this._offset.y;
    return m;
  }

  toTrafo2d(): Trafo2d {
    const inv = M33d.copy(M33d.identity);
    inv._data[2] = -this._offset.x;
    inv._data[5] = -this._offset.y;
    return Trafo2d.fromMatrices(this.toMatrix(), inv);
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Shift2d)) return false;
    return this._offset.equals(other._offset);
  }

  approxEqual(other: Shift2d, eps: number): boolean {
    return this._offset.approxEqual(other._offset, eps);
  }

  getHashCode(): number { return this._offset.getHashCode(); }
  toString(): string { return `Shift2d(${this._offset.toString()})`; }

  *[Symbol.iterator](): Iterator<number> { yield* this._offset; }
}
