// Convert tessellation output to GPU-ready interleaved buffers.
//
// The fragment shader needs three things per vertex:
//   - position      (vec2<f32>) — world-space xy
//   - klm           (vec3<f32>) — Loop-Blinn texcoord
//   - kind          (u32)       — 0 = interior, 1 = bezier2, 2 = arc
//
// We pack them into ONE interleaved array (5 f32 + 1 u32 = 24 bytes
// per vertex, with 4-byte alignment) and produce a single Uint32Array
// of triangle indices. Two triangle ranges are reported separately —
// `interiorRange` and `curveRange` — so the renderer can issue two
// draw calls (interior with no implicit-form test; curves with).
//
// `bulgesOutward` is also reported per curve triangle so the
// renderer can flip the comparison sign (inward-bulging curves
// subtract from the flat polygon by inverting the implicit test).

import type { FaceTriangulation } from "./triangulate.js";

export const VERTEX_KIND_INTERIOR = 0;
export const VERTEX_KIND_BEZIER2  = 1;
export const VERTEX_KIND_ARC      = 2;

export const VERTEX_BYTE_SIZE = 24; // 5 × f32 + 1 × u32

export interface TessellationBuffers {
  /** Interleaved vertex data: per vertex, 5 f32 then 1 u32:
   *  `[x, y, k, l, m, kind, …]`. */
  readonly vertices: Float32Array;
  /** Index buffer: 3 indices per triangle. */
  readonly indices: Uint32Array;
  /** Range of `indices` for interior (flat) triangles. */
  readonly interiorRange: { firstIndex: number; indexCount: number };
  /** Range of `indices` for curve (Loop-Blinn) triangles. */
  readonly curveRange: { firstIndex: number; indexCount: number };
  /**
   * For each curve triangle (in their order in `indices`), whether
   * the curve bulges outward from its chord. The renderer needs this
   * to decide whether the curve's filled half ADDS to the flat
   * polygon (outward) or SUBTRACTS from it (inward).
   */
  readonly curveBulgeOutward: Uint8Array;
}

/** Encode a u32 into a Float32Array slot via DataView so the bit
 *  pattern is preserved across JS number → f32 boundaries. */
function writeU32IntoFloat(arr: Float32Array, index: number, v: number): void {
  // The vertex format places the u32 immediately after 5 f32s. We
  // write through the underlying buffer to avoid the f32 reinterpret.
  const dv = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  dv.setUint32(index * 4, v, true);
}

/**
 * Compile a `FaceTriangulation` into interleaved vertex / index
 * buffers. The output is sized exactly to fit the input; no padding.
 */
export function compileTessellation(t: FaceTriangulation): TessellationBuffers {
  const flatTriCount = t.flat.length;
  const curveTriCount = t.curves.length;
  const totalTriCount = flatTriCount + curveTriCount;
  const totalVertCount = totalTriCount * 3;

  const vertices = new Float32Array(totalVertCount * 6); // 6 slots per vertex (x,y,k,l,m,kind-as-u32)
  const indices = new Uint32Array(totalTriCount * 3);
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
      vertices[vi + 2] = 1; // klm = (1, 1, 1) — placeholder; interior shader ignores.
      vertices[vi + 3] = 1;
      vertices[vi + 4] = 1;
      writeU32IntoFloat(vertices, vi + 5, VERTEX_KIND_INTERIOR);
      vi += 6;
      indices[ii++] = nextIdx++;
    }
  }
  const interiorIndexCount = ii;

  // ---- Curve triangles ----
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
      writeU32IntoFloat(vertices, vi + 5, kind);
      vi += 6;
      indices[ii++] = nextIdx++;
    }
  }
  const curveIndexCount = ii - interiorIndexCount;

  return {
    vertices,
    indices,
    interiorRange: { firstIndex: 0, indexCount: interiorIndexCount },
    curveRange: { firstIndex: interiorIndexCount, indexCount: curveIndexCount },
    curveBulgeOutward,
  };
}
