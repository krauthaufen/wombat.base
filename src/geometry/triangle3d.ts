// Triangle3d — three vertices P0, P1, P2 in 3D.

import { V3d } from "../vector/v3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";
import { Box3d } from "../box/box3d.js";
import { Line3d } from "./line3d.js";
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

  /**
   * SAT-based triangle-AABB overlap (Akenine-Möller, "Fast 3D
   * Triangle-Box Overlap Testing"). 13 separating-axis tests:
   * 3 box face normals, 1 triangle normal, 9 edge cross-products.
   */
  intersectsBox(box: Box3d): boolean {
    const c = box.center();
    const e = box.size().mul(0.5);
    // translate triangle so box is centered at origin
    const v0 = this.p0.sub(c);
    const v1 = this.p1.sub(c);
    const v2 = this.p2.sub(c);
    // edges
    const f0 = v1.sub(v0);
    const f1 = v2.sub(v1);
    const f2 = v0.sub(v2);

    const axisTest = (ax: number, ay: number, az: number, fx: number, fy: number, fz: number): boolean => {
      // axis = (ax, ay, az) (already a cross product result)
      const p0 = v0.x * ax + v0.y * ay + v0.z * az;
      const p1 = v1.x * ax + v1.y * ay + v1.z * az;
      const p2 = v2.x * ax + v2.y * ay + v2.z * az;
      const r = e.x * Math.abs(fx) + e.y * Math.abs(fy) + e.z * Math.abs(fz);
      const mn = Math.min(p0, p1, p2);
      const mx = Math.max(p0, p1, p2);
      return !(mn > r || mx < -r);
    };

    // 9 edge cross-products: u_i × f_j, where u_0 = (1,0,0), etc.
    // axis = (0, -fz, fy), components for r are derived from box axes.
    // For axis u0 × f: (0, -fz, fy)
    if (!axisTest(0, -f0.z, f0.y, 0, f0.z, f0.y)) return false;
    if (!axisTest(0, -f1.z, f1.y, 0, f1.z, f1.y)) return false;
    if (!axisTest(0, -f2.z, f2.y, 0, f2.z, f2.y)) return false;
    // u1 × f: (fz, 0, -fx)
    if (!axisTest(f0.z, 0, -f0.x, f0.z, 0, f0.x)) return false;
    if (!axisTest(f1.z, 0, -f1.x, f1.z, 0, f1.x)) return false;
    if (!axisTest(f2.z, 0, -f2.x, f2.z, 0, f2.x)) return false;
    // u2 × f: (-fy, fx, 0)
    if (!axisTest(-f0.y, f0.x, 0, f0.y, f0.x, 0)) return false;
    if (!axisTest(-f1.y, f1.x, 0, f1.y, f1.x, 0)) return false;
    if (!axisTest(-f2.y, f2.x, 0, f2.y, f2.x, 0)) return false;

    // 3 box face normals: bounds of triangle along x, y, z must overlap [-e, e].
    if (Math.min(v0.x, v1.x, v2.x) > e.x || Math.max(v0.x, v1.x, v2.x) < -e.x) return false;
    if (Math.min(v0.y, v1.y, v2.y) > e.y || Math.max(v0.y, v1.y, v2.y) < -e.y) return false;
    if (Math.min(v0.z, v1.z, v2.z) > e.z || Math.max(v0.z, v1.z, v2.z) < -e.z) return false;

    // triangle normal axis
    const n = f0.cross(f1);
    const d = n.dot(v0);
    const r = e.x * Math.abs(n.x) + e.y * Math.abs(n.y) + e.z * Math.abs(n.z);
    if (Math.abs(d) > r) return false;

    return true;
  }

  /**
   * Triangle-triangle overlap (Möller's tri-tri test). Returns true if
   * the closed triangles share at least one point. Coplanar pairs are
   * resolved by reduction to 2D edge/contains tests.
   */
  intersects(other: Triangle3d): boolean {
    return triTriIntersect(this, other, false) !== null;
  }

  /**
   * Returns the line segment along which two triangles overlap, or
   * undefined when they are disjoint or only share a single point.
   * For coplanar / partial overlaps, returns the chord across the
   * overlap region as an `(a, b)` segment.
   */
  intersection(other: Triangle3d): Line3d | undefined {
    const seg = triTriIntersect(this, other, true);
    if (seg === null) return undefined;
    if (seg === "point") return undefined;
    if (seg.a.approxEqual(seg.b, 1e-15)) return undefined;
    return new Line3d(seg.a, seg.b);
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

// ---------------------------------------------------------------------------
// Möller "A Fast Triangle-Triangle Intersection Test" — minimal port.
// Returns either a segment {a,b}, the literal "point" for 1-point contacts,
// or null for disjoint pairs. The coplanar case is handled by 2D edge
// crossings + point-in-triangle tests.
// ---------------------------------------------------------------------------

type TriSeg = { a: V3d; b: V3d } | "point" | null;

function triTriIntersect(t1: Triangle3d, t2: Triangle3d, _wantSegment: boolean): TriSeg {
  const EPS = 1e-12;
  // Compute plane of t1
  const e1a = t1.p1.sub(t1.p0);
  const e1b = t1.p2.sub(t1.p0);
  const n1 = e1a.cross(e1b);
  const d1 = -n1.dot(t1.p0);
  // distances of t2 vertices to plane of t1
  let du0 = n1.dot(t2.p0) + d1;
  let du1 = n1.dot(t2.p1) + d1;
  let du2 = n1.dot(t2.p2) + d1;
  if (Math.abs(du0) < EPS) du0 = 0;
  if (Math.abs(du1) < EPS) du1 = 0;
  if (Math.abs(du2) < EPS) du2 = 0;
  const du0du1 = du0 * du1;
  const du0du2 = du0 * du2;
  if (du0du1 > 0 && du0du2 > 0) return null;

  const e2a = t2.p1.sub(t2.p0);
  const e2b = t2.p2.sub(t2.p0);
  const n2 = e2a.cross(e2b);
  const d2 = -n2.dot(t2.p0);
  let dv0 = n2.dot(t1.p0) + d2;
  let dv1 = n2.dot(t1.p1) + d2;
  let dv2 = n2.dot(t1.p2) + d2;
  if (Math.abs(dv0) < EPS) dv0 = 0;
  if (Math.abs(dv1) < EPS) dv1 = 0;
  if (Math.abs(dv2) < EPS) dv2 = 0;
  const dv0dv1 = dv0 * dv1;
  const dv0dv2 = dv0 * dv2;
  if (dv0dv1 > 0 && dv0dv2 > 0) return null;

  // Direction of intersection line of the two planes
  const D = n1.cross(n2);
  const dls = D.lengthSquared();
  if (dls < EPS) {
    // Coplanar: test in 2D by projecting along the dominant axis of n1.
    if (dv0 !== 0 || dv1 !== 0 || dv2 !== 0) return null; // parallel but offset
    return coplanarTriTri(t1, t2, n1);
  }

  // pick largest |D| component for projection
  const ax = Math.abs(D.x), ay = Math.abs(D.y), az = Math.abs(D.z);
  let idx = 0;
  if (ay > ax && ay >= az) idx = 1;
  else if (az > ax && az > ay) idx = 2;
  const proj = (p: V3d): number => idx === 0 ? p.x : idx === 1 ? p.y : p.z;
  const vp0 = proj(t1.p0), vp1 = proj(t1.p1), vp2 = proj(t1.p2);
  const up0 = proj(t2.p0), up1 = proj(t2.p1), up2 = proj(t2.p2);

  const isect = (vv0: number, vv1: number, vv2: number, d0: number, d1_: number, d2_: number,
                 P0: V3d, P1: V3d, P2: V3d): [number, number, V3d, V3d] | null => {
    // Two of d0,d1_,d2_ have the same sign; isolate the odd one as the apex.
    let a0: number, b0: number, c0: number;
    let A: V3d, B: V3d, C: V3d;
    if (d0 * d1_ > 0) { a0 = vv2; b0 = vv0; c0 = vv1; A = P2; B = P0; C = P1; }
    else if (d0 * d2_ > 0) { a0 = vv1; b0 = vv0; c0 = vv2; A = P1; B = P0; C = P2; }
    else if (d1_ * d2_ > 0 || d0 !== 0) { a0 = vv0; b0 = vv1; c0 = vv2; A = P0; B = P1; C = P2; }
    else if (d1_ !== 0) { a0 = vv1; b0 = vv0; c0 = vv2; A = P1; B = P0; C = P2; }
    else if (d2_ !== 0) { a0 = vv2; b0 = vv0; c0 = vv1; A = P2; B = P0; C = P1; }
    else {
      // all zero — coplanar handled earlier
      return null;
    }
    // re-fetch the corresponding distances after relabeling
    const dA = (A === P0 ? d0 : A === P1 ? d1_ : d2_);
    const dB = (B === P0 ? d0 : B === P1 ? d1_ : d2_);
    const dC = (C === P0 ? d0 : C === P1 ? d1_ : d2_);
    const tB = a0 + (b0 - a0) * dA / (dA - dB);
    const tC = a0 + (c0 - a0) * dA / (dA - dC);
    const PB = A.add(B.sub(A).mul(dA / (dA - dB)));
    const PC = A.add(C.sub(A).mul(dA / (dA - dC)));
    return [tB, tC, PB, PC];
  };

  const r1 = isect(vp0, vp1, vp2, dv0, dv1, dv2, t1.p0, t1.p1, t1.p2);
  const r2 = isect(up0, up1, up2, du0, du1, du2, t2.p0, t2.p1, t2.p2);
  if (!r1 || !r2) return null;
  let [a1, b1, A1, B1] = r1;
  let [a2, b2, A2, B2] = r2;
  if (a1 > b1) { [a1, b1] = [b1, a1]; [A1, B1] = [B1, A1]; }
  if (a2 > b2) { [a2, b2] = [b2, a2]; [A2, B2] = [B2, A2]; }
  if (b1 < a2 || b2 < a1) return null;
  // overlap interval: [max(a1,a2), min(b1,b2)] on the common line
  const lo = Math.max(a1, a2);
  const hi = Math.min(b1, b2);
  // Pick endpoints in 3D corresponding to lo and hi.
  const pickPoint = (val: number, aV: number, bV: number, A: V3d, B: V3d): V3d => {
    if (Math.abs(bV - aV) < EPS) return A;
    const t = (val - aV) / (bV - aV);
    return A.add(B.sub(A).mul(t));
  };
  const p = pickPoint(lo, a1, b1, A1, B1);
  const q = pickPoint(hi, a1, b1, A1, B1);
  if (Math.abs(hi - lo) < EPS) return "point";
  return { a: p, b: q };
}

function coplanarTriTri(t1: Triangle3d, t2: Triangle3d, n: V3d): TriSeg {
  // Project onto the dominant plane.
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  let i0 = 0, i1 = 1;
  if (ax >= ay && ax >= az) { i0 = 1; i1 = 2; }
  else if (ay >= az) { i0 = 0; i1 = 2; }
  else { i0 = 0; i1 = 1; }
  const pick = (p: V3d, k: number): number => k === 0 ? p.x : k === 1 ? p.y : p.z;
  const c2 = (p: V3d): [number, number] => [pick(p, i0), pick(p, i1)];
  const A = [c2(t1.p0), c2(t1.p1), c2(t1.p2)];
  const B = [c2(t2.p0), c2(t2.p1), c2(t2.p2)];
  const sign = (px: number, py: number, ax_: number, ay_: number, bx: number, by: number): number =>
    (px - bx) * (ay_ - by) - (ax_ - bx) * (py - by);
  const inTri = (P: [number, number], T: [number, number][]): boolean => {
    const d1 = sign(P[0], P[1], T[0]![0], T[0]![1], T[1]![0], T[1]![1]);
    const d2 = sign(P[0], P[1], T[1]![0], T[1]![1], T[2]![0], T[2]![1]);
    const d3 = sign(P[0], P[1], T[2]![0], T[2]![1], T[0]![0], T[0]![1]);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  };
  for (let i = 0; i < 3; i++) if (inTri(A[i]!, B)) return { a: i === 0 ? t1.p0 : i === 1 ? t1.p1 : t1.p2, b: i === 0 ? t1.p0 : i === 1 ? t1.p1 : t1.p2 };
  for (let i = 0; i < 3; i++) if (inTri(B[i]!, A)) return { a: i === 0 ? t2.p0 : i === 1 ? t2.p1 : t2.p2, b: i === 0 ? t2.p0 : i === 1 ? t2.p1 : t2.p2 };
  // Edge-edge crossings
  for (let i = 0; i < 3; i++) {
    const a1 = A[i]!, a2 = A[(i + 1) % 3]!;
    for (let j = 0; j < 3; j++) {
      const b1 = B[j]!, b2 = B[(j + 1) % 3]!;
      const r = (a2[0] - a1[0]); const s_ = (a2[1] - a1[1]);
      const u = (b2[0] - b1[0]); const v = (b2[1] - b1[1]);
      const denom = r * v - s_ * u;
      if (denom === 0) continue;
      const tt = ((b1[0] - a1[0]) * v - (b1[1] - a1[1]) * u) / denom;
      const uu = ((b1[0] - a1[0]) * s_ - (b1[1] - a1[1]) * r) / denom;
      if (tt >= 0 && tt <= 1 && uu >= 0 && uu <= 1) {
        // Lift back to 3D using parameter tt on edge (i) of t1
        const p1 = i === 0 ? t1.p0 : i === 1 ? t1.p1 : t1.p2;
        const p2 = i === 0 ? t1.p1 : i === 1 ? t1.p2 : t1.p0;
        const pt = p1.add(p2.sub(p1).mul(tt));
        return { a: pt, b: pt };
      }
    }
  }
  return null;
}
