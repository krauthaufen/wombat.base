// Per band-triangle candidate list. For each band triangle we want
// the segments (curves / lines) of the glyph contour whose closest-
// point cell intersects the triangle. We collect them by computing
// the geometric distance from the triangle to each segment and
// keeping the K smallest. K=6 is plenty: even at sharp corners or
// where multiple contours meet, more than ~4 contour pieces being
// simultaneously closest to a single small band triangle is rare.
//
// "Distance from triangle to segment" for our purposes:
//   - For lines (kind=5 sentinel) and arc/cubic chord-treated
//     curves: exact triangle-to-segment-2D distance.
//   - For bezier2 curves: sample the curve into a fine polyline
//     (8 sub-segments) and compute triangle-to-polyline distance.
//     Chord deviation at N=8 is well below sub-pixel for typical
//     glyph curves, so the result is exact-equivalent.

import { V2d } from "../vector/v2d.js";
import type { CurveTriangle } from "../geometry/path/loop-blinn.js";

const BEZIER_SAMPLES = 8;

type Tri3 = readonly [V2d, V2d, V2d];

function dot2(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

function pointToSegmentDistSq(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 1e-18 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1 = (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);
  const d2 = (dx - ax) * (by - ay) - (dy - ay) * (bx - ax);
  const d3 = (ax - cx) * (dy - cy) - (ay - cy) * (dx - cx);
  const d4 = (bx - cx) * (dy - cy) - (by - cy) * (dx - cx);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}

function pointInTriangle(
  px: number, py: number, t: Tri3,
): boolean {
  const v0 = t[0], v1 = t[1], v2 = t[2];
  const d1 = (px - v1.x) * (v0.y - v1.y) - (v0.x - v1.x) * (py - v1.y);
  const d2 = (px - v2.x) * (v1.y - v2.y) - (v1.x - v2.x) * (py - v2.y);
  const d3 = (px - v0.x) * (v2.y - v0.y) - (v2.x - v0.x) * (py - v0.y);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function pointToTriangleDistSq(px: number, py: number, t: Tri3): number {
  if (pointInTriangle(px, py, t)) return 0;
  const a = t[0], b = t[1], c = t[2];
  const d1 = pointToSegmentDistSq(px, py, a.x, a.y, b.x, b.y);
  const d2 = pointToSegmentDistSq(px, py, b.x, b.y, c.x, c.y);
  const d3 = pointToSegmentDistSq(px, py, c.x, c.y, a.x, a.y);
  return Math.min(d1, d2, d3);
}

function segToSegDistSq(
  a: V2d, b: V2d, c: V2d, d: V2d,
): number {
  if (segmentsIntersect(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y)) return 0;
  return Math.min(
    pointToSegmentDistSq(a.x, a.y, c.x, c.y, d.x, d.y),
    pointToSegmentDistSq(b.x, b.y, c.x, c.y, d.x, d.y),
    pointToSegmentDistSq(c.x, c.y, a.x, a.y, b.x, b.y),
    pointToSegmentDistSq(d.x, d.y, a.x, a.y, b.x, b.y),
  );
}

function triToSegDistSq(tri: Tri3, p0: V2d, p1: V2d): number {
  // Closest pair = min over (3 tri edges × segment) and (2 seg
  // endpoints × triangle interior). The latter handles the case
  // where an endpoint sits inside the triangle (distance 0).
  const a = tri[0], b = tri[1], c = tri[2];
  let m = Math.min(
    segToSegDistSq(a, b, p0, p1),
    segToSegDistSq(b, c, p0, p1),
    segToSegDistSq(c, a, p0, p1),
  );
  if (m === 0) return 0;
  m = Math.min(m, pointToTriangleDistSq(p0.x, p0.y, tri));
  if (m === 0) return 0;
  m = Math.min(m, pointToTriangleDistSq(p1.x, p1.y, tri));
  return m;
}

function bezier2At(p0: V2d, p1: V2d, p2: V2d, t: number): V2d {
  const u = 1 - t;
  return new V2d(
    u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  );
}

export function triToCurveDistSq(tri: Tri3, c: CurveTriangle): number {
  const v0 = c.vertices[0]!;
  const v1 = c.vertices[1]!;
  const v2 = c.vertices[2]!;
  // Line sentinel (p1 == p0) and arc/cubic (kind != "bezier2") are
  // straight chords: a single segment from v0 to v2.
  const isLine =
    c.kind !== "bezier2" ||
    (v0.x === v1.x && v0.y === v1.y);
  if (isLine) return triToSegDistSq(tri, v0, v2);
  // Real bezier2: sample as a polyline of BEZIER_SAMPLES sub-edges.
  let prev = v0;
  let m = Infinity;
  for (let i = 1; i <= BEZIER_SAMPLES; i++) {
    const t = i / BEZIER_SAMPLES;
    const next = bezier2At(v0, v1, v2, t);
    const d = triToSegDistSq(tri, prev, next);
    if (d < m) m = d;
    if (m === 0) return 0;
    prev = next;
  }
  return m;
}

/**
 * All curve indices within `dist` of `tri` (inclusive). Indices are
 * LOCAL to `curves`. Used by `splitTrisByCandidateCount` — any curve
 * outside this radius can't be closest to any point in the tri
 * (since the tri is at most `halo` from the contour, and `dist`
 * is set ≥ halo, so a curve farther than `dist` is provably
 * dominated by the curve giving us our halo bound).
 */
export function curvesWithinDist(
  tri: Tri3,
  curves: ReadonlyArray<CurveTriangle>,
  dist: number,
): number[] {
  const distSq = dist * dist;
  const out: number[] = [];
  for (let i = 0; i < curves.length; i++) {
    if (triToCurveDistSq(tri, curves[i]!) <= distSq) out.push(i);
  }
  return out;
}

/**
 * Subdivide each input triangle (longest-edge bisection) until every
 * sub-triangle has ≤ K curves within `halo` distance — those are
 * its complete candidate set. Returns one entry per leaf
 * triangle: `{ vertices, candidates: padded-to-K-with-(-1) }`.
 *
 * Halo is the maximum distance from any band point to the contour
 * (= the band's offset radius), so any curve farther than halo from
 * the triangle can't be the closest from anywhere inside it. This
 * gives a provably-exhaustive candidate set: no fragment will ever
 * find a closer curve outside of `candidates`. Subdivision halts at
 * `maxDepth` even if K is exceeded — those rare cases truncate, but
 * shouldn't show in practice for any sensible glyph.
 */
export function splitTrisByCandidateCount(
  rootTris: ReadonlyArray<Tri3>,
  curves: ReadonlyArray<CurveTriangle>,
  halo: number,
  K: number,
  maxDepth = 8,
): { vertices: Tri3; candidates: number[] }[] {
  // Small slack on the radius: floating-point distance computations
  // can fall short of the true geometric distance by ε for
  // tangentially-touching cases. 1.0625 = halo · (1 + 1/16).
  const radius = halo * 1.0625;
  const out: { vertices: Tri3; candidates: number[] }[] = [];
  const stack: { tri: Tri3; depth: number }[] = rootTris.map(
    (t) => ({ tri: t, depth: 0 }),
  );
  while (stack.length > 0) {
    const { tri, depth } = stack.pop()!;
    const cands = curvesWithinDist(tri, curves, radius);
    if (cands.length <= K || depth >= maxDepth) {
      const padded: number[] = new Array(K);
      for (let i = 0; i < K; i++) padded[i] = i < cands.length ? cands[i]! : -1;
      out.push({ vertices: tri, candidates: padded });
      continue;
    }
    // Longest-edge bisection: keeps better aspect ratio than
    // centroid split and avoids degenerate slivers on iterated
    // subdivision.
    const a = tri[0], b = tri[1], c = tri[2];
    const dab = (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
    const dbc = (b.x - c.x) * (b.x - c.x) + (b.y - c.y) * (b.y - c.y);
    const dca = (c.x - a.x) * (c.x - a.x) + (c.y - a.y) * (c.y - a.y);
    let t1: Tri3, t2: Tri3;
    if (dab >= dbc && dab >= dca) {
      const m = new V2d((a.x + b.x) * 0.5, (a.y + b.y) * 0.5);
      t1 = [a, m, c]; t2 = [m, b, c];
    } else if (dbc >= dca) {
      const m = new V2d((b.x + c.x) * 0.5, (b.y + c.y) * 0.5);
      t1 = [b, m, a]; t2 = [m, c, a];
    } else {
      const m = new V2d((c.x + a.x) * 0.5, (c.y + a.y) * 0.5);
      t1 = [c, m, b]; t2 = [m, a, b];
    }
    stack.push({ tri: t1, depth: depth + 1 });
    stack.push({ tri: t2, depth: depth + 1 });
  }
  return out;
}

/**
 * Pick up to K curve indices whose distance to `tri` is smallest.
 * Returned array length is exactly K, padded with -1 when fewer
 * than K curves are within range. Indices are LOCAL to the
 * `curves` array (caller rebases to a global SSBO index by adding
 * its glyph's `triFirst + flatTriCount` offset).
 */
export function pickCandidates(
  tri: Tri3,
  curves: ReadonlyArray<CurveTriangle>,
  K: number,
): number[] {
  // Pair (curveIndex, distSq) and keep the K smallest by distSq.
  // For typical glyph sizes this is a few-hundred-element scan;
  // K is tiny so a simple insertion-sort beats a heap.
  const top: { idx: number; d2: number }[] = [];
  for (let i = 0; i < curves.length; i++) {
    const d2 = triToCurveDistSq(tri, curves[i]!);
    if (top.length < K) {
      top.push({ idx: i, d2 });
      // Insertion-bubble to keep top sorted ascending by d2.
      for (let j = top.length - 1; j > 0 && top[j]!.d2 < top[j - 1]!.d2; j--) {
        const tmp = top[j]!; top[j] = top[j - 1]!; top[j - 1] = tmp;
      }
    } else if (d2 < top[K - 1]!.d2) {
      top[K - 1] = { idx: i, d2 };
      for (let j = K - 1; j > 0 && top[j]!.d2 < top[j - 1]!.d2; j--) {
        const tmp = top[j]!; top[j] = top[j - 1]!; top[j - 1] = tmp;
      }
    }
  }
  const out: number[] = new Array(K);
  for (let i = 0; i < K; i++) out[i] = i < top.length ? top[i]!.idx : -1;
  return out;
}
