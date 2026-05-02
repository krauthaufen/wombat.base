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
  tessellatePath,
} from "../geometry/path/tessellate.js";
import {
  triangulateFilledFaces,
} from "../geometry/path/triangulate.js";
import {
  compileTessellation, VERTEX_BYTE_SIZE,
} from "../geometry/path/buffers.js";
import type { Font } from "./font.js";

/** Number of f32 lanes per vertex in the cache's atlas — matches
 *  `compileTessellation`'s interleaved layout: x, y, k, l, m, kind. */
export const GLYPH_FLOATS_PER_VERTEX = VERTEX_BYTE_SIZE / 4;

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

  // ---------------------------------------------------------------

  private tessellate(codepoint: number): GlyphRecord {
    const ch = String.fromCodePoint(codepoint);
    const advance = this.font.advanceWidth(ch);
    const segs = this.font.charToSegments(ch);

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
      };
    }

    // Shift segments left by advance/2 so glyph is centered on x=0.
    const centered = shiftSegmentsX(segs, -advance * 0.5);

    const tess = tessellatePath(centered);
    const tri = triangulateFilledFaces(tess.filledFaces, tess.extraction, tess.graph);
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
    };
  }
}

// ─────────────────────────────────────────────────────────────────

/** In-place-style x-shift: returns a new segment list whose x-coords
 *  are translated by `dx`. Endpoints shared by V2d identity in the
 *  input are preserved in the output (planar-graph spatial-hash
 *  invariant for arc start/end). */
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
