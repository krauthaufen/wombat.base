// separateCurveHulls — curve triangles that do not overlap.
//
// Loop-Blinn fills a curved edge with ONE triangle over it (start,
// control, end), whose fragment test keeps the side of that curve only.
// That is exact as long as the triangle covers nothing but its own
// curve's sliver: no other curve's triangle overlaps it and no other edge
// crosses it. Glyph outlines mostly are like that; general paths are not —
// a ring segment (an arc band, the stroke of an arc) has its outer arc's
// triangle reach down to its chord, deep under the inner arc's, and the
// region one triangle drops the other keeps.
//
// So curves are split (at t = 1/2) until every curve's hull is apart from
// every other curve's hull and from every other edge. A split hull lies in
// the old one and shrinks fast (the sliver of a curve goes with the square
// of its span), so a few rounds suffice; arcs over 90° are split first, as
// their hull grows without bound towards 180°.

import type { PathSegment } from "./segment.js";

type P = readonly [number, number];

/** The control polygon a curve's Loop-Blinn triangle spans (convex), or undefined for a line. */
function hullOf(s: PathSegment): P[] | undefined {
  switch (s.kind) {
    case "line": return undefined;
    case "bezier2": return [[s.start.x, s.start.y], [s.control.x, s.control.y], [s.end.x, s.end.y]];
    case "bezier3": return convex([[s.start.x, s.start.y], [s.control1.x, s.control1.y], [s.control2.x, s.control2.y], [s.end.x, s.end.y]]);
    case "arc": {
      // the tangents' intersection: start + a·d0 = end − b·d1
      const d0 = s.derivative(0), d1 = s.derivative(1);
      const det = d0.x * -d1.y - d0.y * -d1.x;
      if (Math.abs(det) < 1e-12) return undefined;
      const ex = s.end.x - s.start.x, ey = s.end.y - s.start.y;
      const a = (ex * -d1.y - ey * -d1.x) / det;
      return [[s.start.x, s.start.y], [s.start.x + a * d0.x, s.start.y + a * d0.y], [s.end.x, s.end.y]];
    }
  }
}

/** Convex hull (monotone chain) of a few points, counter-clockwise. */
function convex(ps: P[]): P[] {
  const pts = [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P[] = [], upper: P[] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]!; while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** `poly` pulled towards its centroid by a relative `f`: shared corners no longer touch. */
function shrink(poly: P[], f: number): P[] {
  let cx = 0, cy = 0;
  for (const p of poly) { cx += p[0]; cy += p[1]; }
  cx /= poly.length; cy /= poly.length;
  return poly.map((p) => [p[0] + (cx - p[0]) * f, p[1] + (cy - p[1]) * f] as const);
}

/** Separating-axis test of two convex polygons (a 2-point polygon is a segment). */
function overlap(a: P[], b: P[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
      const nx = q[1] - p[1], ny = p[0] - q[0];
      if (nx === 0 && ny === 0) continue;
      let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const v of a) { const d = v[0] * nx + v[1] * ny; amin = Math.min(amin, d); amax = Math.max(amax, d); }
      for (const v of b) { const d = v[0] * nx + v[1] * ny; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
      if (amax <= bmin || bmax <= amin) return false;
    }
  }
  return true;
}

function boxOf(poly: P[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return [x0, y0, x1, y1];
}

const SHRINK = 1e-6;

/** The vertex a curve triangle adds besides the ends (the hull's middle corner). */
function extraOf(s: PathSegment, hull: P[]): P | undefined {
  if (s.kind === "bezier2") return [s.control.x, s.control.y];
  if (s.kind === "arc") return hull[1];
  return undefined;                                  // cubics: several, covered by the overlap test
}
const chordOf = (s: PathSegment): [P, P] => [[s.start.x, s.start.y], [s.end.x, s.end.y]];
function distToSegment(p: P, [a, b]: [P, P]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function sizeOf(poly: P[]): number { const b = boxOf(poly); return Math.max(b[2] - b[0], b[3] - b[1], 1e-300); }

/**
 * `segments` with curves split until no curve's control polygon overlaps
 * another's or is crossed by another edge (each tested shrunk a little, so
 * neighbours sharing an end do not count). Lines are kept as they are; a
 * path that needs nothing comes back unchanged (the same array).
 */
export function separateCurveHulls(segments: ReadonlyArray<PathSegment>, maxRounds = 12): PathSegment[] {
  let segs = segments as PathSegment[];
  for (let round = 0; round < maxRounds; round++) {
    const hulls = segs.map((s) => {
      if (s.kind === "arc" && Math.abs(s.deltaAngle) > Math.PI / 2 + 1e-9) return "split" as const;
      const h = hullOf(s);
      return h === undefined ? undefined : shrink(h, SHRINK);
    });
    // what every segment occupies: its hull, or its chord for a line
    const shapes = segs.map((s, i) => {
      const h = hulls[i];
      return h === "split" ? undefined : (h ?? [[s.start.x, s.start.y], [s.end.x, s.end.y]] as P[]);
    });
    const boxes = shapes.map((sh) => (sh === undefined ? undefined : boxOf(sh)));
    const split = new Set<number>();
    for (let i = 0; i < segs.length; i++) {
      const hi = hulls[i];
      if (hi === "split") { split.add(i); continue; }
      if (hi === undefined) continue;               // a line or a degenerate curve: nothing to protect
      const bi = boxes[i]!;
      for (let j = 0; j < segs.length; j++) {
        if (j === i) continue;
        const sj = shapes[j], bj = boxes[j];
        if (sj === undefined || bj === undefined) continue;
        if (bj[0] >= bi[2] || bi[0] >= bj[2] || bj[1] >= bi[3] || bi[1] >= bj[3]) continue;
        // a line or chord shrunk too, so an edge ending at this curve's corner does not count
        const other = hulls[j] === undefined ? shrink(sj, SHRINK) : sj;
        if (overlap(hi, other)) { split.add(i); if (hulls[j] !== undefined) split.add(j); continue; }
        // the face polygon decides a curve's side by whether its extra vertex
        // (control, arc apex) is inside the chords: on another chord it is undecided
        const e = extraOf(segs[i]!, hi);
        if (e !== undefined && distToSegment(e, chordOf(segs[j]!)) < 1e-6 * sizeOf(hi)) {
          split.add(i); if (hulls[j] !== undefined) split.add(j);
        }
      }
    }
    if (split.size === 0) return segs;
    const next: PathSegment[] = [];
    segs.forEach((s, i) => {
      if (split.has(i) && s.kind !== "line") { const [a, b] = s.split(0.5); next.push(a as PathSegment, b as PathSegment); }
      else next.push(s);
    });
    segs = next;
  }
  return segs;
}
