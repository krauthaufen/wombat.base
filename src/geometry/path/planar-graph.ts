// PlanarGraph — input to the path tessellator. Takes a flat list of
// `PathSegment`s (typically the segments of one or more closed paths
// concatenated), runs all-pairs intersection, and emits a graph of
// non-crossing sub-segments connected at shared vertices.
//
// Output shape:
//   vertices : V2d[]              — deduplicated within `eps`.
//   edges    : PlanarEdge[]       — each carries a `PathSegment` from
//                                   one V2d to another, split at every
//                                   event where it meets (or touches)
//                                   any other input segment.
//
// Each edge's `segment.start` / `segment.end` is bit-equal to the V2d
// at `vertices[edge.start]` / `vertices[edge.end]` — that property is
// inherited from `split()` sharing endpoint instances by identity (see
// `feedback_path_segment_endpoint_identity.md`). Downstream stages
// (region extraction, winding resolution, triangulation) rely on it.
//
// What is NOT handled here:
//   - Self-intersection of a single cubic Bezier (two t-values mapping
//     to the same world point along one segment). Aardvark's
//     PathSegmentIntersections likewise treats segments pairwise; a
//     dedicated `selfIntersect(seg)` pass can be added later.
//   - Collinear / coincident overlap of two segments along an interval
//     (a region of overlap, not a point). Rare for glyph outlines;
//     deferred.

import { V2d } from "../../vector/v2d.js";
import type { PathSegment } from "./segment.js";
import { intersections, DEFAULT_EPS } from "./intersect.js";

export interface PlanarEdge {
  readonly segment: PathSegment;
  readonly start: number; // index into PlanarGraph.vertices
  readonly end: number;
  /** True if this edge was inserted as a bridge between disconnected
   *  components (Stage 3.5). Bridge edges contribute to face topology
   *  but are NOT part of the actual fill boundary — they should be
   *  excluded from the rendered outline. */
  readonly isBridge?: boolean;
}

export class PlanarGraph {
  readonly vertices: ReadonlyArray<V2d>;
  readonly edges: ReadonlyArray<PlanarEdge>;
  /** For each vertex, the indices of edges incident to it (either as
   *  start or end). Built once at construction. */
  readonly incident: ReadonlyArray<ReadonlyArray<number>>;

  constructor(vertices: ReadonlyArray<V2d>, edges: ReadonlyArray<PlanarEdge>) {
    this.vertices = vertices;
    this.edges = edges;
    const inc: number[][] = vertices.map(() => []);
    for (let i = 0; i < edges.length; i++) {
      inc[edges[i]!.start]!.push(i);
      if (edges[i]!.end !== edges[i]!.start) inc[edges[i]!.end]!.push(i);
    }
    this.incident = inc;
  }
}

// ---------------------------------------------------------------------------
// Vertex dedup with spatial hash
// ---------------------------------------------------------------------------

class VertexCache {
  private readonly eps: number;
  private readonly cellSize: number;
  private readonly verts: V2d[] = [];
  private readonly buckets = new Map<string, number[]>();

  constructor(eps: number) {
    this.eps = eps;
    // Cell size = eps so neighbours within `eps` always fall in the
    // same or an adjacent cell. We probe a 3×3 neighbourhood.
    this.cellSize = eps > 0 ? eps : 1e-9;
  }

  private cellKey(cx: number, cy: number): string { return `${cx},${cy}`; }

  /**
   * Find an existing vertex within `eps` of `p`, or insert `p` and
   * return its new index. When two events from different solvers map
   * to "the same" geometric point but disagree at the 1e-12 level
   * (typical), they collapse to one vertex here.
   */
  findOrAdd(p: V2d): number {
    const cx = Math.floor(p.x / this.cellSize);
    const cy = Math.floor(p.y / this.cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = this.buckets.get(this.cellKey(cx + dx, cy + dy));
        if (list === undefined) continue;
        for (const idx of list) {
          if (this.verts[idx]!.distance(p) <= this.eps) return idx;
        }
      }
    }
    const idx = this.verts.length;
    this.verts.push(p);
    const key = this.cellKey(cx, cy);
    let own = this.buckets.get(key);
    if (own === undefined) { own = []; this.buckets.set(key, own); }
    own.push(idx);
    return idx;
  }

  toArray(): V2d[] { return this.verts.slice(); }
}

// ---------------------------------------------------------------------------
// Event collection
// ---------------------------------------------------------------------------

const T_DEDUP_EPS = 1e-9;

/**
 * Sort + dedup interior t-values. Endpoints (t=0, t=1) are NOT in the
 * input list — they're handled separately as the bracketing
 * sub-segment's natural start/end.
 */
function sortDedupTs(ts: number[]): number[] {
  if (ts.length === 0) return ts;
  ts.sort((a, b) => a - b);
  const out: number[] = [ts[0]!];
  for (let i = 1; i < ts.length; i++) {
    if (ts[i]! - out[out.length - 1]! > T_DEDUP_EPS) out.push(ts[i]!);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a planar graph from a flat list of path segments (typically
 * concatenated from one or more closed paths). All-pairs intersection
 * runs at `eps`; sub-segments are emitted after splitting at every
 * intersection event whose `t` lies strictly inside `(0, 1)`.
 *
 * Cost: O(n²) intersection probes. For glyph-scale n ≤ ~200 that's
 * fine; if it ever matters, add a bbox BVH pre-filter.
 */
export function buildPlanarGraph(
  segments: ReadonlyArray<PathSegment>,
  eps: number = DEFAULT_EPS,
): PlanarGraph {
  const n = segments.length;
  const events: number[][] = [];
  for (let i = 0; i < n; i++) events.push([]);

  // Pairwise intersection. For (i, j) with i < j, both directions
  // record their respective t. We skip i == j — self-intersection of
  // a single segment is intentionally out of scope here.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const hits = intersections(segments[i]!, segments[j]!, eps);
      for (const [ta, tb] of hits) {
        if (ta > T_DEDUP_EPS && ta < 1 - T_DEDUP_EPS) events[i]!.push(ta);
        if (tb > T_DEDUP_EPS && tb < 1 - T_DEDUP_EPS) events[j]!.push(tb);
      }
    }
  }

  for (let i = 0; i < n; i++) events[i] = sortDedupTs(events[i]!);

  const cache = new VertexCache(eps);
  const edges: PlanarEdge[] = [];

  for (let i = 0; i < n; i++) {
    const seg = segments[i]!;
    const ts = events[i]!;
    if (ts.length === 0) {
      // No interior events — emit the whole segment as one edge.
      const s = cache.findOrAdd(seg.start);
      const e = cache.findOrAdd(seg.end);
      edges.push({ segment: seg, start: s, end: e });
      continue;
    }
    // Walk the sorted events, splitting `current` at the local
    // parameter that maps the global t into the remaining piece.
    let current: PathSegment = seg;
    let prevT = 0;
    for (const t of ts) {
      const local = (t - prevT) / (1 - prevT);
      const [left, right] = current.split(local);
      const sV = cache.findOrAdd(left.start);
      const eV = cache.findOrAdd(left.end);
      edges.push({ segment: left, start: sV, end: eV });
      current = right;
      prevT = t;
    }
    const sV = cache.findOrAdd(current.start);
    const eV = cache.findOrAdd(current.end);
    edges.push({ segment: current, start: sV, end: eV });
  }

  return new PlanarGraph(cache.toArray(), edges);
}
