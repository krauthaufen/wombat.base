// Polygon2d — array of V2d points (open polyline closed by an
// implicit edge from last back to first for area / contains).

import { V2d } from "../vector/v2d.js";
import { Box2d } from "../box/box2d.js";
import { Trafo2d } from "../trafo/trafo2d.js";
import { combineHash } from "../internal/hash.js";

export class Polygon2d {
  readonly points: readonly V2d[];

  constructor(points: V2d[] | readonly V2d[]) {
    this.points = points.slice() as readonly V2d[];
  }

  /** Signed area, positive for CCW vertex order. */
  signedArea(): number {
    const n = this.points.length;
    if (n < 3) return 0;
    let a = 0;
    for (let i = 0; i < n; i++) {
      const p = this.points[i]!;
      const q = this.points[(i + 1) % n]!;
      a += p.x * q.y - q.x * p.y;
    }
    return 0.5 * a;
  }

  /** Unsigned area. */
  area(): number { return Math.abs(this.signedArea()); }

  /** Area-weighted centroid. Falls back to point average for degenerate polys. */
  centroid(): V2d {
    const n = this.points.length;
    if (n === 0) return new V2d(0, 0);
    let aSum = 0, cx = 0, cy = 0;
    for (let i = 0; i < n; i++) {
      const p = this.points[i]!;
      const q = this.points[(i + 1) % n]!;
      const cross = p.x * q.y - q.x * p.y;
      aSum += cross;
      cx += (p.x + q.x) * cross;
      cy += (p.y + q.y) * cross;
    }
    if (aSum === 0) {
      // degenerate — average vertices
      let mx = 0, my = 0;
      for (const p of this.points) { mx += p.x; my += p.y; }
      return new V2d(mx / n, my / n);
    }
    const inv = 1 / (3 * aSum);
    return new V2d(cx * inv, cy * inv);
  }

  winding(): "ccw" | "cw" | "degenerate" {
    const a = this.signedArea();
    if (a > 0) return "ccw";
    if (a < 0) return "cw";
    return "degenerate";
  }

  /** Even-odd point-in-polygon test. */
  contains(p: V2d): boolean {
    const n = this.points.length;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const pi = this.points[i]!;
      const pj = this.points[j]!;
      const intersect = ((pi.y > p.y) !== (pj.y > p.y))
        && (p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y) + pi.x);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  boundingBox(): Box2d { return Box2d.fromPoints(this.points); }

  transformed(t: Trafo2d): Polygon2d {
    return new Polygon2d(this.points.map(p => t.transformPos(p)));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Polygon2d)) return false;
    if (this.points.length !== other.points.length) return false;
    for (let i = 0; i < this.points.length; i++) {
      if (!this.points[i]!.equals(other.points[i]!)) return false;
    }
    return true;
  }

  approxEqual(other: Polygon2d, eps: number): boolean {
    if (this.points.length !== other.points.length) return false;
    for (let i = 0; i < this.points.length; i++) {
      if (!this.points[i]!.approxEqual(other.points[i]!, eps)) return false;
    }
    return true;
  }

  getHashCode(): number {
    let h = 0;
    for (const p of this.points) h = combineHash(h, p.getHashCode());
    return h;
  }

  toString(): string {
    return `Polygon2d([${this.points.map(p => p.toString()).join(", ")}])`;
  }
}
