// Circle2d — center + radius in 2D.

import { V2d } from "../vector/v2d.js";
import { Trafo2d } from "../trafo/trafo2d.js";
import { Box2d } from "../box/box2d.js";
import { combineHash, hashNumber } from "../internal/hash.js";

export class Circle2d {
  readonly center: V2d;
  readonly radius: number;

  constructor(center: V2d, radius: number) {
    this.center = center;
    this.radius = radius;
  }

  area(): number { return Math.PI * this.radius * this.radius; }
  circumference(): number { return 2 * Math.PI * this.radius; }

  contains(p: V2d): boolean {
    return p.sub(this.center).lengthSquared() <= this.radius * this.radius;
  }

  closestPoint(p: V2d): V2d {
    const d = p.sub(this.center);
    const l = d.length();
    if (l === 0) return this.center.add(new V2d(this.radius, 0));
    return this.center.add(d.mul(this.radius / l));
  }

  distance(p: V2d): number {
    return Math.abs(p.sub(this.center).length() - this.radius);
  }

  intersects(other: Circle2d | Box2d): boolean {
    if (other instanceof Box2d) {
      const cx = Math.max(other.min.x, Math.min(this.center.x, other.max.x));
      const cy = Math.max(other.min.y, Math.min(this.center.y, other.max.y));
      const dx = this.center.x - cx, dy = this.center.y - cy;
      return dx * dx + dy * dy <= this.radius * this.radius;
    }
    const r = this.radius + other.radius;
    return this.center.sub(other.center).lengthSquared() <= r * r;
  }

  /**
   * Circle-circle intersection in 2D:
   * - Two `V2d` points where the circles cross,
   * - One `V2d` point for tangency,
   * - `undefined` for disjoint or one fully inside the other.
   */
  intersection(other: Circle2d): V2d | [V2d, V2d] | undefined {
    const d2v = other.center.sub(this.center);
    const d2 = d2v.lengthSquared();
    const d = Math.sqrt(d2);
    const rSum = this.radius + other.radius;
    const rDiff = Math.abs(this.radius - other.radius);
    if (d > rSum) return undefined;
    if (d < rDiff) return undefined;
    if (d === 0) return undefined;
    const a = (d2 + this.radius * this.radius - other.radius * other.radius) / (2 * d);
    const mid = this.center.add(d2v.mul(a / d));
    const h2 = this.radius * this.radius - a * a;
    if (h2 <= 0) return mid;
    const h = Math.sqrt(h2);
    // perpendicular in 2D: (-dy, dx) / d
    const perp = new V2d(-d2v.y / d, d2v.x / d);
    return [mid.add(perp.mul(h)), mid.sub(perp.mul(h))];
  }

  transformed(t: Trafo2d): Circle2d {
    const c = t.transformPos(this.center);
    // conservative radius scale via |T·unitX|, |T·unitY|
    const sx = t.transformDir(V2d.unitX).length();
    const sy = t.transformDir(V2d.unitY).length();
    return new Circle2d(c, this.radius * Math.max(sx, sy));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Circle2d)) return false;
    return this.center.equals(other.center) && this.radius === other.radius;
  }

  approxEqual(other: Circle2d, eps: number): boolean {
    return this.center.approxEqual(other.center, eps) && Math.abs(this.radius - other.radius) <= eps;
  }

  getHashCode(): number {
    return combineHash(this.center.getHashCode(), hashNumber(this.radius));
  }

  toString(): string {
    return `Circle2d(c=${this.center.toString()}, r=${this.radius})`;
  }
}
