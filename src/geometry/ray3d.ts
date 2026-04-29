// Ray3d — origin + direction. Direction is unit-length by convention
// (factories normalise) but not enforced; some intersection routines
// rely on |direction| = 1, others (slab box test) parameterise by
// direction-scaled t.
//
// Every `intersection(...)` method returns the **ray parameter `t`**
// (a single `number`) of the first hit, or `undefined` on miss.
// "First hit" means: the smallest `t >= 0`. For volumes (sphere,
// box), if the ray's origin is inside the volume, the entry `t` is
// negative and the exit `t` is returned instead. Use `ray.pointAt(t)`
// to recover the hit point.

import { V3d } from "../vector/v3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";
import { Sphere3d } from "./sphere3d.js";
import { Triangle3d } from "./triangle3d.js";
import { Box3d } from "../box/box3d.js";
import { Plane3d } from "./plane3d.js";
import { Quad3d } from "./quad3d.js";
import { Circle3d } from "./circle3d.js";
import { Polygon3d } from "./polygon3d.js";
import { Line3d } from "./line3d.js";
import { combineHash } from "../internal/hash.js";

type RayHittable3d =
  | Sphere3d | Triangle3d | Box3d | Plane3d
  | Quad3d | Circle3d | Polygon3d;

export class Ray3d {
  readonly origin: V3d;
  readonly direction: V3d;

  constructor(origin: V3d, direction: V3d) {
    this.origin = origin;
    this.direction = direction;
  }

  /** Ray from `from` to `to`, unit direction. */
  static fromPoints(from: V3d, to: V3d): Ray3d {
    return new Ray3d(from, to.sub(from).normalize());
  }

  pointAt(t: number): V3d {
    return this.origin.add(this.direction.mul(t));
  }

  /**
   * Closest point on the **infinite line** through this ray to `p`.
   * Allows negative `t` (i.e. behind the origin). Use
   * {@link closestPointOnRay} to clamp to the half-infinite ray.
   */
  closestPoint(p: V3d): V3d {
    const t = p.sub(this.origin).dot(this.direction) / this.direction.lengthSquared();
    return this.pointAt(t);
  }

  /**
   * Closest point on the **half-infinite ray** (t >= 0) to `p`. Points
   * "behind" the ray's origin clamp to the origin itself.
   */
  closestPointOnRay(p: V3d): V3d {
    let t = p.sub(this.origin).dot(this.direction) / this.direction.lengthSquared();
    if (t < 0) t = 0;
    return this.pointAt(t);
  }

  /** Unsigned distance from the (infinite) line of this ray to `p`. */
  distance(p: V3d): number {
    return p.sub(this.closestPoint(p)).length();
  }

  /**
   * Returns the ray parameter `t` of the first hit (smallest `t >= 0`),
   * or `undefined` on miss. For volumes (Sphere3d, Box3d), an origin
   * inside the volume yields the exit `t` (since the entry is
   * behind, with `t < 0`).
   *
   * - Sphere3d: analytic quadratic.
   * - Triangle3d: Möller–Trumbore.
   * - Box3d: slab method.
   * - Plane3d: parametric, undefined when parallel.
   * - Quad3d: nearest hit across the two diagonal triangles.
   * - Circle3d: hit on the supporting plane within the disk.
   * - Polygon3d: nearest hit across a fan-triangulation around `points[0]`.
   */
  intersection(other: RayHittable3d): number | undefined {
    if (other instanceof Sphere3d) return rayIntersectSphere(this, other);
    if (other instanceof Triangle3d) return rayIntersectTriangle(this, other);
    if (other instanceof Box3d) return rayIntersectBox(this, other);
    if (other instanceof Plane3d) return rayIntersectPlane(this, other);
    if (other instanceof Quad3d) return rayIntersectQuad(this, other);
    if (other instanceof Circle3d) return rayIntersectCircle(this, other);
    if (other instanceof Polygon3d) return rayIntersectPolygon(this, other);
    return undefined;
  }

  intersects(other: RayHittable3d): boolean {
    return this.intersection(other) !== undefined;
  }

  /**
   * Closest pair between this ray (t1 >= 0) and a line segment
   * (t2 in [0, 1]). Standard skew-lines minimisation; for parallel
   * configurations any consistent closest pair is returned.
   */
  closestPoints(other: Line3d): { p1: V3d; p2: V3d; t1: number; t2: number; distance: number } {
    const d1 = this.direction;
    const d2 = other.direction();
    const r = this.origin.sub(other.p0);
    const a = d1.lengthSquared();
    const e = d2.lengthSquared();
    const b = d1.dot(d2);
    const c = d1.dot(r);
    const f = d2.dot(r);
    const EPS = 1e-30;
    let t1: number, t2: number;
    if (a <= EPS && e <= EPS) {
      t1 = 0; t2 = 0;
    } else if (a <= EPS) {
      t1 = 0;
      t2 = clamp01(f / e);
    } else if (e <= EPS) {
      t2 = 0;
      t1 = Math.max(0, -c / a);
    } else {
      const denom = a * e - b * b;
      if (Math.abs(denom) < EPS) {
        // parallel: choose t1 = 0
        t1 = 0;
        t2 = clamp01(f / e);
      } else {
        t1 = (b * f - c * e) / denom;
        t2 = (a * f - b * c) / denom;
      }
      // clamp t2 to [0, 1] then recompute t1
      if (t2 < 0) {
        t2 = 0;
        t1 = -c / a;
      } else if (t2 > 1) {
        t2 = 1;
        t1 = (b - c) / a;
      }
      // clamp t1 to [0, ∞) then recompute t2
      if (t1 < 0) {
        t1 = 0;
        t2 = clamp01(f / e);
      }
    }
    const p1 = this.origin.add(d1.mul(t1));
    const p2 = other.p0.add(d2.mul(t2));
    return { p1, p2, t1, t2, distance: p1.distance(p2) };
  }

  transformed(t: Trafo3d): Ray3d {
    return new Ray3d(t.forward.transformPos(this.origin), t.forward.transformDir(this.direction));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Ray3d)) return false;
    return this.origin.equals(other.origin) && this.direction.equals(other.direction);
  }

  approxEqual(other: Ray3d, eps: number): boolean {
    return this.origin.approxEqual(other.origin, eps) && this.direction.approxEqual(other.direction, eps);
  }

  getHashCode(): number {
    return combineHash(this.origin.getHashCode(), this.direction.getHashCode());
  }

  toString(): string {
    return `Ray3d(o=${this.origin.toString()}, d=${this.direction.toString()})`;
  }
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** First non-negative t along [tMin, tMax], or undefined if both are negative. */
function firstNonNegative(tMin: number, tMax: number): number | undefined {
  if (tMax < 0) return undefined;
  return tMin >= 0 ? tMin : tMax;
}

function rayIntersectSphere(ray: Ray3d, sphere: Sphere3d): number | undefined {
  const oc = ray.origin.sub(sphere.center);
  const a = ray.direction.lengthSquared();
  const b = 2 * oc.dot(ray.direction);
  const c = oc.lengthSquared() - sphere.radius * sphere.radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return undefined;
  const s = Math.sqrt(disc);
  const inv2a = 1 / (2 * a);
  const t1 = (-b - s) * inv2a;
  const t2 = (-b + s) * inv2a;
  return firstNonNegative(Math.min(t1, t2), Math.max(t1, t2));
}

function rayIntersectTriangle(ray: Ray3d, tri: Triangle3d): number | undefined {
  // Möller–Trumbore.
  const EPS = 1e-12;
  const e1 = tri.p1.sub(tri.p0);
  const e2 = tri.p2.sub(tri.p0);
  const pvec = ray.direction.cross(e2);
  const det = e1.dot(pvec);
  if (Math.abs(det) < EPS) return undefined;
  const invDet = 1 / det;
  const tvec = ray.origin.sub(tri.p0);
  const u = tvec.dot(pvec) * invDet;
  if (u < 0 || u > 1) return undefined;
  const qvec = tvec.cross(e1);
  const v = ray.direction.dot(qvec) * invDet;
  if (v < 0 || u + v > 1) return undefined;
  const t = e2.dot(qvec) * invDet;
  if (t < 0) return undefined;
  return t;
}

function rayIntersectBox(ray: Ray3d, box: Box3d): number | undefined {
  const inv = new V3d(1 / ray.direction.x, 1 / ray.direction.y, 1 / ray.direction.z);
  const t1x = (box.min.x - ray.origin.x) * inv.x;
  const t2x = (box.max.x - ray.origin.x) * inv.x;
  const t1y = (box.min.y - ray.origin.y) * inv.y;
  const t2y = (box.max.y - ray.origin.y) * inv.y;
  const t1z = (box.min.z - ray.origin.z) * inv.z;
  const t2z = (box.max.z - ray.origin.z) * inv.z;
  const tMin = Math.max(Math.min(t1x, t2x), Math.min(t1y, t2y), Math.min(t1z, t2z));
  const tMax = Math.min(Math.max(t1x, t2x), Math.max(t1y, t2y), Math.max(t1z, t2z));
  if (tMin > tMax) return undefined;
  return firstNonNegative(tMin, tMax);
}

function rayIntersectPlane(ray: Ray3d, plane: Plane3d): number | undefined {
  const denom = plane.normal.dot(ray.direction);
  if (Math.abs(denom) < 1e-30) return undefined;
  const t = (plane.distance - plane.normal.dot(ray.origin)) / denom;
  if (t < 0) return undefined;
  return t;
}

function rayIntersectQuad(ray: Ray3d, quad: Quad3d): number | undefined {
  const tA = rayIntersectTriangle(ray, new Triangle3d(quad.p0, quad.p1, quad.p2));
  const tB = rayIntersectTriangle(ray, new Triangle3d(quad.p0, quad.p2, quad.p3));
  if (tA !== undefined && tB !== undefined) return Math.min(tA, tB);
  return tA ?? tB;
}

function rayIntersectCircle(ray: Ray3d, circle: Circle3d): number | undefined {
  const denom = circle.normal.dot(ray.direction);
  if (Math.abs(denom) < 1e-30) return undefined;
  const t = circle.normal.dot(circle.center.sub(ray.origin)) / denom;
  if (t < 0) return undefined;
  const point = ray.pointAt(t);
  if (point.sub(circle.center).lengthSquared() > circle.radius * circle.radius) return undefined;
  return t;
}

function rayIntersectPolygon(ray: Ray3d, polygon: Polygon3d): number | undefined {
  const pts = polygon.points;
  const n = pts.length;
  if (n < 3) return undefined;
  let best: number | undefined;
  const p0 = pts[0]!;
  for (let i = 1; i < n - 1; i++) {
    const tri = new Triangle3d(p0, pts[i]!, pts[i + 1]!);
    const t = rayIntersectTriangle(ray, tri);
    if (t !== undefined && (best === undefined || t < best)) best = t;
  }
  return best;
}
