// Polygon3d — array of V3d points (assumed approximately planar
// for area; degenerate-coplanar fallback uses dominant-axis projection).

import { V3d } from "../vector/v3d.js";
import { Box3d } from "../box/box3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";
import { combineHash } from "../internal/hash.js";

export class Polygon3d {
  readonly points: readonly V3d[];

  constructor(points: V3d[] | readonly V3d[]) {
    this.points = points.slice() as readonly V3d[];
  }

  /**
   * Unsigned area. Computed via the polygon's normal-vector area
   * formula `½ |Σ Pi × P(i+1)|`, which is exact for planar polygons
   * regardless of orientation.
   */
  area(): number {
    const n = this.points.length;
    if (n < 3) return 0;
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < n; i++) {
      const p = this.points[i]!;
      const q = this.points[(i + 1) % n]!;
      nx += p.y * q.z - p.z * q.y;
      ny += p.z * q.x - p.x * q.z;
      nz += p.x * q.y - p.y * q.x;
    }
    return 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
  }

  /** Mean of the vertices (not area-weighted in 3D). */
  centroid(): V3d {
    const n = this.points.length;
    if (n === 0) return new V3d(0, 0, 0);
    let cx = 0, cy = 0, cz = 0;
    for (const p of this.points) { cx += p.x; cy += p.y; cz += p.z; }
    const inv = 1 / n;
    return new V3d(cx * inv, cy * inv, cz * inv);
  }

  boundingBox(): Box3d { return Box3d.fromPoints(this.points); }

  transformed(t: Trafo3d): Polygon3d {
    return new Polygon3d(this.points.map(p => t.forward.transformPos(p)));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Polygon3d)) return false;
    if (this.points.length !== other.points.length) return false;
    for (let i = 0; i < this.points.length; i++) {
      if (!this.points[i]!.equals(other.points[i]!)) return false;
    }
    return true;
  }

  approxEqual(other: Polygon3d, eps: number): boolean {
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
    return `Polygon3d([${this.points.map(p => p.toString()).join(", ")}])`;
  }
}
