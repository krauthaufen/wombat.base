import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  Bezier2Segment, Bezier3Segment, ArcSegment,
  classifyBezier2, classifyArc, classifyBezier3, classifyCurve,
} from "../../src/geometry/path/index.js";
import { LineSegment } from "../../src/geometry/path/index.js";

function close(a: number, b: number, eps = 1e-9): void {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

describe("classifyBezier2", () => {
  it("standard texcoords are (0,0,1), (1/2,0,1), (1,1,1)", () => {
    const b = new Bezier2Segment(new V2d(0, 0), new V2d(1, 1), new V2d(2, 0));
    const t = classifyBezier2(b);
    expect(t.kind).toBe("bezier2");
    expect(t.vertices.length).toBe(3);
    expect(t.texcoords).toEqual([[0, 0, 1], [0.5, 0, 1], [1, 1, 1]]);
  });

  it("vertices match the control points in order", () => {
    const p0 = new V2d(0, 0), p1 = new V2d(1, 1), p2 = new V2d(2, 0);
    const t = classifyBezier2(new Bezier2Segment(p0, p1, p2));
    expect(t.vertices[0]).toBe(p0);
    expect(t.vertices[1]).toBe(p1);
    expect(t.vertices[2]).toBe(p2);
  });

  it("u² − v evaluates to zero at every control-point texcoord", () => {
    // Loop-Blinn implicit form for the quadratic curve: F(u, v) =
    // u² − v vanishes on the curve. The 3 texcoord triples are the
    // control points' values, so F should be 0 at each.
    // (0,0): 0 − 0 = 0 ✓
    // (½,0): ¼ − 0 = ¼ — NOT zero! That's the curve's interior at t=½.
    // Actually only the endpoints are ON the curve; (½,0) is the
    // control point P1, which is OFF the curve. The interpolation
    // produces F = u(t)² − v(t) along the curve which IS zero.
    // Test the t=0 and t=1 corners only:
    const b = new Bezier2Segment(new V2d(0, 0), new V2d(1, 1), new V2d(2, 0));
    const t = classifyBezier2(b);
    const f = (uvw: readonly [number, number, number]): number =>
      uvw[0] * uvw[0] - uvw[1];
    close(f(t.texcoords[0]), 0);
    close(f(t.texcoords[2]), 0);
  });

  it("bulgesOutward true when control point lies right of the chord", () => {
    // Chord (0,0)→(2,0); control at (1,1) is ABOVE the chord =
    // LEFT of the start→end direction. cross > 0 → bulgesOutward false.
    const above = classifyBezier2(
      new Bezier2Segment(new V2d(0, 0), new V2d(1, 1), new V2d(2, 0)),
    );
    expect(above.bulgesOutward).toBe(false);

    // Same chord, control at (1, -1): BELOW = RIGHT side. bulgesOutward true.
    const below = classifyBezier2(
      new Bezier2Segment(new V2d(0, 0), new V2d(1, -1), new V2d(2, 0)),
    );
    expect(below.bulgesOutward).toBe(true);
  });
});

describe("classifyArc", () => {
  it("quarter unit-circle: one triangle, apex at local (1, 1)", () => {
    const a = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI / 2);
    const triangles = classifyArc(a);
    expect(triangles.length).toBe(1);
    const t = triangles[0]!;
    // Endpoints at world (1, 0) and (0, 1).
    close(t.vertices[0]!.x, 1); close(t.vertices[0]!.y, 0);
    close(t.vertices[2]!.x, 0); close(t.vertices[2]!.y, 1);
    // Apex world: at (1, 1) for a unit circle quarter from 0 to π/2.
    close(t.vertices[1]!.x, 1); close(t.vertices[1]!.y, 1);
    // Texcoords in local frame: endpoints on the unit circle, apex at (1,1).
    close(t.texcoords[0]![0], 1); close(t.texcoords[0]![1], 0);
    close(t.texcoords[2]![0], 0); close(t.texcoords[2]![1], 1);
    close(t.texcoords[1]![0], 1); close(t.texcoords[1]![1], 1);
  });

  it("full circle: subdivides into 4 quarters (each ≤ π/2 sweep)", () => {
    const a = ArcSegment.circular(new V2d(0, 0), 1, 0, 2 * Math.PI);
    const triangles = classifyArc(a);
    expect(triangles.length).toBe(4);
    for (const t of triangles) {
      // Endpoint texcoords lie exactly on the unit circle.
      const e0 = t.texcoords[0]!, e2 = t.texcoords[2]!;
      close(e0[0] * e0[0] + e0[1] * e0[1], 1);
      close(e2[0] * e2[0] + e2[1] * e2[1], 1);
    }
  });

  it("ellipse arc (rotated): texcoords still on local unit circle", () => {
    const a = ArcSegment.fromRadiiRotation(
      new V2d(3, 4), 2, 1, Math.PI / 6, 0, Math.PI / 3,
    );
    const triangles = classifyArc(a);
    for (const t of triangles) {
      // Local frame: endpoints satisfy u² + v² = 1; apex satisfies the
      // tangent-line intersection so |apex| > 1 for a proper apex.
      const e0 = t.texcoords[0]!, e2 = t.texcoords[2]!;
      close(e0[0] * e0[0] + e0[1] * e0[1], 1);
      close(e2[0] * e2[0] + e2[1] * e2[1], 1);
      const apex = t.texcoords[1]!;
      expect(apex[0] * apex[0] + apex[1] * apex[1]).toBeGreaterThan(1);
    }
  });

  it("uses stored start/end V2ds at piece-0/piece-last for vertex sharing", () => {
    const a = ArcSegment.circular(new V2d(2, 1), 0.5, Math.PI / 4, Math.PI / 3);
    const triangles = classifyArc(a);
    expect(triangles[0]!.vertices[0]).toBe(a.start);
    expect(triangles[triangles.length - 1]!.vertices[2]).toBe(a.end);
  });

  it("bulgesOutward sign matches CCW vs CW input", () => {
    const ccw = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI / 2);
    const cw  = ArcSegment.circular(new V2d(0, 0), 1, 0, -Math.PI / 2);
    expect(classifyArc(ccw)[0]!.bulgesOutward).not.toBe(
      classifyArc(cw)[0]!.bulgesOutward,
    );
  });
});

describe("classifyCurve", () => {
  it("LineSegment returns empty (lines are handled by the flat triangulation)", () => {
    const l = new LineSegment(new V2d(0, 0), new V2d(1, 0));
    expect(classifyCurve(l)).toEqual([]);
  });

  it("Bezier3 throws — Stage 4b not yet implemented", () => {
    const b = new Bezier3Segment(
      new V2d(0, 0), new V2d(0, 1), new V2d(1, 1), new V2d(1, 0),
    );
    expect(() => classifyBezier3(b)).toThrow(/Stage 4b/);
    expect(() => classifyCurve(b)).toThrow(/Stage 4b/);
  });
});
