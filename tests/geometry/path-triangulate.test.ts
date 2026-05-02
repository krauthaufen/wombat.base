import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  LineSegment, Bezier2Segment, ArcSegment, Path,
  buildPlanarGraph, extractFaces, tessellatePath,
  earClip, triangulateFace, triangulateFilledFaces,
} from "../../src/geometry/path/index.js";

function ccwSquare(x: number, y: number, w: number, h: number): LineSegment[] {
  return [
    new LineSegment(new V2d(x, y), new V2d(x + w, y)),
    new LineSegment(new V2d(x + w, y), new V2d(x + w, y + h)),
    new LineSegment(new V2d(x + w, y + h), new V2d(x, y + h)),
    new LineSegment(new V2d(x, y + h), new V2d(x, y)),
  ];
}

function triArea(a: V2d, b: V2d, c: V2d): number {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}

describe("earClip", () => {
  it("triangle: 1 triangle output", () => {
    const tri = [new V2d(0, 0), new V2d(1, 0), new V2d(0, 1)];
    expect(earClip(tri).length).toBe(1);
  });

  it("CCW square: 2 triangles, total area = 1", () => {
    const sq = [
      new V2d(0, 0), new V2d(1, 0), new V2d(1, 1), new V2d(0, 1),
    ];
    const tris = earClip(sq);
    expect(tris.length).toBe(2);
    let total = 0;
    for (const [a, b, c] of tris) total += triArea(sq[a]!, sq[b]!, sq[c]!);
    expect(total).toBeCloseTo(1, 12);
  });

  it("CCW pentagon: 3 triangles, area sums correctly", () => {
    // Regular pentagon, radius 1.
    const pts: V2d[] = [];
    for (let i = 0; i < 5; i++) {
      const t = i * 2 * Math.PI / 5 - Math.PI / 2;
      pts.push(new V2d(Math.cos(t), Math.sin(t)));
    }
    const tris = earClip(pts);
    expect(tris.length).toBe(3);
    const sum = tris.reduce((s, [a, b, c]) => s + triArea(pts[a]!, pts[b]!, pts[c]!), 0);
    // Regular pentagon of circumradius 1 has area (5/2)·sin(2π/5).
    const expected = (5 / 2) * Math.sin(2 * Math.PI / 5);
    expect(sum).toBeCloseTo(expected, 8);
  });

  it("CCW concave L-shape: triangles cover the interior (area sums to polygon area)", () => {
    // L-shape (CCW): 6 vertices, polygon area = 3.
    const L = [
      new V2d(0, 0), new V2d(2, 0), new V2d(2, 1),
      new V2d(1, 1), new V2d(1, 2), new V2d(0, 2),
    ];
    const tris = earClip(L);
    expect(tris.length).toBeGreaterThanOrEqual(3);
    let total = 0;
    for (const [a, b, c] of tris) total += triArea(L[a]!, L[b]!, L[c]!);
    expect(total).toBeCloseTo(3, 8);
  });

  it("degenerate / fewer than 3 vertices: returns empty", () => {
    expect(earClip([])).toEqual([]);
    expect(earClip([new V2d(0, 0)])).toEqual([]);
    expect(earClip([new V2d(0, 0), new V2d(1, 0)])).toEqual([]);
  });
});

describe("triangulateFace", () => {
  it("CCW square face: 2 interior flat triangles, no curves", () => {
    const g = buildPlanarGraph(ccwSquare(0, 0, 1, 1));
    const ext = extractFaces(g);
    // Find the bounded face (positive signed area).
    const f = ext.faces.find(x => x.signedArea > 0)!;
    const tri = triangulateFace(f, ext, g);
    expect(tri.flat.length).toBe(2);
    expect(tri.curves.length).toBe(0);
  });

  it("Bezier2 boundary: emits one Loop-Blinn curve triangle per bez2 edge", () => {
    // Closed shape: 3 lines + 1 quadratic Bezier arc.
    const path = new Path([
      new LineSegment(new V2d(0, 0), new V2d(2, 0)),
      new Bezier2Segment(new V2d(2, 0), new V2d(2.5, 1), new V2d(2, 2)),
      new LineSegment(new V2d(2, 2), new V2d(0, 2)),
      new LineSegment(new V2d(0, 2), new V2d(0, 0)),
    ]);
    const r = tessellatePath([path]);
    const tri = triangulateFilledFaces(r.filledFaces, r.extraction, r.graph);
    // Polygon has 4 vertices → 2 flat triangles.
    expect(tri.flat.length).toBe(2);
    // One curved boundary segment → one curve triangle.
    expect(tri.curves.length).toBe(1);
    expect(tri.curves[0]!.kind).toBe("bezier2");
  });

  it("semicircle + chord: emits curve triangles for the arc + 1 flat triangle", () => {
    // Closable shape: half-disc traced as semicircle + diameter chord.
    // The semicircle contributes its Loop-Blinn boundary triangle(s);
    // the polygon (3 vertices: start, midpoint-of-arc-as-cap, end —
    // actually 2 vertices since arc start/end are the chord ends) has
    // a degenerate flat interior, so the face is covered entirely by
    // curve triangles + the chord-line edge.
    const path = new Path([
      ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI),
      new LineSegment(new V2d(-1, 0), new V2d(1, 0)),
    ]);
    const r = tessellatePath([path]);
    const tri = triangulateFilledFaces(r.filledFaces, r.extraction, r.graph);
    // Semicircle (sweep π) is split into 2 pieces of π/2 each.
    expect(tri.curves.length).toBe(2);
  });
});
