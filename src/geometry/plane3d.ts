// Plane3d — implicit plane `n · x = d`, with `n` stored unit-length.
//
// `signedDistance(p) = n · p - d` is positive on the side of the plane
// the normal points towards. `transformed(t)` for a generic Trafo3d
// transforms the plane's point representation by the forward matrix
// while transforming the normal by `t.backward.transpose()` (so the
// formula stays correct for non-rigid trafos). Rigid/uniform-scale
// transforms reduce to the obvious case.

import { V3d } from "../vector/v3d.js";
import { Ray3d } from "./ray3d.js";
import { Line3d } from "./line3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";
import { combineHash, hashNumber } from "../internal/hash.js";

export class Plane3d {
  readonly normal: V3d;
  readonly distance: number;

  /** Constructs `n · x = d` directly. `n` is assumed unit-length. */
  constructor(normal: V3d, distance: number) {
    this.normal = normal;
    this.distance = distance;
  }

  /** Plane through `p` with normal `n` (n is normalised). */
  static fromPointAndNormal(p: V3d, n: V3d): Plane3d {
    const un = n.normalize();
    return new Plane3d(un, un.dot(p));
  }

  /** Plane through three points. Normal direction follows the right-hand rule on (b-a, c-a). */
  static fromThreePoints(a: V3d, b: V3d, c: V3d): Plane3d {
    const n = b.sub(a).cross(c.sub(a)).normalize();
    return new Plane3d(n, n.dot(a));
  }

  signedDistance(p: V3d): number {
    return this.normal.dot(p) - this.distance;
  }

  /** Unsigned distance from `p` to the plane. */
  distanceTo(p: V3d): number {
    return Math.abs(this.signedDistance(p));
  }

  closestPoint(p: V3d): V3d {
    return p.sub(this.normal.mul(this.signedDistance(p)));
  }

  flipped(): Plane3d {
    return new Plane3d(this.normal.neg(), -this.distance);
  }

  intersects(ray: Ray3d): boolean {
    return Math.abs(this.normal.dot(ray.direction)) > 0;
  }

  /**
   * Intersection with a ray, line, or another plane. Returns:
   * - For Ray3d / Line3d: `{ point, t }` where `t` is the ray/line parameter
   *   (line `t` in [0,1] means inside the segment).
   * - For Plane3d: a `Ray3d` along the line of intersection, or undefined
   *   when planes are parallel.
   */
  intersection(other: Ray3d): { point: V3d; t: number } | undefined;
  intersection(other: Line3d): { point: V3d; t: number } | undefined;
  intersection(other: Plane3d): Ray3d | undefined;
  intersection(other: Ray3d | Line3d | Plane3d): { point: V3d; t: number } | Ray3d | undefined {
    if (other instanceof Plane3d) {
      const dir = this.normal.cross(other.normal);
      const ls = dir.lengthSquared();
      if (ls < 1e-30) return undefined;
      // point on both planes: solve a * n1 + b * n2 = p where p satisfies both.
      const n1n2 = this.normal.dot(other.normal);
      const det = 1 - n1n2 * n1n2;
      if (Math.abs(det) < 1e-30) return undefined;
      const c1 = (this.distance - other.distance * n1n2) / det;
      const c2 = (other.distance - this.distance * n1n2) / det;
      const origin = this.normal.mul(c1).add(other.normal.mul(c2));
      return new Ray3d(origin, dir.normalize());
    }
    if (other instanceof Ray3d) {
      const denom = this.normal.dot(other.direction);
      if (Math.abs(denom) < 1e-30) return undefined;
      const t = (this.distance - this.normal.dot(other.origin)) / denom;
      return { point: other.pointAt(t), t };
    }
    // Line3d
    const dir = other.direction();
    const denom = this.normal.dot(dir);
    if (Math.abs(denom) < 1e-30) return undefined;
    const t = (this.distance - this.normal.dot(other.p0)) / denom;
    return { point: other.p0.add(dir.mul(t)), t };
  }

  transformed(t: Trafo3d): Plane3d {
    // Transform a point on the plane by forward.
    const pOnPlane = this.normal.mul(this.distance);
    const newPoint = t.forward.transformPos(pOnPlane);
    // Transform normal by backward^T (covariant).
    const bw = t.backward;
    // build (backward^T) * normal
    const nx = this.normal.x, ny = this.normal.y, nz = this.normal.z;
    // backward is row-major M44d; backward^T means we use columns as rows.
    // (backward^T)_ij = backward_ji. Apply to direction (no translation).
    // newN_i = sum_j backward[j*4 + i] * n_j
    const fwd = bw._data;
    const nxN = fwd[0]! * nx + fwd[4]! * ny + fwd[8]! * nz;
    const nyN = fwd[1]! * nx + fwd[5]! * ny + fwd[9]! * nz;
    const nzN = fwd[2]! * nx + fwd[6]! * ny + fwd[10]! * nz;
    const nNew = new V3d(nxN, nyN, nzN).normalize();
    return new Plane3d(nNew, nNew.dot(newPoint));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Plane3d)) return false;
    return this.normal.equals(other.normal) && this.distance === other.distance;
  }

  approxEqual(other: Plane3d, eps: number): boolean {
    return this.normal.approxEqual(other.normal, eps) && Math.abs(this.distance - other.distance) <= eps;
  }

  getHashCode(): number {
    return combineHash(this.normal.getHashCode(), hashNumber(this.distance));
  }

  toString(): string {
    return `Plane3d(n=${this.normal.toString()}, d=${this.distance})`;
  }
}
