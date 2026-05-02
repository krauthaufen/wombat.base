import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  LineSegment, Bezier2Segment, ArcSegment,
} from "../../src/geometry/path/index.js";
import { intersections } from "../../src/geometry/path/intersect.js";

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

describe("intersections — dispatcher scaffold", () => {
  it("throws for not-yet-implemented pairs", () => {
    const a = new LineSegment(new V2d(0, 0), new V2d(1, 0));
    const b = new Bezier2Segment(new V2d(0, 0), new V2d(0.5, 1), new V2d(1, 0));
    expect(() => intersections(a, b)).toThrow(/not yet implemented/);
  });

  it("throws for arc cases too (placeholder)", () => {
    const a = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI);
    const b = new LineSegment(new V2d(-2, 0), new V2d(2, 0));
    expect(() => intersections(a, b)).toThrow(/not yet implemented/);
  });
});
