// IIntersectable — uniform ray-intersection interface used by the BVH
// and by the geometric pickThrough fall-through. Each implementation
// reports the first hit (smallest t in [tmin, tmax]) along with the
// world-space point and outward unit normal.

import { V3d } from "../vector/v3d.js";
import { Box3d } from "../box/box3d.js";
import { Sphere3d } from "./sphere3d.js";
import { Triangle3d } from "./triangle3d.js";
import { Quad3d } from "./quad3d.js";
import { Ray3d } from "./ray3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";

export interface IIntersectHit {
  /** Ray parameter (t) of the hit. */
  readonly t: number;
  /** World-space hit point. */
  readonly point: V3d;
  /** Outward surface normal at the hit (unit-length). */
  readonly normal: V3d;
}

export interface IIntersectable {
  readonly boundingBox: Box3d;
  /**
   * Returns the first hit (smallest t in [tmin, tmax]) or `undefined` on miss.
   * Implementations must NOT mutate the ray; tmin / tmax are inclusive.
   */
  intersects(ray: Ray3d, tmin: number, tmax: number): IIntersectHit | undefined;
}

// ---------- box (slab method with axis tracking for normal) ----------

/**
 * Slab ray/AABB. Returns { tNear, tFar, axisNear, axisFar } where axisN
 * is 0/1/2 (x/y/z) and indicates which slab produced tNear / tFar.
 * No hit -> undefined.
 */
export function rayBoxSlab(
  ray: Ray3d, box: Box3d, tmin: number, tmax: number,
): { tNear: number; tFar: number; axisNear: number; axisFar: number } | undefined {
  const ox = ray.origin.x, oy = ray.origin.y, oz = ray.origin.z;
  const dx = ray.direction.x, dy = ray.direction.y, dz = ray.direction.z;
  const bmin = box.min, bmax = box.max;

  let tNear = -Infinity;
  let tFar = Infinity;
  let axisNear = -1;
  let axisFar = -1;

  // x
  {
    const inv = 1 / dx;
    let t1 = (bmin.x - ox) * inv;
    let t2 = (bmax.x - ox) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tNear) { tNear = t1; axisNear = 0; }
    if (t2 < tFar) { tFar = t2; axisFar = 0; }
    if (tNear > tFar) return undefined;
  }
  // y
  {
    const inv = 1 / dy;
    let t1 = (bmin.y - oy) * inv;
    let t2 = (bmax.y - oy) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tNear) { tNear = t1; axisNear = 1; }
    if (t2 < tFar) { tFar = t2; axisFar = 1; }
    if (tNear > tFar) return undefined;
  }
  // z
  {
    const inv = 1 / dz;
    let t1 = (bmin.z - oz) * inv;
    let t2 = (bmax.z - oz) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tNear) { tNear = t1; axisNear = 2; }
    if (t2 < tFar) { tFar = t2; axisFar = 2; }
    if (tNear > tFar) return undefined;
  }

  // Clip against [tmin, tmax]. If both are outside, miss.
  if (tFar < tmin || tNear > tmax) return undefined;
  return { tNear, tFar, axisNear, axisFar };
}

/**
 * Outward face normal for a box hit. `entry=true` means the ray is
 * entering on that slab (entry face's outward normal opposes the
 * direction component); `entry=false` means exit (origin inside, normal
 * points the same way as the direction component).
 */
function boxNormalForAxis(axis: number, dir: V3d, entry: boolean): V3d {
  const sx = dir.x > 0 ? -1 : 1, sy = dir.y > 0 ? -1 : 1, sz = dir.z > 0 ? -1 : 1;
  const flip = entry ? 1 : -1;
  if (axis === 0) return new V3d(sx * flip, 0, 0);
  if (axis === 1) return new V3d(0, sy * flip, 0);
  return new V3d(0, 0, sz * flip);
}

class BoxIntersectable implements IIntersectable {
  readonly boundingBox: Box3d;
  constructor(b: Box3d) { this.boundingBox = b; }
  intersects(ray: Ray3d, tmin: number, tmax: number): IIntersectHit | undefined {
    const slab = rayBoxSlab(ray, this.boundingBox, tmin, tmax);
    if (!slab) return undefined;
    // Origin-inside heuristic: tNear < 0 means the entry is behind the
    // origin, so report the forward-exit hit. Otherwise report the entry,
    // and reject if the entry is outside [tmin, tmax].
    const inside = slab.tNear < 0 && slab.tFar > 0;
    let t: number, axis: number, entry: boolean;
    if (inside) {
      if (slab.tFar < tmin || slab.tFar > tmax) return undefined;
      t = slab.tFar; axis = slab.axisFar; entry = false;
    } else {
      if (slab.tNear < tmin || slab.tNear > tmax) return undefined;
      t = slab.tNear; axis = slab.axisNear; entry = true;
    }
    const point = ray.pointAt(t);
    const normal = boxNormalForAxis(axis, ray.direction, entry);
    return { t, point, normal };
  }
}

// ---------- sphere ----------

class SphereIntersectable implements IIntersectable {
  readonly boundingBox: Box3d;
  private readonly sphere: Sphere3d;
  constructor(s: Sphere3d) {
    this.sphere = s;
    this.boundingBox = Box3d.fromCenterRadius(s.center, s.radius);
  }
  intersects(ray: Ray3d, tmin: number, tmax: number): IIntersectHit | undefined {
    const oc = ray.origin.sub(this.sphere.center);
    const a = ray.direction.lengthSquared();
    const b = 2 * oc.dot(ray.direction);
    const c = oc.lengthSquared() - this.sphere.radius * this.sphere.radius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return undefined;
    const s = Math.sqrt(disc);
    const inv2a = 1 / (2 * a);
    const t0 = (-b - s) * inv2a;
    const t1 = (-b + s) * inv2a;
    const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
    // Origin-inside (lo < 0 < hi) → report the exit; else report entry.
    const inside = lo < 0 && hi > 0;
    let t: number;
    if (inside) {
      if (hi < tmin || hi > tmax) return undefined;
      t = hi;
    } else {
      if (lo < tmin || lo > tmax) return undefined;
      t = lo;
    }
    const point = ray.pointAt(t);
    const normal = point.sub(this.sphere.center).normalize();
    return { t, point, normal };
  }
}

// ---------- triangle (Möller–Trumbore) ----------

interface TriHit { t: number; }

function rayTriangleMT(ray: Ray3d, p0: V3d, p1: V3d, p2: V3d, tmin: number, tmax: number): TriHit | undefined {
  const EPS = 1e-12;
  const e1 = p1.sub(p0);
  const e2 = p2.sub(p0);
  const pvec = ray.direction.cross(e2);
  const det = e1.dot(pvec);
  if (Math.abs(det) < EPS) return undefined;
  const invDet = 1 / det;
  const tvec = ray.origin.sub(p0);
  const u = tvec.dot(pvec) * invDet;
  if (u < 0 || u > 1) return undefined;
  const qvec = tvec.cross(e1);
  const v = ray.direction.dot(qvec) * invDet;
  if (v < 0 || u + v > 1) return undefined;
  const t = e2.dot(qvec) * invDet;
  if (t < tmin || t > tmax) return undefined;
  return { t };
}

function triNormalFacing(p0: V3d, p1: V3d, p2: V3d, rayDir: V3d): V3d {
  const n = p1.sub(p0).cross(p2.sub(p0)).normalize();
  return n.dot(rayDir) > 0 ? n.neg() : n;
}

class TriangleIntersectable implements IIntersectable {
  readonly boundingBox: Box3d;
  private readonly tri: Triangle3d;
  constructor(t: Triangle3d) {
    this.tri = t;
    this.boundingBox = Box3d.fromPoints([t.p0, t.p1, t.p2]);
  }
  intersects(ray: Ray3d, tmin: number, tmax: number): IIntersectHit | undefined {
    const h = rayTriangleMT(ray, this.tri.p0, this.tri.p1, this.tri.p2, tmin, tmax);
    if (!h) return undefined;
    const point = ray.pointAt(h.t);
    const normal = triNormalFacing(this.tri.p0, this.tri.p1, this.tri.p2, ray.direction);
    return { t: h.t, point, normal };
  }
}

// ---------- quad (split into two triangles) ----------

class QuadIntersectable implements IIntersectable {
  readonly boundingBox: Box3d;
  private readonly q: Quad3d;
  constructor(q: Quad3d) {
    this.q = q;
    this.boundingBox = Box3d.fromPoints([q.p0, q.p1, q.p2, q.p3]);
  }
  intersects(ray: Ray3d, tmin: number, tmax: number): IIntersectHit | undefined {
    const a = rayTriangleMT(ray, this.q.p0, this.q.p1, this.q.p2, tmin, tmax);
    const b = rayTriangleMT(ray, this.q.p0, this.q.p2, this.q.p3, tmin, tmax);
    let t: number;
    let p0: V3d, p1: V3d, p2: V3d;
    if (a && b) {
      if (a.t <= b.t) { t = a.t; p0 = this.q.p0; p1 = this.q.p1; p2 = this.q.p2; }
      else { t = b.t; p0 = this.q.p0; p1 = this.q.p2; p2 = this.q.p3; }
    } else if (a) {
      t = a.t; p0 = this.q.p0; p1 = this.q.p1; p2 = this.q.p2;
    } else if (b) {
      t = b.t; p0 = this.q.p0; p1 = this.q.p2; p2 = this.q.p3;
    } else {
      return undefined;
    }
    return { t, point: ray.pointAt(t), normal: triNormalFacing(p0, p1, p2, ray.direction) };
  }
}

// ---------- triangle array ----------

class TrianglesIntersectable implements IIntersectable {
  readonly boundingBox: Box3d;
  private readonly tris: ReadonlyArray<Triangle3d>;
  constructor(tris: ReadonlyArray<Triangle3d>) {
    this.tris = tris;
    if (tris.length === 0) {
      this.boundingBox = Box3d.empty;
    } else {
      const pts: V3d[] = [];
      for (const t of tris) { pts.push(t.p0); pts.push(t.p1); pts.push(t.p2); }
      this.boundingBox = Box3d.fromPoints(pts);
    }
  }
  intersects(ray: Ray3d, tmin: number, tmax: number): IIntersectHit | undefined {
    let bestT = Infinity;
    let bestTri = -1;
    let upper = tmax;
    for (let i = 0; i < this.tris.length; i++) {
      const tr = this.tris[i]!;
      const h = rayTriangleMT(ray, tr.p0, tr.p1, tr.p2, tmin, upper);
      if (h && h.t < bestT) { bestT = h.t; bestTri = i; upper = h.t; }
    }
    if (bestTri < 0) return undefined;
    const tr = this.tris[bestTri]!;
    return {
      t: bestT,
      point: ray.pointAt(bestT),
      normal: triNormalFacing(tr.p0, tr.p1, tr.p2, ray.direction),
    };
  }
}

// ---------- transformed wrapper ----------

class TransformedIntersectable implements IIntersectable {
  readonly boundingBox: Box3d;
  private readonly inner: IIntersectable;
  private readonly trafo: Trafo3d;
  constructor(inner: IIntersectable, trafo: Trafo3d) {
    this.inner = inner;
    this.trafo = trafo;
    // World AABB = AABB of the 8 transformed corners of the local AABB.
    const b = inner.boundingBox;
    if (b.isEmpty()) {
      this.boundingBox = Box3d.empty;
    } else {
      const fwd = trafo.forward;
      const corners: V3d[] = [
        new V3d(b.min.x, b.min.y, b.min.z),
        new V3d(b.max.x, b.min.y, b.min.z),
        new V3d(b.min.x, b.max.y, b.min.z),
        new V3d(b.max.x, b.max.y, b.min.z),
        new V3d(b.min.x, b.min.y, b.max.z),
        new V3d(b.max.x, b.min.y, b.max.z),
        new V3d(b.min.x, b.max.y, b.max.z),
        new V3d(b.max.x, b.max.y, b.max.z),
      ];
      this.boundingBox = Box3d.fromPoints(corners.map(c => fwd.transformPos(c)));
    }
  }
  intersects(ray: Ray3d, tmin: number, tmax: number): IIntersectHit | undefined {
    // Ray into local space. Direction is NOT renormalised, so the local
    // t equals the world t along the same path (linear transforms only).
    // For non-uniform scale this is still consistent: t_local indexes the
    // same world point as t_world because we use the transformed direction.
    const localOrigin = this.trafo.backward.transformPos(ray.origin);
    const localDir = this.trafo.backward.transformDir(ray.direction);
    const localRay = new Ray3d(localOrigin, localDir);
    const hit = this.inner.intersects(localRay, tmin, tmax);
    if (!hit) return undefined;
    const point = this.trafo.forward.transformPos(hit.point);
    // Normal transforms by inverse-transpose of the linear part. We have
    // backward (= inverse), so transposed-transformDir of backward gives
    // (M^-1)^T applied to the local normal — which is what we want.
    const normal = transposedTransformDir(this.trafo.backward, hit.normal).normalize();
    return { t: hit.t, point, normal };
  }
}

/**
 * Computes Mᵀ · v (treating v as a direction; ignores translation).
 * Used to apply (M⁻¹)ᵀ to a normal when M⁻¹ is available as `backward`.
 */
function transposedTransformDir(m: { _data: Float64Array }, v: V3d): V3d {
  const a = m._data;
  const x = v.x, y = v.y, z = v.z;
  // Row-major M44d: index [row*4+col]. Transpose swaps row/col, so
  // (Mᵀ · v).i = sum_j M[j*4+i] * v[j].
  return new V3d(
    a[0]!  * x + a[4]! * y + a[8]!  * z,
    a[1]!  * x + a[5]! * y + a[9]!  * z,
    a[2]!  * x + a[6]! * y + a[10]! * z,
  );
}

// ---------- public namespace ----------

export const Intersectable = {
  box(b: Box3d): IIntersectable { return new BoxIntersectable(b); },
  sphere(s: Sphere3d): IIntersectable { return new SphereIntersectable(s); },
  triangle(t: Triangle3d): IIntersectable { return new TriangleIntersectable(t); },
  quad(q: Quad3d): IIntersectable { return new QuadIntersectable(q); },
  triangles(tris: ReadonlyArray<Triangle3d>): IIntersectable { return new TrianglesIntersectable(tris); },
  transformed(inner: IIntersectable, trafo: Trafo3d): IIntersectable { return new TransformedIntersectable(inner, trafo); },
} as const;
