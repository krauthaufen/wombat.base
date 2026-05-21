// Convert tessellation output to GPU-ready interleaved buffers.
//
// Per-vertex layout (9 f32 = 36 bytes):
//   - [0..1] pos.xy
//   - [2..4] klm.xyz   (BAND verts reuse [2] for triId, [3..4]=0)
//   - [5]    kind
//   - [6..8] lensCand0..2   (lens kind 1/2: self + prev/next curve
//            SSBO indices for the lens-outside AA; -1 otherwise)
//
// BAND (kind = 4) candidates are NOT stored per-vertex anymore — they
// live in a per-band-triangle CSR storage buffer keyed by `triId`
// (slot [2]). The FS loops the triangle's candidate range and runs
// Newton against each. This removes the per-vertex candidate cap and
// shrinks the vertex from 64 B to 36 B. Lines are synthesised as
// degenerate
// quadratic curves so they have a real curveIndex too. For kinds
// 0..3 every cand slot is -1.
// Three triangle ranges are reported separately — `interiorRange`,
// `curveRange`, `ribbonRange` — for callers that want to render
// them with separate pipelines (the unified Loop-Blinn shader
// handles them in one pipeline by branching on `kind`).
//
// Kind is stored as f32 (not u32) so the vertex output doesn't
// require flat interpolation in the shader. Each triangle has a
// uniform kind across its 3 vertices, so f32 interpolation gives the
// constant value across the triangle interior.
//
// Curve triangles are EXPANDED on the CPU so the implicit-gradient
// AA ramp has rasterised pixels to land on regardless of how thin
// the underlying (start, control, end) triangle is. Loop-Blinn klm
// interpolates linearly across any triangle, so we can pick
// arbitrary new vertices and compute their klm via barycentric
// extrapolation — the implicit f stays valid everywhere in the
// extended triangle. Expansion factor: 0.2 × bbox_size of the
// original (start, control, end) — keeps the halo proportional to
// the curve's own extent without needing screen-space math.
//
// `bulgesOutward` is also reported per curve triangle so the
// renderer can flip the comparison sign (inward-bulging curves
// subtract from the flat polygon by inverting the implicit test).

import type { FaceTriangulation } from "./triangulate.js";

export const VERTEX_KIND_INTERIOR     = 0;
export const VERTEX_KIND_BEZIER2      = 1;
export const VERTEX_KIND_ARC          = 2;
/**
 * Outline-ribbon vertex for AA on straight polygon edges. For these
 * vertices the `klmKind.xyz` slot is REINTERPRETED as
 * `(outwardX, outwardY, isOuter)` — the vertex shader expands
 * `isOuter == 1` vertices outward by 1 framebuffer pixel along
 * `outward` in screen space, and the fragment shader uses
 * `1 - isOuter` as the AA alpha ramp.
 */
export const VERTEX_KIND_LINE_RIBBON  = 3;
/**
 * Per-pixel SDF band vertex. The band is a strip of mitered quads
 * tracing the glyph outline ±halo_em; each band triangle carries a
 * chord segment `(A, B)` and up to 2 candidate curve-triangle SSBO
 * indices in its tail slots. The FS computes pixel distance to the
 * chord and to each candidate's bezier (Newton in pixel space), takes
 * the min, and ramps α 1→0 across `AaWidthPx`.
 */
export const VERTEX_KIND_BAND = 4;
/**
 * Interior "shell" vertex — the INSIDE half of the symmetric AA ramp.
 * Emitted by GlyphCache (not compileTessellation) for near-boundary
 * interior triangles. Uses the same per-triangle CSR candidate
 * mechanism as the band (triId parked in slot[2]); the FS applies the
 * inside sign (+1): `α = clamp(0.5 + dist/aaW)`. Deep interior tris
 * with no candidate curve within halo stay VERTEX_KIND_INTERIOR
 * (flat α = 1).
 */
export const VERTEX_KIND_FILL_RAMP = 5;

export const VERTEX_BYTE_SIZE = 36; // 9 × f32 (lens cand slots 6..8; band cands in CSR SSBO)

export interface TessellationBuffers {
  /** Interleaved vertex data: per vertex, 12 f32 (3 vec4):
   *  `[x, y, klm.x, klm.y, klm.z, kind,
   *    cand0, cand1, cand2, cand3, cand4, cand5]`. For `kind = 3`
   *  (line ribbon) the `klm` slot carries
   *  `(outwardX, outwardY, isOuter)`. For kinds 0..3 every cand
   *  slot is -1. For `kind = 4` (band) the cand slots are SSBO
   *  indices into the per-cache curve-triangle storage; the FS
   *  runs Newton on each cand_i >= 0 and takes the min. */
  readonly vertices: Float32Array;
  /** Index buffer: 3 indices per triangle. */
  readonly indices: Uint32Array;
  /** Range of `indices` for interior (flat) triangles. */
  readonly interiorRange: { firstIndex: number; indexCount: number };
  /** Range of `indices` for curve (Loop-Blinn) triangles. */
  readonly curveRange: { firstIndex: number; indexCount: number };
  /** Range of `indices` for line-edge AA ribbon triangles. */
  readonly ribbonRange: { firstIndex: number; indexCount: number };
  /**
   * For each curve triangle (in their order in `indices`), whether
   * the curve bulges outward from its chord. The renderer needs this
   * to decide whether the curve's filled half ADDS to the flat
   * polygon (outward) or SUBTRACTS from it (inward).
   */
  readonly curveBulgeOutward: Uint8Array;
}

/**
 * Compile a `FaceTriangulation` into interleaved vertex / index
 * buffers. The output is sized exactly to fit the input; no padding.
 */
export function compileTessellation(t: FaceTriangulation): TessellationBuffers {
  const flatTriCount = t.flat.length;
  const curveTriCount = t.curves.length;
  const ribbonTriCount = t.ribbons.length;
  const totalTriCount = flatTriCount + curveTriCount + ribbonTriCount;
  const totalVertCount = totalTriCount * 3;

  const FLOATS = VERTEX_BYTE_SIZE / 4;
  const vertices = new Float32Array(totalVertCount * FLOATS);
  const indices = new Uint32Array(totalTriCount * 3);
  const curveBulgeOutward = new Uint8Array(curveTriCount);

  let vi = 0; // vertex slot pointer (in elements)
  let ii = 0; // index pointer
  let nextIdx = 0; // next unused vertex index

  // Helper: set the lens-candidate slots (6..8) to -1. Lens (kind
  // 1/2) overwrites slot 6 (and glyph-cache fills 7..8); other kinds
  // leave them -1.
  const writeNoBand = (off: number): void => {
    for (let c = 6; c < FLOATS; c++) vertices[off + c] = -1;
  };

  // ---- Interior triangles ----
  for (const tri of t.flat) {
    for (let k = 0; k < 3; k++) {
      const p = tri.vertices[k]!;
      vertices[vi + 0] = p.x;
      vertices[vi + 1] = p.y;
      // klm = (0, 1, 1) → k² − l = −1, never discarded by the
      // unified Loop-Blinn fragment test.
      vertices[vi + 2] = 0;
      vertices[vi + 3] = 1;
      vertices[vi + 4] = 1;
      vertices[vi + 5] = VERTEX_KIND_INTERIOR;
      writeNoBand(vi);
      vi += FLOATS;
      indices[ii++] = nextIdx++;
    }
  }
  const interiorIndexCount = ii;

  // ---- Curve triangles ----
  // Original (start, control, end) triangles with Loop-Blinn klm.
  for (let ci = 0; ci < curveTriCount; ci++) {
    const tri = t.curves[ci]!;
    const kind = tri.kind === "arc" ? VERTEX_KIND_ARC : VERTEX_KIND_BEZIER2;
    curveBulgeOutward[ci] = tri.bulgesOutward ? 1 : 0;
    for (let k = 0; k < 3; k++) {
      const p = tri.vertices[k]!;
      const klm = tri.texcoords[k]!;
      vertices[vi + 0] = p.x;
      vertices[vi + 1] = p.y;
      vertices[vi + 2] = klm[0];
      vertices[vi + 3] = klm[1];
      vertices[vi + 4] = klm[2];
      vertices[vi + 5] = kind;
      // slot[6] = LOCAL curve index. glyph-cache rewrites this into
      // a global SSBO index (and fills slot[7..8] with prev/next
      // adjacent curves) before upload, so the lens FS can run the
      // same Newton-distance / AA-ramp logic the band uses for its
      // outside-curve fragments. Slots [7..11] stay -1 here.
      writeNoBand(vi);
      vertices[vi + 6] = ci;
      vi += FLOATS;
      indices[ii++] = nextIdx++;
    }
  }
  const curveIndexCount = ii - interiorIndexCount;

  // ---- Line-edge AA ribbon triangles ----
  // klm slot is reinterpreted as (outwardX, outwardY, isOuter); the
  // vertex shader uses these to expand `isOuter` vertices by 1 px in
  // screen space along `outward` (in NDC), and the fragment shader
  // uses `1 - isOuter` as the linear AA ramp.
  for (const tri of t.ribbons) {
    for (let k = 0; k < 3; k++) {
      const p = tri.vertices[k]!;
      const o = tri.outward[k]!;
      vertices[vi + 0] = p.x;
      vertices[vi + 1] = p.y;
      vertices[vi + 2] = o.x;
      vertices[vi + 3] = o.y;
      vertices[vi + 4] = tri.isOuter[k]!;
      vertices[vi + 5] = VERTEX_KIND_LINE_RIBBON;
      writeNoBand(vi);
      vi += FLOATS;
      indices[ii++] = nextIdx++;
    }
  }
  const ribbonIndexCount = ii - interiorIndexCount - curveIndexCount;

  return {
    vertices,
    indices,
    interiorRange: { firstIndex: 0,                                indexCount: interiorIndexCount },
    curveRange:    { firstIndex: interiorIndexCount,               indexCount: curveIndexCount },
    ribbonRange:   { firstIndex: interiorIndexCount + curveIndexCount, indexCount: ribbonIndexCount },
    curveBulgeOutward,
  };
}
