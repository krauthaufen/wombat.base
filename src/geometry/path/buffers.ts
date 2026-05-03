// Convert tessellation output to GPU-ready interleaved buffers.
//
// The fragment shader needs three things per vertex:
//   - position  (vec2<f32>) — world-space xy
//   - klm       (vec3<f32>) — Loop-Blinn texcoord (or
//                            (outwardX, outwardY, isOuter) when
//                            kind = 3, line ribbon)
//   - kind      (f32)       — 0 interior, 1 bezier2, 2 arc,
//                            3 line ribbon
//
// We pack them into one interleaved array (6 f32 = 24 bytes per
// vertex) and produce a single Uint32Array of triangle indices.
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

export const VERTEX_BYTE_SIZE = 24; // 6 × f32

export interface TessellationBuffers {
  /** Interleaved vertex data: per vertex, 6 f32:
   *  `[x, y, klm.x, klm.y, klm.z, kind]`. For `kind = 3`
   *  (line ribbon), the `klm` slot carries
   *  `(outwardX, outwardY, isOuter)`. */
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

  const haloTriCount = t.outerHalo.length;
  const totalVerts2  = (flatTriCount + curveTriCount + ribbonTriCount + haloTriCount) * 3;
  const totalIdx2    = (flatTriCount + curveTriCount + ribbonTriCount + haloTriCount) * 3;

  const vertices = new Float32Array(totalVerts2 * 6); // x, y, klm.x, klm.y, klm.z, kind
  const indices = new Uint32Array(totalIdx2);
  const curveBulgeOutward = new Uint8Array(curveTriCount);

  let vi = 0; // vertex slot pointer (in elements)
  let ii = 0; // index pointer
  let nextIdx = 0; // next unused vertex index

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
      vi += 6;
      indices[ii++] = nextIdx++;
    }
  }
  const interiorIndexCount = ii;

  // ---- Curve triangles ----
  // Original (start, control, end) triangles with Loop-Blinn klm.
  // The outer halo (below) adds CDT-tessellated triangles covering
  // the bbox area outside polygon + outside outward-curve triangles,
  // so the whole glyph mesh tiles the bbox watertight.
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
      vi += 6;
      indices[ii++] = nextIdx++;
    }
  }
  const curveIndexCount = ii - interiorIndexCount;

  // ---- Outer halo (CDT) triangles ----
  // Tile the bbox-around-glyph with triangles outside polygon and
  // outside any outward-bulging curve triangle. Encoded as kind=1
  // (bezier2) with klm = (1, 0, 1) at all 3 verts → implicit
  // f = 1²−0 = 1 > 0 everywhere, so the FS discards every fragment.
  // This keeps the mesh watertight without painting the surrounding
  // BG. Same fragment-shader code path as real bezier2 triangles
  // (no new shader branch needed).
  for (const tri of t.outerHalo) {
    for (let k = 0; k < 3; k++) {
      const p = tri.vertices[k]!;
      vertices[vi + 0] = p.x;
      vertices[vi + 1] = p.y;
      vertices[vi + 2] = 1;
      vertices[vi + 3] = 0;
      vertices[vi + 4] = 1;
      vertices[vi + 5] = VERTEX_KIND_BEZIER2;
      vi += 6;
      indices[ii++] = nextIdx++;
    }
  }
  const haloIndexCount = ii - interiorIndexCount - curveIndexCount;

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
      vi += 6;
      indices[ii++] = nextIdx++;
    }
  }
  const ribbonIndexCount = ii - interiorIndexCount - curveIndexCount - haloIndexCount;

  return {
    vertices,
    indices,
    interiorRange: { firstIndex: 0,                                                       indexCount: interiorIndexCount },
    curveRange:    { firstIndex: interiorIndexCount,                                      indexCount: curveIndexCount + haloIndexCount },
    ribbonRange:   { firstIndex: interiorIndexCount + curveIndexCount + haloIndexCount,   indexCount: ribbonIndexCount },
    curveBulgeOutward,
  };
}
