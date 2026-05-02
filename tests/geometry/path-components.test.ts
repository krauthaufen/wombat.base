import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  LineSegment,
  buildPlanarGraph, extractFaces, detectComponents,
} from "../../src/geometry/path/index.js";

function ccwSquare(x: number, y: number, w: number, h: number): LineSegment[] {
  return [
    new LineSegment(new V2d(x, y), new V2d(x + w, y)),
    new LineSegment(new V2d(x + w, y), new V2d(x + w, y + h)),
    new LineSegment(new V2d(x + w, y + h), new V2d(x, y + h)),
    new LineSegment(new V2d(x, y + h), new V2d(x, y)),
  ];
}

describe("detectComponents", () => {
  it("single closed contour: 1 component, leftmost vertex correct", () => {
    const g = buildPlanarGraph(ccwSquare(2, 3, 4, 5));
    const ext = extractFaces(g);
    const dec = detectComponents(ext, g);
    expect(dec.components.length).toBe(1);
    const c = dec.components[0]!;
    expect(c.faceIndices.length).toBe(2);
    expect(c.vertexIndices.length).toBe(4);
    expect(c.edgeIndices.length).toBe(4);
    // Leftmost vertex is (2, 3) or (2, 8); ties broken by smallest y → (2, 3).
    expect(g.vertices[c.leftmostVertex]!.x).toBeCloseTo(2);
    expect(g.vertices[c.leftmostVertex]!.y).toBeCloseTo(3);
  });

  it("two non-touching closed contours: 2 components", () => {
    const g = buildPlanarGraph([
      ...ccwSquare(0, 0, 1, 1),
      ...ccwSquare(5, 5, 1, 1),
    ]);
    const ext = extractFaces(g);
    const dec = detectComponents(ext, g);
    expect(dec.components.length).toBe(2);
    // Each component has 2 faces, 4 vertices, 4 edges.
    for (const c of dec.components) {
      expect(c.faceIndices.length).toBe(2);
      expect(c.vertexIndices.length).toBe(4);
      expect(c.edgeIndices.length).toBe(4);
    }
    // componentOfFace partition is consistent.
    for (let f = 0; f < ext.faces.length; f++) {
      expect(dec.componentOfFace[f]).toBeGreaterThanOrEqual(0);
    }
  });

  it("crossing X (one connected planar graph): 1 component", () => {
    const g = buildPlanarGraph([
      new LineSegment(new V2d(0, 0), new V2d(2, 2)),
      new LineSegment(new V2d(0, 2), new V2d(2, 0)),
    ]);
    const ext = extractFaces(g);
    const dec = detectComponents(ext, g);
    expect(dec.components.length).toBe(1);
    expect(dec.components[0]!.vertexIndices.length).toBe(5);
  });

  it("nested non-touching squares: 2 components, distinct bboxes", () => {
    const g = buildPlanarGraph([
      ...ccwSquare(0, 0, 4, 4),
      ...ccwSquare(1, 1, 2, 2),
    ]);
    const ext = extractFaces(g);
    const dec = detectComponents(ext, g);
    expect(dec.components.length).toBe(2);
    // One component has bbox [0,4]² and the other [1,3]².
    const sizes = dec.components.map(c => c.bounds.size().x).slice().sort();
    expect(sizes[0]).toBeCloseTo(2);
    expect(sizes[1]).toBeCloseTo(4);
  });
});
