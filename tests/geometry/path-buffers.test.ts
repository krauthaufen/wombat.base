import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  LineSegment, Bezier2Segment, ArcSegment, Path,
  tessellatePath, triangulateFilledFaces,
  compileTessellation,
  VERTEX_KIND_INTERIOR, VERTEX_KIND_BEZIER2, VERTEX_KIND_ARC,
} from "../../src/geometry/path/index.js";

function readKind(vertices: Float32Array, vertexIndex: number): number {
  return vertices[vertexIndex * 6 + 5]!;
}

function readPosition(vertices: Float32Array, vertexIndex: number): [number, number] {
  return [vertices[vertexIndex * 6 + 0]!, vertices[vertexIndex * 6 + 1]!];
}

describe("compileTessellation", () => {
  function ccwSquare(): LineSegment[] {
    return [
      new LineSegment(new V2d(0, 0), new V2d(1, 0)),
      new LineSegment(new V2d(1, 0), new V2d(1, 1)),
      new LineSegment(new V2d(1, 1), new V2d(0, 1)),
      new LineSegment(new V2d(0, 1), new V2d(0, 0)),
    ];
  }

  it("flat-only square: 2 interior triangles, 0 curve triangles", () => {
    const r = tessellatePath(ccwSquare());
    const tri = triangulateFilledFaces(r.filledFaces, r.extraction, r.graph);
    const bufs = compileTessellation(tri);
    expect(bufs.interiorRange.indexCount).toBe(6); // 2 triangles × 3
    expect(bufs.curveRange.indexCount).toBe(0);
    expect(bufs.indices.length).toBe(6);
    // All vertices flagged as interior.
    const vertCount = bufs.vertices.length / 6;
    for (let i = 0; i < vertCount; i++) {
      expect(readKind(bufs.vertices, i)).toBe(VERTEX_KIND_INTERIOR);
    }
  });

  it("path with bezier2 boundary: interior + bezier2 ranges populated", () => {
    const path = new Path([
      new LineSegment(new V2d(0, 0), new V2d(2, 0)),
      new Bezier2Segment(new V2d(2, 0), new V2d(2.5, 1), new V2d(2, 2)),
      new LineSegment(new V2d(2, 2), new V2d(0, 2)),
      new LineSegment(new V2d(0, 2), new V2d(0, 0)),
    ]);
    const r = tessellatePath([path]);
    const tri = triangulateFilledFaces(r.filledFaces, r.extraction, r.graph);
    const bufs = compileTessellation(tri);
    expect(bufs.interiorRange.indexCount).toBe(6);  // quad → 2 tri
    expect(bufs.curveRange.indexCount).toBe(3);     // 1 bezier2 tri
    // First 6 vertices are interior; next 3 are bezier2.
    for (let i = 0; i < 6; i++) {
      expect(readKind(bufs.vertices, i)).toBe(VERTEX_KIND_INTERIOR);
    }
    for (let i = 6; i < 9; i++) {
      expect(readKind(bufs.vertices, i)).toBe(VERTEX_KIND_BEZIER2);
    }
    expect(bufs.curveBulgeOutward.length).toBe(1);
  });

  it("arc: vertices flagged as arc kind, klm on local unit circle", () => {
    const path = new Path([
      ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI),
      new LineSegment(new V2d(-1, 0), new V2d(1, 0)),
    ]);
    const r = tessellatePath([path]);
    const tri = triangulateFilledFaces(r.filledFaces, r.extraction, r.graph);
    const bufs = compileTessellation(tri);
    // Semicircle splits into 2 arc triangles → 6 arc vertices.
    expect(bufs.curveRange.indexCount).toBe(6);
    // Read curve vertex 0's klm (after interior block).
    const interiorVertCount = bufs.interiorRange.indexCount;
    for (let i = 0; i < 6; i++) {
      const idx = interiorVertCount + i;
      expect(readKind(bufs.vertices, idx)).toBe(VERTEX_KIND_ARC);
    }
    // Endpoints (vertex 0 and 2 of each arc triangle) lie on the unit
    // circle in local coords (k² + l² = 1).
    for (let t = 0; t < 2; t++) {
      const v0 = interiorVertCount + t * 3;
      const v2 = interiorVertCount + t * 3 + 2;
      const k0 = bufs.vertices[v0 * 6 + 2]!, l0 = bufs.vertices[v0 * 6 + 3]!;
      const k2 = bufs.vertices[v2 * 6 + 2]!, l2 = bufs.vertices[v2 * 6 + 3]!;
      expect(k0 * k0 + l0 * l0).toBeCloseTo(1, 6);
      expect(k2 * k2 + l2 * l2).toBeCloseTo(1, 6);
    }
  });

  it("vertex positions match the source triangulation", () => {
    const r = tessellatePath(ccwSquare());
    const tri = triangulateFilledFaces(r.filledFaces, r.extraction, r.graph);
    const bufs = compileTessellation(tri);
    // Reconstruct triangles from buffers; total area should equal 1.
    let area = 0;
    for (let t = 0; t < bufs.indices.length; t += 3) {
      const a = readPosition(bufs.vertices, bufs.indices[t]!);
      const b = readPosition(bufs.vertices, bufs.indices[t + 1]!);
      const c = readPosition(bufs.vertices, bufs.indices[t + 2]!);
      area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    }
    expect(area).toBeCloseTo(1, 9);
  });
});
