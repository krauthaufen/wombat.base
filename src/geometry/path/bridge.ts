// Stage 3.5d — Bridge edge insertion.
//
// Given a (possibly) disconnected planar graph, augment it with
// bridge edges so the result is connected and every face has a
// well-defined winding number. Bridge edges are added between each
// non-root component's leftmost vertex and the closest edge in its
// immediately-enclosing component, found by casting a horizontal ray
// in the −x direction.
//
// Why "closest in −x direction": the leftward-ray closest hit always
// belongs to the IMMEDIATELY enclosing component, never a more-
// distant ancestor — so the bridge segment is automatically guaranteed
// non-crossing with every other component (anything closer would
// have been hit first). Standard CG bridging technique.
//
// If the closest hit lands at an existing vertex (within `eps`),
// that vertex is the bridge target. Otherwise the host edge is
// split at the hit parameter — creating a new vertex — and the
// bridge connects to it.
//
// Bridges are flagged with `isBridge: true`. Faces and windings are
// computed against the augmented graph; the user's fill renderer
// excludes bridge edges from the rendered outline.

import { V2d } from "../../vector/v2d.js";
import { Box2d } from "../../box/box2d.js";
import {
  type PathSegment, LineSegment,
} from "./segment.js";
import {
  PlanarGraph, type PlanarEdge,
} from "./planar-graph.js";
import type { ComponentDecomposition } from "./components.js";
import {
  realRootsOfQuadratic, realRootsOfCubic,
} from "../../numerics/polynomial.js";
import { DEFAULT_EPS } from "./intersect.js";

// ---------------------------------------------------------------------------
// Per-segment "y-line crossing" finder
// ---------------------------------------------------------------------------

interface YCrossing { readonly t: number; readonly x: number; }

const T_EPS = 1e-9;

function lineYCrossings(p: V2d, l: LineSegment): YCrossing[] {
  const dy = l.end.y - l.start.y;
  if (Math.abs(dy) < 1e-15) return [];
  const t = (p.y - l.start.y) / dy;
  if (t < -T_EPS || t > 1 + T_EPS) return [];
  const tc = t < 0 ? 0 : t > 1 ? 1 : t;
  return [{ t: tc, x: l.start.x + tc * (l.end.x - l.start.x) }];
}

function bez2YCrossings(p: V2d, b: PathSegment & { kind: "bezier2" }): YCrossing[] {
  const seg = b as { start: V2d; control: V2d; end: V2d };
  const ay = seg.start.y - 2 * seg.control.y + seg.end.y;
  const by = 2 * (seg.control.y - seg.start.y);
  const cy = seg.start.y - p.y;
  const [t0, t1] = realRootsOfQuadratic(ay, by, cy);
  const out: YCrossing[] = [];
  for (const t of [t0, t1]) {
    if (!Number.isFinite(t) || t < -T_EPS || t > 1 + T_EPS) continue;
    const tc = t < 0 ? 0 : t > 1 ? 1 : t;
    const u = 1 - tc;
    out.push({
      t: tc,
      x: u * u * seg.start.x + 2 * u * tc * seg.control.x + tc * tc * seg.end.x,
    });
  }
  return out;
}

function bez3YCrossings(p: V2d, b: PathSegment & { kind: "bezier3" }): YCrossing[] {
  const seg = b as { start: V2d; control1: V2d; control2: V2d; end: V2d };
  const c3 = -seg.start.y + 3 * seg.control1.y - 3 * seg.control2.y + seg.end.y;
  const c2 = 3 * (seg.start.y - 2 * seg.control1.y + seg.control2.y);
  const c1 = 3 * (seg.control1.y - seg.start.y);
  const c0 = seg.start.y - p.y;
  const [t0, t1, t2] = realRootsOfCubic(c3, c2, c1, c0);
  const out: YCrossing[] = [];
  for (const t of [t0, t1, t2]) {
    if (!Number.isFinite(t) || t < -T_EPS || t > 1 + T_EPS) continue;
    const tc = t < 0 ? 0 : t > 1 ? 1 : t;
    const u = 1 - tc;
    out.push({
      t: tc,
      x: u * u * u * seg.start.x
         + 3 * u * u * tc * seg.control1.x
         + 3 * u * tc * tc * seg.control2.x
         + tc * tc * tc * seg.end.x,
    });
  }
  return out;
}

function arcYCrossings(p: V2d, a: PathSegment & { kind: "arc" }): YCrossing[] {
  const seg = a as {
    start: V2d; end: V2d;
    center: V2d; axis0: V2d; axis1: V2d;
    startAngle: number; deltaAngle: number;
  };
  const A = seg.axis0.y, B = seg.axis1.y, C = p.y - seg.center.y;
  const angles: number[] = [];
  if (Math.abs(A + C) < 1e-15) {
    if (Math.abs(B) < 1e-15) return [];
    const tt = (C - A) / (2 * B);
    angles.push(2 * Math.atan(tt));
  } else {
    const [t0, t1] = realRootsOfQuadratic(A + C, -2 * B, C - A);
    if (Number.isFinite(t0)) angles.push(2 * Math.atan(t0));
    if (Number.isFinite(t1) && Math.abs(t1 - t0) > 1e-12) angles.push(2 * Math.atan(t1));
  }
  const out: YCrossing[] = [];
  for (const theta of angles) {
    let dTheta = theta - seg.startAngle;
    if (seg.deltaAngle > 0) {
      while (dTheta < -T_EPS) dTheta += 2 * Math.PI;
      while (dTheta > 2 * Math.PI + T_EPS) dTheta -= 2 * Math.PI;
    } else if (seg.deltaAngle < 0) {
      while (dTheta > T_EPS) dTheta -= 2 * Math.PI;
      while (dTheta < -2 * Math.PI - T_EPS) dTheta += 2 * Math.PI;
    } else continue;
    const t = dTheta / seg.deltaAngle;
    if (t < -T_EPS || t > 1 + T_EPS) continue;
    const tc = t < 0 ? 0 : t > 1 ? 1 : t;
    const x = seg.center.x
            + Math.cos(theta) * seg.axis0.x
            + Math.sin(theta) * seg.axis1.x;
    out.push({ t: tc, x });
  }
  return out;
}

function segmentYCrossings(p: V2d, seg: PathSegment): YCrossing[] {
  switch (seg.kind) {
    case "line":    return lineYCrossings(p, seg);
    case "bezier2": return bez2YCrossings(p, seg);
    case "bezier3": return bez3YCrossings(p, seg);
    case "arc":     return arcYCrossings(p, seg);
  }
}

// ---------------------------------------------------------------------------
// Closest leftward edge crossing
// ---------------------------------------------------------------------------

interface BridgeTarget {
  readonly edgeIndex: number;
  readonly t: number;
  readonly point: V2d;
}

/**
 * Cast a horizontal ray from `p` going in the −x direction; among
 * all candidate edges, find the one whose closest crossing has the
 * largest `x` strictly less than `p.x`. Returns `undefined` if no
 * candidate edge intersects the leftward ray.
 */
function closestLeftCrossing(
  p: V2d,
  candidateEdgeIndices: ReadonlyArray<number>,
  edges: ReadonlyArray<PlanarEdge>,
): BridgeTarget | undefined {
  let best: BridgeTarget | undefined;
  for (const eIdx of candidateEdgeIndices) {
    const seg = edges[eIdx]!.segment;
    for (const c of segmentYCrossings(p, seg)) {
      if (c.x >= p.x - 1e-12) continue; // strictly left of p
      if (best === undefined || c.x > best.point.x) {
        best = { edgeIndex: eIdx, t: c.t, point: new V2d(c.x, p.y) };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Public API: connect components by bridging
// ---------------------------------------------------------------------------

/**
 * Augment `graph` with bridge edges so its half-edge graph becomes
 * connected. For each component except those that aren't enclosed by
 * any other (the "roots"), a bridge edge is added from the
 * component's leftmost vertex to the closest leftward crossing on a
 * different component's edge — splitting that edge if the hit is
 * interior to it.
 *
 * Return value: a new `PlanarGraph` whose edges are
 *   1. the original edges that weren't split,
 *   2. the two halves of any edge that was split for a bridge,
 *   3. the bridge edges themselves (with `isBridge: true`).
 *
 * The original `graph` is not mutated.
 */
export function connectComponents(
  graph: PlanarGraph,
  decomposition: ComponentDecomposition,
  eps: number = DEFAULT_EPS,
): PlanarGraph {
  if (decomposition.components.length <= 1) return graph;

  // For each component, decide whether it has a bridge target. A
  // component with no leftward crossing is a "root" (top-level
  // unenclosed) and gets no bridge.
  interface Plan {
    fromVertex: number;
    target: BridgeTarget;
  }
  const plans: Plan[] = [];
  for (const c of decomposition.components) {
    const v = c.leftmostVertex;
    const p = graph.vertices[v]!;
    // Candidate edges: all edges NOT in this component.
    const candidates: number[] = [];
    for (let eIdx = 0; eIdx < graph.edges.length; eIdx++) {
      const heComp = decomposition.componentOfHalfEdge[2 * eIdx]!;
      if (heComp !== c.index) candidates.push(eIdx);
    }
    const target = closestLeftCrossing(p, candidates, graph.edges);
    if (target !== undefined) plans.push({ fromVertex: v, target });
  }

  if (plans.length === 0) return graph;

  // Build the augmented graph. Strategy:
  //   - Group plans by host edge so an edge split by multiple bridges
  //     splits only once (or in t-sorted order).
  //   - For each non-split edge, copy through.
  //   - For each split edge, replace with sub-segments + emit bridge
  //     edges to the split-point vertices.
  const newVertices: V2d[] = graph.vertices.slice();
  const newEdges: PlanarEdge[] = [];

  // Map edgeIndex → list of { t, planIndex }
  const splits = new Map<number, Array<{ t: number; planIndex: number }>>();
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i]!;
    let list = splits.get(p.target.edgeIndex);
    if (list === undefined) { list = []; splits.set(p.target.edgeIndex, list); }
    list.push({ t: p.target.t, planIndex: i });
  }

  // For each plan, the "to vertex" index in newVertices.
  const planToVertex: number[] = new Array(plans.length).fill(-1);

  // Process edges: keep unaltered ones, split altered ones.
  for (let eIdx = 0; eIdx < graph.edges.length; eIdx++) {
    const e = graph.edges[eIdx]!;
    const list = splits.get(eIdx);
    if (list === undefined || list.length === 0) {
      newEdges.push(e);
      continue;
    }
    // Sort splits ascending in t; deduplicate (within `eps` in t).
    list.sort((a, b) => a.t - b.t);
    const dedup: Array<{ t: number; planIndex: number }> = [];
    for (const item of list) {
      if (dedup.length === 0 || item.t - dedup[dedup.length - 1]!.t > 1e-9) {
        dedup.push(item);
      } else {
        // Two plans want the same split point; share the vertex.
        planToVertex[item.planIndex] = -2; // marker; resolved below
      }
    }
    // Walk the segment, splitting at each t.
    let current: PathSegment = e.segment;
    let prevT = 0;
    let leftStartVertex = e.start;
    for (let k = 0; k < dedup.length; k++) {
      const tGlobal = dedup[k]!.t;
      const local = (tGlobal - prevT) / (1 - prevT);
      const [left, right] = current.split(local);
      // Add new vertex at left.end (= right.start, by identity).
      const splitPoint = left.end;
      // If close to an existing endpoint of the original edge, snap.
      let splitVi: number;
      if (k === 0 && splitPoint.distance(graph.vertices[e.start]!) <= eps) {
        splitVi = e.start;
      } else if (k === dedup.length - 1
                 && splitPoint.distance(graph.vertices[e.end]!) <= eps) {
        splitVi = e.end;
      } else {
        splitVi = newVertices.length;
        newVertices.push(splitPoint);
      }
      newEdges.push({
        segment: left, start: leftStartVertex, end: splitVi,
      });
      planToVertex[dedup[k]!.planIndex] = splitVi;
      // Resolve any duplicate plans that snapped to this split.
      for (let i = 0; i < plans.length; i++) {
        if (planToVertex[i] === -2) {
          const wantT = plans[i]!.target.t;
          if (Math.abs(wantT - tGlobal) <= 1e-9
              && plans[i]!.target.edgeIndex === eIdx) {
            planToVertex[i] = splitVi;
          }
        }
      }
      current = right;
      prevT = tGlobal;
      leftStartVertex = splitVi;
    }
    newEdges.push({ segment: current, start: leftStartVertex, end: e.end });
  }

  // Emit bridge edges.
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]!;
    const toV = planToVertex[i]!;
    if (toV < 0) continue; // failsafe
    const fromPos = newVertices[plan.fromVertex]!;
    const toPos = newVertices[toV]!;
    newEdges.push({
      segment: new LineSegment(fromPos, toPos),
      start: plan.fromVertex,
      end: toV,
      isBridge: true,
    });
  }

  return new PlanarGraph(newVertices, newEdges);
}
