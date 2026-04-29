// Ray2d — origin + direction in 2D.
//
// Every `intersection(...)` method returns the **ray parameter `t`**
// (a single `number`) of the first hit, or `undefined` on miss.
// "First hit" means the smallest `t >= 0`. For closed shapes (box,
// circle, triangle, polygon, quad), an origin already inside the
// shape yields the exit `t`. Use `ray.pointAt(t)` to recover the
// hit point.

import { V2d } from "../vector/v2d.js";
import { Trafo2d } from "../trafo/trafo2d.js";
import { Box2d } from "../box/box2d.js";
import { Circle2d } from "./circle2d.js";
import { Triangle2d } from "./triangle2d.js";
import { Line2d } from "./line2d.js";
import { Polygon2d } from "./polygon2d.js";
import { Quad2d } from "./quad2d.js";
import { combineHash } from "../internal/hash.js";

type RayHittable2d =
  | Ray2d | Box2d | Circle2d | Triangle2d
  | Line2d | Polygon2d | Quad2d;

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

  /**
   * Closest point on the **infinite line** through this ray to `p`.
   * Use {@link closestPointOnRay} for the half-infinite (t >= 0) case.
   */
  closestPoint(p: V2d): V2d {
    const t = p.sub(this.origin).dot(this.direction) / this.direction.lengthSquared();
    return this.pointAt(t);
  }

  /** Closest point on the half-infinite ray (t >= 0). */
  closestPointOnRay(p: V2d): V2d {
    let t = p.sub(this.origin).dot(this.direction) / this.direction.lengthSquared();
    if (t < 0) t = 0;
    return this.pointAt(t);
  }

  distance(p: V2d): number {
    return p.sub(this.closestPoint(p)).length();
  }

  intersects(other: RayHittable2d): boolean {
    return this.intersection(other) !== undefined;
  }

  /**
   * Returns the ray parameter `t` of the first hit (smallest `t >= 0`),
   * or `undefined` on miss.
   *
   * - Ray2d: solves `o1 + t1 d1 = o2 + t2 d2`; undefined if parallel
   *   or if the hit on this ray has `t1 < 0`.
   * - Box2d: slab method.
   * - Circle2d: ray–disc boundary.
   * - Triangle2d / Polygon2d / Quad2d: Cyrus-Beck clipping; for an
   *   origin inside the shape the exit `t` is returned.
   * - Line2d: parametric, with hit clamped to `t1 >= 0` along the
   *   ray and `t2 ∈ [0, 1]` along the segment.
   */
  intersection(other: RayHittable2d): number | undefined {
    if (other instanceof Ray2d) return rayRayIntersect(this, other);
    if (other instanceof Box2d) return rayBoxIntersect(this, other);
    if (other instanceof Circle2d) return rayCircleIntersect(this, other);
    if (other instanceof Triangle2d) {
      return rayConvexPolyIntersect(this, [other.p0, other.p1, other.p2]);
    }
    if (other instanceof Line2d) return rayLineIntersect(this, other);
    if (other instanceof Polygon2d) {
      return rayConvexPolyIntersect(this, other.points as readonly V2d[]);
    }
    if (other instanceof Quad2d) {
      return rayConvexPolyIntersect(this, [other.p0, other.p1, other.p2, other.p3]);
    }
    return undefined;
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

/** First non-negative t along [tMin, tMax], or undefined if both negative. */
function firstNonNegative(tMin: number, tMax: number): number | undefined {
  if (tMax < 0) return undefined;
  return tMin >= 0 ? tMin : tMax;
}

function rayRayIntersect(a: Ray2d, b: Ray2d): number | undefined {
  const det = a.direction.x * b.direction.y - a.direction.y * b.direction.x;
  if (Math.abs(det) < 1e-30) return undefined;
  const dx = b.origin.x - a.origin.x;
  const dy = b.origin.y - a.origin.y;
  const t1 = (dx * b.direction.y - dy * b.direction.x) / det;
  if (t1 < 0) return undefined;
  // also reject if hit is behind the other ray (t2 < 0)
  const t2 = (dx * a.direction.y - dy * a.direction.x) / det;
  if (t2 < 0) return undefined;
  return t1;
}

function rayBoxIntersect(ray: Ray2d, box: Box2d): number | undefined {
  const invX = 1 / ray.direction.x;
  const invY = 1 / ray.direction.y;
  const t1x = (box.min.x - ray.origin.x) * invX;
  const t2x = (box.max.x - ray.origin.x) * invX;
  const t1y = (box.min.y - ray.origin.y) * invY;
  const t2y = (box.max.y - ray.origin.y) * invY;
  const tMin = Math.max(Math.min(t1x, t2x), Math.min(t1y, t2y));
  const tMax = Math.min(Math.max(t1x, t2x), Math.max(t1y, t2y));
  if (tMin > tMax) return undefined;
  return firstNonNegative(tMin, tMax);
}

function rayCircleIntersect(ray: Ray2d, circle: Circle2d): number | undefined {
  const oc = ray.origin.sub(circle.center);
  const a = ray.direction.lengthSquared();
  const b = 2 * oc.dot(ray.direction);
  const c = oc.lengthSquared() - circle.radius * circle.radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return undefined;
  const s = Math.sqrt(disc);
  const inv2a = 1 / (2 * a);
  const t1 = (-b - s) * inv2a;
  const t2 = (-b + s) * inv2a;
  return firstNonNegative(Math.min(t1, t2), Math.max(t1, t2));
}

function rayLineIntersect(ray: Ray2d, line: Line2d): number | undefined {
  const d1 = ray.direction;
  const d2 = line.direction();
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 1e-30) return undefined;
  const dx = line.p0.x - ray.origin.x;
  const dy = line.p0.y - ray.origin.y;
  const t1 = (dx * d2.y - dy * d2.x) / det;
  const t2 = (dx * d1.y - dy * d1.x) / det;
  if (t1 < 0) return undefined;
  if (t2 < 0 || t2 > 1) return undefined;
  return t1;
}

/**
 * Cyrus-Beck clipping of a ray against a (convex) polygon's edges.
 * Reference: Cyrus & Beck, "Generalized two- and three-dimensional
 * clipping", Computers & Graphics 3 (1978).
 *
 * Returns the first non-negative ray-t at which the ray enters or
 * exits the polygon. For non-convex polygons the result reflects
 * the convex hull of the boundary tests and may be misleading.
 */
function rayConvexPolyIntersect(ray: Ray2d, points: readonly V2d[]): number | undefined {
  const n = points.length;
  if (n < 3) return undefined;
  // signed area to detect winding; CCW => outward normal is (dy, -dx)
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % n]!;
    signedArea += p.x * q.y - q.x * p.y;
  }
  const sign = signedArea >= 0 ? 1 : -1;
  let tEnter = -Infinity;
  let tExit = Infinity;
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % n]!;
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const nx = ey * sign;
    const ny = -ex * sign;
    const denom = nx * ray.direction.x + ny * ray.direction.y;
    const num = nx * (p.x - ray.origin.x) + ny * (p.y - ray.origin.y);
    if (Math.abs(denom) < 1e-30) {
      if (num < 0) return undefined;
      continue;
    }
    const t = num / denom;
    if (denom < 0) {
      if (t > tEnter) tEnter = t;
    } else {
      if (t < tExit) tExit = t;
    }
    if (tEnter > tExit) return undefined;
  }
  if (!isFinite(tEnter) || !isFinite(tExit)) return undefined;
  return firstNonNegative(tEnter, tExit);
}
