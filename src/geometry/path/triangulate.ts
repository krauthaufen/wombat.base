// Constrained triangulation of filled-face boundaries.
//
// Each filled face from `extractFaces` provides a half-edge cycle —
// the face boundary in CCW order. We extract the vertex sequence
// (substituting the chord endpoints for any curved segment, so the
// flat polygon approximates the face) and run ear clipping to emit
// interior triangles.
//
// Curve segments along the boundary additionally contribute their
// Loop-Blinn "boundary" triangles via `classifyCurve` (Stage 4),
// which the renderer composites with the flat interior triangles.
// The interior flat triangulation produces "all-flat" texcoords
// (k = 1, l = 1, m = 1 — the implicit form k³ - lmn evaluates to 0
// trivially, so the entire triangle is "inside").
//
// Limitations / scope of this commit:
//   - Ear clipping handles simple polygons (single closed boundary,
//     no self-intersection, no slits).
//   - For polygons containing bridge edges (Stage 3.5), each bridge
//     contributes two collinear edges in the face cycle (forward +
//     reverse). The triangulator filters degenerate slit triangles
//     after the fact, but more complex hole topologies may need a
//     dedicated polygon-with-holes path. Tracked as a follow-up.

import { V2d } from "../../vector/v2d.js";
import type { PlanarGraph } from "./planar-graph.js";
import type {
  Face, FaceExtractionResult, HalfEdge,
} from "./face-extract.js";
import {
  type CurveTriangle,
  classifyCurve,
  chordPoints,
} from "./loop-blinn.js";

export interface FlatTriangle {
  /** World-space vertices of the triangle (CCW). */
  readonly vertices: readonly [V2d, V2d, V2d];
}

/**
 * Outline-ribbon triangle for AA on straight (line) polygon edges.
 *
 * Each non-bridge LINE half-edge in a face boundary contributes a
 * 2-triangle quad straddling the edge: 2 inner vertices ON the
 * polygon boundary (`isOuter = 0`) and 2 outer vertices at the SAME
 * world position but tagged for clip-space expansion in the vertex
 * shader (`isOuter = 1`). The shader pushes outer vertices outward
 * by exactly 1 framebuffer pixel along the per-vertex `outwardDir`,
 * giving a 1-pixel-wide strip JUST OUTSIDE the polygon. Inside the
 * strip, alpha ramps linearly from 1 (inner, on the polygon edge)
 * to 0 (outer, 1 px out) → a 1-pixel AA halo with no overlap into
 * the flat-fill interior.
 *
 * Curves don't need ribbons — their existing curve triangle in the
 * bulge area handles AA via the implicit gradient (analytic
 * sub-pixel distance, no expansion required).
 */
export interface RibbonTriangle {
  /** World-space vertex positions (CCW). */
  readonly vertices: readonly [V2d, V2d, V2d];
  /** Per-vertex outward direction in world space. The shader
   *  projects, normalises and scales to 1 px in NDC. Same direction
   *  for inner+outer pair at each ribbon corner. */
  readonly outward: readonly [V2d, V2d, V2d];
  /** Per-vertex `isOuter` flag (0 = on polygon edge, 1 = 1px outside). */
  readonly isOuter: readonly [number, number, number];
}

export interface FaceTriangulation {
  /** Interior triangles of the flat polygon approximation. */
  readonly flat: ReadonlyArray<FlatTriangle>;
  /** Loop-Blinn boundary triangles for each curved segment in the
   *  face's boundary, paired with `bulgesOutward` so the renderer
   *  knows whether the curve adds to or subtracts from the flat
   *  interior. */
  readonly curves: ReadonlyArray<CurveTriangle>;
  /** Outline ribbons along boundary LINE edges (skipped for curves
   *  and bridges). Empty when the face has no straight boundary. */
  readonly ribbons: ReadonlyArray<RibbonTriangle>;
}

// ---------------------------------------------------------------------------
// Ear clipping
// ---------------------------------------------------------------------------

interface EarNode {
  readonly idx: number;     // index into the input vertex list
  readonly p: V2d;
  prev: EarNode;
  next: EarNode;
  removed: boolean;
}

/** Signed twice the area of triangle (a, b, c). Positive = CCW. */
function signedArea2(a: V2d, b: V2d, c: V2d): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointInTriangle(p: V2d, a: V2d, b: V2d, c: V2d, eps: number): boolean {
  // Strict-inside test (excluding edges within `eps`).
  const s1 = signedArea2(a, b, p);
  const s2 = signedArea2(b, c, p);
  const s3 = signedArea2(c, a, p);
  const sign = s1 > eps && s2 > eps && s3 > eps;
  const opposite = s1 < -eps && s2 < -eps && s3 < -eps;
  return sign || opposite;
}

/**
 * Strict segment-segment crossing test (excluding shared-endpoint
 * touches). True iff segments (p0, p1) and (q0, q1) properly cross
 * — i.e. interior points of each segment touch.
 */
function segmentsCross(
  p0: V2d, p1: V2d, q0: V2d, q1: V2d, eps: number,
): boolean {
  const d1 = signedArea2(q0, q1, p0);
  const d2 = signedArea2(q0, q1, p1);
  const d3 = signedArea2(p0, p1, q0);
  const d4 = signedArea2(p0, p1, q1);
  // Both endpoints of (p0, p1) must lie strictly on opposite sides
  // of (q0, q1), and vice versa. Endpoint-touches (any d ≈ 0) are
  // treated as non-crossing — they're handled by the vertex-inside
  // check separately.
  return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps))
      && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
}

function isEar(node: EarNode, eps: number): boolean {
  const a = node.prev.p, b = node.p, c = node.next.p;
  // Convex (CCW) test: signed area must be strictly positive.
  if (signedArea2(a, b, c) <= eps) return false;
  // No other (non-adjacent) vertex strictly inside the triangle abc.
  let n = node.next.next;
  while (n !== node.prev) {
    if (pointInTriangle(n.p, a, b, c, eps)) return false;
    n = n.next;
  }
  // The diagonal (a, c) must not cross any non-adjacent polygon
  // edge. Without this, concave polygons whose "missing corner"
  // lies inside the candidate ear are mis-identified as ears
  // (the chord goes outside the polygon).
  let e = node.next;          // edge starts at (next, next.next)
  while (e.next !== node.prev) {
    const u = e.p, v = e.next.p;
    if (segmentsCross(a, c, u, v, eps)) return false;
    e = e.next;
  }
  return true;
}

/**
 * Ear-clipping triangulation of a simple CCW polygon. Returns a
 * list of vertex-index triples. Skips collinear / zero-area
 * "ears" — useful when the polygon has slit edges (e.g. from
 * bridges in Stage 3.5).
 *
 * Input must have ≥ 3 vertices, traverse the polygon in CCW order,
 * and not self-intersect. Repeated vertices (e.g. at slit endpoints)
 * are tolerated as long as the polygon remains topologically valid.
 */
export function earClip(
  polygon: ReadonlyArray<V2d>, eps: number = 1e-12,
): Array<readonly [number, number, number]> {
  const n = polygon.length;
  if (n < 3) return [];

  const nodes: EarNode[] = polygon.map((p, i) => ({
    idx: i, p, prev: undefined as any, next: undefined as any, removed: false,
  }));
  for (let i = 0; i < n; i++) {
    nodes[i]!.prev = nodes[(i - 1 + n) % n]!;
    nodes[i]!.next = nodes[(i + 1) % n]!;
  }

  const result: Array<readonly [number, number, number]> = [];
  let remaining = n;
  let cur = nodes[0]!;
  let stuck = 0;
  while (remaining > 3) {
    if (cur.removed) { cur = cur.next; continue; }
    if (isEar(cur, eps)) {
      // Emit triangle and remove the ear.
      result.push([cur.prev.idx, cur.idx, cur.next.idx]);
      cur.removed = true;
      cur.prev.next = cur.next;
      cur.next.prev = cur.prev;
      remaining -= 1;
      // Move on to the next vertex.
      cur = cur.next;
      stuck = 0;
    } else {
      cur = cur.next;
      stuck += 1;
      if (stuck > remaining * 2) {
        // No ear found in a full sweep — polygon is degenerate /
        // self-touching. Bail out with what we have.
        break;
      }
    }
  }
  // Final triangle (if non-degenerate).
  if (remaining === 3) {
    if (signedArea2(cur.prev.p, cur.p, cur.next.p) > eps) {
      result.push([cur.prev.idx, cur.idx, cur.next.idx]);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Face → flat polygon + curve triangles
// ---------------------------------------------------------------------------

/**
 * Walk the face's half-edge cycle, build the flat chord polygon
 * (each curved segment contributes its endpoints, not its actual
 * curve), and emit a list of `CurveTriangle`s for the curved edges.
 *
 * Bridge half-edges (Stage 3.5) contribute their endpoints to the
 * polygon but do NOT emit curve triangles — they're invisible to
 * the renderer.
 */
// Even-odd ray-cast: is `p` inside the closed simple polygon `poly`?
// Used as the per-face "containsPoint nonCurved p1" decision (mirrors
// Aardvark.Rendering.Text), driving the m-component sign on each
// curve triangle and the polygon-detour through inward control
// points.
function pointInsidePolygon(p: V2d, poly: ReadonlyArray<V2d>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if (((a.y > p.y) !== (b.y > p.y))
        && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) {
      inside = !inside;
    }
  }
  return inside;
}

const flipM = (
  t: readonly [number, number, number],
): readonly [number, number, number] => [t[0], t[1], -t[2]];

/**
 * Mirror of Aardvark.Rendering.Text's PathTessellator. The flat
 * polygon for each face is built from the segment-endpoint chord
 * polyline plus, for every Loop-Blinn curve sub-triangle whose
 * "extra" vertex (bez2 control / arc apex / cubic hull-vertex) lies
 * INSIDE that chord polyline, an extra detour through that vertex.
 * Those curves emit with `m = -1` so the fragment test
 * `(f * m) > 0 → discard` cancels the over-coverage that the detour
 * introduces. Curves whose extra vertex stays OUTSIDE the chord
 * polyline are kept as-is (chord on the polygon, `m = 1`, curve adds
 * the bulge to the polygon).
 *
 * The two-pass shape (chord polyline first, detoured polygon second)
 * is what lets inner contours that arrive via Stage 3.5 bridges
 * subtract correctly: curves on the inner outline have their control
 * point inside the bridged chord polyline (= inside the outer-minus-
 * inner region), so they detour + flip to `m = -1` and the bulge
 * region of the inner outline is excluded from the final fill.
 */
/**
 * Outline ribbons for AA on straight (line) polygon edges. One quad
 * per non-bridge LINE half-edge, sitting JUST OUTSIDE the polygon
 * boundary (after vertex-shader expansion by 1 framebuffer pixel).
 *
 * Per-vertex `outwardDir` is the bisector of the two adjacent
 * non-bridge edge outward-normals at the shared corner — this gives
 * gap-free joins at convex/concave corners up to a miter limit.
 * Beyond the miter limit the bisector falls back to the per-edge
 * normal (small bevel-like overhang at very sharp corners).
 *
 * Curve half-edges DO NOT get a ribbon — the curve triangle in the
 * bulge handles AA via the implicit gradient, and adding a ribbon
 * there would overlap the curve triangle (overdraw).
 */
function buildLineRibbons(
  face: Face, extraction: FaceExtractionResult, graph: PlanarGraph,
): RibbonTriangle[] {
  // Collect boundary line half-edges in face traversal order.
  type BHE = {
    src: V2d; dst: V2d;
    isLine: boolean; isBridge: boolean;
  };
  const edges: BHE[] = [];
  for (const heIdx of face.halfEdges) {
    const he = extraction.halfEdges[heIdx]!;
    const edge = graph.edges[he.edgeIndex]!;
    const src = graph.vertices[he.src]!;
    const dst = graph.vertices[he.dst]!;
    edges.push({
      src, dst,
      isLine: !edge.isBridge && edge.segment.kind === "line",
      isBridge: edge.isBridge ?? false,
    });
  }
  if (edges.length === 0) return [];

  // Per-edge outward normal (right of edge direction for CCW face).
  // Only valid when the edge has positive length; degenerate edges
  // get a zero normal (those won't contribute to a ribbon either).
  const normals: V2d[] = edges.map((e) => {
    const dx = e.dst.x - e.src.x, dy = e.dst.y - e.src.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) return new V2d(0, 0);
    return new V2d(dy / len, -dx / len);
  });

  // Per-vertex bisector at the START of edge i, between the previous
  // VISIBLE (non-bridge) edge's normal and edge i's normal. Bridges
  // are skipped — at a vertex where a bridge meets a line edge, the
  // bisector falls back to the line's own normal.
  const N = edges.length;
  const MITER_MIN = 0.25; // 1 / (1/0.25) = 4× miter cap.
  const bisectorAt = (i: number): V2d => {
    const here = edges[i]!;
    if (!here.isLine) return new V2d(0, 0);
    const nHere = normals[i]!;
    // Find previous visible edge (skipping bridges).
    let p = (i - 1 + N) % N;
    let prevVisibleEdge: BHE | undefined;
    let prevNormal: V2d | undefined;
    for (let k = 0; k < N; k++) {
      if (!edges[p]!.isBridge) { prevVisibleEdge = edges[p]; prevNormal = normals[p]; break; }
      p = (p - 1 + N) % N;
    }
    if (prevVisibleEdge === undefined || prevNormal === undefined) return nHere;
    // Only miter against another LINE; against a curve we keep the
    // line's own normal (curves handle their own AA via implicit).
    if (!prevVisibleEdge.isLine) return nHere;
    const sumX = prevNormal.x + nHere.x, sumY = prevNormal.y + nHere.y;
    const sumLen = Math.hypot(sumX, sumY);
    if (sumLen < 1e-9) return nHere; // 180° turn; should not happen for simple polygons
    const dirX = sumX / sumLen, dirY = sumY / sumLen;
    const cosHalf = Math.max(dirX * nHere.x + dirY * nHere.y, MITER_MIN);
    return new V2d(dirX / cosHalf, dirY / cosHalf);
  };

  const ribbons: RibbonTriangle[] = [];
  for (let i = 0; i < N; i++) {
    const e = edges[i]!;
    if (!e.isLine) continue;
    const bStart = bisectorAt(i);
    const bEnd = bisectorAt((i + 1) % N);
    // Quad vertices: A = src inner, B = dst inner, C = src outer,
    // D = dst outer. Two CCW triangles cover (A→B→D) and (A→D→C).
    const A = e.src, B = e.dst;
    const C = e.src, D = e.dst;
    ribbons.push({
      vertices: [A, B, D],
      outward:  [bStart, bEnd, bEnd],
      isOuter:  [0, 0, 1],
    });
    ribbons.push({
      vertices: [A, D, C],
      outward:  [bStart, bEnd, bStart],
      isOuter:  [0, 1, 1],
    });
  }
  return ribbons;
}

function buildFacePolygon(
  face: Face, extraction: FaceExtractionResult, graph: PlanarGraph,
): { polygon: V2d[]; curves: CurveTriangle[] } {
  // Pass 1: chord polyline including sub-piece break points (arc
  // pieces, cubic-to-quadratic splits). This is the reference
  // polygon for the per-curve "extra vertex inside polygon?" test;
  // it follows the curve at sub-piece resolution but uses straight
  // chords within each sub-piece.
  const chordPolygon: V2d[] = [];
  for (const heIdx of face.halfEdges) {
    const he = extraction.halfEdges[heIdx]!;
    const edge = graph.edges[he.edgeIndex]!;
    chordPolygon.push(graph.vertices[he.src]!);
    if (edge.isBridge) continue;
    const segOriented = he.reversed ? edge.segment.reverse() : edge.segment;
    for (const p of chordPoints(segOriented)) chordPolygon.push(p);
  }

  // Pass 2: build the final polygon (with control-detour spikes for
  // sub-pieces whose "extra" vertex lies inside the chord polygon)
  // and emit curve triangles. Curves whose extra is INSIDE flip
  // their `m` to −1 so the fragment test `(f * m) > 0 → discard`
  // cancels coverage that the detour over-introduces.
  const polygon: V2d[] = [];
  const curves: CurveTriangle[] = [];
  for (const heIdx of face.halfEdges) {
    const he = extraction.halfEdges[heIdx]!;
    const edge = graph.edges[he.edgeIndex]!;
    polygon.push(graph.vertices[he.src]!);
    if (edge.isBridge) continue;
    const segOriented = he.reversed ? edge.segment.reverse() : edge.segment;
    const breaks = chordPoints(segOriented);
    const subTriangles = classifyCurve(segOriented);
    // Sub-pieces and break-points correspond 1:1: sub-piece i ends at
    // breaks[i] (for i < N-1); the last sub-piece ends at the segment
    // end (already pushed by the next half-edge's src).
    for (let i = 0; i < subTriangles.length; i++) {
      const ct = subTriangles[i]!;
      const extra = ct.vertices[1]!;
      const inside = pointInsidePolygon(extra, chordPolygon);
      if (inside) {
        polygon.push(extra);
        curves.push({
          ...ct,
          texcoords: [flipM(ct.texcoords[0]), flipM(ct.texcoords[1]), flipM(ct.texcoords[2])],
        });
      } else {
        curves.push(ct);
      }
      // Break-point between sub-piece i and i+1 (always a polygon
      // vertex, since it lies on the actual curve).
      if (i < breaks.length) polygon.push(breaks[i]!);
    }
  }
  return { polygon, curves };
}

/**
 * Triangulate one face: emit interior flat triangles + curve
 * boundary triangles. The face is assumed to be in CCW order
 * (positive signed area); CW faces should be skipped or reversed
 * by the caller before invoking this.
 */
export function triangulateFace(
  face: Face, extraction: FaceExtractionResult, graph: PlanarGraph,
): FaceTriangulation {
  const { polygon, curves } = buildFacePolygon(face, extraction, graph);
  const triIndices = earClip(polygon);
  const flat: FlatTriangle[] = triIndices.map(([a, b, c]) => ({
    vertices: [polygon[a]!, polygon[b]!, polygon[c]!] as const,
  }));
  const ribbons = buildLineRibbons(face, extraction, graph);
  return { flat, curves, ribbons };
}

/**
 * Triangulate every face in `filledFaceIndices`. Returns flattened
 * lists of all interior + curve triangles across all faces, ready
 * for upload to the GPU.
 */
export function triangulateFilledFaces(
  filledFaceIndices: ReadonlyArray<number>,
  extraction: FaceExtractionResult,
  graph: PlanarGraph,
): FaceTriangulation {
  const flat: FlatTriangle[] = [];
  const curves: CurveTriangle[] = [];
  const ribbons: RibbonTriangle[] = [];
  for (const fi of filledFaceIndices) {
    const f = extraction.faces[fi]!;
    if (f.signedArea <= 0) continue; // skip CW / outer faces
    const tri = triangulateFace(f, extraction, graph);
    flat.push(...tri.flat);
    curves.push(...tri.curves);
    ribbons.push(...tri.ribbons);
  }
  return { flat, curves, ribbons };
}
