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
  compileTessellation, VERTEX_BYTE_SIZE,
} from "../geometry/path/buffers.js";
import {
  buildGlyphSdf, packSdfSegments, SDF_FLOATS_PER_SEGMENT,
} from "./glyph-sdf.js";
import type { Font } from "./font.js";

/** Number of f32 lanes per vertex in the cache's atlas — matches
 *  `compileTessellation`'s interleaved layout: x, y, k, l, m, kind. */
export const GLYPH_FLOATS_PER_VERTEX = VERTEX_BYTE_SIZE / 4;
/** Number of f32 lanes per triangle in `trianglePackedBuffer()`'s
 *  output — 4 × vec4 (positions, klm.xy, klm.z, kind). */
export const TRI_FLOATS_PER_TRI = 16;

export interface GlyphRecord {
  /** First index in the cache's index buffer for this glyph. */
  readonly firstIndex: number;
  /** Number of indices for this glyph (3 × triangle count). */
  readonly indexCount: number;
  /** Vertex offset to add to each index for this glyph (passed as
   *  `baseVertex` to `drawIndexed` / `drawIndexedIndirect`). */
  readonly baseVertex: number;
  /** Vertex count contributed by this glyph (informational). */
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
   *  glyph. (Used by the alpha-blending fragment-shader SDF path.) */
  readonly sdfSegFirst: number;
  /** Number of segments for this glyph in the SDF buffer. */
  readonly sdfSegCount: number;
  /** Tight glyph bbox (centered in x, native in y) for the SDF
   *  fullscreen-quad geometry. Padded slightly by the consumer to
   *  ensure the AA ramp fits inside the rendered quad. */
  readonly sdfBbox: { x0: number; y0: number; x1: number; y1: number };
  /** First triangle index in the cache's packed triangle buffer for
   *  this glyph (excluding ribbons). */
  readonly triFirst: number;
  /** Number of triangles for this glyph in the packed buffer. */
  readonly triCount: number;
}

export class GlyphCache {
  /** Code-point → cached record. */
  private readonly records = new Map<number, GlyphRecord>();
  /** Atlas vertex storage — interleaved [x,y,k,l,m,kind] per vertex.
   *  Backed by a growable plain array; consumers read via
   *  `vertexBuffer()` which returns a Float32Array snapshot. */
  private readonly vertices: number[] = [];
  /** Atlas index storage. */
  private readonly indices: number[] = [];
  /** Per-font SDF segment storage — flat float-array of packed
   *  `SDF_FLOATS_PER_SEGMENT` floats per segment. Grows append-only
   *  alongside the triangle atlas; `record.sdfSegFirst` /
   *  `sdfSegCount` index into it. */
  private readonly sdfFloats: number[] = [];
  /** Running triangle count across cached glyphs, used to assign
   *  `triFirst` per glyph for the packed triangle buffer. */
  private triRunning = 0;

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
   * Triangles with `kind = 3` (line ribbons) are SKIPPED — their
   * geometry is degenerate before the VS expansion, and the per-
   * pixel path doesn't reproduce that expansion. Polygon line edges
   * end up hard-pixel-aligned in this mode.
   */
  trianglePackedBuffer(): Float32Array {
    const verts = this.vertices;
    const indices = this.indices;
    const triCount = indices.length / 3;
    // First pass: count non-ribbon triangles.
    let nKept = 0;
    for (let t = 0; t < triCount; t++) {
      const i0 = indices[t * 3]!;
      const kind = verts[i0 * GLYPH_FLOATS_PER_VERTEX + 5]!;
      if (kind > 2.5 && kind < 3.5) continue;  // skip ribbons
      nKept++;
    }
    const out = new Float32Array(nKept * TRI_FLOATS_PER_TRI);
    let w = 0;
    for (let t = 0; t < triCount; t++) {
      const i0 = indices[t * 3]!;
      const i1 = indices[t * 3 + 1]!;
      const i2 = indices[t * 3 + 2]!;
      const o0 = i0 * GLYPH_FLOATS_PER_VERTEX;
      const o1 = i1 * GLYPH_FLOATS_PER_VERTEX;
      const o2 = i2 * GLYPH_FLOATS_PER_VERTEX;
      const kind = verts[o0 + 5]!;
      if (kind > 2.5 && kind < 3.5) continue;  // skip ribbons
      // vec4 0: v0.xy, klm0.xy
      out[w + 0]  = verts[o0 + 0]!;
      out[w + 1]  = verts[o0 + 1]!;
      out[w + 2]  = verts[o0 + 2]!;
      out[w + 3]  = verts[o0 + 3]!;
      // vec4 1: v1.xy, klm1.xy
      out[w + 4]  = verts[o1 + 0]!;
      out[w + 5]  = verts[o1 + 1]!;
      out[w + 6]  = verts[o1 + 2]!;
      out[w + 7]  = verts[o1 + 3]!;
      // vec4 2: v2.xy, klm2.xy
      out[w + 8]  = verts[o2 + 0]!;
      out[w + 9]  = verts[o2 + 1]!;
      out[w + 10] = verts[o2 + 2]!;
      out[w + 11] = verts[o2 + 3]!;
      // vec4 3: klm0.z, klm1.z, klm2.z, kind
      out[w + 12] = verts[o0 + 4]!;
      out[w + 13] = verts[o1 + 4]!;
      out[w + 14] = verts[o2 + 4]!;
      out[w + 15] = kind;
      w += TRI_FLOATS_PER_TRI;
    }
    return out;
  }
  /** Total triangle count across all cached glyphs (excluding ribbons). */
  get totalTriCount(): number {
    const indices = this.indices;
    const verts = this.vertices;
    let n = 0;
    for (let t = 0; t < indices.length / 3; t++) {
      const i0 = indices[t * 3]!;
      const kind = verts[i0 * GLYPH_FLOATS_PER_VERTEX + 5]!;
      if (kind > 2.5 && kind < 3.5) continue;
      n++;
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
      };
    }

    // Shift segments left by advance/2 so glyph is centered on x=0.
    const centered = shiftSegmentsX(segs, -advance * 0.5);

    const tri = triangulateGlyph(centered);
    const bufs = compileTessellation(tri);

    const baseVertex = this.vertices.length / GLYPH_FLOATS_PER_VERTEX;
    const firstIndex = this.indices.length;
    const vertexCount = bufs.vertices.length / GLYPH_FLOATS_PER_VERTEX;

    // Append vertices verbatim — they're already in centered coords
    // because we centered the input segments.
    for (let i = 0; i < bufs.vertices.length; i++) {
      this.vertices.push(bufs.vertices[i]!);
    }
    // Indices are already local to this glyph (0..vertexCount-1) as
    // produced by `compileTessellation`. We append unchanged.
    for (let i = 0; i < bufs.indices.length; i++) {
      this.indices.push(bufs.indices[i]!);
    }

    // SDF segments built from the same centered path; appended into
    // the per-font SDF buffer. Used by the alpha-blending render path.
    const sdfSegFirst = this.sdfFloats.length / SDF_FLOATS_PER_SEGMENT;
    const sdf = buildGlyphSdf(centered);
    const packed = packSdfSegments(sdf.segments);
    for (let i = 0; i < packed.length; i++) this.sdfFloats.push(packed[i]!);

    // Count non-ribbon triangles in this glyph's slice for triFirst
    // / triCount addressing of the packed triangle buffer.
    const triFirst = this.triRunning;
    let triCount = 0;
    for (let t = 0; t < bufs.indices.length / 3; t++) {
      const i0 = bufs.indices[t * 3]!;
      const kind = bufs.vertices[i0 * GLYPH_FLOATS_PER_VERTEX + 5]!;
      if (kind > 2.5 && kind < 3.5) continue;  // skip ribbons
      triCount++;
    }
    this.triRunning += triCount;

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
