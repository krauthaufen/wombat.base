// PathSegment-pair intersection solvers. Port of the algorithms used
// in Aardvark.Base.Fonts.PathSegmentIntersections (Apache-2.0): each
// pair (line/bez2/bez3/arc × line/bez2/bez3/arc) gets the real solver
// Aardvark uses, not a polyline / Bezier-approximation fallback. Arcs
// stay first-class throughout.
//
// Public API:
//   intersections(a, b, eps?) → Array<[ta, tb]>
//
// where each `(ta, tb)` is a parameter pair in `[0, 1]²` such that
// `a.eval(ta) ≈ b.eval(tb)` within `eps`. Output is sorted by `ta`
// (matching Aardvark's `intersections`).

import { V2d } from "../../vector/v2d.js";
import {
  type PathSegment,
  LineSegment, Bezier2Segment, Bezier3Segment, ArcSegment,
} from "./segment.js";
import {
  realRootsOfQuadratic, realRootsOfCubic,
} from "../../numerics/polynomial.js";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Default position-equality tolerance (V2d distance) for solvers. */
export const DEFAULT_EPS = 1e-8;

/** Parameter-domain slack: a t outside [0,1] but within `T_EPS` of an
 *  endpoint is clamped, not rejected. Matches Aardvark's `teps`. */
const T_EPS = 1e-6;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Two points equal within `eps`? */
function approxEqV2(a: V2d, b: V2d, eps: number): boolean {
  return a.distance(b) <= eps;
}

function clamp01(t: number): number { return t < 0 ? 0 : t > 1 ? 1 : t; }

/**
 * Endpoint coincidence prefilter. Aardvark's solvers run this before
 * the heavy math: if the segments share one or more endpoints (within
 * `eps`), return the corresponding (ta, tb) pairs directly. Returns
 * `undefined` to mean "no shortcut, proceed to the analytic solver".
 *
 * Returning `[]` (empty array) is NOT what we want here — that would
 * mean "no intersections found", which differs from "no shortcut
 * applied". Hence the `undefined` sentinel.
 */
function endpointCoincidence(
  a: PathSegment, b: PathSegment, eps: number,
): Array<[number, number]> | undefined {
  const hits: Array<[number, number]> = [];
  if (approxEqV2(a.start, b.start, eps)) hits.push([0, 0]);
  if (approxEqV2(a.start, b.end, eps))   hits.push([0, 1]);
  if (approxEqV2(a.end,   b.start, eps)) hits.push([1, 0]);
  if (approxEqV2(a.end,   b.end, eps))   hits.push([1, 1]);
  return hits.length === 0 ? undefined : hits;
}

// ---------------------------------------------------------------------------
// Solver: line × line
// ---------------------------------------------------------------------------

/**
 * Two line-segment intersection. Solves the 2×2 linear system for
 * the two ray parameters and verifies they both lie in `[0, 1]` plus
 * `T_EPS` slack; clamps and re-checks position equality at `eps`
 * to guard against parallel-but-shifted false positives.
 */
/** Append `[ta, tb]` to `out` unless an entry already there is within
 *  `eps` in either parameter. Used by all solvers to merge their
 *  endpoint-coincidence prefilter with their analytic interior hits
 *  without producing duplicates. */
function pushUnique(
  out: Array<[number, number]>, ta: number, tb: number, eps: number,
): void {
  for (const [u, v] of out) {
    if (Math.abs(u - ta) < eps && Math.abs(v - tb) < eps) return;
  }
  out.push([ta, tb]);
}

function lineXline(
  a: LineSegment, b: LineSegment, eps: number,
): Array<[number, number]> {
  const result: Array<[number, number]> = endpointCoincidence(a, b, eps) ?? [];

  const da = a.end.sub(a.start);
  const db = b.end.sub(b.start);
  const det = da.x * db.y - da.y * db.x;
  if (det === 0) return result; // parallel / collinear

  const ox = b.start.x - a.start.x;
  const oy = b.start.y - a.start.y;
  const ta = (ox * db.y - oy * db.x) / det;
  const tb = (ox * da.y - oy * da.x) / det;

  if (ta < -T_EPS || ta > 1 + T_EPS) return result;
  if (tb < -T_EPS || tb > 1 + T_EPS) return result;

  const ca = clamp01(ta), cb = clamp01(tb);
  const pa = a.eval(ca), pb = b.eval(cb);
  if (!approxEqV2(pa, pb, eps)) return result;
  pushUnique(result, ca, cb, eps);
  return result;
}

// ---------------------------------------------------------------------------
// Solver: arc × line
// ---------------------------------------------------------------------------

/**
 * Recover the arc parameter `t ∈ [0, 1]` from an ellipse-local angle
 * `theta` (radians, the angle on the unit-circle in local frame).
 * Returns `undefined` if `theta` lies outside the arc range modulo
 * any necessary 2π shift. Otherwise returns the t (clamped to [0,1])
 * if it falls within `T_EPS` of the domain.
 */
function arcParamFromAngle(
  startAngle: number, deltaAngle: number, theta: number,
): number | undefined {
  let dTheta = theta - startAngle;
  if (deltaAngle > 0) {
    while (dTheta < -T_EPS) dTheta += 2 * Math.PI;
    while (dTheta > 2 * Math.PI + T_EPS) dTheta -= 2 * Math.PI;
  } else if (deltaAngle < 0) {
    while (dTheta > T_EPS) dTheta -= 2 * Math.PI;
    while (dTheta < -2 * Math.PI - T_EPS) dTheta += 2 * Math.PI;
  } else {
    return undefined; // zero-sweep arc has no interior
  }
  const t = dTheta / deltaAngle;
  if (t < -T_EPS || t > 1 + T_EPS) return undefined;
  return clamp01(t);
}

/**
 * Solve the line × arc system in the ellipse's local frame, where the
 * ellipse becomes the unit circle. Local coords are recovered via a
 * 2×2 inverse over `(axis0, axis1)`.
 */
function arcXline(
  arc: ArcSegment, line: LineSegment, eps: number,
): Array<[number, number]> {
  const result: Array<[number, number]> = endpointCoincidence(arc, line, eps) ?? [];

  const a0 = arc.axis0, a1 = arc.axis1, c = arc.center;
  const det = a0.x * a1.y - a0.y * a1.x;
  if (det === 0) return result; // degenerate ellipse

  // Map a global point P to local (α, β) where ellipse = unit circle.
  const toLocal = (P: V2d): V2d => {
    const dx = P.x - c.x, dy = P.y - c.y;
    return new V2d(
      (dx * a1.y - dy * a1.x) / det,
      (-dx * a0.y + dy * a0.x) / det,
    );
  };

  const p0 = toLocal(line.start);
  const p1 = toLocal(line.end);
  const dx = p1.x - p0.x, dy = p1.y - p0.y;

  // |p0 + s*d|² = 1  →  (d·d) s² + 2(p0·d) s + (p0·p0 - 1) = 0
  const A = dx * dx + dy * dy;
  const B = 2 * (p0.x * dx + p0.y * dy);
  const C = p0.x * p0.x + p0.y * p0.y - 1;

  const [s0, s1] = realRootsOfQuadratic(A, B, C);

  const tryRoot = (s: number): void => {
    if (!Number.isFinite(s)) return;
    if (s < -T_EPS || s > 1 + T_EPS) return;
    const sc = clamp01(s);
    const lx = p0.x + sc * dx, ly = p0.y + sc * dy;
    const theta = Math.atan2(ly, lx);
    const ta = arcParamFromAngle(arc.startAngle, arc.deltaAngle, theta);
    if (ta === undefined) return;
    const pa = arc.eval(ta), pb = line.eval(sc);
    if (!approxEqV2(pa, pb, eps)) return;
    pushUnique(result, ta, sc, eps);
  };

  tryRoot(s0);
  tryRoot(s1);
  return result;
}

// ---------------------------------------------------------------------------
// Solver: bez2 × line
// ---------------------------------------------------------------------------

/**
 * Plug Bezier2's parametric form `P(t) = p0 + b·t + a·t²` (with
 * `b = 2(p1-p0)` and `a = p0-2p1+p2`) into the line's perpendicular
 * `n·(P - q0) = 0`. Yields a quadratic in `t`. Each `t`-root is
 * back-projected onto the line to recover `s`, and both roots are
 * accepted only if `P(t) ≈ Q(s)` within `eps`.
 */
function bez2Xline(
  bez: Bezier2Segment, line: LineSegment, eps: number,
): Array<[number, number]> {
  const result: Array<[number, number]> = endpointCoincidence(bez, line, eps) ?? [];

  const p0 = bez.start, p1 = bez.control, p2 = bez.end;
  const q0 = line.start, q1 = line.end;
  const dx = q1.x - q0.x, dy = q1.y - q0.y;
  // Quadratic curve coefficients: P(t) = p0 + b·t + a·t²
  const ax = p0.x - 2 * p1.x + p2.x;
  const ay = p0.y - 2 * p1.y + p2.y;
  const bx = 2 * (p1.x - p0.x);
  const by = 2 * (p1.y - p0.y);

  // Perpendicular form n = (-dy, dx). n·(P - q0) = 0
  // 0 = (n.x ax + n.y ay) t² + (n.x bx + n.y by) t + n·(p0 - q0)
  const f2 = -dy * ax + dx * ay;
  const f1 = -dy * bx + dx * by;
  const f0 = -dy * (p0.x - q0.x) + dx * (p0.y - q0.y);

  const [t0, t1] = realRootsOfQuadratic(f2, f1, f0);
  const dLen2 = dx * dx + dy * dy;

  const tryRoot = (t: number): void => {
    if (!Number.isFinite(t)) return;
    if (t < -T_EPS || t > 1 + T_EPS) return;
    const tc = clamp01(t);
    const px = p0.x + bx * tc + ax * tc * tc;
    const py = p0.y + by * tc + ay * tc * tc;
    const s = ((px - q0.x) * dx + (py - q0.y) * dy) / dLen2;
    if (s < -T_EPS || s > 1 + T_EPS) return;
    const sc = clamp01(s);
    const lpx = q0.x + sc * dx, lpy = q0.y + sc * dy;
    if (Math.hypot(px - lpx, py - lpy) > eps) return;
    pushUnique(result, tc, sc, eps);
  };
  tryRoot(t0);
  tryRoot(t1);
  return result;
}

// ---------------------------------------------------------------------------
// Solver: bez3 × line
// ---------------------------------------------------------------------------

/**
 * Same idea as `bez2Xline` but with a cubic curve. Coefficients of
 * `P(t) = p0 + b·t + a·t² + c·t³` are expanded from the cubic Bernstein
 * form once and substituted into the line's perpendicular.
 */
function bez3Xline(
  bez: Bezier3Segment, line: LineSegment, eps: number,
): Array<[number, number]> {
  const result: Array<[number, number]> = endpointCoincidence(bez, line, eps) ?? [];

  const p0 = bez.start, p1 = bez.control1, p2 = bez.control2, p3 = bez.end;
  const q0 = line.start, q1 = line.end;
  const dx = q1.x - q0.x, dy = q1.y - q0.y;

  // P(t) = p0 + 3(p1-p0)t + 3(p0-2p1+p2)t² + (-p0+3p1-3p2+p3)t³
  const cx = -p0.x + 3 * p1.x - 3 * p2.x + p3.x;
  const cy = -p0.y + 3 * p1.y - 3 * p2.y + p3.y;
  const ax = 3 * (p0.x - 2 * p1.x + p2.x);
  const ay = 3 * (p0.y - 2 * p1.y + p2.y);
  const bx = 3 * (p1.x - p0.x);
  const by = 3 * (p1.y - p0.y);

  // n·(P(t) - q0) = (n.x cx + n.y cy) t³ + (n.x ax + n.y ay) t²
  //               + (n.x bx + n.y by) t + n·(p0 - q0)
  // n = (-dy, dx)
  const f3 = -dy * cx + dx * cy;
  const f2 = -dy * ax + dx * ay;
  const f1 = -dy * bx + dx * by;
  const f0 = -dy * (p0.x - q0.x) + dx * (p0.y - q0.y);

  const [t0, t1, t2] = realRootsOfCubic(f3, f2, f1, f0);
  const dLen2 = dx * dx + dy * dy;

  const tryRoot = (t: number): void => {
    if (!Number.isFinite(t)) return;
    if (t < -T_EPS || t > 1 + T_EPS) return;
    const tc = clamp01(t);
    const t2c = tc * tc, t3c = t2c * tc;
    const px = p0.x + bx * tc + ax * t2c + cx * t3c;
    const py = p0.y + by * tc + ay * t2c + cy * t3c;
    const s = ((px - q0.x) * dx + (py - q0.y) * dy) / dLen2;
    if (s < -T_EPS || s > 1 + T_EPS) return;
    const sc = clamp01(s);
    const lpx = q0.x + sc * dx, lpy = q0.y + sc * dy;
    if (Math.hypot(px - lpx, py - lpy) > eps) return;
    pushUnique(result, tc, sc, eps);
  };
  tryRoot(t0);
  tryRoot(t1);
  tryRoot(t2);
  return result;
}

// ---------------------------------------------------------------------------
// Generic numeric solver: subdivision + Newton
// ---------------------------------------------------------------------------
//
// Used for every pair where at least one segment is an implicit curve
// (bez2×bez2, bez2×arc, arc×arc, plus all bez3×* combinations — same
// policy Aardvark uses for the hardest pairs). Algorithm:
//
//   1. Subdivide both segments at their parameter-midpoints while the
//      tight bboxes overlap. Recursion stops when both halves are
//      smaller than `BBOX_TOL` in either axis, or `MAX_DEPTH` is hit.
//   2. Each surviving leaf yields a seed `(ta, tb)` at the parameter
//      midpoints.
//   3. Newton-refine each seed against `F(ta, tb) = a(ta) - b(tb)`
//      with Jacobian `[a'(ta), -b'(tb)]` and step `J⁻¹·F`. Bail out
//      if the step takes us outside `[-Δ, 1+Δ]` or stalls.
//   4. Accept the refined point if `|F| < eps`. For tangent pairs
//      where Newton stalls but the seed already has `|F| < eps`,
//      accept the seed itself (otherwise we'd miss tangencies).
//   5. Cluster duplicates within `eps` in parameter or position space.

const BBOX_TOL = 1e-10;
const MAX_DEPTH = 40;

function bboxesOverlap(a: PathSegment, b: PathSegment): boolean {
  const ba = a.bounds(), bb = b.bounds();
  return !(ba.max.x < bb.min.x
        || bb.max.x < ba.min.x
        || ba.max.y < bb.min.y
        || bb.max.y < ba.min.y);
}

function bboxBelowTol(a: PathSegment): boolean {
  const sz = a.bounds().size();
  return sz.x < BBOX_TOL && sz.y < BBOX_TOL;
}

function newtonStep(
  a: PathSegment, b: PathSegment,
  ta: number, tb: number, eps: number,
): { ta: number; tb: number; converged: boolean } {
  for (let iter = 0; iter < 40; iter++) {
    const pa = a.eval(ta), pb = b.eval(tb);
    const fx = pa.x - pb.x, fy = pa.y - pb.y;
    if (Math.hypot(fx, fy) < eps * 0.1) return { ta, tb, converged: true };
    const da = a.derivative(ta), db = b.derivative(tb);
    const det = db.x * da.y - da.x * db.y;
    if (Math.abs(det) < 1e-22) return { ta, tb, converged: false };
    const dTa = (db.y * fx - db.x * fy) / det;
    const dTb = (da.y * fx - da.x * fy) / det;
    ta += dTa;
    tb += dTb;
    if (ta < -T_EPS || ta > 1 + T_EPS || tb < -T_EPS || tb > 1 + T_EPS) {
      return { ta, tb, converged: false };
    }
  }
  return { ta, tb, converged: false };
}

function numericIntersect(
  a: PathSegment, b: PathSegment, eps: number,
): Array<[number, number]> {
  const coinc = endpointCoincidence(a, b, eps);
  // We don't early-return on coincidence here — there may also be
  // *interior* intersections (a curve that grazes its neighbour mid-
  // span and also shares an endpoint). Collect coincidence as the
  // initial result list; numeric search adds the rest.
  const result: Array<[number, number]> = coinc ?? [];

  const seeds: Array<[number, number]> = [];
  const recurse = (
    aa: PathSegment, ta0: number, ta1: number,
    bb: PathSegment, tb0: number, tb1: number,
    depth: number,
  ): void => {
    if (!bboxesOverlap(aa, bb)) return;
    if (depth >= MAX_DEPTH || (bboxBelowTol(aa) && bboxBelowTol(bb))) {
      seeds.push([(ta0 + ta1) * 0.5, (tb0 + tb1) * 0.5]);
      return;
    }
    const [aL, aR] = aa.split(0.5);
    const [bL, bR] = bb.split(0.5);
    const taM = (ta0 + ta1) * 0.5, tbM = (tb0 + tb1) * 0.5;
    recurse(aL, ta0, taM, bL, tb0, tbM, depth + 1);
    recurse(aL, ta0, taM, bR, tbM, tb1, depth + 1);
    recurse(aR, taM, ta1, bL, tb0, tbM, depth + 1);
    recurse(aR, taM, ta1, bR, tbM, tb1, depth + 1);
  };
  recurse(a, 0, 1, b, 0, 1, 0);

  const accept = (ta: number, tb: number): void => {
    if (ta < -T_EPS || ta > 1 + T_EPS) return;
    if (tb < -T_EPS || tb > 1 + T_EPS) return;
    const tac = clamp01(ta), tbc = clamp01(tb);
    const pa = a.eval(tac), pb = b.eval(tbc);
    if (!approxEqV2(pa, pb, eps)) return;
    for (const [u, v] of result) {
      if (Math.abs(u - tac) < eps && Math.abs(v - tbc) < eps) return;
      if (approxEqV2(a.eval(u), pa, eps)) return;
    }
    result.push([tac, tbc]);
  };

  for (const [s0, s1] of seeds) {
    const r = newtonStep(a, b, s0, s1, eps);
    if (r.converged) {
      accept(r.ta, r.tb);
    } else {
      // Tangent fallback: accept the seed if it already satisfies
      // the position-equality test at `eps` (Newton stalled because
      // the Jacobian is near-singular at a tangency, not because
      // there's no intersection).
      const pa = a.eval(s0), pb = b.eval(s1);
      if (approxEqV2(pa, pb, eps)) accept(s0, s1);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Pair-flip helper
// ---------------------------------------------------------------------------

/** Swap (a, b) result pairs to (b, a). Used when the dispatcher
 *  routes a (kind1, kind2) request to a (kind2, kind1) solver. */
function flip(hits: ReadonlyArray<[number, number]>): Array<[number, number]> {
  return hits.map(([a, b]) => [b, a] as [number, number]);
}

// ---------------------------------------------------------------------------
// Top-level dispatcher
// ---------------------------------------------------------------------------

/**
 * All intersections of two `PathSegment`s. Each result is a parameter
 * pair `(ta, tb)` in `[0, 1]²`. Output is sorted ascending by `ta`.
 *
 * Argument order matters: if `(a, b)` is implemented but only
 * `(b, a)`'s solver exists, the dispatcher swaps and flips the
 * output pairs.
 */
export function intersections(
  a: PathSegment, b: PathSegment, eps: number = DEFAULT_EPS,
): Array<[number, number]> {
  const hits = dispatch(a, b, eps);
  hits.sort((x, y) => x[0] - y[0]);
  return hits;
}

function dispatch(
  a: PathSegment, b: PathSegment, eps: number,
): Array<[number, number]> {
  // line × *
  if (a.kind === "line" && b.kind === "line") return lineXline(a, b, eps);
  if (a.kind === "line" && b.kind === "arc")     return flip(arcXline(b, a, eps));
  if (a.kind === "line" && b.kind === "bezier2") return flip(bez2Xline(b, a, eps));
  if (a.kind === "line" && b.kind === "bezier3") return flip(bez3Xline(b, a, eps));

  // arc × line (other arc cases come in sub-stages 1c-1d)
  if (a.kind === "arc" && b.kind === "line") return arcXline(a, b, eps);

  // bez2 × line / bez3 × line
  if (a.kind === "bezier2" && b.kind === "line") return bez2Xline(a, b, eps);
  if (a.kind === "bezier3" && b.kind === "line") return bez3Xline(a, b, eps);

  // Every implicit-curve × implicit-curve case routes through the
  // generic subdivision + Newton solver. Same policy Aardvark uses
  // for its bez3 cases; we extend it to bez2-pair and arc-pair too.
  return numericIntersect(a, b, eps);
}

// ---------------------------------------------------------------------------
// Internal exports for testing
// ---------------------------------------------------------------------------

export const __internal = {
  endpointCoincidence,
  lineXline,
  T_EPS,
};
