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
import { Rot3d } from "../rotation/rot3d.js";
import { Shift3d } from "./shift3d.js";
import { Scale3d } from "./scale3d.js";
import { combineHash } from "../internal/hash.js";

const DEG_TO_RAD = Math.PI / 180;

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

  // ---------- translation ----------

  static translation(v: V3d): Trafo3d;
  static translation(tx: number, ty: number, tz: number): Trafo3d;
  static translation(shift: Shift3d): Trafo3d;
  static translation(a: V3d | number | Shift3d, b?: number, c?: number): Trafo3d {
    let v: V3d;
    if (typeof a === "number") v = new V3d(a, b!, c!);
    else if (a instanceof Shift3d) v = a.offset;
    else v = a;
    return Trafo3d.fromMatrices(M44d.translation(v), M44d.translation(v.neg()));
  }

  // ---------- scaling ----------

  /** Non-uniform per-axis scaling. */
  static scaling(v: V3d): Trafo3d;
  /** Per-component scaling. */
  static scaling(sx: number, sy: number, sz: number): Trafo3d;
  /** Uniform scaling. */
  static scaling(s: number): Trafo3d;
  /** Scaling from a Scale3d. */
  static scaling(scale: Scale3d): Trafo3d;
  static scaling(a: V3d | number | Scale3d, b?: number, c?: number): Trafo3d {
    if (typeof a === "number") {
      if (b === undefined) {
        return Trafo3d.fromMatrices(M44d.scalingUniform(a), M44d.scalingUniform(1 / a));
      }
      return Trafo3d.fromMatrices(
        M44d.scaling(a, b, c!),
        M44d.scaling(1 / a, 1 / b, 1 / c!),
      );
    }
    const v = a instanceof Scale3d ? a.scale : a;
    return Trafo3d.fromMatrices(
      M44d.scaling(v),
      M44d.scaling(new V3d(1 / v.x, 1 / v.y, 1 / v.z)),
    );
  }

  // ---------- rotation ----------

  /** Rotation around `axis` by `rad` (right-handed). Axis must be normalized. */
  static rotation(axis: V3d, rad: number): Trafo3d;
  /** Rotation from a Rot3d. */
  static rotation(rot: Rot3d): Trafo3d;
  static rotation(a: V3d | Rot3d, rad?: number): Trafo3d {
    if (a instanceof Rot3d) {
      const fwd = a.toMatrixHomogeneous();
      const bwd = a.inverse().toMatrixHomogeneous();
      return Trafo3d.fromMatrices(fwd, bwd);
    }
    return Trafo3d.fromMatrices(M44d.rotation(a, rad!), M44d.rotation(a, -rad!));
  }

  /** Rotation around `axis` by `deg` degrees. Axis must be normalized. */
  static rotationInDegrees(axis: V3d, deg: number): Trafo3d {
    return Trafo3d.rotation(axis, deg * DEG_TO_RAD);
  }

  static rotationX(rad: number): Trafo3d {
    return Trafo3d.fromMatrices(M44d.rotationX(rad), M44d.rotationX(-rad));
  }
  static rotationXInDegrees(deg: number): Trafo3d { return Trafo3d.rotationX(deg * DEG_TO_RAD); }
  static rotationY(rad: number): Trafo3d {
    return Trafo3d.fromMatrices(M44d.rotationY(rad), M44d.rotationY(-rad));
  }
  static rotationYInDegrees(deg: number): Trafo3d { return Trafo3d.rotationY(deg * DEG_TO_RAD); }
  static rotationZ(rad: number): Trafo3d {
    return Trafo3d.fromMatrices(M44d.rotationZ(rad), M44d.rotationZ(-rad));
  }
  static rotationZInDegrees(deg: number): Trafo3d { return Trafo3d.rotationZ(deg * DEG_TO_RAD); }

  /** Rotation from roll (X), pitch (Y), yaw (Z) in radians. Order: Z·Y·X. */
  static rotationEuler(roll: number, pitch: number, yaw: number): Trafo3d;
  /** Rotation from a roll/pitch/yaw vector in radians. Order: Z·Y·X. */
  static rotationEuler(rollPitchYaw: V3d): Trafo3d;
  static rotationEuler(a: number | V3d, pitch?: number, yaw?: number): Trafo3d {
    let r: number, p: number, y: number;
    if (typeof a === "number") { r = a; p = pitch!; y = yaw!; }
    else { r = a.x; p = a.y; y = a.z; }
    return Trafo3d.rotationZ(y).mul(Trafo3d.rotationY(p)).mul(Trafo3d.rotationX(r));
  }
  /** Rotation from roll/pitch/yaw in degrees. Order: Z·Y·X. */
  static rotationEulerInDegrees(roll: number, pitch: number, yaw: number): Trafo3d;
  static rotationEulerInDegrees(rollPitchYaw: V3d): Trafo3d;
  static rotationEulerInDegrees(a: number | V3d, pitch?: number, yaw?: number): Trafo3d {
    if (typeof a === "number") {
      return Trafo3d.rotationEuler(a * DEG_TO_RAD, pitch! * DEG_TO_RAD, yaw! * DEG_TO_RAD);
    }
    return Trafo3d.rotationEuler(a.mul(DEG_TO_RAD));
  }

  /** Rotation that takes the unit vector `from` to `into`. */
  static rotateInto(from: V3d, into: V3d): Trafo3d {
    return Trafo3d.rotation(Rot3d.fromTwoVectors(from, into));
  }

  // ---------- shear ----------

  /** Shear along the x-axis. */
  static shearYZ(factorY: number, factorZ: number): Trafo3d {
    return Trafo3d.fromMatrices(M44d.shearYZ(factorY, factorZ), M44d.shearYZ(-factorY, -factorZ));
  }
  /** Shear along the y-axis. */
  static shearXZ(factorX: number, factorZ: number): Trafo3d {
    return Trafo3d.fromMatrices(M44d.shearXZ(factorX, factorZ), M44d.shearXZ(-factorX, -factorZ));
  }
  /** Shear along the z-axis. */
  static shearXY(factorX: number, factorY: number): Trafo3d {
    return Trafo3d.fromMatrices(M44d.shearXY(factorX, factorY), M44d.shearXY(-factorX, -factorY));
  }

  // ---------- view ----------

  /**
   * View transformation from explicit basis vectors.
   * `u`, `v`, `z` are the right, up, and view-plane-normal vectors.
   * For a right-handed view, `z` points away from the scene (opposite to forward).
   */
  static viewTrafo(location: V3d, u: V3d, v: V3d, z: V3d): Trafo3d {
    const uDl = u.dot(location), vDl = v.dot(location), zDl = z.dot(location);
    const fwd = M44d.fromArray([
      u.x, u.y, u.z, -uDl,
      v.x, v.y, v.z, -vDl,
      z.x, z.y, z.z, -zDl,
      0, 0, 0, 1,
    ]);
    const bwd = M44d.fromArray([
      u.x, v.x, z.x, location.x,
      u.y, v.y, z.y, location.y,
      u.z, v.z, z.z, location.z,
      0, 0, 0, 1,
    ]);
    return Trafo3d.fromMatrices(fwd, bwd);
  }

  /** Right-handed view trafo (z-negative points into the scene). */
  static viewTrafoRH(location: V3d, up: V3d, forward: V3d): Trafo3d {
    return Trafo3d.viewTrafo(location, forward.cross(up), up, forward.neg());
  }
  /** Left-handed view trafo (z-positive points into the scene). */
  static viewTrafoLH(location: V3d, up: V3d, forward: V3d): Trafo3d {
    return Trafo3d.viewTrafo(location, up.cross(forward), up, forward);
  }

  // ---------- projection ----------

  /**
   * Right-handed perspective projection. Maps eye-space depth `[-near, -far]`
   * to NDC z `[0, 1]` (D3D / Vulkan convention). `far` may be `Infinity`.
   */
  static perspectiveProjectionRH(
    l: number, r: number, b: number, t: number, n: number, f: number = Infinity,
  ): Trafo3d {
    let m22: number, m23: number, m32i: number;
    if (!Number.isFinite(f)) {
      m22 = -1; m23 = -n; m32i = -1 / n;
    } else {
      m22 = f / (n - f); m23 = (f * n) / (n - f); m32i = (n - f) / (f * n);
    }
    const fwd = M44d.fromArray([
      (2 * n) / (r - l), 0, (r + l) / (r - l), 0,
      0, (2 * n) / (t - b), (t + b) / (t - b), 0,
      0, 0, m22, m23,
      0, 0, -1, 0,
    ]);
    const bwd = M44d.fromArray([
      (r - l) / (2 * n), 0, 0, (r + l) / (2 * n),
      0, (t - b) / (2 * n), 0, (t + b) / (2 * n),
      0, 0, 0, -1,
      0, 0, m32i, 1 / n,
    ]);
    return Trafo3d.fromMatrices(fwd, bwd);
  }

  /** Right-handed perspective from horizontal FoV (radians) and aspect (w/h). */
  static perspectiveProjectionRHFov(horizontalFovRad: number, aspect: number, n: number, f: number = Infinity): Trafo3d {
    const r = Math.tan(horizontalFovRad / 2) * n;
    const t = r / aspect;
    return Trafo3d.perspectiveProjectionRH(-r, r, -t, t, n, f);
  }

  /**
   * OpenGL-convention perspective projection (NDC z in `[-1, 1]`).
   */
  static perspectiveProjectionGL(
    l: number, r: number, b: number, t: number, n: number, f: number = Infinity,
  ): Trafo3d {
    let m22: number, m23: number, m32i: number;
    if (!Number.isFinite(f)) {
      m22 = -1; m23 = -2 * n; m32i = -1 / (2 * n);
    } else {
      m22 = (f + n) / (n - f); m23 = (2 * f * n) / (n - f); m32i = (n - f) / (2 * f * n);
    }
    const fwd = M44d.fromArray([
      (2 * n) / (r - l), 0, (r + l) / (r - l), 0,
      0, (2 * n) / (t - b), (t + b) / (t - b), 0,
      0, 0, m22, m23,
      0, 0, -1, 0,
    ]);
    const bwd = M44d.fromArray([
      (r - l) / (2 * n), 0, 0, (r + l) / (2 * n),
      0, (t - b) / (2 * n), 0, (t + b) / (2 * n),
      0, 0, 0, -1,
      0, 0, m32i, (f + n) / (2 * f * n),
    ]);
    return Trafo3d.fromMatrices(fwd, bwd);
  }
  static perspectiveProjectionGLFov(horizontalFovRad: number, aspect: number, n: number, f: number = Infinity): Trafo3d {
    const r = Math.tan(horizontalFovRad / 2) * n;
    const t = r / aspect;
    return Trafo3d.perspectiveProjectionGL(-r, r, -t, t, n, f);
  }

  /** Right-handed orthographic projection (NDC z in `[0, 1]`). */
  static orthoProjectionRH(l: number, r: number, b: number, t: number, n: number, f: number): Trafo3d {
    const fwd = M44d.fromArray([
      2 / (r - l), 0, 0, -(r + l) / (r - l),
      0, 2 / (t - b), 0, -(t + b) / (t - b),
      0, 0, 1 / (n - f), n / (n - f),
      0, 0, 0, 1,
    ]);
    return Trafo3d.fromMatrix(fwd);
  }
  /** OpenGL orthographic projection (NDC z in `[-1, 1]`). */
  static orthoProjectionGL(l: number, r: number, b: number, t: number, n: number, f: number): Trafo3d {
    const fwd = M44d.fromArray([
      2 / (r - l), 0, 0, -(r + l) / (r - l),
      0, 2 / (t - b), 0, -(t + b) / (t - b),
      0, 0, 2 / (n - f), (n + f) / (n - f),
      0, 0, 0, 1,
    ]);
    return Trafo3d.fromMatrix(fwd);
  }

  // ---------- frame / basis ----------

  /** Trafo whose forward maps `(0,0,0) → origin` and the standard basis to `(xAxis, yAxis, zAxis)`. */
  static fromBasis(xAxis: V3d, yAxis: V3d, zAxis: V3d, origin: V3d): Trafo3d {
    const fwd = M44d.fromArray([
      xAxis.x, yAxis.x, zAxis.x, origin.x,
      xAxis.y, yAxis.y, zAxis.y, origin.y,
      xAxis.z, yAxis.z, zAxis.z, origin.z,
      0, 0, 0, 1,
    ]);
    return Trafo3d.fromMatrix(fwd);
  }

  /** Same as fromBasis but assumes the basis is orthonormal (faster inverse). */
  static fromOrthoNormalBasis(xAxis: V3d, yAxis: V3d, zAxis: V3d): Trafo3d {
    const fwd = M44d.fromArray([
      xAxis.x, yAxis.x, zAxis.x, 0,
      xAxis.y, yAxis.y, zAxis.y, 0,
      xAxis.z, yAxis.z, zAxis.z, 0,
      0, 0, 0, 1,
    ]);
    const bwd = M44d.fromArray([
      xAxis.x, xAxis.y, xAxis.z, 0,
      yAxis.x, yAxis.y, yAxis.z, 0,
      zAxis.x, zAxis.y, zAxis.z, 0,
      0, 0, 0, 1,
    ]);
    return Trafo3d.fromMatrices(fwd, bwd);
  }

  /** Builds Scale * Rotation(Euler) * Translation, in that order. */
  static fromComponents(scale: V3d, rotationEulerRad: V3d, translation: V3d): Trafo3d {
    return Trafo3d.scaling(scale)
      .mul(Trafo3d.rotationEuler(rotationEulerRad))
      .mul(Trafo3d.translation(translation));
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

  // ---------- operator overloads (boperators) ----------

  static "*"(a: Trafo3d, b: Trafo3d): Trafo3d { return a.mul(b); }
}
