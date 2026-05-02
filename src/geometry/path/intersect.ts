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
function lineXline(
  a: LineSegment, b: LineSegment, eps: number,
): Array<[number, number]> {
  const coinc = endpointCoincidence(a, b, eps);
  if (coinc !== undefined) return coinc;

  const da = a.end.sub(a.start);
  const db = b.end.sub(b.start);
  const det = da.x * db.y - da.y * db.x;
  if (det === 0) return []; // parallel / collinear

  const ox = b.start.x - a.start.x;
  const oy = b.start.y - a.start.y;
  const ta = (ox * db.y - oy * db.x) / det;
  const tb = (ox * da.y - oy * da.x) / det;

  if (ta < -T_EPS || ta > 1 + T_EPS) return [];
  if (tb < -T_EPS || tb > 1 + T_EPS) return [];

  const ca = clamp01(ta), cb = clamp01(tb);
  const pa = a.eval(ca), pb = b.eval(cb);
  if (!approxEqV2(pa, pb, eps)) return [];
  return [[ca, cb]];
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
  if (a.kind === "line" && b.kind === "line") {
    return lineXline(a, b, eps);
  }
  // Sub-stages 1b–1e plug their solvers in here. Until then, the
  // remaining 14 (a,b) cases throw, so a missing solver is loud, not
  // silent. Argument-flipped pairs reuse the implemented solver and
  // swap the output coordinates.
  throw new Error(
    `intersections: not yet implemented for (${a.kind}, ${b.kind})`,
  );
}

// ---------------------------------------------------------------------------
// Internal exports for testing
// ---------------------------------------------------------------------------

export const __internal = {
  endpointCoincidence,
  lineXline,
  T_EPS,
};
