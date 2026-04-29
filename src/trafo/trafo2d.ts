// Trafo2d — full 2D transformation, stored as a forward M33d (homogeneous)
// together with its inverse.
//
// Composition uses the Aardvark Trafo convention:
//   `a.mul(b).transform(v) === b.transform(a.transform(v))`
// — i.e. "do a first, then b" (the opposite of Euclidean2d/Affine2d/etc.).
// See `trafo3d.ts` for the rationale.

import { V2d } from "../vector/v2d.js";
import { V3d } from "../vector/v3d.js";
import { M33d } from "../matrix/m33d.js";
import { Rot2d } from "../rotation/rot2d.js";
import { Shift2d } from "./shift2d.js";
import { Scale2d } from "./scale2d.js";
import { combineHash } from "../internal/hash.js";

const DEG_TO_RAD = Math.PI / 180;

function transformPos2(m: M33d, p: V2d): V2d {
  const a = m._data;
  const x = p.x, y = p.y;
  const ox = a[0]! * x + a[1]! * y + a[2]!;
  const oy = a[3]! * x + a[4]! * y + a[5]!;
  const ow = a[6]! * x + a[7]! * y + a[8]!;
  const inv = ow !== 0 ? 1 / ow : 1;
  return new V2d(ox * inv, oy * inv);
}

function transformDir2(m: M33d, d: V2d): V2d {
  const a = m._data;
  const x = d.x, y = d.y;
  return new V2d(a[0]! * x + a[1]! * y, a[3]! * x + a[4]! * y);
}

export class Trafo2d {
  static readonly __aardworxMathBrand: "Trafo2d" = "Trafo2d";

  /** @internal */
  readonly _forward: M33d;
  /** @internal */
  readonly _backward: M33d;

  constructor() {
    this._forward = M33d.copy(M33d.identity);
    this._backward = M33d.copy(M33d.identity);
  }

  static readonly identity: Trafo2d = new Trafo2d();

  static fromMatrix(m: M33d): Trafo2d {
    return Trafo2d.fromMatrices(m, m.inverse());
  }

  static fromMatrices(forward: M33d, backward: M33d): Trafo2d {
    const t = Object.create(Trafo2d.prototype) as { _forward: M33d; _backward: M33d };
    t._forward = M33d.copy(forward);
    t._backward = M33d.copy(backward);
    return t as Trafo2d;
  }

  // ---------- translation ----------

  static translation(v: V2d): Trafo2d;
  static translation(tx: number, ty: number): Trafo2d;
  static translation(shift: Shift2d): Trafo2d;
  static translation(a: V2d | number | Shift2d, b?: number): Trafo2d {
    let v: V2d;
    if (typeof a === "number") v = new V2d(a, b!);
    else if (a instanceof Shift2d) v = a.offset;
    else v = a;
    return Trafo2d.fromMatrices(M33d.translation(v), M33d.translation(v.neg()));
  }

  // ---------- scaling ----------

  static scaling(v: V2d): Trafo2d;
  static scaling(sx: number, sy: number): Trafo2d;
  static scaling(s: number): Trafo2d;
  static scaling(scale: Scale2d): Trafo2d;
  static scaling(a: V2d | number | Scale2d, b?: number): Trafo2d {
    if (typeof a === "number") {
      if (b === undefined) {
        return Trafo2d.fromMatrices(M33d.scalingUniform(a), M33d.scalingUniform(1 / a));
      }
      return Trafo2d.fromMatrices(M33d.scaling(a, b), M33d.scaling(1 / a, 1 / b));
    }
    const v = a instanceof Scale2d ? a.scale : a;
    return Trafo2d.fromMatrices(
      M33d.scaling(v),
      M33d.scaling(new V2d(1 / v.x, 1 / v.y)),
    );
  }

  // ---------- rotation ----------

  static rotation(rad: number): Trafo2d;
  static rotation(r: Rot2d): Trafo2d;
  static rotation(a: number | Rot2d): Trafo2d {
    const rad = typeof a === "number" ? a : a.radians;
    return Trafo2d.fromMatrices(M33d.rotation(rad), M33d.rotation(-rad));
  }
  static rotationInDegrees(deg: number): Trafo2d {
    return Trafo2d.rotation(deg * DEG_TO_RAD);
  }

  // ---------- frame / basis ----------

  /** Trafo whose forward maps `(0,0) → origin` and the standard basis to `(xAxis, yAxis)`. */
  static fromBasis(xAxis: V2d, yAxis: V2d, origin: V2d): Trafo2d {
    const fwd = M33d.fromArray([
      xAxis.x, yAxis.x, origin.x,
      xAxis.y, yAxis.y, origin.y,
      0, 0, 1,
    ]);
    return Trafo2d.fromMatrix(fwd);
  }

  static fromOrthoNormalBasis(xAxis: V2d, yAxis: V2d): Trafo2d {
    const fwd = M33d.fromArray([
      xAxis.x, yAxis.x, 0,
      xAxis.y, yAxis.y, 0,
      0, 0, 1,
    ]);
    const bwd = M33d.fromArray([
      xAxis.x, xAxis.y, 0,
      yAxis.x, yAxis.y, 0,
      0, 0, 1,
    ]);
    return Trafo2d.fromMatrices(fwd, bwd);
  }

  /** Builds Scale * Rotation * Translation, in that order. */
  static fromComponents(scale: V2d, rotationRad: number, translation: V2d): Trafo2d {
    return Trafo2d.scaling(scale)
      .mul(Trafo2d.rotation(rotationRad))
      .mul(Trafo2d.translation(translation));
  }

  get forward(): M33d { return this._forward; }
  get backward(): M33d { return this._backward; }

  transform(p: V2d): V2d { return transformPos2(this._forward, p); }
  transformPos(p: V2d): V2d { return transformPos2(this._forward, p); }
  transformDir(d: V2d): V2d { return transformDir2(this._forward, d); }
  transformHom(v: V3d): V3d { return this._forward.transform(v); }

  inverseTransform(p: V2d): V2d { return transformPos2(this._backward, p); }
  inverseTransformPos(p: V2d): V2d { return transformPos2(this._backward, p); }
  inverseTransformDir(d: V2d): V2d { return transformDir2(this._backward, d); }

  /** Aardvark Trafo convention: `a.mul(b)` = "do a first, then b". */
  mul(other: Trafo2d): Trafo2d {
    return Trafo2d.fromMatrices(
      other._forward.mul(this._forward),
      this._backward.mul(other._backward),
    );
  }

  /** Alias for `mul` — both read "do this first, then other" for Trafo2d. */
  then(other: Trafo2d): Trafo2d { return this.mul(other); }

  inverse(): Trafo2d { return Trafo2d.fromMatrices(this._backward, this._forward); }

  toMatrix(): M33d { return this._forward; }
  toTrafo2d(): Trafo2d { return this; }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Trafo2d)) return false;
    return this._forward.equals(other._forward) && this._backward.equals(other._backward);
  }

  approxEqual(other: Trafo2d, eps: number): boolean {
    return this._forward.approxEqual(other._forward, eps)
        && this._backward.approxEqual(other._backward, eps);
  }

  getHashCode(): number {
    return combineHash(this._forward.getHashCode(), this._backward.getHashCode());
  }

  toString(): string {
    return `Trafo2d(forward=${this._forward.toString()}, backward=${this._backward.toString()})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield* this._forward;
    yield* this._backward;
  }

  // ---------- operator overloads (boperators) ----------

  static "*"(a: Trafo2d, b: Trafo2d): Trafo2d { return a.mul(b); }
}
