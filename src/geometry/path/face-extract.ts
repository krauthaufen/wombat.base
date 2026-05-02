// Face extraction from a `PlanarGraph`. Builds a Doubly Connected Edge
// List (DCEL) — every undirected edge becomes two directed half-edges
// — and walks face cycles via the standard "rotate around the
// destination vertex" formula:
//
//   next(h) = the outgoing half-edge at h.dst that is immediately CW
//             before h.twin in the CCW cyclic order at h.dst.
//
// Equivalently, `next = prev_in_cyclic_order(twin)`. The face on the
// LEFT of each half-edge is the one being traced.
//
// The unbounded outer face is the unique face traced clockwise; its
// signed area is the most negative across all faces. Bounded faces
// have positive signed area when traced CCW.
//
// Curved edges (Beziers / arcs) contribute their tangent direction at
// the start vertex (or the negated end-tangent for reverse half-edges)
// to the cyclic angle ordering, and their analytic `signedAreaTerm()`
// to face areas.

import type { PathSegment } from "./segment.js";
import type { PlanarGraph } from "./planar-graph.js";

export interface HalfEdge {
  /** Index into `graph.edges`. */
  readonly edgeIndex: number;
  /** True if this half-edge traverses its underlying segment from
   *  end → start (i.e. the reverse of `segment`'s native parameter). */
  readonly reversed: boolean;
  /** Source vertex index (where this half-edge departs from). */
  readonly src: number;
  /** Destination vertex index (where it arrives). */
  readonly dst: number;
  /** Tangent angle leaving `src`, in radians, range `(-π, π]`. */
  readonly outgoingAngle: number;
  /** Index of the reverse half-edge sharing the same edge. */
  readonly twin: number;
  /** Index of the next half-edge in the same face cycle. */
  next: number;
}

export interface Face {
  /** Half-edge indices forming the face boundary, in traversal order
   *  (closed cycle: `face.halfEdges[0]` follows `face.halfEdges[last]`). */
  readonly halfEdges: ReadonlyArray<number>;
  /** Signed area of the face. Positive = bounded (CCW); negative =
   *  outer (CW around bounded regions). */
  readonly signedArea: number;
}

export interface FaceExtractionResult {
  readonly halfEdges: ReadonlyArray<HalfEdge>;
  readonly faces: ReadonlyArray<Face>;
  /** Index in `faces` of the unbounded outer face (the one with
   *  most-negative signed area), or `-1` if the graph is empty. */
  readonly outerFaceIndex: number;
  /** For each half-edge index, the index of the face it bounds. */
  readonly faceOfHalfEdge: ReadonlyArray<number>;
}

function angleAt(seg: PathSegment, atStart: boolean): number {
  // For half-edges traversing the segment in reverse direction, the
  // outgoing tangent at the destination-as-source is the negated
  // end-tangent of the segment's native parameterization.
  const d = atStart ? seg.derivative(0) : seg.derivative(1).neg();
  return Math.atan2(d.y, d.x);
}

/**
 * Build the half-edge graph and walk face cycles.
 *
 * Cost: O(V + E + Σ deg(v) log deg(v)) — linear in the graph plus a
 * sort per vertex over its incident half-edges.
 */
export function extractFaces(graph: PlanarGraph): FaceExtractionResult {
  const halfEdges: HalfEdge[] = [];
  for (let i = 0; i < graph.edges.length; i++) {
    const e = graph.edges[i]!;
    halfEdges.push({
      edgeIndex: i, reversed: false,
      src: e.start, dst: e.end,
      outgoingAngle: angleAt(e.segment, true),
      twin: 2 * i + 1, next: -1,
    });
    halfEdges.push({
      edgeIndex: i, reversed: true,
      src: e.end, dst: e.start,
      outgoingAngle: angleAt(e.segment, false),
      twin: 2 * i, next: -1,
    });
  }

  // Per-vertex outgoing half-edges, sorted CCW by angle.
  const outgoing: number[][] = graph.vertices.map(() => []);
  for (let h = 0; h < halfEdges.length; h++) {
    outgoing[halfEdges[h]!.src]!.push(h);
  }
  for (const list of outgoing) {
    list.sort((a, b) => halfEdges[a]!.outgoingAngle - halfEdges[b]!.outgoingAngle);
  }

  // For each half-edge h ending at vertex w:
  //   - find h.twin's index in w's CCW-sorted outgoing list
  //   - next(h) is the half-edge one position CW (= index − 1 mod n)
  for (let h = 0; h < halfEdges.length; h++) {
    const tw = halfEdges[h]!.twin;
    const w = halfEdges[h]!.dst;
    const list = outgoing[w]!;
    const idx = list.indexOf(tw);
    if (idx < 0) {
      throw new Error(`extractFaces: twin ${tw} missing from vertex ${w}'s outgoing list`);
    }
    const prevIdx = (idx - 1 + list.length) % list.length;
    halfEdges[h]!.next = list[prevIdx]!;
  }

  // Walk face cycles.
  const visited = new Uint8Array(halfEdges.length);
  const faceOfHalfEdge = new Array<number>(halfEdges.length).fill(-1);
  const faces: Face[] = [];
  let outerFaceIndex = -1;
  let mostNegativeArea = 0;

  for (let start = 0; start < halfEdges.length; start++) {
    if (visited[start]) continue;
    const cycle: number[] = [];
    let h = start;
    let safety = 0;
    while (!visited[h]) {
      if (++safety > halfEdges.length + 1) {
        throw new Error("extractFaces: face cycle did not close — corrupted next pointers");
      }
      visited[h] = 1;
      cycle.push(h);
      h = halfEdges[h]!.next;
    }

    // Sum of segment area terms, sign-flipped on reversed half-edges.
    let area = 0;
    for (const he of cycle) {
      const e = graph.edges[halfEdges[he]!.edgeIndex]!;
      const term = e.segment.signedAreaTerm();
      area += halfEdges[he]!.reversed ? -term : term;
    }

    const faceIndex = faces.length;
    faces.push({ halfEdges: cycle, signedArea: area });
    for (const he of cycle) faceOfHalfEdge[he] = faceIndex;
    if (area < mostNegativeArea) {
      mostNegativeArea = area;
      outerFaceIndex = faceIndex;
    }
  }

  return { halfEdges, faces, outerFaceIndex, faceOfHalfEdge };
}
