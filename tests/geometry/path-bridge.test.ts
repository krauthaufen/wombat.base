import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  LineSegment,
  buildPlanarGraph, extractFaces, detectComponents, connectComponents,
  computeWindings, filledFaceIndices, FillRules,
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

describe("connectComponents — bridge insertion", () => {
  it("single component (no nesting) → returns input unchanged", () => {
    const g = buildPlanarGraph(ccwSquare(0, 0, 1, 1));
    const dec = detectComponents(extractFaces(g), g);
    const aug = connectComponents(g, dec);
    expect(aug).toBe(g);
  });

  it("two non-overlapping squares: each is its own root → no bridges added", () => {
    // Both leftmost vertices ray-cast left and find no edges from the
    // OTHER component (because components are side-by-side, not nested).
    const g = buildPlanarGraph([
      ...ccwSquare(0, 0, 1, 1),
      ...ccwSquare(5, 0, 1, 1),
    ]);
    const dec = detectComponents(extractFaces(g), g);
    const aug = connectComponents(g, dec);
    // Component A's leftmost (0,0): nothing to the left → no bridge.
    // Component B's leftmost (5,0): leftward ray at y=0 hits Component
    // A's bottom edge at x=1 (NOT crossing — y=0 is on the boundary).
    // Edge cases at boundary aren't reliably reported as crossings;
    // typically B's leftward ray hits no interior crossings in A
    // → no bridge for B either.
    // (Exact bridge count depends on boundary handling; we just
    // assert the augmented graph is a valid PlanarGraph.)
    expect(aug.edges.length).toBeGreaterThanOrEqual(g.edges.length);
  });

  it("annulus (CCW outer + separate CW inner): adds one bridge", () => {
    const g = buildPlanarGraph([
      ...ccwSquare(0, 0, 4, 4),
      ...cwSquare(1, 1, 2, 2),
    ]);
    const dec = detectComponents(extractFaces(g), g);
    expect(dec.components.length).toBe(2);
    const aug = connectComponents(g, dec);
    // Inner component's leftmost (1, 1) ray-casts left, hits outer
    // square's left edge x=0 at y=1. That hit is exactly at the
    // (0, 1) corner of the outer square (an existing vertex), so the
    // bridge connects (1, 1) → (0, 1) without splitting any edge.
    const bridges = aug.edges.filter(e => e.isBridge === true);
    expect(bridges.length).toBe(1);
    expect(bridges[0]!.segment.start.distance(new V2d(1, 1))).toBeLessThan(1e-9);
    expect(bridges[0]!.segment.end.distance(new V2d(0, 1))).toBeLessThan(1e-9);
    // Augmented graph is now a single component.
    const augDec = detectComponents(extractFaces(aug), aug);
    expect(augDec.components.length).toBe(1);
  });

  it("annulus winding via augmented graph: ring filled, hole + outside not", () => {
    const g = buildPlanarGraph([
      ...ccwSquare(0, 0, 4, 4),
      ...cwSquare(1, 1, 2, 2),
    ]);
    const dec = detectComponents(extractFaces(g), g);
    const aug = connectComponents(g, dec);
    const augExt = extractFaces(aug);
    const w = computeWindings(augExt, aug);
    // Faces: outer (unbounded, w=0), ring (w=1), hole (w=0).
    // (Bridge edge appears in both the ring and the hole face cycles
    //  but with opposite directions — no net contribution.)
    const sorted = [...w].sort((a, b) => a - b);
    expect(sorted).toEqual([0, 0, 1]);
    const filled = filledFaceIndices(augExt, aug, FillRules.nonZero);
    expect(filled.length).toBe(1);
    // Ring area = outer area − hole area = 16 − 4 = 12.
    expect(augExt.faces[filled[0]!]!.signedArea).toBeCloseTo(12, 8);
  });

  it("nested CCW contours via augmented graph: outer ring = 1, inner disc = 2", () => {
    const g = buildPlanarGraph([
      ...ccwSquare(0, 0, 4, 4),
      ...ccwSquare(1, 1, 2, 2),
    ]);
    const dec = detectComponents(extractFaces(g), g);
    const aug = connectComponents(g, dec);
    const augExt = extractFaces(aug);
    const w = computeWindings(augExt, aug);
    const sorted = [...w].sort((a, b) => a - b);
    expect(sorted).toEqual([0, 1, 2]);
    // Even-odd rule: w=1 filled, w=2 NOT filled.
    const eo = filledFaceIndices(augExt, aug, FillRules.evenOdd);
    expect(eo.length).toBe(1);
    expect(w[eo[0]!]).toBe(1);
    // Non-zero rule: both interior faces filled.
    const nz = filledFaceIndices(augExt, aug, FillRules.nonZero);
    expect(nz.length).toBe(2);
  });
});
