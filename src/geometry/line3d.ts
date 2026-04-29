// Line3d — segment between two endpoints P0, P1.

import { V3d } from "../vector/v3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";
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
