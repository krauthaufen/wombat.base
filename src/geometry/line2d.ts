// Line2d — segment between two endpoints P0, P1.

import { V2d } from "../vector/v2d.js";
import { Trafo2d } from "../trafo/trafo2d.js";
import { combineHash } from "../internal/hash.js";

export class Line2d {
  readonly p0: V2d;
  readonly p1: V2d;

  constructor(p0: V2d, p1: V2d) {
    this.p0 = p0;
    this.p1 = p1;
  }

  direction(): V2d { return this.p1.sub(this.p0); }
  length(): number { return this.direction().length(); }

  closestPointToSegment(p: V2d): V2d {
    const d = this.direction();
    const ls = d.lengthSquared();
    if (ls === 0) return this.p0;
    let t = p.sub(this.p0).dot(d) / ls;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    return this.p0.add(d.mul(t));
  }

  closestPointToLine(p: V2d): V2d {
    const d = this.direction();
    const ls = d.lengthSquared();
    if (ls === 0) return this.p0;
    const t = p.sub(this.p0).dot(d) / ls;
    return this.p0.add(d.mul(t));
  }

  closestPoint(p: V2d): V2d { return this.closestPointToSegment(p); }
  distance(p: V2d): number { return p.sub(this.closestPointToSegment(p)).length(); }

  /**
   * Signed distance from `p` to the infinite line. Positive on the
   * left of the directed line P0→P1 (CCW normal `(-dy, dx)`), zero on
   * the line, negative on the right.
   */
  signedDistance(p: V2d): number {
    const d = this.direction();
    const len = d.length();
    if (len === 0) return p.sub(this.p0).length();
    return ((p.x - this.p0.x) * (-d.y) + (p.y - this.p0.y) * d.x) / len;
  }

  transformed(t: Trafo2d): Line2d {
    return new Line2d(t.transformPos(this.p0), t.transformPos(this.p1));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Line2d)) return false;
    return this.p0.equals(other.p0) && this.p1.equals(other.p1);
  }

  approxEqual(other: Line2d, eps: number): boolean {
    return this.p0.approxEqual(other.p0, eps) && this.p1.approxEqual(other.p1, eps);
  }

  getHashCode(): number {
    return combineHash(this.p0.getHashCode(), this.p1.getHashCode());
  }

  toString(): string {
    return `Line2d(${this.p0.toString()}, ${this.p1.toString()})`;
  }
}
