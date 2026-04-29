// Ray3d — origin + direction. Direction is unit-length by convention
// (factories normalise) but not enforced; some intersection routines
// rely on |direction| = 1, others (slab box test) parameterise by
// direction-scaled t.

import { V3d } from "../vector/v3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";
import { Sphere3d } from "./sphere3d.js";
import { Triangle3d } from "./triangle3d.js";
import { Box3d } from "../box/box3d.js";
import { combineHash } from "../internal/hash.js";

export class Ray3d {
  readonly origin: V3d;
  readonly direction: V3d;

  constructor(origin: V3d, direction: V3d) {
    this.origin = origin;
    this.direction = direction;
  }

  /** Ray from `from` to `to`, unit direction. */
  static fromPoints(from: V3d, to: V3d): Ray3d {
    return new Ray3d(from, to.sub(from).normalize());
  }

  pointAt(t: number): V3d {
    return this.origin.add(this.direction.mul(t));
  }

  /** Closest point on the (infinite) line of this ray to `p`. */
  closestPoint(p: V3d): V3d {
    const t = p.sub(this.origin).dot(this.direction) / this.direction.lengthSquared();
    return this.pointAt(t);
  }

  /** Unsigned distance from the (infinite) line of this ray to `p`. */
  distance(p: V3d): number {
    return p.sub(this.closestPoint(p)).length();
  }

  /**
   * Intersection with a sphere (Möller form), triangle (Möller–Trumbore),
   * or AABB (slab method).
   *
   * - Sphere3d: returns `{tMin, tMax}` for the entry/exit parameters,
   *   or undefined if the ray misses.
   * - Triangle3d: returns `{point, t, u, v}` with barycentric (u, v)
   *   on edges (P1-P0, P2-P0). Hits at t < 0 are filtered out.
   * - Box3d: returns `{tMin, tMax}` from the slab method.
   */
  intersection(sphere: Sphere3d): { tMin: number; tMax: number } | undefined;
  intersection(triangle: Triangle3d): { point: V3d; t: number; u: number; v: number } | undefined;
  intersection(box: Box3d): { tMin: number; tMax: number } | undefined;
  intersection(other: Sphere3d | Triangle3d | Box3d):
    | { tMin: number; tMax: number }
    | { point: V3d; t: number; u: number; v: number }
    | undefined {
    if (other instanceof Sphere3d) {
      // |o + t d - c|^2 = r^2
      const oc = this.origin.sub(other.center);
      const a = this.direction.lengthSquared();
      const b = 2 * oc.dot(this.direction);
      const c = oc.lengthSquared() - other.radius * other.radius;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return undefined;
      const s = Math.sqrt(disc);
      const inv2a = 1 / (2 * a);
      const t1 = (-b - s) * inv2a;
      const t2 = (-b + s) * inv2a;
      return { tMin: Math.min(t1, t2), tMax: Math.max(t1, t2) };
    }
    if (other instanceof Triangle3d) {
      // Möller–Trumbore.
      const EPS = 1e-12;
      const e1 = other.p1.sub(other.p0);
      const e2 = other.p2.sub(other.p0);
      const pvec = this.direction.cross(e2);
      const det = e1.dot(pvec);
      if (Math.abs(det) < EPS) return undefined;
      const invDet = 1 / det;
      const tvec = this.origin.sub(other.p0);
      const u = tvec.dot(pvec) * invDet;
      if (u < 0 || u > 1) return undefined;
      const qvec = tvec.cross(e1);
      const v = this.direction.dot(qvec) * invDet;
      if (v < 0 || u + v > 1) return undefined;
      const t = e2.dot(qvec) * invDet;
      if (t < 0) return undefined;
      return { point: this.pointAt(t), t, u, v };
    }
    // Box3d slab method.
    const inv = new V3d(1 / this.direction.x, 1 / this.direction.y, 1 / this.direction.z);
    const t1x = (other.min.x - this.origin.x) * inv.x;
    const t2x = (other.max.x - this.origin.x) * inv.x;
    const t1y = (other.min.y - this.origin.y) * inv.y;
    const t2y = (other.max.y - this.origin.y) * inv.y;
    const t1z = (other.min.z - this.origin.z) * inv.z;
    const t2z = (other.max.z - this.origin.z) * inv.z;
    const tMin = Math.max(Math.min(t1x, t2x), Math.min(t1y, t2y), Math.min(t1z, t2z));
    const tMax = Math.min(Math.max(t1x, t2x), Math.max(t1y, t2y), Math.max(t1z, t2z));
    if (tMax < 0 || tMin > tMax) return undefined;
    return { tMin, tMax };
  }

  intersects(other: Sphere3d | Box3d | Triangle3d): boolean {
    return this.intersection(other as Sphere3d) !== undefined;
  }

  transformed(t: Trafo3d): Ray3d {
    return new Ray3d(t.forward.transformPos(this.origin), t.forward.transformDir(this.direction));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Ray3d)) return false;
    return this.origin.equals(other.origin) && this.direction.equals(other.direction);
  }

  approxEqual(other: Ray3d, eps: number): boolean {
    return this.origin.approxEqual(other.origin, eps) && this.direction.approxEqual(other.direction, eps);
  }

  getHashCode(): number {
    return combineHash(this.origin.getHashCode(), this.direction.getHashCode());
  }

  toString(): string {
    return `Ray3d(o=${this.origin.toString()}, d=${this.direction.toString()})`;
  }
}
