// Loop-Blinn needs curve triangles that do not overlap one another nor
// cross other edges: a curve triangle keeps (or drops) the side of ITS
// curve, so where two overlap, the region one of them should cut away is
// kept by the other. An arc band (a ring segment, a stroke of an arc)
// over 90° is such a case: the outer arc's triangle reaches down to its
// chord, deep under the inner arc's. `tessellatePath` splits curves until
// their hulls are apart (`separateCurveHulls`), and ear clipping keeps a
// vertex on an ear's edge (a halved curve's detour) from being cut away.
// Checked by evaluating the fill as the fragment shader does, on a grid,
// against the true shape.

import { describe, expect, it } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import { pathFromSvgD } from "../../src/svg/path.js";
import { tessellatePath } from "../../src/geometry/path/tessellate.js";
import { triangulateFilledFaces } from "../../src/geometry/path/triangulate.js";
import { compileTessellation, VERTEX_BYTE_SIZE } from "../../src/geometry/path/buffers.js";
import { separateCurveHulls } from "../../src/geometry/path/separate.js";
import { ArcSegment } from "../../src/geometry/path/segment.js";

const F = VERTEX_BYTE_SIZE / 4;

/** Whether the fill covers (x, y): some triangle contains it and keeps it. */
function covered(d: string, x: number, y: number, b = buffersOf(d)): boolean {
  const V = b.vertices, I = b.indices;
  for (let t = 0; t < I.length; t += 3) {
    const i0 = I[t]! * F, i1 = I[t + 1]! * F, i2 = I[t + 2]! * F;
    const kind = V[i0 + 5]!;
    if (kind > 2.5) continue;                              // AA ribbons: no area
    const ax = V[i0]!, ay = V[i0 + 1]!, bx = V[i1]!, by = V[i1 + 1]!, cx = V[i2]!, cy = V[i2 + 1]!;
    const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(det) < 1e-14) continue;
    const l0 = ((bx - x) * (cy - y) - (cx - x) * (by - y)) / det;
    const l1 = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) / det;
    const l2 = 1 - l0 - l1;
    if (l0 < 0 || l1 < 0 || l2 < 0) continue;
    const at = (o: number) => l0 * V[i0 + o]! + l1 * V[i1 + o]! + l2 * V[i2 + o]!;
    const k = at(2), l = at(3), m = at(4);
    if (kind > 1.7) { if ((k * k + l * l - 1) * m > 0) continue; }
    else if (kind > 0.7) { if ((k * k - l) * m > 0) continue; }
    return true;
  }
  return false;
}
const cache = new Map<string, ReturnType<typeof compileTessellation>>();
function buffersOf(d: string) {
  let b = cache.get(d);
  if (b === undefined) {
    const t = tessellatePath(pathFromSvgD(d));
    b = compileTessellation(triangulateFilledFaces(t.filledFaces, t.extraction, t.graph));
    cache.set(d, b);
  }
  return b;
}

/** Grid samples over [x0,x1]×[y0,y1] more than `margin` from every edge: wrong ones. */
function wrongSamples(d: string, inside: (x: number, y: number) => boolean, edgeDist: (x: number, y: number) => number,
                      x0: number, x1: number, y0: number, y1: number, n = 120, margin = 1e-3): number {
  let wrong = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / n, y = y0 + (y1 - y0) * (j + 0.5) / n;
    if (edgeDist(x, y) < margin) continue;
    if (covered(d, x, y) !== inside(x, y)) wrong++;
  }
  return wrong;
}

const band = (r: number, R: number) =>
  `M ${R} 0 A ${R} ${R} 0 0 1 0 ${R} L 0 ${r} A ${r} ${r} 0 0 0 ${r} 0 Z`;

describe("curve hulls apart (Loop-Blinn correctness)", () => {
  for (const [r, R] of [[9, 10], [9.5, 10], [5, 10], [9.9, 10]] as const) {
    it(`a quarter ring between ${r} and ${R} is filled exactly`, () => {
      const d = band(r, R);
      const inside = (x: number, y: number) => { const q = Math.hypot(x, y); return x > 0 && y > 0 && q > r && q < R; };
      const edge = (x: number, y: number) => { const q = Math.hypot(x, y); return Math.min(Math.abs(q - r), Math.abs(q - R), Math.abs(x), Math.abs(y)); };
      expect(wrongSamples(d, inside, edge, -0.5, R + 0.5, -0.5, R + 0.5)).toBe(0);
    });
  }

  it("a crescent: one quadratic's hull inside the other's", () => {
    // both bulge up from (0,0) to (10,0); the region between them is filled
    const d = "M 0 0 Q 5 4 10 0 Q 5 2 0 0 Z";
    const yT = (x: number) => { const t = x / 10; return 8 * t * (1 - t); };
    const yB = (x: number) => { const t = x / 10; return 4 * t * (1 - t); };
    const inside = (x: number, y: number) => x > 0 && x < 10 && y > yB(x) && y < yT(x);
    const edge = (x: number, y: number) => Math.min(Math.abs(y - yT(x)), Math.abs(y - yB(x)), Math.abs(x), Math.abs(x - 10));
    expect(wrongSamples(d, inside, edge, -0.5, 10.5, -0.5, 2.5)).toBe(0);
  });

  it("separateCurveHulls leaves apart curves alone and splits overlapping ones", () => {
    const circle = pathFromSvgD("M 1 0 A 1 1 0 0 1 -1 0 A 1 1 0 0 1 1 0 Z");
    // a half-circle arc has no finite hull (tangents parallel): split, but no further than needed
    expect(separateCurveHulls(circle).length).toBeLessThanOrEqual(8);
    const banded = separateCurveHulls(pathFromSvgD(band(9.5, 10)));
    expect(banded.filter((s) => s.kind === "arc").length).toBeGreaterThan(2);
    for (const s of banded) if (s.kind === "arc") expect(Math.abs((s as ArcSegment).deltaAngle)).toBeLessThan(Math.PI / 2);
    // lines only: unchanged
    const sq = pathFromSvgD("M 0 0 L 1 0 L 1 1 Z");
    expect(separateCurveHulls(sq)).toEqual(sq);
    void V2d;
  });
});
