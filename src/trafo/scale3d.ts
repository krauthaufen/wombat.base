// Scale3d — non-uniform scaling about the origin (V3d factors).

import { V3d } from "../vector/v3d.js";
import { M33d } from "../matrix/m33d.js";
import { M44d } from "../matrix/m44d.js";
import { Rot3d } from "../rotation/rot3d.js";
import { Shift3d } from "./shift3d.js";
import { Euclidean3d } from "./euclidean3d.js";
import { Similarity3d } from "./similarity3d.js";
import { Affine3d } from "./affine3d.js";
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

  /** Per-axis factors. Use `scaling(s)` for uniform. */
  static scaling(v: V3d): Scale3d;
  static scaling(sx: number, sy: number, sz: number): Scale3d;
  static scaling(s: number): Scale3d;
  static scaling(a: V3d | number, b?: number, c?: number): Scale3d {
    if (typeof a === "number") {
      if (b === undefined) return new Scale3d(new V3d(a, a, a));
      return new Scale3d(new V3d(a, b, c!));
    }
    return new Scale3d(a);
  }

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

  // ---------- operator overloads (boperators) ----------

  static "*"(a: Scale3d, b: Scale3d): Scale3d;
  static "*"(a: Scale3d, v: V3d): V3d;
  static "*"(a: Scale3d, m: M44d): M44d;
  static "*"(a: Scale3d, b: Rot3d): Affine3d;
  static "*"(a: Rot3d, b: Scale3d): Affine3d;
  static "*"(a: Scale3d, b: Shift3d): Affine3d;
  static "*"(a: Shift3d, b: Scale3d): Affine3d;
  static "*"(a: Scale3d, b: Euclidean3d): Affine3d;
  static "*"(a: Euclidean3d, b: Scale3d): Affine3d;
  static "*"(a: Scale3d, b: Similarity3d): Affine3d;
  static "*"(a: Similarity3d, b: Scale3d): Affine3d;
  static "*"(
    a: Scale3d | Rot3d | Shift3d | Euclidean3d | Similarity3d,
    b: Scale3d | V3d | M44d | Rot3d | Shift3d | Euclidean3d | Similarity3d,
  ): Scale3d | V3d | M44d | Affine3d {
    if (a instanceof Scale3d) {
      if (b instanceof Scale3d) return a.mul(b);
      if (b instanceof V3d) return a.transform(b);
      if (b instanceof M44d) return a.toMatrix().mul(b);
      if (b instanceof Rot3d) {
        return new Affine3d(M33d.diagonal(a.scale).mul(b.toMatrix()), V3d.zero);
      }
      if (b instanceof Shift3d) {
        // (Scale * Shift).transform(v) = scale*(v + shift) = scale*v + scale*shift.
        return new Affine3d(M33d.diagonal(a.scale), b.offset.mul(a.scale));
      }
      if (b instanceof Euclidean3d) {
        return new Affine3d(M33d.diagonal(a.scale).mul(b.rot.toMatrix()), b.trans.mul(a.scale));
      }
      if (b instanceof Similarity3d) {
        const m = b.rot.toMatrix().mul(b.scale);
        return new Affine3d(M33d.diagonal(a.scale).mul(m), b.trans.mul(a.scale));
      }
    }
    const sb = b as Scale3d;
    if (a instanceof Rot3d) {
      return new Affine3d(a.toMatrix().mul(M33d.diagonal(sb.scale)), V3d.zero);
    }
    if (a instanceof Shift3d) {
      // (Shift * Scale).transform(v) = scale*v + shift.
      return new Affine3d(M33d.diagonal(sb.scale), a.offset);
    }
    if (a instanceof Euclidean3d) {
      return new Affine3d(a.rot.toMatrix().mul(M33d.diagonal(sb.scale)), a.trans);
    }
    if (a instanceof Similarity3d) {
      const m = a.rot.toMatrix().mul(a.scale);
      return new Affine3d(m.mul(M33d.diagonal(sb.scale)), a.trans);
    }
    throw new Error("Scale3d.*: unreachable");
  }
}
