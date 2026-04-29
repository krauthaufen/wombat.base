// Triangle2d — three vertices P0, P1, P2 in 2D.

import { V2d } from "../vector/v2d.js";
import { V3d } from "../vector/v3d.js";
import { Trafo2d } from "../trafo/trafo2d.js";
import { combineHash } from "../internal/hash.js";

export class Triangle2d {
  readonly p0: V2d;
  readonly p1: V2d;
  readonly p2: V2d;

  constructor(p0: V2d, p1: V2d, p2: V2d) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
  }

  /** Unsigned area. */
  area(): number {
    return Math.abs(this.signedArea());
  }

  /** Signed area; positive for CCW vertex order. */
  signedArea(): number {
    return 0.5 * ((this.p1.x - this.p0.x) * (this.p2.y - this.p0.y)
                - (this.p2.x - this.p0.x) * (this.p1.y - this.p0.y));
  }

  centroid(): V2d {
    return new V2d(
      (this.p0.x + this.p1.x + this.p2.x) / 3,
      (this.p0.y + this.p1.y + this.p2.y) / 3,
    );
  }

  /** Barycentric coordinates `(u, v, w)` with `p = u·P0 + v·P1 + w·P2`. */
  barycentric(p: V2d): V3d {
    const detT = (this.p1.y - this.p2.y) * (this.p0.x - this.p2.x)
               + (this.p2.x - this.p1.x) * (this.p0.y - this.p2.y);
    if (detT === 0) return new V3d(NaN, NaN, NaN);
    const u = ((this.p1.y - this.p2.y) * (p.x - this.p2.x)
             + (this.p2.x - this.p1.x) * (p.y - this.p2.y)) / detT;
    const v = ((this.p2.y - this.p0.y) * (p.x - this.p2.x)
             + (this.p0.x - this.p2.x) * (p.y - this.p2.y)) / detT;
    const w = 1 - u - v;
    return new V3d(u, v, w);
  }

  contains(p: V2d): boolean {
    // sign-check three edge cross products
    const d1 = (p.x - this.p1.x) * (this.p0.y - this.p1.y) - (this.p0.x - this.p1.x) * (p.y - this.p1.y);
    const d2 = (p.x - this.p2.x) * (this.p1.y - this.p2.y) - (this.p1.x - this.p2.x) * (p.y - this.p2.y);
    const d3 = (p.x - this.p0.x) * (this.p2.y - this.p0.y) - (this.p2.x - this.p0.x) * (p.y - this.p0.y);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  /**
   * Triangle-triangle overlap in 2D via SAT. The 6 separating axes are
   * the outward normals of each triangle's three edges.
   */
  intersects(other: Triangle2d): boolean {
    return !sat2dSeparates(this, other) && !sat2dSeparates(other, this);
  }

  transformed(t: Trafo2d): Triangle2d {
    return new Triangle2d(t.transformPos(this.p0), t.transformPos(this.p1), t.transformPos(this.p2));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Triangle2d)) return false;
    return this.p0.equals(other.p0) && this.p1.equals(other.p1) && this.p2.equals(other.p2);
  }

  approxEqual(other: Triangle2d, eps: number): boolean {
    return this.p0.approxEqual(other.p0, eps) && this.p1.approxEqual(other.p1, eps) && this.p2.approxEqual(other.p2, eps);
  }

  getHashCode(): number {
    return combineHash(combineHash(this.p0.getHashCode(), this.p1.getHashCode()), this.p2.getHashCode());
  }

  toString(): string {
    return `Triangle2d(${this.p0.toString()}, ${this.p1.toString()}, ${this.p2.toString()})`;
  }
}

// Returns true if any edge of `a` is a separating axis between `a` and `b`.
function sat2dSeparates(a: Triangle2d, b: Triangle2d): boolean {
  const verts: [V2d, V2d, V2d] = [a.p0, a.p1, a.p2];
  const others: [V2d, V2d, V2d] = [b.p0, b.p1, b.p2];
  for (let i = 0; i < 3; i++) {
    const v0 = verts[i]!;
    const v1 = verts[(i + 1) % 3]!;
    // edge normal (right-hand): (dy, -dx)
    const nx = v1.y - v0.y;
    const ny = -(v1.x - v0.x);
    let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    for (const v of verts) {
      const p = v.x * nx + v.y * ny;
      if (p < aMin) aMin = p; if (p > aMax) aMax = p;
    }
    for (const v of others) {
      const p = v.x * nx + v.y * ny;
      if (p < bMin) bMin = p; if (p > bMax) bMax = p;
    }
    if (aMax < bMin || bMax < aMin) return true;
  }
  return false;
}
