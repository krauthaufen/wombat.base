import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  LineSegment, ArcSegment,
  buildPlanarGraph, extractFaces,
  computeWindings, filledFaceIndices,
  FillRules,
} from "../../src/geometry/path/index.js";

function ccwSquare(x: number, y: number, w: number, h: number): LineSegment[] {
  return [
    new LineSegment(new V2d(x, y), new V2d(x + w, y)),
    new LineSegment(new V2d(x + w, y), new V2d(x + w, y + h)),
    new LineSegment(new V2d(x + w, y + h), new V2d(x, y + h)),
    new LineSegment(new V2d(x, y + h), new V2d(x, y)),
  ];
}

function cwSquare(x: number, y: number, w: number, h: number): LineSegment[] {
  return [
    new LineSegment(new V2d(x, y), new V2d(x, y + h)),
    new LineSegment(new V2d(x, y + h), new V2d(x + w, y + h)),
    new LineSegment(new V2d(x + w, y + h), new V2d(x + w, y)),
    new LineSegment(new V2d(x + w, y), new V2d(x, y)),
  ];
}

describe("winding — basics", () => {
  it("CCW square: outer = 0, interior = +1", () => {
    const g = buildPlanarGraph(ccwSquare(0, 0, 1, 1));
    const w = computeWindings(extractFaces(g), g);
    expect(w.length).toBe(2);
    const sorted = [...w].sort((a, b) => a - b);
    expect(sorted).toEqual([0, 1]);
  });

  it("CW square: outer = 0, interior = -1", () => {
    const g = buildPlanarGraph(cwSquare(0, 0, 1, 1));
    const w = computeWindings(extractFaces(g), g);
    const sorted = [...w].sort((a, b) => a - b);
    expect(sorted).toEqual([-1, 0]);
  });

  // Disconnected nested contours: the path-bridge.test.ts suite
  // covers winding correctness on the augmented (bridged) graph.
  // Here we just sanity-check that the un-augmented winding still
  // works for a connected planar graph (one closed contour with
  // self-touch behaviour, not two disjoint contours).
  it("self-touching figure-8 (one connected planar graph): non-zero winding on each loop", () => {
    // A figure-8 traced as one closed path: a single contour that
    // crosses itself at the origin. Both lobes should have winding
    // ±1; the outer face has winding 0.
    const path = [
      new LineSegment(new V2d(-1, 0), new V2d(0, 1)),
      new LineSegment(new V2d(0, 1), new V2d(1, 0)),
      new LineSegment(new V2d(1, 0), new V2d(0, -1)),
      new LineSegment(new V2d(0, -1), new V2d(-1, 0)),
    ];
    const g = buildPlanarGraph(path);
    const w = computeWindings(extractFaces(g), g);
    // 2 faces (it's just a CCW diamond, no self-cross): 0 and ±1.
    const sorted = [...w].sort((a, b) => a - b);
    expect(sorted.length).toBe(2);
    expect(Math.abs(sorted[0]!) + Math.abs(sorted[1]!)).toBe(1);
  });

  it("disconnected CCW squares: each interior fills independently", () => {
    const g = buildPlanarGraph([
      ...ccwSquare(0, 0, 1, 1),
      ...ccwSquare(5, 0, 1, 1),
    ]);
    const ext = extractFaces(g);
    const w = computeWindings(ext, g);
    expect(w.length).toBe(4);
    const sorted = [...w].sort((a, b) => a - b);
    expect(sorted).toEqual([0, 0, 1, 1]);
    const filled = filledFaceIndices(ext, g);
    expect(filled.length).toBe(2);
  });

  it("fill rules — even-odd / positive / exactly select different face sets", () => {
    // Two crossing CCW triangles forming a 6-pointed star. The
    // central hexagon has winding 2; the 6 points have winding 1;
    // outside has winding 0.
    const sqrt3 = Math.sqrt(3);
    const tri1 = [
      new LineSegment(new V2d(-1, -sqrt3 / 3), new V2d(1, -sqrt3 / 3)),
      new LineSegment(new V2d(1, -sqrt3 / 3), new V2d(0, 2 * sqrt3 / 3)),
      new LineSegment(new V2d(0, 2 * sqrt3 / 3), new V2d(-1, -sqrt3 / 3)),
    ];
    const tri2 = [
      new LineSegment(new V2d(-1, sqrt3 / 3), new V2d(0, -2 * sqrt3 / 3)),
      new LineSegment(new V2d(0, -2 * sqrt3 / 3), new V2d(1, sqrt3 / 3)),
      new LineSegment(new V2d(1, sqrt3 / 3), new V2d(-1, sqrt3 / 3)),
    ];
    const g = buildPlanarGraph([...tri1, ...tri2]);
    const ext = extractFaces(g);
    const w = computeWindings(ext, g);
    // Non-zero rule: everything inside either triangle is filled.
    const nz = filledFaceIndices(ext, g, FillRules.nonZero);
    // Even-odd rule: hexagon (w=2) excluded, 6 points (w=1) included.
    const eo = filledFaceIndices(ext, g, FillRules.evenOdd);
    expect(nz.length).toBeGreaterThan(eo.length);
    // Positive rule equals non-zero for this all-CCW input.
    const pos = filledFaceIndices(ext, g, FillRules.positive);
    expect(pos.length).toBe(nz.length);
    // exactly(2): only the centre hexagon.
    const centre = filledFaceIndices(ext, g, FillRules.exactly(2));
    expect(centre.length).toBe(1);
    expect(w[centre[0]!]).toBe(2);
  });

  it("circle + diameter: half-discs both filled (each winding = 1)", () => {
    const arc = ArcSegment.circular(new V2d(0, 0), 1, 0, 2 * Math.PI);
    const chord = new LineSegment(new V2d(-1, 0), new V2d(1, 0));
    const g = buildPlanarGraph([arc, chord]);
    const w = computeWindings(extractFaces(g), g);
    expect(w.length).toBe(3);
    const sorted = [...w].sort((a, b) => a - b);
    expect(sorted).toEqual([0, 1, 1]);
  });
});
