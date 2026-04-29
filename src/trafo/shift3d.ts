// Shift3d — translation-only 3D transformation (V3d offset).
//
// Composition convention: `a.mul(b)` applies `b` first then `a`, i.e.
// `a.mul(b).transform(v) === a.transform(b.transform(v))`. For pure
// translation that just amounts to vector addition, but the convention
// is preserved for uniformity with the rest of the trafo family.

import { V3d } from "../vector/v3d.js";
import { M44d } from "../matrix/m44d.js";
import { Rot3d } from "../rotation/rot3d.js";
import { Euclidean3d } from "./euclidean3d.js";
import { Trafo3d } from "./trafo3d.js";

export class Shift3d {
  static readonly __aardworxMathBrand: "Shift3d" = "Shift3d";

  /** @internal */
  readonly _offset: V3d;

  constructor(offset: V3d = V3d.zero) {
    this._offset = V3d.copy(offset);
  }

  static readonly identity: Shift3d = new Shift3d(V3d.zero);

  static translation(v: V3d): Shift3d;
  static translation(tx: number, ty: number, tz: number): Shift3d;
  static translation(a: V3d | number, b?: number, c?: number): Shift3d {
    if (typeof a === "number") return new Shift3d(new V3d(a, b!, c!));
    return new Shift3d(a);
  }

  get offset(): V3d { return this._offset; }

  // ---------- transformations ----------

  transform(p: V3d): V3d { return p.add(this._offset); }
  transformPos(p: V3d): V3d { return this.transform(p); }
  transformDir(d: V3d): V3d { return V3d.copy(d); }

  // ---------- algebra ----------

  mul(other: Shift3d): Shift3d {
    return new Shift3d(this._offset.add(other._offset));
  }

  inverse(): Shift3d {
    return new Shift3d(this._offset.neg());
  }

  // ---------- conversions ----------

  toMatrix(): M44d { return M44d.translation(this._offset); }
  toTrafo3d(): Trafo3d {
    return Trafo3d.fromMatrices(
      M44d.translation(this._offset),
      M44d.translation(this._offset.neg()),
    );
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Shift3d)) return false;
    return this._offset.equals(other._offset);
  }

  approxEqual(other: Shift3d, eps: number): boolean {
    return this._offset.approxEqual(other._offset, eps);
  }

  getHashCode(): number { return this._offset.getHashCode(); }

  toString(): string { return `Shift3d(${this._offset.toString()})`; }

  *[Symbol.iterator](): Iterator<number> {
    yield* this._offset;
  }

  // ---------- operator overloads (boperators) ----------

  static "*"(a: Shift3d, b: Shift3d): Shift3d;
  static "*"(a: Shift3d, v: V3d): V3d;
  static "*"(a: Shift3d, m: M44d): M44d;
  static "*"(a: Shift3d, b: Rot3d): Euclidean3d;
  static "*"(a: Rot3d, b: Shift3d): Euclidean3d;
  static "*"(
    a: Shift3d | Rot3d,
    b: Shift3d | V3d | M44d | Rot3d,
  ): Shift3d | V3d | M44d | Euclidean3d {
    if (a instanceof Shift3d) {
      if (b instanceof Shift3d) return a.mul(b);
      if (b instanceof V3d) return a.transform(b);
      if (b instanceof M44d) return a.toMatrix().mul(b);
      // Shift * Rot: (Shift * Rot).transform(v) = Rot*v + a.offset.
      if (b instanceof Rot3d) return new Euclidean3d(b, a.offset);
    }
    // Rot * Shift: (Rot * Shift).transform(v) = Rot*(v + s.offset) = Rot*v + Rot*s.offset.
    const sb = b as Shift3d;
    return new Euclidean3d(a as Rot3d, (a as Rot3d).transform(sb.offset));
  }
}
