// Triangle3d — three vertices P0, P1, P2 in 3D.

import { V3d } from "../vector/v3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";
import { combineHash } from "../internal/hash.js";

export class Triangle3d {
  readonly p0: V3d;
  readonly p1: V3d;
  readonly p2: V3d;

  constructor(p0: V3d, p1: V3d, p2: V3d) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
  }

  /** Twice the signed area divided by 2 — i.e. unsigned area. */
  area(): number {
    return this.p1.sub(this.p0).cross(this.p2.sub(this.p0)).length() * 0.5;
  }

  /** Unit normal of the triangle, by right-hand rule on (p1-p0, p2-p0). */
  normal(): V3d {
    return this.p1.sub(this.p0).cross(this.p2.sub(this.p0)).normalize();
  }

  centroid(): V3d {
    return this.p0.add(this.p1).add(this.p2).mul(1 / 3);
  }

  /**
   * Barycentric coordinates `(u, v, w)` with `p ≈ u·P0 + v·P1 + w·P2`.
   * `p` is first projected onto the triangle's plane, so off-plane
   * inputs return barycentrics for the projection.
   */
  barycentric(p: V3d): V3d {
    const v0 = this.p1.sub(this.p0);
    const v1 = this.p2.sub(this.p0);
    const v2 = p.sub(this.p0);
    const d00 = v0.dot(v0);
    const d01 = v0.dot(v1);
    const d11 = v1.dot(v1);
    const d20 = v2.dot(v0);
    const d21 = v2.dot(v1);
    const denom = d00 * d11 - d01 * d01;
    if (denom === 0) return new V3d(NaN, NaN, NaN);
    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1 - v - w;
    return new V3d(u, v, w);
  }

  /** True iff the projection of `p` onto the plane lies inside the triangle. */
  contains(p: V3d): boolean {
    const b = this.barycentric(p);
    return b.x >= 0 && b.y >= 0 && b.z >= 0;
  }

  closestPoint(p: V3d): V3d {
    // clamp barycentric to triangle
    const b = this.barycentric(p);
    const u = Math.max(0, b.x), v = Math.max(0, b.y), w = Math.max(0, b.z);
    const s = u + v + w;
    if (s === 0) return this.p0;
    const inv = 1 / s;
    return this.p0.mul(u * inv).add(this.p1.mul(v * inv)).add(this.p2.mul(w * inv));
  }

  distance(p: V3d): number {
    return p.sub(this.closestPoint(p)).length();
  }

  transformed(t: Trafo3d): Triangle3d {
    return new Triangle3d(
      t.forward.transformPos(this.p0),
      t.forward.transformPos(this.p1),
      t.forward.transformPos(this.p2),
    );
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Triangle3d)) return false;
    return this.p0.equals(other.p0) && this.p1.equals(other.p1) && this.p2.equals(other.p2);
  }

  approxEqual(other: Triangle3d, eps: number): boolean {
    return this.p0.approxEqual(other.p0, eps) && this.p1.approxEqual(other.p1, eps) && this.p2.approxEqual(other.p2, eps);
  }

  getHashCode(): number {
    return combineHash(combineHash(this.p0.getHashCode(), this.p1.getHashCode()), this.p2.getHashCode());
  }

  toString(): string {
    return `Triangle3d(${this.p0.toString()}, ${this.p1.toString()}, ${this.p2.toString()})`;
  }
}
