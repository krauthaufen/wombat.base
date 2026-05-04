// Glyph tessellation pipeline using libtess for the polygon-with-
// holes interior fill.
//
// Pipeline:
//   1. Split segments into contours.
//   2. For each contour, build the CHORD POLYLINE.
//   3. libtess(contours, NONZERO) → flat interior triangles.
//   4. Per segment, classifyCurve → Loop-Blinn curve triangles.
//   5. Per contour, buildLineRibbonsForContour → AA ribbons on line
//      edges (with bisector miter at corners).

import { V2d } from "../../vector/v2d.js";
import type { PathSegment } from "./segment.js";
import type {
  RibbonTriangle, FaceTriangulation,
} from "./triangulate.js";
import {
  type CurveTriangle, classifyCurve, chordPoints,
} from "./loop-blinn.js";
import { tessellateContoursLibtess } from "./libtess-fill.js";

// ---------------------------------------------------------------------------
// Contour split + chord polyline
// ---------------------------------------------------------------------------

const CLOSE_EPS = 1e-9;
const NEAR = (a: V2d, b: V2d): boolean =>
  a === b
  || (Math.abs(a.x - b.x) < CLOSE_EPS && Math.abs(a.y - b.y) < CLOSE_EPS);

/**
 * Split a flat segment list into separate closed contours. Each
 * contour is the maximal run of segments where consecutive
 * `seg[i].end` and `seg[i+1].start` coincide. New subpaths (M
 * commands) break the chain because the new anchor doesn't match
 * the previous contour's last endpoint.
 */
export function splitContours(segments: ReadonlyArray<PathSegment>): PathSegment[][] {
  const out: PathSegment[][] = [];
  let cur: PathSegment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (cur.length === 0) cur.push(s);
    else if (NEAR(cur[cur.length - 1]!.end, s.start)) cur.push(s);
    else { out.push(cur); cur = [s]; }
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/**
 * Plain chord polyline (no detours). Used as the reference shape
 * for the inward-bulge inside test.
 */
export function chordPolyline(contour: ReadonlyArray<PathSegment>): V2d[] {
  const out: V2d[] = [];
  for (const seg of contour) {
    out.push(seg.start);
    for (const p of chordPoints(seg)) out.push(p);
  }
  return out;
}

/**
 * Signed winding of point `p` w.r.t. an oriented polyline (edges
 * implied between consecutive vertices, last-to-first closes). +1
 * each time an edge crosses the rightward ray from `p` going UP,
 * −1 going DOWN.
 */
function contourWinding(p: V2d, poly: ReadonlyArray<V2d>): number {
  let w = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i]!, b = poly[(i + 1) % n]!;
    if (a.y <= p.y) {
      if (b.y > p.y) {
        // Upward crossing.
        const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        if (cross > 0) w += 1;
      }
    } else if (b.y <= p.y) {
      // Downward crossing.
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (cross < 0) w -= 1;
    }
  }
  return w;
}

/**
 * Whether `p` lies inside the glyph's filled region under the
 * NONZERO rule, summed across every contour. Treats inner counter
 * contours (CW from the face's perspective) correctly — a control
 * vertex sitting in the hole returns FALSE because outer (+1) +
 * inner (−1) = 0 for that point.
 */
export function isInsideGlyphFill(p: V2d, chordPolys: ReadonlyArray<ReadonlyArray<V2d>>): boolean {
  let w = 0;
  for (const c of chordPolys) w += contourWinding(p, c);
  return w !== 0;
}

/**
 * Chord polyline with detour-via-control injected at every INWARD-
 * bulging curve sub-piece (control vertex inside the GLYPH FILL,
 * tested across all contours under NONZERO winding). This is the
 * polyline we feed to libtess for the interior fill: detouring
 * carves the curve-triangle bite out of the flat-fill polygon so
 * that the curve triangle's m=−1 discard subtracts that bite
 * cleanly. Outward-bulging curves (control outside fill) stay on
 * the chord — their curve triangle adds the bulge with m=+1.
 */
function fillPolyline(
  contour: ReadonlyArray<PathSegment>,
  allChordPolys: ReadonlyArray<ReadonlyArray<V2d>>,
): V2d[] {
  const out: V2d[] = [];
  for (const seg of contour) {
    out.push(seg.start);
    const breaks = chordPoints(seg);
    const subs = classifyCurve(seg);
    for (let i = 0; i < subs.length; i++) {
      const ct = subs[i]!;
      if (isInsideGlyphFill(ct.vertices[1]!, allChordPolys)) {
        out.push(ct.vertices[1]!);
      }
      if (i < breaks.length) out.push(breaks[i]!);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Line ribbons (per contour)
// ---------------------------------------------------------------------------

const MITER_MIN = 0.25; // 4× cap.

function unitNormalRight(a: V2d, b: V2d): V2d | undefined {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return undefined;
  return new V2d(dy / len, -dx / len);
}

function buildLineRibbonsForContour(contour: ReadonlyArray<PathSegment>): RibbonTriangle[] {
  // Collect per-segment endpoints + classification.
  type E = { src: V2d; dst: V2d; isLine: boolean; n: V2d | undefined };
  const edges: E[] = [];
  for (const seg of contour) {
    const n = unitNormalRight(seg.start, seg.end);
    edges.push({ src: seg.start, dst: seg.end, isLine: seg.kind === "line", n });
  }
  const N = edges.length;
  if (N === 0) return [];
  // Bisector at the START of edge i: between previous-line-edge's
  // outward normal and edge i's. If previous edge is a curve, fall
  // back to edge i's own normal (the curve's implicit handles its
  // own edge).
  const bisectorAt = (i: number): V2d => {
    const here = edges[i]!;
    if (!here.isLine || !here.n) return new V2d(0, 0);
    const prev = edges[(i - 1 + N) % N]!;
    if (!prev.isLine || !prev.n) return here.n;
    const sx = prev.n.x + here.n.x, sy = prev.n.y + here.n.y;
    const sLen = Math.hypot(sx, sy);
    if (sLen < 1e-9) return here.n;
    const dirX = sx / sLen, dirY = sy / sLen;
    const cosHalf = Math.max(dirX * here.n.x + dirY * here.n.y, MITER_MIN);
    return new V2d(dirX / cosHalf, dirY / cosHalf);
  };
  const out: RibbonTriangle[] = [];
  for (let i = 0; i < N; i++) {
    const e = edges[i]!;
    if (!e.isLine) continue;
    const bStart = bisectorAt(i);
    const bEnd = bisectorAt((i + 1) % N);
    const A = e.src, B = e.dst;
    const C = e.src, D = e.dst;
    out.push({ vertices: [A, B, D], outward: [bStart, bEnd, bEnd], isOuter: [0, 0, 1] });
    out.push({ vertices: [A, D, C], outward: [bStart, bEnd, bStart], isOuter: [0, 1, 1] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Tessellate a glyph (or arbitrary closed-path) `PathSegment[]` to a
 * `FaceTriangulation`:
 *
 *   - `flat`: interior libtess triangles (flat fill, α = 1).
 *   - `curves`: Loop-Blinn (start, control, end) triangles with klm
 *     texcoords. m is flipped (negated) for inward-bulging curves so
 *     the FS implicit `(k²−l)·m > 0` carves the bite out of the
 *     interior fill instead of adding it on the outside.
 *   - `ribbons`: per-line-edge AA parallelograms (kind = 3).
 */
export function triangulateGlyph(segments: ReadonlyArray<PathSegment>): FaceTriangulation {
  const contours = splitContours(segments);
  if (contours.length === 0) {
    return { flat: [], curves: [], ribbons: [] };
  }
  const chordPolys = contours.map(chordPolyline);
  const fillPolys = contours.map((c) => fillPolyline(c, chordPolys));
  const flat = tessellateContoursLibtess(fillPolys, "non-zero");
  const curves: CurveTriangle[] = [];
  for (const contour of contours) {
    for (const seg of contour) {
      for (const c of classifyCurve(seg)) {
        if (isInsideGlyphFill(c.vertices[1]!, chordPolys)) {
          curves.push({
            ...c,
            texcoords: [
              [c.texcoords[0]![0], c.texcoords[0]![1], -c.texcoords[0]![2]],
              [c.texcoords[1]![0], c.texcoords[1]![1], -c.texcoords[1]![2]],
              [c.texcoords[2]![0], c.texcoords[2]![1], -c.texcoords[2]![2]],
            ],
          });
        } else {
          curves.push(c);
        }
      }
    }
  }
  const ribbons: RibbonTriangle[] = [];
  for (const contour of contours) {
    ribbons.push(...buildLineRibbonsForContour(contour));
  }
  return { flat, curves, ribbons };
}
