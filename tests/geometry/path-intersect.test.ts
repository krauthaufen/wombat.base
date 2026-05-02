import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  LineSegment, Bezier2Segment, Bezier3Segment, ArcSegment,
} from "../../src/geometry/path/index.js";
import { intersections } from "../../src/geometry/path/intersect.js";
import { intersectionsRef } from "./path-intersect-fuzz.js";

// Deterministic LCG for reproducible random fuzz inputs.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const EPS = 1e-8;

function close(a: number, b: number, eps = EPS): void {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

describe("intersections — line × line", () => {
  it("crossing X gives one interior hit at t=0.5 each", () => {
    const a = new LineSegment(new V2d(0, 0), new V2d(2, 2));
    const b = new LineSegment(new V2d(0, 2), new V2d(2, 0));
    const hits = intersections(a, b);
    expect(hits.length).toBe(1);
    close(hits[0]![0], 0.5);
    close(hits[0]![1], 0.5);
  });

  it("parallel lines: no intersection", () => {
    const a = new LineSegment(new V2d(0, 0), new V2d(1, 0));
    const b = new LineSegment(new V2d(0, 1), new V2d(1, 1));
    expect(intersections(a, b).length).toBe(0);
  });

  it("collinear segments: solver returns no hit (det=0)", () => {
    // Aardvark treats collinear-overlap as "no hit" from the analytic
    // solver — overlap is reported via endpoint coincidence only.
    const a = new LineSegment(new V2d(0, 0), new V2d(2, 0));
    const b = new LineSegment(new V2d(1, 0), new V2d(3, 0));
    expect(intersections(a, b).length).toBe(0);
  });

  it("touching at a single endpoint: reported via coincidence prefilter", () => {
    const a = new LineSegment(new V2d(0, 0), new V2d(1, 0));
    const b = new LineSegment(new V2d(1, 0), new V2d(2, 1));
    const hits = intersections(a, b);
    expect(hits.length).toBe(1);
    close(hits[0]![0], 1);
    close(hits[0]![1], 0);
  });

  it("disjoint lines that would cross if extended: no hit", () => {
    const a = new LineSegment(new V2d(0, 0), new V2d(1, 0));
    const b = new LineSegment(new V2d(2, -1), new V2d(2, 1));
    expect(intersections(a, b).length).toBe(0);
  });

  it("hit at the very edge of [0,1] within T_EPS slack still reported", () => {
    // b's endpoint sits 1e-9 past a's endpoint along the X axis —
    // the slack allows the clamp + position-check to accept it.
    const a = new LineSegment(new V2d(0, 0), new V2d(1, 0));
    const b = new LineSegment(new V2d(1 + 1e-9, -1), new V2d(1 + 1e-9, 1));
    const hits = intersections(a, b);
    expect(hits.length).toBe(1);
  });

  it("output is sorted by ta", () => {
    // Two-endpoint coincidence (a is a single segment whose start and
    // end both sit on b). Result should be [(0, t1), (1, t2)] or the
    // reverse depending on b's parametrisation — either way the first
    // entry's ta must be ≤ the second's.
    const a = new LineSegment(new V2d(0, 0), new V2d(1, 0));
    const b = new LineSegment(new V2d(1, 0), new V2d(0, 0));
    const hits = intersections(a, b);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]![0]).toBeGreaterThanOrEqual(hits[i - 1]![0]);
    }
  });
});

describe("intersections — arc × line", () => {
  it("horizontal diameter through unit circle: two hits at t=0 and t=1 of the arc", () => {
    // Full upper semicircle from (1,0) to (-1,0); horizontal line cuts both endpoints.
    const arc = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI);
    const line = new LineSegment(new V2d(-2, 0), new V2d(2, 0));
    const hits = intersections(arc, line);
    expect(hits.length).toBe(2);
  });

  it("chord through interior of arc: one interior hit", () => {
    // Quarter arc from (1,0) to (0,1); diagonal chord just below the
    // midpoint of the arc.
    const arc = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI / 2);
    const line = new LineSegment(new V2d(0, 0), new V2d(1, 1));
    const hits = intersections(arc, line);
    expect(hits.length).toBe(1);
    // Intersection at angle π/4: arc parameter t = (π/4) / (π/2) = 0.5.
    expect(hits[0]![0]).toBeCloseTo(0.5, 8);
  });

  it("tangent line: one (double) hit", () => {
    const arc = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI);
    // Line tangent to the top of the circle at (0, 1).
    const line = new LineSegment(new V2d(-1, 1), new V2d(1, 1));
    const hits = intersections(arc, line);
    expect(hits.length).toBe(1);
    // Arc midpoint is at angle π/2 → t = 0.5; line midpoint is also t = 0.5.
    expect(hits[0]![0]).toBeCloseTo(0.5, 8);
    expect(hits[0]![1]).toBeCloseTo(0.5, 8);
  });

  it("disjoint line: no hits", () => {
    const arc = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI / 2);
    const line = new LineSegment(new V2d(2, 2), new V2d(3, 3));
    expect(intersections(arc, line).length).toBe(0);
  });

  it("rotated ellipse + chord: matches subdivision reference", () => {
    const arc = ArcSegment.fromRadiiRotation(
      new V2d(0, 0), 2, 1, Math.PI / 6, -0.5, 2.5,
    );
    const line = new LineSegment(new V2d(-3, 0.3), new V2d(3, -0.7));
    const got = intersections(arc, line);
    const ref = intersectionsRef(arc, line);
    expect(got.length).toBe(ref.length);
    for (let i = 0; i < got.length; i++) {
      expect(got[i]![0]).toBeCloseTo(ref[i]![0], 6);
      expect(got[i]![1]).toBeCloseTo(ref[i]![1], 6);
    }
  });

  it("argument-flipped (line, arc) call returns swapped pairs", () => {
    const arc = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI / 2);
    const line = new LineSegment(new V2d(0, 0), new V2d(1, 1));
    const direct = intersections(arc, line);
    const flipped = intersections(line, arc);
    expect(flipped.length).toBe(direct.length);
    for (let i = 0; i < direct.length; i++) {
      expect(flipped[i]![0]).toBeCloseTo(direct[i]![1], 8);
      expect(flipped[i]![1]).toBeCloseTo(direct[i]![0], 8);
    }
  });
});

describe("intersections — bez2 × line", () => {
  it("symmetric arch crossed at the apex", () => {
    const bez = new Bezier2Segment(
      new V2d(0, 0), new V2d(1, 2), new V2d(2, 0),
    );
    // Apex of the parabola is at (1, 1); horizontal line y=1 should
    // touch tangentially → one (double) hit.
    const line = new LineSegment(new V2d(-1, 1), new V2d(3, 1));
    const hits = intersections(bez, line);
    expect(hits.length).toBe(1);
    expect(hits[0]![0]).toBeCloseTo(0.5, 8);
  });

  it("two transversal crossings", () => {
    const bez = new Bezier2Segment(
      new V2d(0, 0), new V2d(1, 2), new V2d(2, 0),
    );
    // Horizontal line y=0.5 cuts through the arch at two t-values.
    const line = new LineSegment(new V2d(-1, 0.5), new V2d(3, 0.5));
    const hits = intersections(bez, line);
    expect(hits.length).toBe(2);
  });

  it("disjoint", () => {
    const bez = new Bezier2Segment(new V2d(0, 0), new V2d(1, 1), new V2d(2, 0));
    const line = new LineSegment(new V2d(0, 5), new V2d(2, 5));
    expect(intersections(bez, line).length).toBe(0);
  });

  it("matches subdivision reference on random configs", () => {
    const rand = lcg(0xc01dface);
    let configs = 0, mismatches = 0;
    for (let i = 0; i < 200; i++) {
      const p0 = new V2d(rand() * 4 - 2, rand() * 4 - 2);
      const p1 = new V2d(rand() * 4 - 2, rand() * 4 - 2);
      const p2 = new V2d(rand() * 4 - 2, rand() * 4 - 2);
      const q0 = new V2d(rand() * 4 - 2, rand() * 4 - 2);
      const q1 = new V2d(rand() * 4 - 2, rand() * 4 - 2);
      const bez = new Bezier2Segment(p0, p1, p2);
      const line = new LineSegment(q0, q1);
      const got = intersections(bez, line, 1e-8);
      const ref = intersectionsRef(bez, line, 1e-12);
      configs += 1;
      if (got.length !== ref.length) { mismatches += 1; continue; }
      for (let j = 0; j < got.length; j++) {
        if (Math.abs(got[j]![0] - ref[j]![0]) > 1e-5
         || Math.abs(got[j]![1] - ref[j]![1]) > 1e-5) {
          mismatches += 1;
          break;
        }
      }
    }
    expect(mismatches).toBe(0);
    expect(configs).toBe(200);
  });
});

describe("intersections — bez3 × line", () => {
  it("S-curve crosses horizontal axis three times", () => {
    // Cubic with two turning points straddling y=0.
    const bez = new Bezier3Segment(
      new V2d(0, -1), new V2d(0, 2), new V2d(2, -2), new V2d(2, 1),
    );
    const line = new LineSegment(new V2d(-1, 0), new V2d(3, 0));
    const hits = intersections(bez, line);
    expect(hits.length).toBe(3);
  });

  it("disjoint", () => {
    const bez = new Bezier3Segment(
      new V2d(0, 0), new V2d(0, 1), new V2d(1, 1), new V2d(1, 0),
    );
    const line = new LineSegment(new V2d(0, 5), new V2d(1, 5));
    expect(intersections(bez, line).length).toBe(0);
  });

  it("matches subdivision reference on random configs", () => {
    const rand = lcg(0xfeedbeef);
    let mismatches = 0;
    for (let i = 0; i < 200; i++) {
      const p = (): V2d => new V2d(rand() * 4 - 2, rand() * 4 - 2);
      const bez = new Bezier3Segment(p(), p(), p(), p());
      const line = new LineSegment(p(), p());
      const got = intersections(bez, line, 1e-8);
      const ref = intersectionsRef(bez, line, 1e-12);
      if (got.length !== ref.length) { mismatches += 1; continue; }
      for (let j = 0; j < got.length; j++) {
        if (Math.abs(got[j]![0] - ref[j]![0]) > 1e-4
         || Math.abs(got[j]![1] - ref[j]![1]) > 1e-4) {
          mismatches += 1;
          break;
        }
      }
    }
    expect(mismatches).toBe(0);
  });
});
