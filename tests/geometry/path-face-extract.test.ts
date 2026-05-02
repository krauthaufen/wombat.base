import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  LineSegment, ArcSegment,
  buildPlanarGraph, extractFaces,
} from "../../src/geometry/path/index.js";

describe("extractFaces — basics", () => {
  it("CCW square: 2 faces (interior + outer), interior area = 1", () => {
    const segs = [
      new LineSegment(new V2d(0, 0), new V2d(1, 0)),
      new LineSegment(new V2d(1, 0), new V2d(1, 1)),
      new LineSegment(new V2d(1, 1), new V2d(0, 1)),
      new LineSegment(new V2d(0, 1), new V2d(0, 0)),
    ];
    const g = buildPlanarGraph(segs);
    const r = extractFaces(g);
    expect(r.faces.length).toBe(2);
    // One face has area +1 (CCW interior), one has area -1 (outer).
    const sorted = r.faces.map(f => f.signedArea).slice().sort((a, b) => a - b);
    expect(sorted[0]).toBeCloseTo(-1, 9);
    expect(sorted[1]).toBeCloseTo(1, 9);
    expect(r.outerFaceIndex).toBeGreaterThanOrEqual(0);
    expect(r.faces[r.outerFaceIndex]!.signedArea).toBeCloseTo(-1, 9);
  });

  it("CW square: outer is the one with positive sub-graph + flipped winding", () => {
    // A clockwise-traversed square has its "interior" face traced
    // clockwise (negative area). The "outer" face is then traced CCW
    // (positive area) — but it's still unbounded and gets flagged
    // because it's the LARGER (positive) of the two when the input
    // is CW. We don't make claims about CW orientation here; just
    // that face extraction produces 2 faces.
    const segs = [
      new LineSegment(new V2d(0, 0), new V2d(0, 1)),
      new LineSegment(new V2d(0, 1), new V2d(1, 1)),
      new LineSegment(new V2d(1, 1), new V2d(1, 0)),
      new LineSegment(new V2d(1, 0), new V2d(0, 0)),
    ];
    const r = extractFaces(buildPlanarGraph(segs));
    expect(r.faces.length).toBe(2);
  });

  it("two crossing lines (X-shape, no closed boundary): 1 face", () => {
    // No closed cycles in the graph — every walk goes "out and back"
    // along the four arms of the X. There's exactly one face: the
    // unbounded plane minus the cross. Each half-edge is visited once.
    const segs = [
      new LineSegment(new V2d(0, 0), new V2d(2, 2)),
      new LineSegment(new V2d(0, 2), new V2d(2, 0)),
    ];
    const r = extractFaces(buildPlanarGraph(segs));
    expect(r.faces.length).toBe(1);
    // Single face → signed area is 0 (degenerate).
    expect(Math.abs(r.faces[0]!.signedArea)).toBeLessThan(1e-9);
  });

  it("two non-overlapping squares: 4 faces (two interiors + two outer-like)", () => {
    // Disconnected components produce separate "outer" cycles in
    // the DCEL — the standard half-edge graph doesn't auto-merge
    // disjoint unbounded regions. Stage 3b's winding-rule filter
    // gives both outer-like faces winding 0 → unfilled, so the
    // multiplicity is harmless for fill resolution.
    const sqA = [
      new LineSegment(new V2d(0, 0), new V2d(1, 0)),
      new LineSegment(new V2d(1, 0), new V2d(1, 1)),
      new LineSegment(new V2d(1, 1), new V2d(0, 1)),
      new LineSegment(new V2d(0, 1), new V2d(0, 0)),
    ];
    const sqB = [
      new LineSegment(new V2d(5, 0), new V2d(6, 0)),
      new LineSegment(new V2d(6, 0), new V2d(6, 1)),
      new LineSegment(new V2d(6, 1), new V2d(5, 1)),
      new LineSegment(new V2d(5, 1), new V2d(5, 0)),
    ];
    const r = extractFaces(buildPlanarGraph([...sqA, ...sqB]));
    expect(r.faces.length).toBe(4);
    // Each square contributes one +1 interior and one -1 outer.
    const sorted = r.faces.map(f => f.signedArea).slice().sort((a, b) => a - b);
    expect(sorted[0]).toBeCloseTo(-1, 9);
    expect(sorted[1]).toBeCloseTo(-1, 9);
    expect(sorted[2]).toBeCloseTo(1, 9);
    expect(sorted[3]).toBeCloseTo(1, 9);
  });

  it("'+' overlap of two rectangles: 5 faces (centre + 4 arms + 1 outer)", () => {
    // A: x∈[0,4], y∈[1,3]; B: x∈[1,3], y∈[0,4]. Their union is a
    // plus-shape with one bounded centre region, four bounded "arm"
    // regions, and one unbounded outer face. Total: 6 faces.
    const sqA = [
      new LineSegment(new V2d(0, 1), new V2d(4, 1)),
      new LineSegment(new V2d(4, 1), new V2d(4, 3)),
      new LineSegment(new V2d(4, 3), new V2d(0, 3)),
      new LineSegment(new V2d(0, 3), new V2d(0, 1)),
    ];
    const sqB = [
      new LineSegment(new V2d(1, 0), new V2d(3, 0)),
      new LineSegment(new V2d(3, 0), new V2d(3, 4)),
      new LineSegment(new V2d(3, 4), new V2d(1, 4)),
      new LineSegment(new V2d(1, 4), new V2d(1, 0)),
    ];
    const r = extractFaces(buildPlanarGraph([...sqA, ...sqB]));
    // Centre rectangle is x∈[1,3], y∈[1,3] → area 4.
    // Four arms each have area 2 (e.g. left arm: [0,1] × [1,3] = 2).
    // Outer face has area = -(4 + 4·2) = -12.
    const areas = r.faces.map(f => f.signedArea).slice().sort((a, b) => a - b);
    expect(r.faces.length).toBe(6);
    expect(areas[0]).toBeCloseTo(-12, 8);
    // Four arms (area 2) + one centre (area 4)
    expect(areas[1]).toBeCloseTo(2, 8);
    expect(areas[2]).toBeCloseTo(2, 8);
    expect(areas[3]).toBeCloseTo(2, 8);
    expect(areas[4]).toBeCloseTo(2, 8);
    expect(areas[5]).toBeCloseTo(4, 8);
  });

  it("circle + diameter chord: 3 faces (two half-discs + outer)", () => {
    const arc = ArcSegment.circular(new V2d(0, 0), 1, 0, 2 * Math.PI);
    const chord = new LineSegment(new V2d(-1, 0), new V2d(1, 0));
    const r = extractFaces(buildPlanarGraph([arc, chord]));
    expect(r.faces.length).toBe(3);
    // Two interior half-discs of area π/2 each; outer = -π.
    const areas = r.faces.map(f => f.signedArea).slice().sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(-Math.PI, 6);
    expect(areas[1]).toBeCloseTo(Math.PI / 2, 6);
    expect(areas[2]).toBeCloseTo(Math.PI / 2, 6);
  });

  it("each face's half-edges form a closed cycle", () => {
    const segs = [
      new LineSegment(new V2d(0, 0), new V2d(1, 0)),
      new LineSegment(new V2d(1, 0), new V2d(1, 1)),
      new LineSegment(new V2d(1, 1), new V2d(0, 1)),
      new LineSegment(new V2d(0, 1), new V2d(0, 0)),
    ];
    const r = extractFaces(buildPlanarGraph(segs));
    for (const f of r.faces) {
      // Walk next pointers; must return to start within the cycle length.
      let h = f.halfEdges[0]!;
      for (let i = 1; i < f.halfEdges.length; i++) {
        h = r.halfEdges[h]!.next;
        expect(h).toBe(f.halfEdges[i]);
      }
      // Final next returns to start.
      expect(r.halfEdges[h]!.next).toBe(f.halfEdges[0]);
    }
  });
});
