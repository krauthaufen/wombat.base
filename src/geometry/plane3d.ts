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
import { Triangle3d } from "./triangle3d.js";
import { Box3d } from "../box/box3d.js";
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

  intersects(other: Ray3d | Triangle3d | Box3d): boolean {
    if (other instanceof Triangle3d) {
      const s0 = this.signedDistance(other.p0);
      const s1 = this.signedDistance(other.p1);
      const s2 = this.signedDistance(other.p2);
      const allPos = s0 > 0 && s1 > 0 && s2 > 0;
      const allNeg = s0 < 0 && s1 < 0 && s2 < 0;
      return !(allPos || allNeg);
    }
    if (other instanceof Box3d) {
      return this.classify(other) === "intersecting";
    }
    return Math.abs(this.normal.dot(other.direction)) > 0;
  }

  /**
   * Classifies an axis-aligned box against this plane:
   * - `"above"` — box lies strictly on the side the normal points to,
   * - `"below"` — box lies strictly on the opposite side,
   * - `"intersecting"` — box straddles or touches the plane.
   *
   * Uses the SAT-style projection trick: project the box's half-extents
   * onto the plane normal and compare to the signed distance of the
   * box center. Suitable as a building block for frustum culling.
   */
  classify(box: Box3d): "above" | "below" | "intersecting" {
    const c = box.center();
    const e = box.size().mul(0.5);
    const r = e.x * Math.abs(this.normal.x) + e.y * Math.abs(this.normal.y) + e.z * Math.abs(this.normal.z);
    const sd = this.signedDistance(c);
    if (sd > r) return "above";
    if (sd < -r) return "below";
    return "intersecting";
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
  intersection(other: Triangle3d): Line3d | { kind: "point"; point: V3d } | undefined;
  intersection(other: Ray3d | Line3d | Plane3d | Triangle3d):
    | { point: V3d; t: number }
    | Ray3d
    | Line3d
    | { kind: "point"; point: V3d }
    | undefined {
    if (other instanceof Triangle3d) {
      const s0 = this.signedDistance(other.p0);
      const s1 = this.signedDistance(other.p1);
      const s2 = this.signedDistance(other.p2);
      const allPos = s0 > 0 && s1 > 0 && s2 > 0;
      const allNeg = s0 < 0 && s1 < 0 && s2 < 0;
      if (allPos || allNeg) return undefined;
      // Collect intersection points along edges that straddle the plane,
      // plus any vertex that lies exactly on the plane.
      const pts: V3d[] = [];
      const edge = (a: V3d, sa: number, b: V3d, sb: number): void => {
        if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
          const t = sa / (sa - sb);
          pts.push(a.add(b.sub(a).mul(t)));
        }
      };
      if (s0 === 0) pts.push(other.p0);
      if (s1 === 0) pts.push(other.p1);
      if (s2 === 0) pts.push(other.p2);
      edge(other.p0, s0, other.p1, s1);
      edge(other.p1, s1, other.p2, s2);
      edge(other.p2, s2, other.p0, s0);
      // Deduplicate near-coincident points (a vertex on the plane plus an
      // edge endpoint hit will both yield the same coordinate).
      const uniq: V3d[] = [];
      for (const p of pts) {
        let dup = false;
        for (const q of uniq) {
          if (p.approxEqual(q, 1e-12)) { dup = true; break; }
        }
        if (!dup) uniq.push(p);
      }
      if (uniq.length === 0) return undefined;
      if (uniq.length === 1) return { kind: "point", point: uniq[0]! };
      return new Line3d(uniq[0]!, uniq[1]!);
    }
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
