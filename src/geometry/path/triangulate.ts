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
} from "./loop-blinn.js";

export interface FlatTriangle {
  /** World-space vertices of the triangle (CCW). */
  readonly vertices: readonly [V2d, V2d, V2d];
}

export interface FaceTriangulation {
  /** Interior triangles of the flat polygon approximation. */
  readonly flat: ReadonlyArray<FlatTriangle>;
  /** Loop-Blinn boundary triangles for each curved segment in the
   *  face's boundary, paired with `bulgesOutward` so the renderer
   *  knows whether the curve adds to or subtracts from the flat
   *  interior. */
  readonly curves: ReadonlyArray<CurveTriangle>;
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
function buildFacePolygon(
  face: Face, extraction: FaceExtractionResult, graph: PlanarGraph,
): { polygon: V2d[]; curves: CurveTriangle[] } {
  const polygon: V2d[] = [];
  const curves: CurveTriangle[] = [];
  for (const heIdx of face.halfEdges) {
    const he = extraction.halfEdges[heIdx]!;
    const edge = graph.edges[he.edgeIndex]!;
    // The polygon's vertex at this half-edge is `he.src`'s position.
    polygon.push(graph.vertices[he.src]!);
    // Bridges don't produce curves and aren't part of the rendered
    // outline; skip their classification.
    if (edge.isBridge) continue;
    // For a forward half-edge we use the segment as-is; for reversed
    // we flip via `seg.reverse()` before classifying so the curve
    // triangle's vertex order matches the face traversal.
    const segOriented = he.reversed ? edge.segment.reverse() : edge.segment;
    for (const ct of classifyCurve(segOriented)) curves.push(ct);
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
  return { flat, curves };
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
  for (const fi of filledFaceIndices) {
    const f = extraction.faces[fi]!;
    if (f.signedArea <= 0) continue; // skip CW / outer faces
    const tri = triangulateFace(f, extraction, graph);
    flat.push(...tri.flat);
    curves.push(...tri.curves);
  }
  return { flat, curves };
}
