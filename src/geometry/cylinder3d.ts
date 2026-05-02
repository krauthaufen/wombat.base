// Cylinder3d — finite cylinder defined by two endpoints (axis caps) and a radius.
//
// `p0` and `p1` are the centres of the two end caps; `radius` is the
// (orthogonal) distance from the axis to the side surface. Mirrors the
// F# `Aardvark.Base.Cylinder3d` shape used by the dom intersectable.

import { V3d } from "../vector/v3d.js";
import { Box3d } from "../box/box3d.js";
import { combineHash, hashNumber } from "../internal/hash.js";

export class Cylinder3d {
  readonly p0: V3d;
  readonly p1: V3d;
  readonly radius: number;

  constructor(p0: V3d, p1: V3d, radius: number) {
    this.p0 = p0;
    this.p1 = p1;
    this.radius = radius;
  }

  /** Axis vector p1 - p0 (NOT normalised). */
  axis(): V3d { return this.p1.sub(this.p0); }

  /** Length of the cylinder along its axis. */
  height(): number { return this.p1.sub(this.p0).length(); }

  /**
   * Conservative axis-aligned bounding box: covers both end-cap discs
   * by adding `radius` along each axis. This is loose for slanted axes
   * but cheap and correct (encloses the entire cylinder).
   */
  get boundingBox(): Box3d {
    const r = this.radius;
    const minx = Math.min(this.p0.x, this.p1.x) - r;
    const miny = Math.min(this.p0.y, this.p1.y) - r;
    const minz = Math.min(this.p0.z, this.p1.z) - r;
    const maxx = Math.max(this.p0.x, this.p1.x) + r;
    const maxy = Math.max(this.p0.y, this.p1.y) + r;
    const maxz = Math.max(this.p0.z, this.p1.z) + r;
    return new Box3d(minx, miny, minz, maxx, maxy, maxz);
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Cylinder3d)) return false;
    return this.p0.equals(other.p0) && this.p1.equals(other.p1) && this.radius === other.radius;
  }

  approxEqual(other: Cylinder3d, eps: number): boolean {
    return this.p0.approxEqual(other.p0, eps)
        && this.p1.approxEqual(other.p1, eps)
        && Math.abs(this.radius - other.radius) <= eps;
  }

  getHashCode(): number {
    return combineHash(combineHash(this.p0.getHashCode(), this.p1.getHashCode()), hashNumber(this.radius));
  }

  toString(): string {
    return `Cylinder3d(p0=${this.p0.toString()}, p1=${this.p1.toString()}, r=${this.radius})`;
  }
}
