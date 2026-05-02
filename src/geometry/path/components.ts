// Connected-component detection over a `FaceExtractionResult`.
//
// Two faces are in the same component iff their boundary cycles are
// linked through shared edges (half-edge twins). BFS via the
// twin/next pointers traverses all half-edges reachable from any
// starting half-edge, partitioning the planar subdivision.
//
// Each component is summarised by:
//   - the half-edges, faces, vertices, and edges it contains
//   - the face with the most-negative signed area (its "local outer")
//   - the bounding box of its vertices
//   - the leftmost vertex (smallest x, ties broken by smallest y) —
//     used by Stage 3.5d as the bridge anchor when the component is
//     enclosed by another.

import { V2d } from "../../vector/v2d.js";
import type { PlanarGraph } from "./planar-graph.js";
import type { FaceExtractionResult } from "./face-extract.js";
import { Box2d } from "../../box/box2d.js";

export interface ComponentInfo {
  readonly index: number;
  /** Half-edge indices belonging to this component. */
  readonly halfEdgeIndices: ReadonlyArray<number>;
  /** Face indices whose boundary lies in this component. */
  readonly faceIndices: ReadonlyArray<number>;
  /** Edge indices (each `PlanarEdge`) belonging to this component. */
  readonly edgeIndices: ReadonlyArray<number>;
  /** Vertex indices participating in this component. */
  readonly vertexIndices: ReadonlyArray<number>;
  /** Face with the most-negative signed area within this component. */
  readonly outerFaceIndex: number;
  /** Tight bbox of the component's vertices. */
  readonly bounds: Box2d;
  /** Index of the leftmost vertex (min x, then min y). */
  readonly leftmostVertex: number;
}

export interface ComponentDecomposition {
  readonly components: ReadonlyArray<ComponentInfo>;
  /** For each face index, the component it belongs to. */
  readonly componentOfFace: ReadonlyArray<number>;
  /** For each half-edge index, the component it belongs to. */
  readonly componentOfHalfEdge: ReadonlyArray<number>;
}

export function detectComponents(
  extraction: FaceExtractionResult,
  graph: PlanarGraph,
): ComponentDecomposition {
  const { halfEdges, faces, faceOfHalfEdge } = extraction;
  const componentOfHalfEdge = new Array<number>(halfEdges.length).fill(-1);
  const componentOfFace = new Array<number>(faces.length).fill(-1);
  const components: ComponentInfo[] = [];

  for (let seed = 0; seed < halfEdges.length; seed++) {
    if (componentOfHalfEdge[seed]! >= 0) continue;
    const compIndex = components.length;
    const heList: number[] = [];
    const faceSet = new Set<number>();
    const edgeSet = new Set<number>();
    const vertexSet = new Set<number>();

    const queue = [seed];
    while (queue.length > 0) {
      const h = queue.pop()!;
      if (componentOfHalfEdge[h]! >= 0) continue;
      componentOfHalfEdge[h] = compIndex;
      heList.push(h);
      const he = halfEdges[h]!;
      faceSet.add(faceOfHalfEdge[h]!);
      edgeSet.add(he.edgeIndex);
      vertexSet.add(he.src);
      vertexSet.add(he.dst);
      // Adjacent half-edges in the same component:
      //   - twin (other side of same edge)
      //   - next (next in face cycle)
      // (twin alone would suffice for component detection, but
      //  including next makes the BFS converge in fewer iterations
      //  on typical glyph topologies.)
      if (componentOfHalfEdge[he.twin]! < 0) queue.push(he.twin);
      if (componentOfHalfEdge[he.next]! < 0) queue.push(he.next);
    }

    // Local outer face = most-negative-area face among this comp's faces.
    let outerFace = -1;
    let minArea = Infinity;
    for (const f of faceSet) {
      componentOfFace[f] = compIndex;
      if (faces[f]!.signedArea < minArea) {
        minArea = faces[f]!.signedArea;
        outerFace = f;
      }
    }

    // Component bbox + leftmost vertex.
    let bb = Box2d.empty;
    let leftmost = -1;
    let leftX = Infinity, leftY = Infinity;
    for (const v of vertexSet) {
      const p = graph.vertices[v]!;
      bb = bb.extend(p);
      if (p.x < leftX || (p.x === leftX && p.y < leftY)) {
        leftX = p.x; leftY = p.y; leftmost = v;
      }
    }

    components.push({
      index: compIndex,
      halfEdgeIndices: heList,
      faceIndices: Array.from(faceSet),
      edgeIndices: Array.from(edgeSet),
      vertexIndices: Array.from(vertexSet),
      outerFaceIndex: outerFace,
      bounds: bb,
      leftmostVertex: leftmost,
    });
  }

  return { components, componentOfFace, componentOfHalfEdge };
}
