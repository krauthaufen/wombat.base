import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  LineSegment, Bezier2Segment, Bezier3Segment, ArcSegment,
  buildPlanarGraph,
} from "../../src/geometry/path/index.js";

describe("buildPlanarGraph — basics", () => {
  it("simple closed square: 4 vertices, 4 edges", () => {
    const segs = [
      new LineSegment(new V2d(0, 0), new V2d(1, 0)),
      new LineSegment(new V2d(1, 0), new V2d(1, 1)),
      new LineSegment(new V2d(1, 1), new V2d(0, 1)),
      new LineSegment(new V2d(0, 1), new V2d(0, 0)),
    ];
    const g = buildPlanarGraph(segs);
    expect(g.vertices.length).toBe(4);
    expect(g.edges.length).toBe(4);
    // Each vertex has exactly 2 incident edges (one in, one out).
    for (const inc of g.incident) expect(inc.length).toBe(2);
  });

  it("two crossing lines: 5 vertices (4 ends + 1 cross), 4 split edges", () => {
    const segs = [
      new LineSegment(new V2d(0, 0), new V2d(2, 2)),
      new LineSegment(new V2d(0, 2), new V2d(2, 0)),
    ];
    const g = buildPlanarGraph(segs);
    expect(g.vertices.length).toBe(5);
    expect(g.edges.length).toBe(4);
    // The crossing vertex (1, 1) should have 4 incident edges.
    let crossingVertex = -1;
    for (let i = 0; i < g.vertices.length; i++) {
      if (g.vertices[i]!.distance(new V2d(1, 1)) < 1e-9) { crossingVertex = i; break; }
    }
    expect(crossingVertex).toBeGreaterThanOrEqual(0);
    expect(g.incident[crossingVertex]!.length).toBe(4);
  });

  it("non-crossing closed paths: graphs are disjoint, total vertex count adds", () => {
    const sqA = [
      new LineSegment(new V2d(0, 0), new V2d(1, 0)),
      new LineSegment(new V2d(1, 0), new V2d(1, 1)),
      new LineSegment(new V2d(1, 1), new V2d(0, 1)),
      new LineSegment(new V2d(0, 1), new V2d(0, 0)),
    ];
    const sqB = [
      new LineSegment(new V2d(5, 5), new V2d(6, 5)),
      new LineSegment(new V2d(6, 5), new V2d(6, 6)),
      new LineSegment(new V2d(6, 6), new V2d(5, 6)),
      new LineSegment(new V2d(5, 6), new V2d(5, 5)),
    ];
    const g = buildPlanarGraph([...sqA, ...sqB]);
    expect(g.vertices.length).toBe(8);
    expect(g.edges.length).toBe(8);
  });

  it("two overlapping rectangles forming a '+': 8 corners + 4 crossings", () => {
    // A: x∈[0,4], y∈[1,3] (wide). B: x∈[1,3], y∈[0,4] (tall).
    // Only A's horizontal edges cross B's vertical edges and vice
    // versa, giving 4 crossings at the inner corners of the plus.
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
    const g = buildPlanarGraph([...sqA, ...sqB]);
    // 8 corners + 4 crossings = 12 vertices.
    expect(g.vertices.length).toBe(12);
    // A: top and bottom each split into 3 by 2 crossings; sides
    // unchanged. 3+3+1+1 = 8. Same for B → 16 edges total.
    expect(g.edges.length).toBe(16);
    let fourway = 0, twoway = 0;
    for (const inc of g.incident) {
      if (inc.length === 4) fourway += 1;
      else if (inc.length === 2) twoway += 1;
    }
    expect(fourway).toBe(4);
    expect(twoway).toBe(8);
  });
});

describe("buildPlanarGraph — curves", () => {
  it("circle crossed by a diameter: 2 endpoint coincidences become 2 graph vertices", () => {
    // Full circle as one arc, with a chord through the diameter.
    const arc = ArcSegment.circular(new V2d(0, 0), 1, 0, 2 * Math.PI);
    const chord = new LineSegment(new V2d(-1, 0), new V2d(1, 0));
    const g = buildPlanarGraph([arc, chord]);
    // The arc starts and ends at (1, 0); the chord starts at (-1, 0)
    // and ends at (1, 0). Both share the (1, 0) point. The chord
    // also touches the circle at (-1, 0). Net: vertex set = {(1, 0),
    // (-1, 0)} → 2 vertices.
    expect(g.vertices.length).toBe(2);
    // Edges: the arc gets split at (-1, 0) into two halves; the chord
    // is one segment between the two vertices.
    expect(g.edges.length).toBe(3);
  });

  it("Bezier-arc closed shape: graph is well-formed", () => {
    const arc = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI);
    const cubic = new Bezier3Segment(
      new V2d(-1, 0), new V2d(-0.5, -1), new V2d(0.5, -1), new V2d(1, 0),
    );
    const g = buildPlanarGraph([arc, cubic]);
    // No interior intersections; just the two shared endpoints.
    expect(g.vertices.length).toBe(2);
    expect(g.edges.length).toBe(2);
  });

  it("each edge's segment endpoints match its vertex positions within eps", () => {
    // Chain a few primitives together (not necessarily closed) to
    // sanity-check the dedup invariant: regardless of which solver
    // produced the V2d, the cache resolves it to a unique vertex
    // and the edge's stored segment.start/end agrees within eps.
    const segs = [
      new LineSegment(new V2d(0, 0), new V2d(1, 0)),
      new Bezier2Segment(new V2d(1, 0), new V2d(1, 1), new V2d(0, 1)),
      new Bezier3Segment(
        new V2d(0, 1), new V2d(-0.5, 1), new V2d(-1, 0.5), new V2d(-1, 0),
      ),
      ArcSegment.circular(new V2d(0, 0), 1, Math.PI, Math.PI / 2),
    ];
    // Last arc ends at (0, -1), so the chain isn't closed. Just
    // check the invariant; the graph need not be a single cycle.
    const g = buildPlanarGraph(segs);
    for (const e of g.edges) {
      const vs = g.vertices[e.start]!;
      const ve = g.vertices[e.end]!;
      expect(e.segment.start.distance(vs)).toBeLessThan(1e-7);
      expect(e.segment.end.distance(ve)).toBeLessThan(1e-7);
    }
  });
});
