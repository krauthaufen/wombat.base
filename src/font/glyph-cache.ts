// Per-Font lazy tessellation cache.
//
// On first sight of a code-point we tessellate the glyph through the
// Stage 0–6a pipeline, append its (vertices, indices) into a single
// growing atlas, and remember the resulting `(firstIndex, indexCount,
// baseVertex, advance, bbox)` so a consumer (Sg.Text, an MDI batcher,
// …) can issue per-glyph draw calls that reuse the cached mesh.
//
// Glyph vertices are stored CENTERED AROUND mid-advance — i.e. each
// glyph's x-range is `[-advance/2, +advance/2]` rather than the
// font's native left-aligned `[0, advance]`. This makes the
// `aa.text-flip` trick in the vertex shader symmetric: both
// per-instance offset.x and per-vertex local.x mirror around 0 with
// a simple sign flip, no `(advance - x)` arithmetic.
//
// The atlas grows append-only — no eviction in v0. For typical text
// (Latin, scripts with a few hundred unique glyphs) memory is
// negligible. Larger CJK use-cases can layer eviction later.

import { Box2d } from "../box/box2d.js";
import { V2d } from "../vector/v2d.js";
import {
  type PathSegment,
  LineSegment, Bezier2Segment, Bezier3Segment, ArcSegment,
} from "../geometry/path/segment.js";
import {
  triangulateGlyph,
} from "../geometry/path/triangulate-glyph.js";
import {
  compileTessellation, VERTEX_BYTE_SIZE, VERTEX_KIND_BAND,
} from "../geometry/path/buffers.js";
import {
  buildGlyphSdf, packSdfSegments, SDF_FLOATS_PER_SEGMENT,
} from "./glyph-sdf.js";
import { buildGlyphBand } from "./band-builder.js";
import type { Font } from "./font.js";

/** Em-space half-width of the SDF outline band. The cache pre-bakes
 *  the band assuming a maximum AA halo of `BAND_HALO_EM` em-units of
 *  glyph height — the SDF FS will produce a hard cutoff once the
 *  fragment's distance exceeds this. ~0.15 em fits comfortably for
 *  the typical zoom range (≈ 15 px at 100 px-per-em rendering). At
 *  much higher zoom the band may visibly clip the AA ramp; rebuild
 *  the cache with a larger value if so. */
const BAND_HALO_EM = 0.05;

/** Number of f32 lanes per vertex in the cache's atlas — matches
 *  `compileTessellation`'s interleaved layout: x, y, k, l, m, kind. */
export const GLYPH_FLOATS_PER_VERTEX = VERTEX_BYTE_SIZE / 4;
/** Number of f32 lanes per triangle in `trianglePackedBuffer()`'s
 *  output — 4 × vec4 (positions, klm.xy, klm.z, kind). */
export const TRI_FLOATS_PER_TRI = 16;

export interface GlyphRecord {
  /** First index in the cache's FAST index buffer for this glyph
   *  (flat + curves + ribbons; band triangles are NOT in this range). */
  readonly firstIndex: number;
  /** Number of indices for this glyph in the fast index buffer. */
  readonly indexCount: number;
  /** Vertex offset to add to each index for this glyph (passed as
   *  `baseVertex` to `drawIndexed` / `drawIndexedIndirect`). Same
   *  baseVertex applies to both the fast and SDF index ranges. */
  readonly baseVertex: number;
  /** Vertex count contributed by this glyph (informational; counts
   *  every kind, including band vertices). */
  readonly vertexCount: number;
  /** Glyph's horizontal advance in font units. */
  readonly advance: number;
  /** Glyph's bbox in **centered glyph-local** coords (so x-range is
   *  centered around 0, not the font-native [0, advance]). y-range
   *  is unchanged from the font's natural y-up frame. */
  readonly bbox: Box2d;
  /** True for whitespace / empty-outline glyphs (`indexCount = 0`).
   *  Layout still uses `advance`; nothing draws. */
  readonly empty: boolean;
  /** First segment index in the cache's SDF segment buffer for this
   *  glyph. (Used by the legacy alpha-blending fragment-shader SDF
   *  path; the band-based SDF path doesn't use this.) */
  readonly sdfSegFirst: number;
  /** Number of segments for this glyph in the SDF buffer. */
  readonly sdfSegCount: number;
  /** Tight glyph bbox (centered in x, native in y) for the legacy
   *  SDF fullscreen-quad geometry. */
  readonly sdfBbox: { x0: number; y0: number; x1: number; y1: number };
  /** First triangle index in the cache's packed triangle SSBO for
   *  this glyph (flat + curves; ribbons and band tris are excluded). */
  readonly triFirst: number;
  /** Number of triangles for this glyph in the packed SSBO. */
  readonly triCount: number;
  /** First index in the cache's SDF index buffer (band + flat tris,
   *  contiguous; band tris come first in this slice). */
  readonly sdfFirstIndex: number;
  /** Number of indices for this glyph in the SDF index buffer. */
  readonly sdfIndexCount: number;
  /** Band triangle count (informational). */
  readonly bandTriCount: number;
}

export class GlyphCache {
  /** Code-point → cached record. */
  private readonly records = new Map<number, GlyphRecord>();
  /** Atlas vertex storage — interleaved 12 f32 per vertex (3 vec4):
   *    pos.xy, klm.xyz, kind, chordA.xy, chordB.xy, cand0, cand1.
   *  See `buffers.ts` for the full layout. Backed by a growable plain
   *  array; consumers read via `vertexBuffer()`. */
  private readonly vertices: number[] = [];
  /** Atlas FAST index storage — flat + curves + ribbons. Drives the
   *  Loop-Blinn render path. Band triangles are NOT in this buffer. */
  private readonly indices: number[] = [];
  /** Atlas SDF index storage — band + flat (in that order, per glyph).
   *  Drives the band-based per-pixel SDF render path. */
  private readonly sdfIndicesArr: number[] = [];
  /** Per-font SDF segment storage — flat float-array of packed
   *  `SDF_FLOATS_PER_SEGMENT` floats per segment. Grows append-only
   *  alongside the triangle atlas; `record.sdfSegFirst` /
   *  `sdfSegCount` index into it. */
  private readonly sdfFloats: number[] = [];
  /** Running triangle count across cached glyphs, used to assign
   *  `triFirst` per glyph for the packed triangle buffer. */
  private triRunning = 0;
  /** Running per-band-triangle ID, cache-global. Stuffed into
   *  vertex slot[10] so the SDF debug shader can colour each band
   *  triangle independently — surrogate for an unsupported
   *  `gl_PrimitiveID` / `@builtin(primitive_index)` in the fragment
   *  stage. */
  private bandTriIdNext = 0;

  constructor(readonly font: Font) {}

  /** Look up (or tessellate on first sight) the glyph for `codepoint`. */
  get(codepoint: number): GlyphRecord {
    let r = this.records.get(codepoint);
    if (r) return r;
    r = this.tessellate(codepoint);
    this.records.set(codepoint, r);
    return r;
  }

  /** Convenience for single-character look-ups. */
  getChar(ch: string): GlyphRecord {
    const cp = ch.codePointAt(0);
    if (cp === undefined) {
      throw new Error("GlyphCache.getChar: empty string");
    }
    return this.get(cp);
  }

  /** Number of unique glyphs cached so far. */
  get size(): number { return this.records.size; }

  /** Total vertex count across all cached glyphs. */
  get totalVertexCount(): number { return this.vertices.length / GLYPH_FLOATS_PER_VERTEX; }
  /** Total index count across all cached glyphs. */
  get totalIndexCount(): number { return this.indices.length; }

  /** Snapshot of the atlas vertex buffer. The underlying storage may
   *  grow on subsequent `get` calls — callers should re-snapshot if
   *  they've added more glyphs since. */
  vertexBuffer(): Float32Array { return new Float32Array(this.vertices); }
  /** Snapshot of the atlas index buffer. Indices are LOCAL to each
   *  glyph (0..glyph.vertexCount-1); apply `record.baseVertex` at
   *  draw time. */
  indexBuffer(): Uint32Array { return new Uint32Array(this.indices); }
  /** Snapshot of the SDF (band + flat) index buffer. Same baseVertex
   *  per glyph as `indexBuffer()`; the per-glyph slice is described by
   *  `record.sdfFirstIndex` / `sdfIndexCount`. */
  sdfIndexBuffer(): Uint32Array { return new Uint32Array(this.sdfIndicesArr); }

  /** Snapshot of the SDF segment buffer for the alpha-blending path.
   *  Layout: `SDF_FLOATS_PER_SEGMENT` floats per segment, indexed by
   *  `record.sdfSegFirst` / `sdfSegCount`. */
  sdfSegmentBuffer(): Float32Array { return new Float32Array(this.sdfFloats); }
  /** Total segment count across all cached glyphs. */
  get totalSdfSegCount(): number { return this.sdfFloats.length / SDF_FLOATS_PER_SEGMENT; }

  /**
   * Packed triangle buffer for the per-pixel triangle-SDF path.
   * Layout (`TRI_FLOATS_PER_TRI = 16` floats = 4 × vec4 per triangle):
   *   `[v0.xy, klm0.xy, v1.xy, klm1.xy, v2.xy, klm2.xy,
   *     klm0.z, klm1.z, klm2.z, kind]`
   * Triangles with `kind = 3` (line ribbons) and `kind = 4` (band)
   * are SKIPPED — neither carries Loop-Blinn klm coordinates, and the
   * SSBO is consumed only for kind=4 fragments looking up their
   * candidate curve triangles by global SSBO index.
   */
  trianglePackedBuffer(): Float32Array {
    const verts = this.vertices;
    const indices = this.indices;
    let nKept = 0;
    for (const rec of this.records.values()) {
      if (rec.empty) continue;
      const localTris = rec.indexCount / 3;
      for (let t = 0; t < localTris; t++) {
        const li0 = indices[rec.firstIndex + t * 3]!;
        const kind = verts[(li0 + rec.baseVertex) * GLYPH_FLOATS_PER_VERTEX + 5]!;
        if (kind > 2.5) continue;  // skip ribbons (3) and band (4)
        nKept++;
      }
    }
    const out = new Float32Array(nKept * TRI_FLOATS_PER_TRI);
    let w = 0;
    for (const rec of this.records.values()) {
      if (rec.empty) continue;
      const localTris = rec.indexCount / 3;
      for (let t = 0; t < localTris; t++) {
        const li0 = indices[rec.firstIndex + t * 3]!;
        const li1 = indices[rec.firstIndex + t * 3 + 1]!;
        const li2 = indices[rec.firstIndex + t * 3 + 2]!;
        const o0 = (li0 + rec.baseVertex) * GLYPH_FLOATS_PER_VERTEX;
        const o1 = (li1 + rec.baseVertex) * GLYPH_FLOATS_PER_VERTEX;
        const o2 = (li2 + rec.baseVertex) * GLYPH_FLOATS_PER_VERTEX;
        const kind = verts[o0 + 5]!;
        if (kind > 2.5) continue;
        out[w + 0]  = verts[o0 + 0]!;
        out[w + 1]  = verts[o0 + 1]!;
        out[w + 2]  = verts[o0 + 2]!;
        out[w + 3]  = verts[o0 + 3]!;
        out[w + 4]  = verts[o1 + 0]!;
        out[w + 5]  = verts[o1 + 1]!;
        out[w + 6]  = verts[o1 + 2]!;
        out[w + 7]  = verts[o1 + 3]!;
        out[w + 8]  = verts[o2 + 0]!;
        out[w + 9]  = verts[o2 + 1]!;
        out[w + 10] = verts[o2 + 2]!;
        out[w + 11] = verts[o2 + 3]!;
        out[w + 12] = verts[o0 + 4]!;
        out[w + 13] = verts[o1 + 4]!;
        out[w + 14] = verts[o2 + 4]!;
        out[w + 15] = kind;
        w += TRI_FLOATS_PER_TRI;
      }
    }
    return out;
  }
  /** Total triangle count across all cached glyphs (excluding ribbons + band). */
  get totalTriCount(): number {
    const indices = this.indices;
    const verts = this.vertices;
    let n = 0;
    for (const rec of this.records.values()) {
      if (rec.empty) continue;
      const localTris = rec.indexCount / 3;
      for (let t = 0; t < localTris; t++) {
        const li0 = indices[rec.firstIndex + t * 3]!;
        const kind = verts[(li0 + rec.baseVertex) * GLYPH_FLOATS_PER_VERTEX + 5]!;
        if (kind > 2.5) continue;
        n++;
      }
    }
    return n;
  }

  // ---------------------------------------------------------------

  private tessellate(codepoint: number): GlyphRecord {
    const ch = String.fromCodePoint(codepoint);
    // Cache stores everything em-scaled: 1 em = 1 world unit. Callers
    // pick a visual size with their own Trafo (1.0 → font-size = 1
    // world unit per em); no per-glyph scale baked into vertex data.
    const upem = this.font.unitsPerEm || 1;
    const sx = 1 / upem;
    const advance = this.font.advanceWidth(ch) * sx;
    const segs = scaleSegments(this.font.charToSegments(ch), sx);

    if (segs.length === 0) {
      // Empty outline — whitespace, control chars, etc.
      return {
        firstIndex: this.indices.length,
        indexCount: 0,
        baseVertex: this.vertices.length / GLYPH_FLOATS_PER_VERTEX,
        vertexCount: 0,
        advance,
        bbox: Box2d.empty,
        empty: true,
        sdfSegFirst: this.sdfFloats.length / SDF_FLOATS_PER_SEGMENT,
        sdfSegCount: 0,
        sdfBbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
        triFirst: this.triRunning,
        triCount: 0,
        sdfFirstIndex: this.sdfIndicesArr.length,
        sdfIndexCount: 0,
        bandTriCount: 0,
      };
    }

    // Shift segments left by advance/2 so glyph is centered on x=0.
    const centered = shiftSegmentsX(segs, -advance * 0.5);

    const triRaw = triangulateGlyph(centered);
    // Append a "line sentinel" curve entry per line edge: a degenerate
    // bezier2 with p1 = p0 marks "line from p0 to p2". The FS detects
    // it via VERTEX_KIND_LINE (set by compileTessellation) and uses a
    // closed-form point-segment distance — cheaper than Newton and
    // avoids NaN from a collinear quadratic.
    //
    // Important: do NOT rewrite the outline edge's curveIndex. The
    // band-builder relies on `curveIndex < 0` to take its chord
    // branch; if we point line edges at a synthesized quadratic with
    // p1=p0 the band-builder's tangent at t=0 is zero, the perp
    // normal goes invalid, and the chunk + neighbouring miter both
    // get skipped → visible coverage gaps and missing miters.
    const synthCurves: typeof triRaw.curves[number][] =
      [...triRaw.curves];
    const synthOutline = triRaw.outlineContours.map((contour) =>
      contour.map((edge) => {
        if (edge.curveIndex >= 0) return edge;
        const idx = synthCurves.length;
        synthCurves.push({
          kind: "bezier2",
          vertices: [edge.start, edge.start, edge.end],
          texcoords: [[0, 0, 1], [0, 0, 1], [1, 1, 1]],
          bulgesOutward: false,
        });
        return { ...edge, curveIndex: idx };
      })
    );
    const tri = {
      ...triRaw,
      curves: synthCurves,
      outlineContours: synthOutline,
    };
    const bufs = compileTessellation(tri);

    const baseVertex = this.vertices.length / GLYPH_FLOATS_PER_VERTEX;
    const firstIndex = this.indices.length;
    const sdfFirstIndex = this.sdfIndicesArr.length;

    // Append fast-path vertices (flat + curves + ribbons) verbatim.
    for (let i = 0; i < bufs.vertices.length; i++) {
      this.vertices.push(bufs.vertices[i]!);
    }
    // Append fast-path indices (flat + curves + ribbons) unchanged.
    for (let i = 0; i < bufs.indices.length; i++) {
      this.indices.push(bufs.indices[i]!);
    }

    // SDF segments built from the same centered path; appended into
    // the per-font SDF buffer (legacy SDF path; band path doesn't use).
    const sdfSegFirst = this.sdfFloats.length / SDF_FLOATS_PER_SEGMENT;
    const sdf = buildGlyphSdf(centered);
    const packed = packSdfSegments(sdf.segments);
    for (let i = 0; i < packed.length; i++) this.sdfFloats.push(packed[i]!);

    // Per-glyph SSBO range: flat + curves only (skip ribbons; bands
    // emit later and we skip those too). We also need each curve's
    // index in this slice so we can rebase the band-builder's local
    // candidate indices to global SSBO indices.
    const triFirst = this.triRunning;
    let triCount = 0;
    // Curve local index within this glyph's SSBO slice = flatN + ci
    // (where ci is the index into the original `tri.curves` array,
    // matching `buildGlyphBand`'s `cand0` values).
    const flatTriCount = tri.flat.length;
    for (let t = 0; t < bufs.indices.length / 3; t++) {
      const i0 = bufs.indices[t * 3]!;
      const kind = bufs.vertices[i0 * GLYPH_FLOATS_PER_VERTEX + 5]!;
      // Keep flat (0), bezier2 (1), arc (2), line (5). Skip ribbons
      // (3) — no SDF role — and band (4) — appended later.
      if (kind > 2.5) continue;
      triCount++;
    }
    this.triRunning += triCount;

    // Build the outline band. Each band tri carries up to 4 candidate
    // curve/line SSBO indices derived from its inner-side vertices
    // (anchor points contribute their two adjacent edges' curves;
    // leg-control vertices contribute the one edge they belong to).
    // The FS iterates only those 4 — bounded per-fragment cost.
    // Local curve index → global SSBO index = triFirst + flatTriCount + ci.
    const bandTris = buildGlyphBand(tri.outlineContours, tri.curves, BAND_HALO_EM);
    const ssboCurveBase = triFirst + flatTriCount;
    let nextVi = bufs.vertices.length / GLYPH_FLOATS_PER_VERTEX;
    for (const bt of bandTris) {
      // Real per-tri candidate SSBO indices (band-builder's pass-1+2).
      // -1 = unused. The FS counts non-(-1) entries to derive a
      // candidate-count for the debug-mode colour ramp, so no
      // separate vertex slot is needed for the visualisation.
      const c0 = bt.candidates[0] >= 0 ? ssboCurveBase + bt.candidates[0] : -1;
      const c1 = bt.candidates[1] >= 0 ? ssboCurveBase + bt.candidates[1] : -1;
      const c2 = bt.candidates[2] >= 0 ? ssboCurveBase + bt.candidates[2] : -1;
      const c3 = bt.candidates[3] >= 0 ? ssboCurveBase + bt.candidates[3] : -1;
      const c4 = bt.candidates[4] >= 0 ? ssboCurveBase + bt.candidates[4] : -1;
      const c5 = bt.candidates[5] >= 0 ? ssboCurveBase + bt.candidates[5] : -1;
      // Running per-band-triangle ID (cache-global). Stuffed into
      // klm.x — unused for kind=4 (no Loop-Blinn lens for band tris).
      // Same value on all 3 verts → flat across the tri.
      const triId = this.bandTriIdNext++;
      for (let k = 0; k < 3; k++) {
        const p = bt.vertices[k]!;
        this.vertices.push(
          p.x, p.y,
          triId, 0, 0,             // slot[2]=triId (klm.x), [3..4]=0
          VERTEX_KIND_BAND,
          c0, c1, c2, c3,          // slots[6..9] = first 4 candidates
          c4, c5,                  // slots[10..11] = candidates 5/6
        );
        this.sdfIndicesArr.push(nextVi);
        nextVi++;
      }
    }
    const bandTriCount = bandTris.length;

    // Append SDF range's solid-fill tris: flat (kind=0) + curves
    // (kind=1/2). The curve triangles' chord-detoured lens is the
    // only thing filling outward-bulge interiors — without them the
    // body has a gap between the chord and the curve. The FS treats
    // every non-band fragment as solid α=1, so the Loop-Blinn klm
    // discard is intentionally bypassed; the band ±halo strip
    // handles the AA boundary.
    const flatRange = bufs.interiorRange;
    const curveRange = bufs.curveRange;
    for (let i = 0; i < flatRange.indexCount; i++) {
      this.sdfIndicesArr.push(bufs.indices[flatRange.firstIndex + i]!);
    }
    for (let i = 0; i < curveRange.indexCount; i++) {
      this.sdfIndicesArr.push(bufs.indices[curveRange.firstIndex + i]!);
    }
    const sdfIndexCount =
      bandTriCount * 3 + flatRange.indexCount + curveRange.indexCount;

    const vertexCount = nextVi;

    // Bbox of the centered glyph: native bbox shifted by -advance/2.
    const nat = this.font.charBoundingBox(ch);
    const bbox = new Box2d(
      nat.min.x - advance * 0.5, nat.min.y,
      nat.max.x - advance * 0.5, nat.max.y,
    );

    return {
      firstIndex,
      indexCount: bufs.indices.length,
      baseVertex,
      vertexCount,
      advance,
      bbox,
      empty: false,
      sdfSegFirst,
      sdfSegCount: sdf.segments.length,
      sdfBbox: sdf.bbox,
      triFirst,
      triCount,
      sdfFirstIndex,
      sdfIndexCount,
      bandTriCount,
    };
  }
}

// ─────────────────────────────────────────────────────────────────

/** In-place-style x-shift: returns a new segment list whose x-coords
 *  are translated by `dx`. Endpoints shared by V2d identity in the
 *  input are preserved in the output (planar-graph spatial-hash
 *  invariant for arc start/end). */
/**
 * Uniformly scale both axes of every segment in `segs` by `s`.
 * Endpoint identity is preserved (each input `V2d` maps to the same
 * output `V2d` everywhere it appears) so the planar-graph spatial-
 * hash invariant survives.
 */
function scaleSegments(
  segs: ReadonlyArray<PathSegment>, s: number,
): PathSegment[] {
  if (s === 1) return [...segs];
  const cache = new Map<V2d, V2d>();
  const t = (p: V2d): V2d => {
    let q = cache.get(p);
    if (!q) { q = new V2d(p.x * s, p.y * s); cache.set(p, q); }
    return q;
  };
  return segs.map((seg): PathSegment => {
    switch (seg.kind) {
      case "line":    return new LineSegment(t(seg.start), t(seg.end));
      case "bezier2": return new Bezier2Segment(t(seg.start), t(seg.control), t(seg.end));
      case "bezier3": return new Bezier3Segment(t(seg.start), t(seg.control1), t(seg.control2), t(seg.end));
      case "arc": {
        // Arc: center scales as a point, axes (vectors) scale too.
        return new ArcSegment(
          t(seg.start), t(seg.end),
          new V2d(seg.center.x * s, seg.center.y * s),
          new V2d(seg.axis0.x * s, seg.axis0.y * s),
          new V2d(seg.axis1.x * s, seg.axis1.y * s),
          seg.startAngle, seg.deltaAngle,
        );
      }
    }
  });
}

function shiftSegmentsX(
  segs: ReadonlyArray<PathSegment>, dx: number,
): PathSegment[] {
  const cache = new Map<V2d, V2d>();
  const t = (p: V2d): V2d => {
    let q = cache.get(p);
    if (!q) { q = new V2d(p.x + dx, p.y); cache.set(p, q); }
    return q;
  };
  return segs.map((s): PathSegment => {
    switch (s.kind) {
      case "line":    return new LineSegment(t(s.start), t(s.end));
      case "bezier2": return new Bezier2Segment(t(s.start), t(s.control), t(s.end));
      case "bezier3": return new Bezier3Segment(t(s.start), t(s.control1), t(s.control2), t(s.end));
      case "arc": {
        // Arc center shifts along x; axes are vectors, not points,
        // so they don't shift.
        return new ArcSegment(
          t(s.start), t(s.end),
          new V2d(s.center.x + dx, s.center.y),
          s.axis0, s.axis1, s.startAngle, s.deltaAngle,
        );
      }
    }
  });
}
