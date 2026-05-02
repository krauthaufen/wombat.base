// Loop-Blinn texcoord classification for curve segments.
//
// Given a curve segment, produce the triangle(s) covering it plus
// per-vertex texcoords (u, v[, w]) such that a fragment shader can
// run an implicit-form test to discard pixels not on the filled side
// of the curve. Output for each segment kind:
//
//   bezier2 — one triangle = the three control points; per-vertex
//             texcoords (0, 0), (1/2, 0), (1, 1). Fragment test:
//             `u² − v` (sign decides inside/outside).
//
//   arc     — covered by 1 or more triangles (subdivided if the
//             sweep |Δθ| > π/2). Each triangle has 3 vertices: the
//             arc endpoints plus the tangent-line intersection
//             ("apex"). Per-vertex texcoords are the points'
//             coordinates in the ellipse's local frame (where the
//             ellipse becomes the unit circle); fragment test:
//             `u² + v² − 1`.
//
//   bezier3 — five-case classification (serpentine / loop / cusp at
//             infinity / cusp with inflection / quadratic-degenerate
//             / line-degenerate). Stage 4b. Currently throws.
//
// `bulgesOutward` reports whether the curve's interior lies on the
// chord's outward (right) side relative to the segment's natural
// traversal — i.e. whether the triangle's filled portion ADDS to the
// flat polygon (true) or has to be subtracted from it (false). The
// flat-polygon-fill stage uses this flag to decide how to combine
// triangles with the polygonal interior.

import { V2d } from "../../vector/v2d.js";
import {
  type PathSegment,
  Bezier2Segment, Bezier3Segment, ArcSegment,
} from "./segment.js";

export type CurveTriangleKind =
  | "bezier2"
  | "arc"
  | "bezier3-serpentine"
  | "bezier3-loop"
  | "bezier3-cusp"
  | "bezier3-quadratic"
  | "bezier3-line";

export interface CurveTriangle {
  readonly kind: CurveTriangleKind;
  /** World-space vertices forming the triangle (3 points). */
  readonly vertices: readonly [V2d, V2d, V2d];
  /** Per-vertex texcoords (k, l, m). m = 1 for bezier2 / arc; cubic
   *  cases use the third component. */
  readonly texcoords: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ];
  /** True when the curve bulges OUTWARD from its endpoint chord
   *  (filled side exterior to the polygon → add); false if INWARD
   *  (filled side interior → subtract). */
  readonly bulgesOutward: boolean;
}

// ---------------------------------------------------------------------------
// Bezier2
// ---------------------------------------------------------------------------

/**
 * One triangle (the three control points) with the standard
 * Loop-Blinn quadratic texcoords (0, 0, 1), (½, 0, 1), (1, 1, 1).
 * Fragment test: `u² − v` is zero on the curve, negative on one
 * side, positive on the other.
 *
 * `bulgesOutward` is reported relative to the segment's natural
 * traversal direction: true if the control point P1 lies to the
 * RIGHT of the chord P0 → P2 (i.e. the curve bulges away from the
 * left, which is the side where a CCW-traversed contour places its
 * interior).
 */
export function classifyBezier2(b: Bezier2Segment): CurveTriangle {
  const cross = (b.end.x - b.start.x) * (b.control.y - b.start.y)
              - (b.end.y - b.start.y) * (b.control.x - b.start.x);
  return {
    kind: "bezier2",
    vertices: [b.start, b.control, b.end],
    texcoords: [[0, 0, 1], [0.5, 0, 1], [1, 1, 1]],
    bulgesOutward: cross < 0,
  };
}

// ---------------------------------------------------------------------------
// Arc
// ---------------------------------------------------------------------------

/**
 * Affine map from world to ellipse-local frame, where the ellipse
 * becomes the unit circle. `axis0`, `axis1`, `center` define the
 * ellipse; the inverse 2×2 maps `(P − center)` to local `(u, v)`.
 */
function worldToLocal(a: ArcSegment, P: V2d): V2d {
  const a0 = a.axis0, a1 = a.axis1;
  const det = a0.x * a1.y - a0.y * a1.x;
  const dx = P.x - a.center.x, dy = P.y - a.center.y;
  return new V2d(
    (dx * a1.y - dy * a1.x) / det,
    (-dx * a0.y + dy * a0.x) / det,
  );
}

function localToWorld(a: ArcSegment, p: V2d): V2d {
  return new V2d(
    a.center.x + p.x * a.axis0.x + p.y * a.axis1.x,
    a.center.y + p.x * a.axis0.y + p.y * a.axis1.y,
  );
}

/**
 * Apex of the triangle covering an arc piece spanning angles
 * `[theta0, theta1]` in local frame. The apex is the intersection
 * of the tangent lines to the unit circle at those two angles:
 *
 *   `cos(θᵢ)·x + sin(θᵢ)·y = 1`
 *
 * giving `x = (sin θ₁ − sin θ₀)/sin(θ₁−θ₀)`,
 *        `y = (cos θ₀ − cos θ₁)/sin(θ₁−θ₀)`.
 */
function localArcApex(theta0: number, theta1: number): V2d {
  const dt = theta1 - theta0;
  const denom = Math.sin(dt);
  // Caller is responsible for ensuring |dt| <= π/2 < π so denom ≠ 0.
  return new V2d(
    (Math.sin(theta1) - Math.sin(theta0)) / denom,
    (Math.cos(theta0) - Math.cos(theta1)) / denom,
  );
}

const MAX_ARC_PIECE = Math.PI / 2;

/**
 * One or more triangles covering an arc; per-vertex texcoords are
 * the local-frame `(u, v, 1)` so the fragment test `u² + v² − 1`
 * gives the inside/outside-circle classification.
 *
 * Arcs with `|Δθ| > π/2` are split into pieces (each ≤ π/2) so the
 * tangent-intersection apex stays well-conditioned.
 */
export function classifyArc(a: ArcSegment): CurveTriangle[] {
  const out: CurveTriangle[] = [];
  const total = a.deltaAngle;
  const pieces = Math.max(1, Math.ceil(Math.abs(total) / MAX_ARC_PIECE));
  const step = total / pieces;
  // Determine bulge: same convention as bezier2 — does the curve
  // bulge to the right of its chord? A CCW arc (deltaAngle > 0)
  // with interior on the left bulges outward when traversed start
  // → end if axis0 × axis1 has the same sign as deltaAngle.
  const cross = a.axis0.x * a.axis1.y - a.axis0.y * a.axis1.x;
  const bulgesOutward = cross * a.deltaAngle < 0;

  for (let i = 0; i < pieces; i++) {
    const t0 = a.startAngle + i * step;
    const t1 = a.startAngle + (i + 1) * step;
    // Endpoints in local frame: exactly on the unit circle.
    const p0Local = new V2d(Math.cos(t0), Math.sin(t0));
    const p1Local = new V2d(Math.cos(t1), Math.sin(t1));
    const apexLocal = localArcApex(t0, t1);
    // For piece-0 / piece-last, snap the world endpoints to the
    // segment's stored start / end V2ds so the planar-graph and
    // tessellation stages still see bit-identical shared vertices.
    const p0World = i === 0 ? a.start : localToWorld(a, p0Local);
    const p1World = i === pieces - 1 ? a.end : localToWorld(a, p1Local);
    const apexWorld = localToWorld(a, apexLocal);
    out.push({
      kind: "arc",
      vertices: [p0World, apexWorld, p1World],
      texcoords: [
        [p0Local.x, p0Local.y, 1],
        [apexLocal.x, apexLocal.y, 1],
        [p1Local.x, p1Local.y, 1],
      ],
      bulgesOutward,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bezier3 — Stage 4b
// ---------------------------------------------------------------------------

/** TODO: Stage 4b — five-case Loop-Blinn classification for cubic
 *  Beziers (serpentine / loop / cusp / quadratic-degen / line-degen). */
export function classifyBezier3(_b: Bezier3Segment): CurveTriangle[] {
  throw new Error(
    "classifyBezier3: cubic Loop-Blinn classification is Stage 4b — not yet implemented",
  );
}

// ---------------------------------------------------------------------------
// Top-level dispatch
// ---------------------------------------------------------------------------

/**
 * Classify any curve segment into one or more `CurveTriangle`s
 * with the appropriate Loop-Blinn texcoords. Lines are not curves
 * (they're handled by the flat polygon triangulation in Stage 5);
 * passing a `LineSegment` here returns an empty list.
 */
export function classifyCurve(seg: PathSegment): CurveTriangle[] {
  switch (seg.kind) {
    case "line":    return [];
    case "bezier2": return [classifyBezier2(seg)];
    case "arc":     return classifyArc(seg);
    case "bezier3": return classifyBezier3(seg);
  }
}
