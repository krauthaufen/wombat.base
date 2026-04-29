// Line3d — segment between two endpoints P0, P1.

import { V3d } from "../vector/v3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";
import type { Plane3d } from "./plane3d.js";
import { combineHash } from "../internal/hash.js";

export class Line3d {
  readonly p0: V3d;
  readonly p1: V3d;

  constructor(p0: V3d, p1: V3d) {
    this.p0 = p0;
    this.p1 = p1;
  }

  /** `p1 - p0` (not normalised). */
  direction(): V3d { return this.p1.sub(this.p0); }

  length(): number { return this.direction().length(); }

  /** Closest point on the segment, clamped to [0,1]. */
  closestPointToSegment(p: V3d): V3d {
    const d = this.direction();
    const ls = d.lengthSquared();
    if (ls === 0) return this.p0;
    let t = p.sub(this.p0).dot(d) / ls;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    return this.p0.add(d.mul(t));
  }

  /** Closest point on the infinite line through P0,P1. */
  closestPointToLine(p: V3d): V3d {
    const d = this.direction();
    const ls = d.lengthSquared();
    if (ls === 0) return this.p0;
    const t = p.sub(this.p0).dot(d) / ls;
    return this.p0.add(d.mul(t));
  }

  closestPoint(p: V3d): V3d { return this.closestPointToSegment(p); }
  distance(p: V3d): number { return p.sub(this.closestPointToSegment(p)).length(); }

  /**
   * Intersection of the (infinite) line through this segment with a plane.
   * Returns:
   * - `{ point, t }` for proper intersection (`t` is the segment parameter:
   *   `t ∈ [0, 1]` means the hit lies inside the closed segment),
   * - `"parallel"` when the line direction is parallel to the plane and
   *   does NOT lie in it,
   * - `"in-plane"` when the line is fully contained in the plane.
   */
  intersection(plane: Plane3d): { point: V3d; t: number } | "parallel" | "in-plane" {
    const dir = this.direction();
    const denom = plane.normal.dot(dir);
    if (Math.abs(denom) < 1e-30) {
      // direction parallel to plane; check if any point lies on it
      if (Math.abs(plane.signedDistance(this.p0)) < 1e-12) return "in-plane";
      return "parallel";
    }
    const t = (plane.distance - plane.normal.dot(this.p0)) / denom;
    return { point: this.p0.add(dir.mul(t)), t };
  }

  /**
   * Closest pair of points between two infinite 3D lines (one on each).
   * Returns `t1`, `t2` as segment parameters (in [0,1] iff the closest
   * point lies inside the corresponding segment), the world-space points,
   * and their distance. Falls back to a stable formula for parallel lines.
   */
  closestPoints(other: Line3d): { p1: V3d; p2: V3d; t1: number; t2: number; distance: number } {
    const d1 = this.direction();
    const d2 = other.direction();
    const r = this.p0.sub(other.p0);
    const a = d1.lengthSquared();
    const e = d2.lengthSquared();
    const f = d2.dot(r);
    const EPS = 1e-30;
    let t1: number, t2: number;
    if (a <= EPS && e <= EPS) {
      const p = this.p0; const q = other.p0;
      return { p1: p, p2: q, t1: 0, t2: 0, distance: p.distance(q) };
    }
    if (a <= EPS) {
      t1 = 0; t2 = f / e;
    } else {
      const c = d1.dot(r);
      if (e <= EPS) {
        t1 = -c / a; t2 = 0;
      } else {
        const b = d1.dot(d2);
        const denom = a * e - b * b;
        if (Math.abs(denom) < EPS) {
          // parallel: pick t1 = 0
          t1 = 0;
          t2 = f / e;
        } else {
          t1 = (b * f - c * e) / denom;
          t2 = (a * f - b * c) / denom;
        }
      }
    }
    const p1 = this.p0.add(d1.mul(t1));
    const p2 = other.p0.add(d2.mul(t2));
    return { p1, p2, t1, t2, distance: p1.distance(p2) };
  }

  /**
   * Treats both as infinite lines: true when their closest-point
   * distance is below `eps`. Skew lines almost never share a point in
   * f64, so this is the practical "do they meet?" test.
   */
  intersects(other: Line3d, eps: number = 1e-9): boolean {
    return this.closestPoints(other).distance <= eps;
  }

  transformed(t: Trafo3d): Line3d {
    return new Line3d(t.forward.transformPos(this.p0), t.forward.transformPos(this.p1));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Line3d)) return false;
    return this.p0.equals(other.p0) && this.p1.equals(other.p1);
  }

  approxEqual(other: Line3d, eps: number): boolean {
    return this.p0.approxEqual(other.p0, eps) && this.p1.approxEqual(other.p1, eps);
  }

  getHashCode(): number {
    return combineHash(this.p0.getHashCode(), this.p1.getHashCode());
  }

  toString(): string {
    return `Line3d(${this.p0.toString()}, ${this.p1.toString()})`;
  }
}
