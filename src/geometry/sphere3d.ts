// Sphere3d — center + radius.

import { V3d } from "../vector/v3d.js";
import { Box3d } from "../box/box3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";
import { Ray3d } from "./ray3d.js";
import { combineHash, hashNumber } from "../internal/hash.js";

export class Sphere3d {
  readonly center: V3d;
  readonly radius: number;

  constructor(center: V3d, radius: number) {
    this.center = center;
    this.radius = radius;
  }

  /**
   * A bounding sphere of the points: centroid + max distance.
   * **Suboptimal** (not the minimum enclosing sphere; that would
   * require Welzl's algorithm). Returned sphere is correct (encloses
   * all points) but typically larger than the minimum.
   */
  static fromPoints(points: V3d[]): Sphere3d {
    if (points.length === 0) return new Sphere3d(V3d.zero, 0);
    let cx = 0, cy = 0, cz = 0;
    for (const p of points) { cx += p.x; cy += p.y; cz += p.z; }
    const inv = 1 / points.length;
    const center = new V3d(cx * inv, cy * inv, cz * inv);
    let r2 = 0;
    for (const p of points) {
      const d2 = p.distanceSquared(center);
      if (d2 > r2) r2 = d2;
    }
    return new Sphere3d(center, Math.sqrt(r2));
  }

  contains(p: V3d): boolean {
    return p.distanceSquared(this.center) <= this.radius * this.radius;
  }

  closestPoint(p: V3d): V3d {
    const d = p.sub(this.center);
    const len = d.length();
    if (len === 0) return this.center.add(new V3d(this.radius, 0, 0));
    return this.center.add(d.mul(this.radius / len));
  }

  distance(p: V3d): number {
    return Math.max(0, p.distance(this.center) - this.radius);
  }

  intersects(other: Sphere3d | Box3d | Ray3d): boolean {
    if (other instanceof Sphere3d) {
      const r = this.radius + other.radius;
      return this.center.distanceSquared(other.center) <= r * r;
    }
    if (other instanceof Box3d) {
      // closest point on box to center
      const c = this.center;
      const cx = Math.max(other.min.x, Math.min(c.x, other.max.x));
      const cy = Math.max(other.min.y, Math.min(c.y, other.max.y));
      const cz = Math.max(other.min.z, Math.min(c.z, other.max.z));
      const dx = c.x - cx, dy = c.y - cy, dz = c.z - cz;
      return dx * dx + dy * dy + dz * dz <= this.radius * this.radius;
    }
    // Ray3d
    const hit = other.intersection(this);
    if (!hit) return false;
    return hit.tMax >= 0;
  }

  transformed(t: Trafo3d): Sphere3d {
    // Conservative: scale radius by max axis-scale of forward.
    const c = t.forward.transformPos(this.center);
    const sx = t.forward.transformDir(V3d.unitX).length();
    const sy = t.forward.transformDir(V3d.unitY).length();
    const sz = t.forward.transformDir(V3d.unitZ).length();
    return new Sphere3d(c, this.radius * Math.max(sx, sy, sz));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Sphere3d)) return false;
    return this.center.equals(other.center) && this.radius === other.radius;
  }

  approxEqual(other: Sphere3d, eps: number): boolean {
    return this.center.approxEqual(other.center, eps) && Math.abs(this.radius - other.radius) <= eps;
  }

  getHashCode(): number {
    return combineHash(this.center.getHashCode(), hashNumber(this.radius));
  }

  toString(): string {
    return `Sphere3d(c=${this.center.toString()}, r=${this.radius})`;
  }
}
