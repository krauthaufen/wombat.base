// Ray2d — origin + direction in 2D.

import { V2d } from "../vector/v2d.js";
import { Trafo2d } from "../trafo/trafo2d.js";
import { combineHash } from "../internal/hash.js";

export class Ray2d {
  readonly origin: V2d;
  readonly direction: V2d;

  constructor(origin: V2d, direction: V2d) {
    this.origin = origin;
    this.direction = direction;
  }

  static fromPoints(from: V2d, to: V2d): Ray2d {
    return new Ray2d(from, to.sub(from).normalize());
  }

  pointAt(t: number): V2d {
    return this.origin.add(this.direction.mul(t));
  }

  closestPoint(p: V2d): V2d {
    const t = p.sub(this.origin).dot(this.direction) / this.direction.lengthSquared();
    return this.pointAt(t);
  }

  distance(p: V2d): number {
    return p.sub(this.closestPoint(p)).length();
  }

  intersects(other: Ray2d): boolean {
    return this.intersection(other) !== undefined;
  }

  /**
   * 2D ray–ray intersection. Solves
   *   `o1 + t1 d1 = o2 + t2 d2`
   * via the 2x2 system. Returns undefined when rays are parallel.
   */
  intersection(other: Ray2d): { point: V2d; t1: number; t2: number } | undefined {
    const det = this.direction.x * other.direction.y - this.direction.y * other.direction.x;
    if (Math.abs(det) < 1e-30) return undefined;
    const dx = other.origin.x - this.origin.x;
    const dy = other.origin.y - this.origin.y;
    const t1 = (dx * other.direction.y - dy * other.direction.x) / det;
    const t2 = (dx * this.direction.y - dy * this.direction.x) / det;
    return { point: this.pointAt(t1), t1, t2 };
  }

  transformed(t: Trafo2d): Ray2d {
    return new Ray2d(t.transformPos(this.origin), t.transformDir(this.direction));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Ray2d)) return false;
    return this.origin.equals(other.origin) && this.direction.equals(other.direction);
  }

  approxEqual(other: Ray2d, eps: number): boolean {
    return this.origin.approxEqual(other.origin, eps) && this.direction.approxEqual(other.direction, eps);
  }

  getHashCode(): number {
    return combineHash(this.origin.getHashCode(), this.direction.getHashCode());
  }

  toString(): string {
    return `Ray2d(o=${this.origin.toString()}, d=${this.direction.toString()})`;
  }
}
