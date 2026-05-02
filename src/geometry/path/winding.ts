// Winding-number resolution per face via ray-casting against the
// planar graph's edges.
//
// Why ray-casting (not pure BFS over half-edges): a topological
// annulus (two separate contours, one nested inside the other)
// produces FOUR faces in the DCEL — two per connected component —
// and pure BFS can't propagate winding across the disconnect. A
// horizontal-ray crossing count from any interior point handles
// this uniformly: the winding number is exactly the sum of signed
// crossings, regardless of how the planar graph splits into
// components.
//
// Sign convention: for a segment crossing the +x ray from `p`,
//   +1 if the segment is going UPWARD in y (dy/dt > 0)
//   −1 if DOWNWARD (dy/dt < 0)
// A CCW-traversed bounded contour gives +1 to interior points; CW
// gives −1; nested contours add.
//
// Per-segment-kind closed forms find the y-coordinate roots:
//   line    — single linear equation in t
//   bezier2 — quadratic in t (realRootsOfQuadratic)
//   bezier3 — cubic in t   (realRootsOfCubic)
//   arc     — Weierstrass substitution `t = tan(θ/2)` reduces
//             A·cos θ + B·sin θ = C to a quadratic in t

import { V2d } from "../../vector/v2d.js";
import {
  type PathSegment,
  LineSegment, Bezier2Segment, Bezier3Segment, ArcSegment,
} from "./segment.js";
import {
  realRootsOfQuadratic, realRootsOfCubic,
} from "../../numerics/polynomial.js";
import type {
  Face, FaceExtractionResult, HalfEdge,
} from "./face-extract.js";
import type { PlanarGraph } from "./planar-graph.js";
import { type FillRule, FillRules } from "./fill-rule.js";

const T_EPS = 1e-9;

// ---------------------------------------------------------------------------
// Per-segment ray-crossing count
// ---------------------------------------------------------------------------

function lineCrossings(p: V2d, l: LineSegment): number {
  const dy = l.end.y - l.start.y;
  if (Math.abs(dy) < 1e-15) return 0;
  const t = (p.y - l.start.y) / dy;
  if (t < T_EPS || t > 1 - T_EPS) return 0;
  const x = l.start.x + t * (l.end.x - l.start.x);
  if (x <= p.x) return 0;
  return dy > 0 ? 1 : -1;
}

function bez2Crossings(p: V2d, b: Bezier2Segment): number {
  // y(t) = y0 + (2(y1-y0))t + (y0 - 2y1 + y2) t²
  const ay = b.start.y - 2 * b.control.y + b.end.y;
  const by = 2 * (b.control.y - b.start.y);
  const cy = b.start.y - p.y;
  const [t0, t1] = realRootsOfQuadratic(ay, by, cy);
  let count = 0;
  for (const t of [t0, t1]) {
    if (!Number.isFinite(t) || t < T_EPS || t > 1 - T_EPS) continue;
    // x(t)
    const u = 1 - t;
    const x = u * u * b.start.x + 2 * u * t * b.control.x + t * t * b.end.x;
    if (x <= p.x) continue;
    // dy/dt = by + 2 ay t
    const dyDt = by + 2 * ay * t;
    count += dyDt > 0 ? 1 : -1;
  }
  return count;
}

function bez3Crossings(p: V2d, b: Bezier3Segment): number {
  // y(t) = y0 + 3(y1-y0)t + 3(y0-2y1+y2)t² + (-y0+3y1-3y2+y3)t³
  const cy3 = -b.start.y + 3 * b.control1.y - 3 * b.control2.y + b.end.y;
  const cy2 = 3 * (b.start.y - 2 * b.control1.y + b.control2.y);
  const cy1 = 3 * (b.control1.y - b.start.y);
  const cy0 = b.start.y - p.y;
  const [t0, t1, t2] = realRootsOfCubic(cy3, cy2, cy1, cy0);
  let count = 0;
  for (const t of [t0, t1, t2]) {
    if (!Number.isFinite(t) || t < T_EPS || t > 1 - T_EPS) continue;
    const u = 1 - t;
    const x = u * u * u * b.start.x
            + 3 * u * u * t * b.control1.x
            + 3 * u * t * t * b.control2.x
            + t * t * t * b.end.x;
    if (x <= p.x) continue;
    // dy/dt = cy1 + 2 cy2 t + 3 cy3 t²
    const dyDt = cy1 + 2 * cy2 * t + 3 * cy3 * t * t;
    count += dyDt > 0 ? 1 : -1;
  }
  return count;
}

function arcCrossings(p: V2d, a: ArcSegment): number {
  // y(θ) = c.y + cos θ · a0.y + sin θ · a1.y
  // setting y = p.y → A cos θ + B sin θ = C with A = a0.y, B = a1.y,
  // C = p.y − c.y. Weierstrass t = tan(θ/2) gives
  //   (A + C) t² − 2 B t + (C − A) = 0
  const A = a.axis0.y, B = a.axis1.y, C = p.y - a.center.y;
  let count = 0;
  const tryAngle = (theta: number): void => {
    // Map theta into the arc's parameter t ∈ [0, 1].
    const tParam = arcParamFromAngle(a.startAngle, a.deltaAngle, theta);
    if (tParam === undefined) return;
    if (tParam < T_EPS || tParam > 1 - T_EPS) return;
    // x at this angle
    const x = a.center.x + Math.cos(theta) * a.axis0.x + Math.sin(theta) * a.axis1.x;
    if (x <= p.x) return;
    // dy/dθ at this angle = -sin θ · a0.y + cos θ · a1.y; sign of dy/dt
    // is sign(deltaAngle) * sign(dy/dθ).
    const dyDtheta = -Math.sin(theta) * a.axis0.y + Math.cos(theta) * a.axis1.y;
    const dyDt = a.deltaAngle * dyDtheta;
    if (Math.abs(dyDt) < 1e-15) return; // tangent; skip
    count += dyDt > 0 ? 1 : -1;
  };
  if (Math.abs(A + C) < 1e-15) {
    // Linear: -2B t + (C - A) = 0 → t = (C - A) / (2B), if B != 0.
    if (Math.abs(B) < 1e-15) return 0; // y-component identically zero
    const tt = (C - A) / (2 * B);
    const theta = 2 * Math.atan(tt);
    tryAngle(theta);
    return count;
  }
  const [t0, t1] = realRootsOfQuadratic(A + C, -2 * B, C - A);
  if (Number.isFinite(t0)) tryAngle(2 * Math.atan(t0));
  if (Number.isFinite(t1) && Math.abs(t1 - t0) > 1e-12) tryAngle(2 * Math.atan(t1));
  return count;
}

function arcParamFromAngle(
  startAngle: number, deltaAngle: number, theta: number,
): number | undefined {
  let dTheta = theta - startAngle;
  if (deltaAngle > 0) {
    while (dTheta < -1e-9) dTheta += 2 * Math.PI;
    while (dTheta > 2 * Math.PI + 1e-9) dTheta -= 2 * Math.PI;
  } else if (deltaAngle < 0) {
    while (dTheta > 1e-9) dTheta -= 2 * Math.PI;
    while (dTheta < -2 * Math.PI - 1e-9) dTheta += 2 * Math.PI;
  } else {
    return undefined;
  }
  const t = dTheta / deltaAngle;
  if (t < -1e-9 || t > 1 + 1e-9) return undefined;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function segmentCrossings(p: V2d, seg: PathSegment): number {
  switch (seg.kind) {
    case "line":    return lineCrossings(p, seg);
    case "bezier2": return bez2Crossings(p, seg);
    case "bezier3": return bez3Crossings(p, seg);
    case "arc":     return arcCrossings(p, seg);
  }
}

// ---------------------------------------------------------------------------
// Interior-point picking per face
// ---------------------------------------------------------------------------

/**
 * Pick a point strictly inside `face` by stepping a tiny distance
 * along the inward normal at the midpoint of the face's first
 * half-edge. The face is on the LEFT of every half-edge (DCEL
 * convention), so inward = left perpendicular of the segment's
 * tangent direction.
 */
function pickInteriorPoint(
  face: Face, halfEdges: ReadonlyArray<HalfEdge>, graph: PlanarGraph,
): V2d {
  const heIdx = face.halfEdges[0]!;
  const he = halfEdges[heIdx]!;
  const seg = graph.edges[he.edgeIndex]!.segment;
  // Midpoint of the half-edge (in the half-edge's traversal direction).
  const tMid = 0.5;
  const mid = seg.eval(tMid);
  const tangent = seg.derivative(tMid);
  // For a forward half-edge, the half-edge direction matches the
  // segment's parametric direction; for a reversed half-edge, flip.
  const tx = he.reversed ? -tangent.x : tangent.x;
  const ty = he.reversed ? -tangent.y : tangent.y;
  const len = Math.hypot(tx, ty);
  if (len < 1e-15) return mid; // degenerate
  // Left perpendicular of (tx, ty) is (-ty, tx); normalize.
  const nx = -ty / len, ny = tx / len;
  // Step in by a fraction of the segment's bounding-box diagonal
  // (heuristic: avoids jumping past nearby parallel boundaries) but
  // also enforce a minimum well above the ray-cast endpoint tolerance
  // (T_EPS = 1e-9). Otherwise crossings at nearby segment endpoints
  // get filtered as "endpoint-adjacent" and the winding undercounts.
  const bb = seg.bounds().size();
  const diag = Math.hypot(bb.x, bb.y);
  const step = Math.max(diag * 1e-3, 1e-6);
  return new V2d(mid.x + nx * step, mid.y + ny * step);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Winding number per face. Each face's representative interior point
 * is ray-cast against every planar-graph edge; the signed crossing
 * sum is the winding number.
 *
 * This handles topologically-disconnected components correctly (e.g.
 * a CCW outer contour with a separate CW hole inside): each face's
 * winding is computed independently of the DCEL component structure.
 */
export function computeWindings(
  extraction: FaceExtractionResult, graph: PlanarGraph,
): number[] {
  const result: number[] = new Array(extraction.faces.length);
  for (let i = 0; i < extraction.faces.length; i++) {
    const p = pickInteriorPoint(extraction.faces[i]!, extraction.halfEdges, graph);
    let w = 0;
    for (const e of graph.edges) w += segmentCrossings(p, e.segment);
    result[i] = w;
  }
  return result;
}

/**
 * Indices of faces inside the filled region under the supplied fill
 * rule (defaults to non-zero). Pass `FillRules.evenOdd`,
 * `FillRules.positive`, etc., or any user-defined predicate.
 */
export function filledFaceIndices(
  extraction: FaceExtractionResult,
  graph: PlanarGraph,
  rule: FillRule = FillRules.nonZero,
): number[] {
  const w = computeWindings(extraction, graph);
  const out: number[] = [];
  for (let i = 0; i < w.length; i++) if (rule(w[i]!)) out.push(i);
  return out;
}
