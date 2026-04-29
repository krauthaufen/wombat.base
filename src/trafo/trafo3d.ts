// Trafo3d — full 3D transformation, stored as a forward M44d together
// with its inverse (`backward`). This is the workhorse type used by
// cameras and scene graphs: keeping both matrices avoids recomputing
// the inverse on every `inverseTransform` call.
//
// COMPOSITION ORDER. Trafo3d sits on the boundary between the strict
// math types (M44d, Rot3d, Euclidean3d, …) and the "human-universe"
// transformations users actually compose to describe scenes. The
// math types use the standard mathematical convention — `a * b`
// applied to a vector means "do `b` first, then `a`", because that's
// what matrix multiplication says. Trafo3d intentionally inverts
// that and reads left-to-right:
//
//   `a.mul(b).transform(v) === b.transform(a.transform(v))`
//
// "do `a` first, then `b`". This matches Aardvark.Base.Trafo3d in F#
// — chains like `model * view * projection` apply model first, then
// view, then projection, in the order a human would speak them.
// Code ported from the F# stack stays correct without re-reading
// every multiplication.
//
// In matrix terms: `(a.mul(b)).forward = b.forward · a.forward` and
// `(a.mul(b)).backward = a.backward · b.backward`. The other types
// in this library keep the standard `a · b = do b then a` convention.

import { V3d } from "../vector/v3d.js";
import { V4d } from "../vector/v4d.js";
import { M44d } from "../matrix/m44d.js";
import { combineHash } from "../internal/hash.js";

export class Trafo3d {
  static readonly __aardworxMathBrand: "Trafo3d" = "Trafo3d";

  /** @internal */
  readonly _forward: M44d;
  /** @internal */
  readonly _backward: M44d;

  /** Constructs the identity Trafo3d (both matrices identity). */
  constructor() {
    this._forward = M44d.copy(M44d.identity);
    this._backward = M44d.copy(M44d.identity);
  }

  static readonly identity: Trafo3d = new Trafo3d();

  /** Computes the inverse via `m.inverse()`. */
  static fromMatrix(m: M44d): Trafo3d {
    return Trafo3d.fromMatrices(m, m.inverse());
  }

  /**
   * Trusts the caller that `forward` and `backward` are inverses of
   * each other. Used to skip the inverse computation when both
   * matrices are already known (e.g. the closed-form inverse of a
   * Euclidean3d is cheaper than a generic 4x4 inversion).
   */
  static fromMatrices(forward: M44d, backward: M44d): Trafo3d {
    const t = Object.create(Trafo3d.prototype) as { _forward: M44d; _backward: M44d };
    t._forward = M44d.copy(forward);
    t._backward = M44d.copy(backward);
    return t as Trafo3d;
  }

  get forward(): M44d { return this._forward; }
  get backward(): M44d { return this._backward; }

  // ---------- transformations ----------

  transform(p: V3d): V3d { return this._forward.transformPos(p); }
  transformPos(p: V3d): V3d { return this._forward.transformPos(p); }
  transformDir(d: V3d): V3d { return this._forward.transformDir(d); }
  transformHom(v: V4d): V4d { return this._forward.transform(v); }

  inverseTransform(p: V3d): V3d { return this._backward.transformPos(p); }
  inverseTransformPos(p: V3d): V3d { return this._backward.transformPos(p); }
  inverseTransformDir(d: V3d): V3d { return this._backward.transformDir(d); }

  // ---------- algebra ----------

  /**
   * Aardvark Trafo convention: `a.mul(b)` means "do `a` first, then
   * `b`". So `(a.mul(b)).transform(v) = b.transform(a.transform(v))`.
   * In matrix terms: forward = b.forward · a.forward; backward =
   * a.backward · b.backward.
   */
  mul(other: Trafo3d): Trafo3d {
    return Trafo3d.fromMatrices(
      other._forward.mul(this._forward),
      this._backward.mul(other._backward),
    );
  }

  /** Alias for `mul` — both read "do this first, then other" for Trafo3d. */
  then(other: Trafo3d): Trafo3d { return this.mul(other); }

  /** Constant-time: just swap forward and backward. */
  inverse(): Trafo3d {
    return Trafo3d.fromMatrices(this._backward, this._forward);
  }

  // ---------- conversions ----------

  toMatrix(): M44d { return this._forward; }
  toTrafo3d(): Trafo3d { return this; }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Trafo3d)) return false;
    return this._forward.equals(other._forward) && this._backward.equals(other._backward);
  }

  approxEqual(other: Trafo3d, eps: number): boolean {
    return this._forward.approxEqual(other._forward, eps)
        && this._backward.approxEqual(other._backward, eps);
  }

  getHashCode(): number {
    return combineHash(this._forward.getHashCode(), this._backward.getHashCode());
  }

  toString(): string {
    return `Trafo3d(forward=${this._forward.toString()}, backward=${this._backward.toString()})`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield* this._forward;
    yield* this._backward;
  }
}
