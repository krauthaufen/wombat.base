// Circle3d — oriented disk: center + radius + unit normal.

import { V3d } from "../vector/v3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";
import { combineHash, hashNumber } from "../internal/hash.js";

export class Circle3d {
  readonly center: V3d;
  readonly radius: number;
  readonly normal: V3d;

  constructor(center: V3d, radius: number, normal: V3d) {
    this.center = center;
    this.radius = radius;
    this.normal = normal;
  }

  area(): number { return Math.PI * this.radius * this.radius; }
  circumference(): number { return 2 * Math.PI * this.radius; }

  /**
   * Closest point on the disk (interior + boundary). Projects `p`
   * onto the plane, then clamps the in-plane offset to `radius`.
   */
  closestPoint(p: V3d): V3d {
    const d = p.sub(this.center);
    const onPlane = d.sub(this.normal.mul(d.dot(this.normal)));
    const l = onPlane.length();
    if (l <= this.radius) return this.center.add(onPlane);
    return this.center.add(onPlane.mul(this.radius / l));
  }

  distance(p: V3d): number {
    return p.sub(this.closestPoint(p)).length();
  }

  transformed(t: Trafo3d): Circle3d {
    const c = t.forward.transformPos(this.center);
    const n = t.forward.transformDir(this.normal).normalize();
    const sx = t.forward.transformDir(V3d.unitX).length();
    const sy = t.forward.transformDir(V3d.unitY).length();
    const sz = t.forward.transformDir(V3d.unitZ).length();
    return new Circle3d(c, this.radius * Math.max(sx, sy, sz), n);
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Circle3d)) return false;
    return this.center.equals(other.center) && this.radius === other.radius && this.normal.equals(other.normal);
  }

  approxEqual(other: Circle3d, eps: number): boolean {
    return this.center.approxEqual(other.center, eps)
        && Math.abs(this.radius - other.radius) <= eps
        && this.normal.approxEqual(other.normal, eps);
  }

  getHashCode(): number {
    return combineHash(combineHash(this.center.getHashCode(), hashNumber(this.radius)), this.normal.getHashCode());
  }

  toString(): string {
    return `Circle3d(c=${this.center.toString()}, r=${this.radius}, n=${this.normal.toString()})`;
  }
}
