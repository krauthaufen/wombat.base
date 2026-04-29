// Scale3d — non-uniform scaling about the origin (V3d factors).

import { V3d } from "../vector/v3d.js";
import { M44d } from "../matrix/m44d.js";
import { Trafo3d } from "./trafo3d.js";

export class Scale3d {
  static readonly __aardworxMathBrand: "Scale3d" = "Scale3d";

  /** @internal */
  readonly _scale: V3d;

  constructor(scale: V3d = V3d.one) {
    this._scale = V3d.copy(scale);
  }

  static readonly identity: Scale3d = new Scale3d(V3d.one);

  static uniform(s: number): Scale3d { return new Scale3d(new V3d(s, s, s)); }
  static from(v: V3d): Scale3d { return new Scale3d(v); }

  get scale(): V3d { return this._scale; }

  // ---------- transformations ----------

  transform(p: V3d): V3d { return p.mul(this._scale); }
  transformPos(p: V3d): V3d { return this.transform(p); }
  transformDir(d: V3d): V3d { return d.mul(this._scale); }

  // ---------- algebra ----------

  mul(other: Scale3d): Scale3d {
    return new Scale3d(this._scale.mul(other._scale));
  }

  inverse(): Scale3d {
    return new Scale3d(new V3d(
      1 / this._scale.x,
      1 / this._scale.y,
      1 / this._scale.z,
    ));
  }

  // ---------- conversions ----------

  toMatrix(): M44d { return M44d.scaling(this._scale); }
  toTrafo3d(): Trafo3d {
    const inv = new V3d(1 / this._scale.x, 1 / this._scale.y, 1 / this._scale.z);
    return Trafo3d.fromMatrices(M44d.scaling(this._scale), M44d.scaling(inv));
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Scale3d)) return false;
    return this._scale.equals(other._scale);
  }

  approxEqual(other: Scale3d, eps: number): boolean {
    return this._scale.approxEqual(other._scale, eps);
  }

  getHashCode(): number { return this._scale.getHashCode(); }

  toString(): string { return `Scale3d(${this._scale.toString()})`; }

  *[Symbol.iterator](): Iterator<number> {
    yield* this._scale;
  }
}
