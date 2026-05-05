// Per-glyph band geometry: triangulated annulus around every contour
// at ±halo, used by the per-pixel SDF text effect for AA.
//
// Pipeline:
//   1. For each contour, sample as a closed polyline (chunk starts
//      from `expandContour` — straight edges become a single segment,
//      bezier2 edges get adaptively subdivided to bound chord error).
//   2. Feed all contour polylines into Clipper (clipper-lib 1.x) as
//      a single subject. Run two `ClipperOffset.Execute` passes:
//        - `+halo` → outer offset paths
//        - `-halo` → inner offset paths
//      Clipper handles miter capping (bevel fallback at acute joins),
//      hole detection (CCW outer + CW inner stay correctly wound),
//      self-intersection clipping at thin parts, and produces
//      topologically clean closed paths.
//   3. `Clipper.Execute(Difference, outer - inner, NonZero)` →
//      annulus paths. Each output path is a simple closed polygon
//      (or hole) with proper winding for libtess.
//   4. Triangulate the annulus paths via libtess EVEN-ODD. EVEN-ODD
//      is orientation-agnostic so we don't have to track which
//      Clipper output paths are holes.
//
// Why we no longer try to build the band ourselves with chunk-quads
// or hand-rolled offset polylines:
//   - Hand-rolled overlapping chunk-quads + miter triangles + libtess
//     POSITIVE union: works for the geometry but produces sub-pixel
//     holes from libtess slivering on collinear shared edges and
//     T-junctions between adjacent chunk quads and their miter
//     polygons.
//   - Hand-rolled offset polylines (one outer + one inner per
//     contour, with bisector miters): blows up at sharp concave
//     corners (uncapped miter = giant spike) and self-intersects on
//     thin glyph parts, producing alternating filled/empty rings
//     under EVEN-ODD.
//   - Clipper2-js (the more recent JS port): produced garbage output
//     even on a unit-square inflation — port bug. The older
//     clipper-lib (Clipper 1.x) works correctly.
//
// Each emitted triangle currently carries no per-tri candidate
// metadata — the FS iterates the glyph's full curve+line SSBO range
// from triFirst..triCount per fragment. Bounded but heavy on small
// mobile GPUs; per-tri SSBO range clipping is on the followup list.

import { V2d } from "../vector/v2d.js";
import type {
  OutlineEdge,
} from "../geometry/path/triangulate.js";
import type { CurveTriangle } from "../geometry/path/loop-blinn.js";
import { tessellateContoursLibtess } from "../geometry/path/libtess-fill.js";
import { pointInsidePolygon } from "../geometry/path/triangulate.js";
import ClipperLib from "clipper-lib";

interface ClipperPt { X: number; Y: number; }
type ClipperPath = ClipperPt[];
type ClipperPaths = ClipperPath[];

export interface BandTriangle {
  /** Three world-space vertices in CCW order (em coords). */
  readonly vertices: readonly [V2d, V2d, V2d];
}

/** Subdivide-or-not threshold (chord deviation as fraction of haloEm). */
const CHORD_TOL = 0.25;

/** Hard cap on subdivisions per curve edge, just to bound geometry. */
const MAX_CHUNKS = 16;

/** Miter length cap: past this multiple of haloEm the bisector miter
 *  is replaced by a bevel (two perpendicular offset points). */
const MITER_CAP = 4.0;

interface BandChunk {
  readonly a: V2d;
  readonly b: V2d;
  readonly tA: V2d;
  readonly tB: V2d;
  /** Index into the GLYPH's `curves` array (synthetic curves for line
   *  edges have already been allocated by the caller). */
  readonly curveIndex: number;
}

/**
 * Build a flat list of band triangles covering the halo region of
 * every contour. The result is a tessellation of the polygon union
 * (outer offset minus inner offset) per contour, with per-triangle
 * candidate-curve tagging for the SDF lookup.
 */
/**
 * Build the band as the boolean union of per-chunk thick-stroke
 * quads via libtess.
 *
 * Each chunk emits a CCW quad (perpendicular trapezoid extruded
 * ±halo from chunk's a/b along the chunk's local tangent normals).
 * Quads from adjacent chunks share their edge vertices; quads from
 * thin glyph parts may overlap on the inside (inner offset of
 * concave corners crosses opposite contour). We pass every quad as
 * a SEPARATE positively-wound contour to libtess and use the
 * POSITIVE winding rule, so libtess fills wherever any quad covers
 * and the output is a non-overlapping tessellation of the union.
 *
 * Earlier attempts tried polygon-union via offset polylines as one
 * closed ring per contour — that worked for simple shapes but
 * NONZERO winding on self-intersecting inner offsets cancelled
 * regions where windings opposed, leaving sub-percent gaps in the
 * band. POSITIVE winding on independent per-chunk quads has no
 * cancellation: a region is filled iff at least one quad covers it.
 */
export function buildGlyphBand(
  outlineContours: ReadonlyArray<ReadonlyArray<OutlineEdge>>,
  curves: ReadonlyArray<CurveTriangle>,
  haloEm: number,
): BandTriangle[] {
  // Band = ClipperOffset(innerApprox, +halo) DIFFERENCE innerApprox.
  //
  //   innerApprox = piecewise-linear polyline that lies INSIDE the
  //                 body, by edge:
  //                   line / arc / cubic    → chord (line IS body)
  //                   bezier2 outward bulge → chord (chord is inside
  //                                           body; the lens between
  //                                           chord and curve is body
  //                                           fill via the Loop-Blinn
  //                                           lens triangle)
  //                   bezier2 inward bulge  → legs p0-p1-p2 (p1 is
  //                                           inside body, so legs
  //                                           lie inside)
  //   inflated    = innerApprox grown by halo in every direction.
  //   band        = inflated − innerApprox = halo-wide strip on the
  //                 OUTSIDE of innerApprox.
  //
  // No -halo offset: the inside of innerApprox is body, where the
  // kind=0/1/2 body fill already produces α=1 — band work there is
  // wasted overdraw. Difference clears it.
  //
  // Overlap with the body: at outward-bulging edges, innerApprox
  // takes the chord, but the actual body extends out to the curve
  // (via the kind=1 lens). The band's outer halo strip therefore
  // overlaps the lens — harmless because the lens already paints
  // α=1, and SDF distance for those band fragments still gives the
  // correct AA ramp at the actual curve boundary.
  // Clipper uses integer coords, so scale up em-space floats. SCALE
  // must be high enough that round-off is well below sub-pixel —
  // otherwise the band's Clipper-quantized inner boundary doesn't
  // match the body's exact-em-space outer boundary, and the
  // rasterizer flickers between the two slightly-different edges
  // along the seam. 2^20 = ~1e-6 em precision (sub-pixel even at
  // pathological zoom). Stays well within JS safe-int range under
  // Clipper's coord×coord internals (53-bit / 2 = 2^26 limit).
  const SCALE = 1 << 20;
  // Pre-compute the chord polygon (= polygon of anchor points) for
  // every contour. The "inside body" test for each curve's control
  // point P1 is even-odd parity over these chord polygons: P1 is in
  // body iff an odd number of contour chord polygons contain it.
  // This matches what the mesh tessellator uses to decide ADD vs
  // SUBTRACT on the curve's lens — orientation-independent.
  const chordPolys: V2d[][] = outlineContours.map((c) => c.map((e) => e.start));
  const innerExact: V2d[][] = [];
  const innerSubj: ClipperPaths = [];
  for (const contour of outlineContours) {
    const inner = buildInsideBodyPolyline(contour, curves, chordPolys);
    if (inner.length < 3) continue;
    innerExact.push(inner);
    innerSubj.push(vec2dPathToClipper(inner, SCALE));
  }
  if (innerSubj.length === 0) return [];
  const delta = haloEm * SCALE;
  const lib = ClipperLib as unknown as {
    ClipperOffset: new (miterLimit: number, arcTolerance: number) => {
      AddPaths(paths: ClipperPaths, joinType: number, endType: number): void;
      Execute(out: ClipperPaths, delta: number): void;
    };
    JoinType: { jtMiter: number };
    EndType: { etClosedPolygon: number };
  };
  // Use Clipper ONLY for the offset (we have no closed-form polygon
  // offsetter, and Clipper handles miter caps + concave clipping
  // correctly). The output is Clipper-quantized, but the inflated
  // boundary is OUTSIDE the body where no other geometry lives, so
  // quantization there can't cause a body/band seam mismatch.
  //
  // The inner polyline is NOT passed through Clipper — we hand it
  // straight to libtess at exact em-space coords. That keeps it
  // bit-identical to the body fill's outline, so body and band
  // share their seam pixel-perfectly with no flicker.
  //
  // libtess EVEN-ODD on the union of (inner polylines + inflated
  // polylines) fills regions inside an odd number of inputs:
  //   - inside body, inside its inflated: even (2), empty.
  //   - between body and inflated (outer band strip): odd (1), filled.
  //   - inside hole, inside hole-inflated (= shrunken hole interior,
  //     deep inside hole): even (4 — outer-CCW + outer-inflated-CCW
  //     + hole-CW + hole-inflated-CW), empty.
  //   - inside hole, OUTSIDE hole-inflated (= halo-wide strip just
  //     inside the hole boundary): odd (3), filled. This is the
  //     hole-side band.
  // Outer/inner polyline orientations are preserved through Clipper
  // (CCW outer stays CCW; CW hole stays CW), giving the parity above
  // automatically.
  const offset = new lib.ClipperOffset(4.0, 0.25);
  offset.AddPaths(innerSubj, lib.JoinType.jtMiter, lib.EndType.etClosedPolygon);
  const inflatedClipper: ClipperPaths = [];
  offset.Execute(inflatedClipper, +delta);
  const polylines: V2d[][] = [];
  for (const inner of innerExact) polylines.push([...inner]);
  for (const path of inflatedClipper) {
    if (path.length < 3) continue;
    const poly: V2d[] = [];
    for (const p of path) poly.push(new V2d(p.X / SCALE, p.Y / SCALE));
    polylines.push(poly);
  }
  if (polylines.length === 0) return [];
  const tris = tessellateContoursLibtess(polylines, "even-odd");
  return tris.map((t) => ({
    vertices: [t.vertices[0]!, t.vertices[1]!, t.vertices[2]!] as const,
  }));
}

/**
 * Walk the contour and emit a piecewise-linear polyline that lies
 * INSIDE the body. Classification matches the mesh tessellator
 * (triangulate.ts ~line 430):
 *   - chord polygon = polygon of contour anchor points (each
 *     edge's start vertex).
 *   - For each bezier2 edge, check whether the control point P1
 *     is INSIDE the chord polygon:
 *       INSIDE  → inward bulge: walk legs (start, p1) — p1 is
 *                 inside body, so the two legs lie inside.
 *       OUTSIDE → outward bulge: walk chord (just start) — chord
 *                 is inside body; the lens between chord and curve
 *                 is body fill via Loop-Blinn.
 * Lines / arcs / cubics → walk chord regardless.
 *
 * This replaces the local cross-product `bulgesOutward` flag (which
 * is reliable for CCW outer contours but flips for CW holes and
 * for self-intersecting subpaths). The `pointInsidePolygon` test
 * is what the body tessellator uses to decide whether to ADD or
 * SUBTRACT each curve's lens, so it's the canonical answer.
 */
function buildInsideBodyPolyline(
  contour: ReadonlyArray<OutlineEdge>,
  curves: ReadonlyArray<CurveTriangle>,
  allChordPolys: ReadonlyArray<ReadonlyArray<V2d>>,
): V2d[] {
  const out: V2d[] = [];
  for (const edge of contour) {
    out.push(edge.start);
    if (edge.curveIndex < 0) continue;
    const c = curves[edge.curveIndex]!;
    if (c.kind !== "bezier2") continue;
    const v0 = c.vertices[0]!;
    const v1 = c.vertices[1]!;
    if (v0.x === v1.x && v0.y === v1.y) continue; // line sentinel
    if (pointInsideBody(v1, allChordPolys)) {
      out.push(v1);
    }
  }
  return out;
}

/**
 * Even-odd parity over all contour chord polygons: a point is in
 * body iff it's inside an odd number of contour chord polygons.
 * For a glyph with one outer + N holes, that's:
 *   - 0 → outside outer (= background)
 *   - 1 → inside outer, outside any hole (= body)
 *   - 2 → inside outer + inside one hole (= hole interior)
 *   - etc. (nested holes-in-holes alternate parity)
 */
function pointInsideBody(
  p: V2d,
  chordPolys: ReadonlyArray<ReadonlyArray<V2d>>,
): boolean {
  let inside = false;
  for (const poly of chordPolys) {
    if (pointInsidePolygon(p, poly)) inside = !inside;
  }
  return inside;
}

function vec2dPathToClipper(pts: ReadonlyArray<V2d>, scale: number): ClipperPath {
  const out: ClipperPath = [];
  for (const p of pts) {
    const X = Math.round(p.x * scale);
    const Y = Math.round(p.y * scale);
    const last = out.length > 0 ? out[out.length - 1]! : null;
    if (last !== null && last.X === X && last.Y === Y) continue;
    out.push({ X, Y });
  }
  if (out.length >= 2) {
    const first = out[0]!;
    const tail  = out[out.length - 1]!;
    if (first.X === tail.X && first.Y === tail.Y) out.pop();
  }
  return out;
}

/**
 * Strip duplicate-consecutive vertices from a closed polygon
 * (zero-length edges break libtess). Do NOT strip collinear
 * vertices: chunk quads include the contour vertices `a` and `b`
 * as explicit collinear vertices on their perpendicular end-edges
 * specifically so they coincide with the miter polygons' corner
 * vertex. Removing them would re-introduce the T-junction
 * libtess can't handle.
 */
function filterDegenerateVertices(poly: ReadonlyArray<V2d>, eps: number): V2d[] {
  const n = poly.length;
  if (n < 3) return [...poly];
  const out: V2d[] = [];
  for (let i = 0; i < n; i++) {
    const curr = poly[i]!;
    const prev = out.length > 0 ? out[out.length - 1]! : poly[(i - 1 + n) % n]!;
    if (Math.abs(curr.x - prev.x) <= eps && Math.abs(curr.y - prev.y) <= eps) continue;
    out.push(curr);
  }
  return out;
}

/**
 * Push CCW polygons covering the band into `out`:
 *   - one perpendicular-trapezoid quad per chunk;
 *   - two miter-fan triangles at every cross-segment join (outer
 *     and inner side) that fill the wedge gaps between adjacent
 *     quads' divergent perpendiculars at the shared vertex.
 *
 * libtess with POSITIVE rule then unions them all into one
 * watertight non-overlapping triangulation: same shape as a
 * classical thick-stroke with mitered joins, but without us having
 * to compute miter intersection points or special-case bevels —
 * libtess handles convex (gap-filled by the fan) and concave
 * (overlap-absorbed by the union) joins uniformly.
 */
function pushChunkQuads(
  chunks: ReadonlyArray<BandChunk>,
  haloEm: number,
  orient: number,
  out: V2d[][],
): void {
  const N = chunks.length;
  if (N === 0) return;
  // Per-vertex perpendiculars on each side, computed once and
  // shared between the chunk's quad and the miter-fan polygons at
  // its A vertex. Indexed by the A-vertex of chunk i (= shared
  // vertex with chunk (i-1+N)%N).
  const npAtA: { x: number; y: number; ok: boolean }[] = new Array(N);
  const npAtB: { x: number; y: number; ok: boolean }[] = new Array(N);
  for (let i = 0; i < N; i++) {
    npAtA[i] = unitNormal(chunks[i]!.tA);
    npAtB[i] = unitNormal(chunks[i]!.tB);
  }
  for (let i = 0; i < N; i++) {
    const ck = chunks[i]!;
    const nA = npAtA[i]!;
    const nB = npAtB[i]!;
    if (!nA.ok || !nB.ok) continue;
    const oAx = orient * nA.x, oAy = orient * nA.y;
    const oBx = orient * nB.x, oBy = orient * nB.y;
    const Ai = new V2d(ck.a.x - haloEm * oAx, ck.a.y - haloEm * oAy);
    const Ao = new V2d(ck.a.x + haloEm * oAx, ck.a.y + haloEm * oAy);
    const Bi = new V2d(ck.b.x - haloEm * oBx, ck.b.y - haloEm * oBy);
    const Bo = new V2d(ck.b.x + haloEm * oBx, ck.b.y + haloEm * oBy);
    // Include a/b (the contour vertices) as explicit polygon
    // vertices, even though they're collinear with Ai/Ao and Bo/Bi
    // respectively. Without them the chunk quad has a single edge
    // Bo→Bi running through the contour vertex `b`, but the miter
    // polygon at that corner has `b` as an explicit vertex — a
    // T-junction. libtess's POSITIVE union sees the inconsistent
    // topology and drops slivers, which renders as visible holes.
    if (orient >= 0) out.push([Ai, ck.a, Ao, Bo, ck.b, Bi]);
    else             out.push([Bi, ck.b, Bo, Ao, ck.a, Ai]);
  }
  // Miter joins at every cross-segment vertex. Classical thick-stroke
  // miter: at the join, the outer edge extends along the bisector by
  // halo / cos(θ/2) — the "miter point". For convex corners this is
  // a sharp spike outward; for concave corners it lies inward (and
  // libtess's union absorbs the resulting overlap with the chunk
  // quads). When the miter length exceeds MITER_CAP·halo we fall
  // back to a bevel, i.e. a flat fan across the two perpendiculars
  // without the spike.
  //
  // Implementation: per join, push a 4-vertex CCW polygon
  // (corner, prevPerp, miterPoint, nextPerp) — at corners where the
  // miter cap kicks in, miterPoint is replaced with the perpendicular
  // bisector at halo distance, which collapses the miter into a
  // bevel fan.
  for (let i = 0; i < N; i++) {
    const np = npAtB[(i - 1 + N) % N]!;
    const nn = npAtA[i]!;
    if (!np.ok || !nn.ok) continue;
    const corner = chunks[i]!.a;
    const npx = orient * np.x, npy = orient * np.y;
    const nnx = orient * nn.x, nny = orient * nn.y;
    const dot = npx * nnx + npy * nny;
    // 1 + dot ≈ 0 (180° fold) or both arms parallel (cross ≈ 0):
    // skip — degenerate fan with no area.
    const crossOuter = npx * nny - npy * nnx;
    if (Math.abs(crossOuter) < 1e-12) continue;
    const cosHalf2 = (1 + dot) * 0.5;
    const beveled = cosHalf2 < 1 / (MITER_CAP * MITER_CAP);
    // Bisector unit on the outer side. blen²= 2·cosHalf², so
    // bisector_unit = (np + nn) / (2·cosHalf).
    const sumX = npx + nnx, sumY = npy + nny;
    const blen = Math.hypot(sumX, sumY);
    const ux = blen > 1e-12 ? sumX / blen : npx;
    const uy = blen > 1e-12 ? sumY / blen : npy;
    // Miter (or bevel-fallback) outward extension.
    const cosHalf = Math.sqrt(Math.max(cosHalf2, 1e-12));
    // Outer side gets the full miter spike (capped). Inner side
    // is CLAMPED to perpendicular distance: extending the inner
    // miter inward (e.g. halo·√2 at a 90° corner) takes the band
    // past the local body thickness for thin glyphs, and the band
    // fragments out there give α=0 with no body to mask them →
    // visible dark holes. Perpendicular-only inner = the band stays
    // within the body footprint.
    const reachOuter = beveled ? haloEm : haloEm / cosHalf;
    const reachInner = haloEm;
    const mOuter = new V2d(corner.x + reachOuter * ux, corner.y + reachOuter * uy);
    const mInner = new V2d(corner.x - reachInner * ux, corner.y - reachInner * uy);
    const prevOuter = new V2d(corner.x + haloEm * npx, corner.y + haloEm * npy);
    const nextOuter = new V2d(corner.x + haloEm * nnx, corner.y + haloEm * nny);
    const prevInner = new V2d(corner.x - haloEm * npx, corner.y - haloEm * npy);
    const nextInner = new V2d(corner.x - haloEm * nnx, corner.y - haloEm * nny);
    // Emit miters as 3-vertex triangles WITHOUT the corner vertex.
    // The corner is already covered by the adjacent chunk hexagons;
    // adding it to the miter polygon creates an overlapping interior
    // (corner sits inside both chunk hexagons), and the resulting
    // shared collinear sub-edge confuses libtess's POSITIVE union.
    // Triangle [Bo_prev=prevOuter, mOuter, Ao_next=nextOuter]
    // shares only single edges (Bo_prev↔chunk_prev, Ao_next↔chunk_
    // next) with adjacent chunks and lies entirely outside their
    // interiors — clean union, no slivers.
    if (crossOuter > 0) {
      out.push([prevOuter, mOuter, nextOuter]);
      out.push([nextInner, mInner, prevInner]);
    } else {
      out.push([nextOuter, mOuter, prevOuter]);
      out.push([prevInner, mInner, nextInner]);
    }
  }
}

// ---------------------------------------------------------------------------
// Curve subdivision (≥ 2 chunks per edge so adjacency bookkeeping is
// symmetric).
// ---------------------------------------------------------------------------

function expandContour(
  contour: ReadonlyArray<OutlineEdge>,
  curves: ReadonlyArray<CurveTriangle>,
  haloEm: number,
): BandChunk[] {
  const chunks: BandChunk[] = [];
  for (const edge of contour) {
    const c = edge.curveIndex >= 0 ? curves[edge.curveIndex]! : null;
    // Line cases: legacy raw line edge, glyph-cache's line sentinel
    // (bezier2 with p1 == p0), or a non-bezier2 curve treated as
    // chord. All three are perfectly straight in pixel space → one
    // perpendicular quad spans the whole edge. No midpoint split:
    // it adds nothing geometrically and multiplies polygon junctions
    // for libtess to weld (a previous version split into 2 sub-
    // chunks and produced visible mid-edge holes on T's crossbar).
    const isLineSentinel =
      c !== null && c.kind === "bezier2" &&
      c.vertices[0]!.x === c.vertices[1]!.x &&
      c.vertices[0]!.y === c.vertices[1]!.y;
    const isStraight = c === null || isLineSentinel || c.kind !== "bezier2";
    if (isStraight) {
      const t = new V2d(edge.end.x - edge.start.x, edge.end.y - edge.start.y);
      chunks.push({ a: edge.start, b: edge.end, tA: t, tB: t, curveIndex: edge.curveIndex });
      continue;
    }
    const p0 = c.vertices[0]!, p1 = c.vertices[1]!, p2 = c.vertices[2]!;
    const dx = 2 * p1.x - p0.x - p2.x;
    const dy = 2 * p1.y - p0.y - p2.y;
    const dev = Math.hypot(dx, dy) * 0.25;
    const tol = Math.max(haloEm * CHORD_TOL, 1e-9);
    let n = 2;
    if (dev > tol) {
      n = Math.min(MAX_CHUNKS, Math.max(2, Math.ceil(Math.sqrt(dev / tol))));
    }
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const a = bezier2At(p0, p1, p2, t0);
      const b = bezier2At(p0, p1, p2, t1);
      const tA = bezier2Tangent(p0, p1, p2, t0);
      const tB = bezier2Tangent(p0, p1, p2, t1);
      chunks.push({ a, b, tA, tB, curveIndex: edge.curveIndex });
    }
  }
  return chunks;
}

function bezier2At(p0: V2d, p1: V2d, p2: V2d, t: number): V2d {
  const u = 1 - t;
  return new V2d(
    u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  );
}
function bezier2Tangent(p0: V2d, p1: V2d, p2: V2d, t: number): V2d {
  const u = 1 - t;
  return new V2d(
    2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  );
}

// ---------------------------------------------------------------------------
// Orientation
// ---------------------------------------------------------------------------

function contourOrientation(
  contour: ReadonlyArray<OutlineEdge>,
  curves: ReadonlyArray<CurveTriangle>,
): number {
  let s = 0;
  const pts: V2d[] = [];
  for (const e of contour) {
    pts.push(e.start);
    if (e.curveIndex >= 0) {
      const c = curves[e.curveIndex];
      if (c && c.kind === "bezier2") pts.push(c.vertices[1]!);
    }
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s >= 0 ? 1 : -1;
}

// ---------------------------------------------------------------------------
// Offset polylines (outer / inner) + ring tessellation
// ---------------------------------------------------------------------------

function unitNormal(t: V2d): { x: number; y: number; ok: boolean } {
  const len = Math.hypot(t.x, t.y);
  if (len < 1e-12) return { x: 0, y: 0, ok: false };
  return { x: t.y / len, y: -t.x / len, ok: true };
}

interface OffsetPolylines {
  outer: V2d[];
  inner: V2d[];
}

/**
 * Build outer + inner offset polylines for one contour. At every
 * shared vertex the bisector miter is used unless its length exceeds
 * `MITER_CAP * halo`, in which case a bevel is emitted (two
 * perpendicular offset points). Same logic on both outer and inner
 * sides; libtess's NONZERO union resolves any inner self-overlap on
 * thin strokes.
 */
function buildOffsetPolylines(
  chunks: ReadonlyArray<BandChunk>,
  haloEm: number,
  orient: number,
): OffsetPolylines {
  const outer: V2d[] = [];
  const inner: V2d[] = [];
  const N = chunks.length;
  for (let i = 0; i < N; i++) {
    const prev = chunks[(i - 1 + N) % N]!;
    const here = chunks[i]!;
    const v = here.a;
    const np = unitNormal(prev.tB);
    const nn = unitNormal(here.tA);
    if (!np.ok || !nn.ok) {
      // Degenerate tangent — fall back to straight pass-through.
      outer.push(new V2d(v.x, v.y));
      inner.push(new V2d(v.x, v.y));
      continue;
    }
    const npx = orient * np.x, npy = orient * np.y;
    const nnx = orient * nn.x, nny = orient * nn.y;
    const dot = npx * nnx + npy * nny;
    const cosHalf2 = (1 + dot) * 0.5;
    if (cosHalf2 < 1 / (MITER_CAP * MITER_CAP)) {
      // Bevel: two offset points (perpendicular at each side of the
      // join). The polyline turns the corner with a flat cut instead
      // of a pointy spike.
      outer.push(new V2d(v.x + haloEm * npx, v.y + haloEm * npy));
      outer.push(new V2d(v.x + haloEm * nnx, v.y + haloEm * nny));
      inner.push(new V2d(v.x - haloEm * npx, v.y - haloEm * npy));
      inner.push(new V2d(v.x - haloEm * nnx, v.y - haloEm * nny));
    } else {
      // Miter: single bisector point on each side.
      const bx = (npx + nnx) * 0.5;
      const by = (npy + nny) * 0.5;
      const blen = Math.hypot(bx, by);
      if (blen < 1e-9) {
        // 180° fold — fall back to perpendicular.
        outer.push(new V2d(v.x + haloEm * npx, v.y + haloEm * npy));
        inner.push(new V2d(v.x - haloEm * npx, v.y - haloEm * npy));
      } else {
        const cosHalf = Math.sqrt(cosHalf2);
        const scale = haloEm / cosHalf;
        const ux = bx / blen, uy = by / blen;
        outer.push(new V2d(v.x + scale * ux, v.y + scale * uy));
        inner.push(new V2d(v.x - scale * ux, v.y - scale * uy));
      }
    }
  }
  return { outer, inner };
}

// ---------------------------------------------------------------------------
// Per-triangle candidate tagging
// ---------------------------------------------------------------------------

interface CurveSampler {
  readonly index: number;
  /** Bezier2 control points when the underlying curve is a quadratic
   *  bezier — enables the exact closed-form distance solver. */
  readonly bez2: readonly [V2d, V2d, V2d] | null;
  /** Sampled chord points (fallback for non-bezier2 curve kinds and
   *  used by the curve-sample-vs-triangle leg of the triangle-to-
   *  curve distance metric). */
  readonly samples: ReadonlyArray<V2d>;
}

function buildCurveSamplers(
  curves: ReadonlyArray<CurveTriangle>,
): CurveSampler[] {
  const SAMPLES = 4; // 5 sample points per curve, including endpoints
  const out: CurveSampler[] = [];
  for (let i = 0; i < curves.length; i++) {
    const c = curves[i]!;
    if (c.kind !== "bezier2") {
      // Arc / cubic — treat as straight chord between v0 and v2.
      out.push({
        index: i,
        bez2: null,
        samples: [c.vertices[0]!, c.vertices[2]!],
      });
      continue;
    }
    const p0 = c.vertices[0]!, p1 = c.vertices[1]!, p2 = c.vertices[2]!;
    const samples: V2d[] = [];
    for (let s = 0; s <= SAMPLES; s++) {
      const t = s / SAMPLES;
      const u = 1 - t;
      samples.push(new V2d(
        u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
      ));
    }
    out.push({ index: i, bez2: [p0, p1, p2] as const, samples });
  }
  return out;
}

/**
 * Exact squared distance from `p` to a quadratic Bezier (P0, P1, P2)
 * by solving the closed-form cubic for d/dt |B(t) - p|² = 0.
 *
 * Setting A = P0 - p, B = P1 - P0, C = P2 - 2P1 + P0, the critical-
 * point cubic is
 *   |C|² t³ + 3(B·C) t² + (A·C + 2|B|²) t + (A·B) = 0.
 *
 * We depress it to u³ + p u + q = 0 and pick the trig branch (3 real
 * roots) or Cardano's formula (1 real root) by sign of the
 * discriminant. Roots in [0, 1] plus the two endpoints are
 * evaluated; we return the smallest squared distance.
 *
 * Used for picking K-nearest curves per band triangle. The
 * sampled-chord approximation that was here before could miss
 * curves whose closest point sits between samples — those triangles
 * then ran Newton against the wrong candidates and either rendered
 * solid or discarded entirely.
 */
function distSqPointToBezier2(
  p: V2d, p0: V2d, p1: V2d, p2: V2d,
): number {
  const Ax = p0.x - p.x, Ay = p0.y - p.y;
  const Bx = p1.x - p0.x, By = p1.y - p0.y;
  const Cx = p2.x - 2 * p1.x + p0.x;
  const Cy = p2.y - 2 * p1.y + p0.y;
  const a3 = Cx * Cx + Cy * Cy;
  const a2 = 3 * (Bx * Cx + By * Cy);
  const a1 = (Ax * Cx + Ay * Cy) + 2 * (Bx * Bx + By * By);
  const a0 = Ax * Bx + Ay * By;

  // Endpoints first.
  const d0x = Ax, d0y = Ay;
  const d1x = Ax + 2 * Bx + Cx;
  const d1y = Ay + 2 * By + Cy;
  let best = Math.min(d0x * d0x + d0y * d0y, d1x * d1x + d1y * d1y);

  const evalAt = (t: number): void => {
    if (!(t > 0 && t < 1)) return;
    const u = 1 - t;
    const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x - p.x;
    const y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y - p.y;
    const d = x * x + y * y;
    if (d < best) best = d;
  };

  if (Math.abs(a3) < 1e-14) {
    // Degenerate quadratic = line. The cubic collapses to linear:
    // a1 t + a0 = 0.
    if (Math.abs(a1) > 1e-14) evalAt(-a0 / a1);
    return best;
  }

  // Depressed cubic: u = t + a2/(3a3) → u³ + p u + q = 0.
  const inv = 1 / a3;
  const ba = a2 * inv;
  const ca = a1 * inv;
  const da = a0 * inv;
  const off = -ba / 3;
  const pp = (3 * ca - ba * ba) / 3;
  const qq = (2 * ba * ba * ba - 9 * ba * ca + 27 * da) / 27;
  const halfQ = qq * 0.5;
  const thirdP = pp / 3;
  const disc = halfQ * halfQ + thirdP * thirdP * thirdP;

  if (disc < 0) {
    // Three real roots — trigonometric form.
    const r = 2 * Math.sqrt(-thirdP);
    const arg = Math.max(-1, Math.min(1, 3 * qq / (pp * r)));
    const phi = Math.acos(arg) / 3;
    const TWOPI3 = 2 * Math.PI / 3;
    evalAt(r * Math.cos(phi)              + off);
    evalAt(r * Math.cos(phi - TWOPI3)     + off);
    evalAt(r * Math.cos(phi - 2 * TWOPI3) + off);
  } else {
    // One real root — Cardano's formula. Signed cube root via
    // sign(x) * |x|^(1/3) avoids the negative-input pitfall.
    const sq = Math.sqrt(disc);
    const ua = -halfQ + sq;
    const ub = -halfQ - sq;
    const cbrt = (x: number): number =>
      Math.sign(x) * Math.pow(Math.abs(x), 1 / 3);
    evalAt(cbrt(ua) + cbrt(ub) + off);
  }
  return best;
}

/** Squared distance from p to a sampler's curve. Uses the exact
 *  cubic for bezier2; falls back to sampled chord segments for arc /
 *  cubic triangles (which we currently treat as straight chords
 *  anyway in the band-builder). */
function distSqPointToCurve(p: V2d, c: CurveSampler): number {
  if (c.bez2) {
    return distSqPointToBezier2(p, c.bez2[0], c.bez2[1], c.bez2[2]);
  }
  const samples = c.samples;
  let best = Infinity;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i]!, b = samples[i + 1]!;
    const ex = b.x - a.x, ey = b.y - a.y;
    const px = p.x - a.x, py = p.y - a.y;
    const len2 = ex * ex + ey * ey;
    let t = len2 > 1e-18 ? (px * ex + py * ey) / len2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const cx = a.x + t * ex - p.x;
    const cy = a.y + t * ey - p.y;
    const d2 = cx * cx + cy * cy;
    if (d2 < best) best = d2;
  }
  return best;
}

/** Squared distance from point p to triangle (v0, v1, v2). 0 if p
 *  is inside the triangle. */
function distSqPointToTriangle(p: V2d, v0: V2d, v1: V2d, v2: V2d): number {
  // Inside-test via barycentric signs.
  const d1x = v1.x - v0.x, d1y = v1.y - v0.y;
  const d2x = v2.x - v0.x, d2y = v2.y - v0.y;
  const dpx = p.x  - v0.x, dpy = p.y  - v0.y;
  const dot11 = d1x * d1x + d1y * d1y;
  const dot12 = d1x * d2x + d1y * d2y;
  const dot22 = d2x * d2x + d2y * d2y;
  const dotp1 = dpx * d1x + dpy * d1y;
  const dotp2 = dpx * d2x + dpy * d2y;
  const denom = dot11 * dot22 - dot12 * dot12;
  if (Math.abs(denom) > 1e-18) {
    const u = (dot22 * dotp1 - dot12 * dotp2) / denom;
    const v = (dot11 * dotp2 - dot12 * dotp1) / denom;
    if (u >= 0 && v >= 0 && u + v <= 1) return 0;
  }
  // Else closest is on an edge.
  return Math.min(
    distSqPointToSeg(p, v0, v1),
    distSqPointToSeg(p, v1, v2),
    distSqPointToSeg(p, v2, v0),
  );
}
function distSqPointToSeg(p: V2d, a: V2d, b: V2d): number {
  const ex = b.x - a.x, ey = b.y - a.y;
  const px = p.x - a.x, py = p.y - a.y;
  const len2 = ex * ex + ey * ey;
  let t = len2 > 1e-18 ? (px * ex + py * ey) / len2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const cx = a.x + t * ex - p.x;
  const cy = a.y + t * ey - p.y;
  return cx * cx + cy * cy;
}

/** Approximate squared distance from triangle to curve. We sample
 *  both — every triangle sample point's perp distance to the curve
 *  AND every curve sample point's distance to the triangle — and
 *  take the min. This is much tighter than centroid-only, which
 *  badly underestimates "nearness" for elongated triangles where the
 *  curve touches an edge but is far from the centroid. */
function distSqTriangleToCurve(
  v0: V2d, v1: V2d, v2: V2d, c: CurveSampler,
): number {
  let best = Infinity;
  // Curve samples → triangle.
  for (const q of c.samples) {
    const d = distSqPointToTriangle(q, v0, v1, v2);
    if (d < best) best = d;
    if (best <= 0) return 0;
  }
  // Triangle samples (vertices + edge midpoints + centroid) → curve.
  const cxv = (v0.x + v1.x + v2.x) / 3;
  const cyv = (v0.y + v1.y + v2.y) / 3;
  const samples: V2d[] = [
    v0, v1, v2,
    new V2d(cxv, cyv),
    new V2d((v0.x + v1.x) * 0.5, (v0.y + v1.y) * 0.5),
    new V2d((v1.x + v2.x) * 0.5, (v1.y + v2.y) * 0.5),
    new V2d((v2.x + v0.x) * 0.5, (v2.y + v0.y) * 0.5),
  ];
  for (const p of samples) {
    const d = distSqPointToCurve(p, c);
    if (d < best) best = d;
  }
  return best;
}

/** K-smallest-by-distance, partial selection sort (K is small). */
function kNearestCurvesForTriangle(
  v0: V2d, v1: V2d, v2: V2d,
  samplers: ReadonlyArray<CurveSampler>,
  k: number,
): number[] {
  const n = samplers.length;
  if (n === 0) return [];
  const dists = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    dists[i] = distSqTriangleToCurve(v0, v1, v2, samplers[i]!);
  }
  const out: number[] = [];
  const taken = new Uint8Array(n);
  for (let kk = 0; kk < k && kk < n; kk++) {
    let bestI = -1, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (taken[i]) continue;
      const d = dists[i]!;
      if (d < bestD) { bestD = d; bestI = i; }
    }
    if (bestI < 0) break;
    out.push(samplers[bestI]!.index);
    taken[bestI] = 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Band emission
// ---------------------------------------------------------------------------

/** Per-shared-vertex join geometry. For miter joins the two adjacent
 *  chunks share `mOuter` / `mInner` exactly (one point each side, so
 *  the quads tile watertight). For bevel joins the two adjacent
 *  chunks have *different* perpendicular offsets at the vertex, and
 *  a small bevel triangle on each side bridges the gap. */
interface Junction {
  /** The contour vertex shared by `prev` and `next`. */
  readonly v: V2d;
  /** True → use bevel (perpendicular offsets per side + bevel tri).
   *  False → use single mitered point shared by both adjacent quads. */
  readonly bevel: boolean;
  /** Mitered outward / inward offset point (only meaningful when
   *  `bevel === false`). */
  readonly mOuter: V2d;
  readonly mInner: V2d;
  /** Perpendicular offsets on each side (used when `bevel === true`,
   *  also kept around for the bevel-triangle emission). */
  readonly prevOuter: V2d;
  readonly prevInner: V2d;
  readonly nextOuter: V2d;
  readonly nextInner: V2d;
}

/** UNUSED — kept for reference. Per-chunk mitered band geometry has
 *  irrecoverable overlap at concave corners of thin glyphs (miter
 *  inner extends by halo·√2 and crosses opposite contour). Replaced
 *  by a single bbox quad per glyph emitted in `buildGlyphBand`. */
function _emitContourBand_unused(
  chunks: ReadonlyArray<BandChunk>,
  _curves: ReadonlyArray<CurveTriangle>,
  haloEm: number,
  orient: number,
  out: BandTriangle[],
): void {
  const N = chunks.length;
  if (N === 0) return;
  const ccw = orient >= 0;
  const tri = (a: V2d, b: V2d, c: V2d): readonly [V2d, V2d, V2d] =>
    ccw ? [a, b, c] as const : [a, c, b] as const;

  // Pre-compute the join geometry at every shared vertex (one entry
  // per chunk, indexed by chunk `i`'s START, which equals chunk
  // `(i-1) mod N`'s END). This is the classical thick-stroke
  // miter-with-cap recipe: convex joins get a single miter point
  // shared by both adjacent quads; sharp joins fall back to a bevel
  // (two perpendicular points + a connecting tri). Concave joins
  // also reduce to a miter point — it just lies on the inward side
  // of the contour and the band quads tuck inward at it. Either way
  // adjacent quads share the corner geometry exactly, so the band
  // is watertight AND non-overlapping by construction.
  const J: Junction[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const prev = chunks[(i - 1 + N) % N]!;
    const here = chunks[i]!;
    const v = here.a;
    const np = unitNormal(prev.tB);
    const nn = unitNormal(here.tA);
    if (!np.ok || !nn.ok) {
      // Degenerate — fall back to a no-offset junction.
      J[i] = {
        v, bevel: false,
        mOuter: v, mInner: v,
        prevOuter: v, prevInner: v, nextOuter: v, nextInner: v,
      };
      continue;
    }
    const npx = orient * np.x, npy = orient * np.y;
    const nnx = orient * nn.x, nny = orient * nn.y;
    const prevOuter = new V2d(v.x + haloEm * npx, v.y + haloEm * npy);
    const prevInner = new V2d(v.x - haloEm * npx, v.y - haloEm * npy);
    const nextOuter = new V2d(v.x + haloEm * nnx, v.y + haloEm * nny);
    const nextInner = new V2d(v.x - haloEm * nnx, v.y - haloEm * nny);
    const dot = npx * nnx + npy * nny;
    const cosHalf2 = (1 + dot) * 0.5;
    if (cosHalf2 < 1 / (MITER_CAP * MITER_CAP)) {
      // Bevel: miter would extend > MITER_CAP*halo. Use perpendicular
      // offsets per side and a bevel tri to bridge.
      J[i] = {
        v, bevel: true,
        mOuter: v, mInner: v,
        prevOuter, prevInner, nextOuter, nextInner,
      };
      continue;
    }
    // Miter: single point each side. cos_half² ≥ 1/CAP² guarantees
    // the bisector has non-trivial length.
    const bx = (npx + nnx) * 0.5;
    const by = (npy + nny) * 0.5;
    const blen = Math.hypot(bx, by);
    if (blen < 1e-9) {
      // 180° fold — fall back to perpendicular (effectively bevel).
      J[i] = {
        v, bevel: true,
        mOuter: v, mInner: v,
        prevOuter, prevInner, nextOuter, nextInner,
      };
      continue;
    }
    const cosHalf = Math.sqrt(cosHalf2);
    const scale = haloEm / cosHalf;
    const ux = bx / blen, uy = by / blen;
    const mOuter = new V2d(v.x + scale * ux, v.y + scale * uy);
    const mInner = new V2d(v.x - scale * ux, v.y - scale * uy);
    J[i] = { v, bevel: false, mOuter, mInner, prevOuter, prevInner, nextOuter, nextInner };
  }

  // Per-chunk quad. Corner A uses junction[i] (shared with prev);
  // corner B uses junction[(i+1) % N] (shared with next). For
  // mitered joins both sides see the same point. For beveled joins
  // each chunk picks the side of the perpendicular pair that faces
  // INTO this chunk (prev.* at our A, next.* at our B — counter-
  // intuitively that's "next's view" of A and "prev's view" of B,
  // since junction[i].nextOuter is the offset using here.tA i.e. our
  // own tangent at A, and junction[i+1].prevOuter uses our own
  // tangent at B).
  for (let i = 0; i < N; i++) {
    const jA = J[i]!;
    const jB = J[(i + 1) % N]!;
    const Ao = jA.bevel ? jA.nextOuter : jA.mOuter;
    const Ai = jA.bevel ? jA.nextInner : jA.mInner;
    const Bo = jB.bevel ? jB.prevOuter : jB.mOuter;
    const Bi = jB.bevel ? jB.prevInner : jB.mInner;
    out.push({ vertices: tri(Ai, Bi, Bo) });
    out.push({ vertices: tri(Ai, Bo, Ao) });
  }

  // Bevel triangles at sharp joins: bridge prev's perpendicular
  // offset and next's perpendicular offset on each side, fanning
  // through the contour vertex.
  for (let i = 0; i < N; i++) {
    const j = J[i]!;
    if (!j.bevel) continue;
    out.push({ vertices: tri(j.v, j.prevOuter, j.nextOuter) });
    out.push({ vertices: tri(j.v, j.nextInner, j.prevInner) });
  }
}
