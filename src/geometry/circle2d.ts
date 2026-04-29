// Circle2d — center + radius in 2D.

import { V2d } from "../vector/v2d.js";
import { Trafo2d } from "../trafo/trafo2d.js";
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
