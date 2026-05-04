// libtess-based polygon-with-holes interior tessellation. Replaces
// our ad-hoc ear-clip + custom planar-graph face decomposition for
// glyph fill: feeds each glyph's chord-polyline contours to GLU
// tessellator with the requested winding rule and gets back a flat
// triangle list.
//
// Robust against:
//   - self-touch at vertices (shared chord endpoints between
//     adjacent contour edges, the Lato H 9-vs-10 case).
//   - polygon-with-holes (counter loops in O / D / e / a / o / …).
//   - segment-segment self-intersection inside a single contour
//     (libtess handles it via the GLU_TESS_COMBINE callback).
//
// Limitations vs. Aardvark's full sanitiser:
//   - libtess treats cubic beziers as opaque straight chords, so
//     a self-intersecting cubic (loop / serpentine cusp) is NOT
//     split before tessellation. Feed cubics as PRE-SPLIT bezier2s
//     (which we already do via cubicToQuadratics in classifyCurve).
//   - Arc segments must come in ≤90° pieces (already enforced by
//     classifyArc's MAX_ARC_PIECE).

import type { V2d } from "../../vector/v2d.js";
// libtess.js publishes a single UMD bundle. Vite + node both pick up
// the default export from libtess.min.js.
import libtess from "libtess";

import type { FlatTriangle } from "./triangulate.js";

export type FillRuleName =
  | "non-zero"
  | "even-odd"
  | "positive"
  | "negative"
  | "abs-geq-two";

const WINDING: Record<FillRuleName, number> = {
  "non-zero":    libtess.windingRule.GLU_TESS_WINDING_NONZERO,
  "even-odd":    libtess.windingRule.GLU_TESS_WINDING_ODD,
  "positive":    libtess.windingRule.GLU_TESS_WINDING_POSITIVE,
  "negative":    libtess.windingRule.GLU_TESS_WINDING_NEGATIVE,
  "abs-geq-two": libtess.windingRule.GLU_TESS_WINDING_ABS_GEQ_TWO,
};

/**
 * Tessellate a polygon-with-holes given as `contours: V2d[][]`. Each
 * inner array is one closed contour; orientation is interpreted under
 * the requested winding rule (default `non-zero` for TrueType-style
 * "outer CCW + holes CW" fonts).
 *
 * Returns an array of flat triangles in the same coordinate space as
 * the input. Fresh `V2d`-shaped objects (`{ x, y }`) are allocated
 * for COMBINE-generated vertices (self-intersection points) — those
 * lose endpoint identity with the original chord points, but the
 * tessellator's flat triangles don't need it.
 */
export function tessellateContoursLibtess(
  contours: ReadonlyArray<ReadonlyArray<V2d>>,
  rule: FillRuleName = "non-zero",
): FlatTriangle[] {
  if (contours.length === 0) return [];
  const tess = new libtess.GluTesselator();
  tess.gluTessProperty(libtess.gluEnum.GLU_TESS_WINDING_RULE, WINDING[rule]);
  // Force pure GL_TRIANGLES output — without an EDGE_FLAG callback
  // libtess emits TRIANGLE_FANs / STRIPS which we'd have to
  // re-decode. With EDGE_FLAG (no-op) it falls back to GL_TRIANGLES.
  tess.gluTessNormal(0, 0, 1);

  const out: FlatTriangle[] = [];
  let batch: { x: number; y: number }[] = [];

  tess.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN, (_type: number) => {
    batch = [];
  });
  tess.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA,
    (data: { x: number; y: number }, _polyData: unknown) => {
      batch.push(data);
    });
  tess.gluTessCallback(libtess.gluEnum.GLU_TESS_END, () => {
    for (let i = 0; i + 2 < batch.length; i += 3) {
      const a = batch[i]!, b = batch[i + 1]!, c = batch[i + 2]!;
      // Libtess output is in input space (math y-up) and CCW per
      // the configured normal (0, 0, 1). We don't enforce winding
      // downstream — Sg.Text uses CullMode none.
      out.push({ vertices: [
        { x: a.x, y: a.y } as V2d,
        { x: b.x, y: b.y } as V2d,
        { x: c.x, y: c.y } as V2d,
      ] as const });
    }
    batch = [];
  });
  tess.gluTessCallback(libtess.gluEnum.GLU_TESS_EDGE_FLAG,
    (_flag: boolean) => { /* no-op forces GL_TRIANGLES */ });
  tess.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE,
    (coords: ReadonlyArray<number>, _data: ReadonlyArray<unknown>, _weight: ReadonlyArray<number>) => {
      // Self-intersection point produced by libtess. We discard the
      // weighted blend of input data (we only need positions).
      return { x: coords[0]!, y: coords[1]! };
    });
  tess.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, (errno: number) => {
    // Most errors are recoverable (libtess just bails on the
    // primitive). Log and let the contour drop.
    // eslint-disable-next-line no-console
    console.warn("libtess error:", errno);
  });

  tess.gluTessBeginPolygon(undefined);
  for (const c of contours) {
    if (c.length < 3) continue;
    tess.gluTessBeginContour();
    for (const v of c) {
      tess.gluTessVertex([v.x, v.y, 0], { x: v.x, y: v.y });
    }
    tess.gluTessEndContour();
  }
  tess.gluTessEndPolygon();

  return out;
}
