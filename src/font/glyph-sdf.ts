// Per-glyph SDF segment data for fragment-shader analytic AA.
//
// Each glyph contributes a flat array of `SdfSegment`s — one entry
// per line segment + one per quadratic bezier sub-piece. Cubic
// beziers are subdivided to quadratics; arcs are sampled to a small
// number of cubic-style approximating beziers (TODO; for now we just
// include their chord polyline as a sequence of line segments — fine
// for test glyphs that don't use arcs).
//
// Each segment carries the unit `fillNormal` pointing into the fill
// region (precomputed via `isInsideGlyphFill` test on a sample point
// nudged off the segment midpoint). The fragment shader uses
// `sign(dot(p - closestPt, fillNormal))` to recover the signed
// distance for AA.

import { V2d } from "../vector/v2d.js";
import type { PathSegment } from "../geometry/path/segment.js";
import {
  Bezier2Segment, LineSegment, Bezier3Segment,
} from "../geometry/path/segment.js";
import {
  splitContours, chordPolyline, isInsideGlyphFill,
} from "../geometry/path/triangulate-glyph.js";

/** Discriminator passed to the fragment shader for per-segment SDF. */
export const SDF_KIND_LINE    = 0;
export const SDF_KIND_BEZIER2 = 1;

/**
 * One SDF segment ready for upload to the GPU.
 *
 * Fragment-shader layout (3 × vec4 = 48 bytes per segment):
 *   `vec4(start.xy, end.xy)`
 *   `vec4(control.xy, fillNormal.xy)`     (control unused for lines)
 *   `vec4(kind, 0, 0, 0)`
 */
export interface SdfSegment {
  readonly kind: number;
  readonly start: V2d;
  readonly end: V2d;
  /** For line segments, equal to `start` (unused by FS). */
  readonly control: V2d;
  /** Unit perpendicular to the segment, pointing into the fill. */
  readonly fillNormal: V2d;
}

/** Per-glyph SDF data. */
export interface GlyphSdf {
  readonly segments: ReadonlyArray<SdfSegment>;
  /** Tight axis-aligned bbox in glyph (em-scaled) coords. */
  readonly bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** Number of f32 elements per `SdfSegment` in the GPU buffer. */
export const SDF_FLOATS_PER_SEGMENT = 12;

// --- Helpers ----------------------------------------------------------------

/**
 * Subdivide a cubic bezier into N quadratic approximations. We use
 * the simple midpoint-control approximation: for each split, take
 * the control point as the average of the two cubic control vectors
 * — accurate enough for AA at glyph scales.
 */
function cubicToQuads(b: Bezier3Segment, n = 4): Bezier2Segment[] {
  const out: Bezier2Segment[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const tm = (t0 + t1) * 0.5;
    const p0 = b.eval(t0);
    const p2 = b.eval(t1);
    const pm = b.eval(tm);
    const d0 = b.derivative(t0);
    const d2 = b.derivative(t1);
    // Place the quadratic control at the intersection of the
    // tangent lines at p0 and p2; falls back to pm * 2 - (p0+p2)/2
    // if the tangents are parallel.
    const cross = d0.x * d2.y - d0.y * d2.x;
    let p1: V2d;
    if (Math.abs(cross) < 1e-10) {
      p1 = new V2d(2 * pm.x - 0.5 * (p0.x + p2.x), 2 * pm.y - 0.5 * (p0.y + p2.y));
    } else {
      const t = ((p2.x - p0.x) * d2.y - (p2.y - p0.y) * d2.x) / cross;
      p1 = new V2d(p0.x + d0.x * t, p0.y + d0.y * t);
    }
    out.push(new Bezier2Segment(p0, p1, p2));
  }
  return out;
}

/** Compute unit perpendicular to (a, b), pointing into the fill. */
function fillNormalForChord(
  a: V2d, b: V2d, allChordPolys: ReadonlyArray<ReadonlyArray<V2d>>,
): V2d {
  const ex = b.x - a.x, ey = b.y - a.y;
  const elen = Math.hypot(ex, ey);
  if (elen < 1e-12) return new V2d(1, 0);
  const lx = -ey / elen, ly = ex / elen; // left perp
  const eps = elen * 1e-3;
  const tx = (a.x + b.x) * 0.5 + lx * eps;
  const ty = (a.y + b.y) * 0.5 + ly * eps;
  if (isInsideGlyphFill(new V2d(tx, ty), allChordPolys)) {
    return new V2d(lx, ly);
  }
  return new V2d(-lx, -ly);
}

/** Compute fill-side normal for a quadratic bezier segment. We
 *  evaluate the curve+derivative at t=0.5, take the perpendicular,
 *  and test which side is inside the fill. */
function fillNormalForBezier2(
  b: Bezier2Segment, allChordPolys: ReadonlyArray<ReadonlyArray<V2d>>,
): V2d {
  const m = b.eval(0.5);
  const d = b.derivative(0.5);
  const len = Math.hypot(d.x, d.y);
  if (len < 1e-12) return fillNormalForChord(b.start, b.end, allChordPolys);
  const lx = -d.y / len, ly = d.x / len; // left perp
  const eps = Math.max(Math.hypot(b.end.x - b.start.x, b.end.y - b.start.y) * 1e-3, 1e-9);
  const tx = m.x + lx * eps;
  const ty = m.y + ly * eps;
  if (isInsideGlyphFill(new V2d(tx, ty), allChordPolys)) {
    return new V2d(lx, ly);
  }
  return new V2d(-lx, -ly);
}

// --- Public entry -----------------------------------------------------------

/**
 * Build SDF segment data for a single glyph (path).
 */
export function buildGlyphSdf(
  pathSegments: ReadonlyArray<PathSegment>,
): GlyphSdf {
  const contours = splitContours(pathSegments);
  if (contours.length === 0) {
    return { segments: [], bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } };
  }
  const chordPolys = contours.map(chordPolyline);

  const segments: SdfSegment[] = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const expand = (p: V2d): void => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };

  for (const contour of contours) {
    for (const seg of contour) {
      if (seg instanceof LineSegment) {
        expand(seg.start); expand(seg.end);
        segments.push({
          kind: SDF_KIND_LINE,
          start: seg.start,
          end: seg.end,
          control: seg.start,
          fillNormal: fillNormalForChord(seg.start, seg.end, chordPolys),
        });
      } else if (seg instanceof Bezier2Segment) {
        expand(seg.start); expand(seg.control); expand(seg.end);
        segments.push({
          kind: SDF_KIND_BEZIER2,
          start: seg.start,
          end: seg.end,
          control: seg.control,
          fillNormal: fillNormalForBezier2(seg, chordPolys),
        });
      } else if (seg instanceof Bezier3Segment) {
        const quads = cubicToQuads(seg);
        for (const q of quads) {
          expand(q.start); expand(q.control); expand(q.end);
          segments.push({
            kind: SDF_KIND_BEZIER2,
            start: q.start,
            end: q.end,
            control: q.control,
            fillNormal: fillNormalForBezier2(q, chordPolys),
          });
        }
      } else {
        // Arc — sample as a chord polyline. TODO: proper arc SDF.
        const N = 16;
        let prev = seg.eval(0);
        expand(prev);
        for (let i = 1; i <= N; i++) {
          const t = i / N;
          const p = seg.eval(t);
          expand(p);
          segments.push({
            kind: SDF_KIND_LINE,
            start: prev,
            end: p,
            control: prev,
            fillNormal: fillNormalForChord(prev, p, chordPolys),
          });
          prev = p;
        }
      }
    }
  }

  if (!isFinite(minX)) {
    return { segments: [], bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } };
  }
  return {
    segments,
    bbox: { x0: minX, y0: minY, x1: maxX, y1: maxY },
  };
}

/**
 * Pack an array of SDF segments into a flat Float32Array suitable
 * for upload as a WebGPU storage buffer. Layout is
 * `SDF_FLOATS_PER_SEGMENT` floats per segment:
 *
 *   [ start.x, start.y, end.x, end.y,
 *     control.x, control.y, fillNormal.x, fillNormal.y,
 *     kind, 0, 0, 0 ]
 */
export function packSdfSegments(segments: ReadonlyArray<SdfSegment>): Float32Array {
  const out = new Float32Array(segments.length * SDF_FLOATS_PER_SEGMENT);
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    const o = i * SDF_FLOATS_PER_SEGMENT;
    out[o + 0]  = s.start.x;
    out[o + 1]  = s.start.y;
    out[o + 2]  = s.end.x;
    out[o + 3]  = s.end.y;
    out[o + 4]  = s.control.x;
    out[o + 5]  = s.control.y;
    out[o + 6]  = s.fillNormal.x;
    out[o + 7]  = s.fillNormal.y;
    out[o + 8]  = s.kind;
    // 9..11 padding
  }
  return out;
}
