// Smoke tests for the lower-traffic geometry primitives.
import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import { V3d } from "../../src/vector/v3d.js";
import { Ray2d } from "../../src/geometry/ray2d.js";
import { Line2d } from "../../src/geometry/line2d.js";
import { Line3d } from "../../src/geometry/line3d.js";
import { Triangle2d } from "../../src/geometry/triangle2d.js";
import { Circle2d } from "../../src/geometry/circle2d.js";
import { Circle3d } from "../../src/geometry/circle3d.js";
import { Quad2d } from "../../src/geometry/quad2d.js";
import { Quad3d } from "../../src/geometry/quad3d.js";
import { Polygon3d } from "../../src/geometry/polygon3d.js";

describe("geometry smoke", () => {
  it("Ray2d–Ray2d intersection at the unit corner", () => {
    const r1 = new Ray2d(new V2d(0, 0), new V2d(1, 0));
    const r2 = new Ray2d(new V2d(1, -1), new V2d(0, 1));
    const t = r1.intersection(r2);
    expect(t).toBeCloseTo(1, 12);
    expect(r1.pointAt(t!).approxEqual(new V2d(1, 0), 1e-12)).toBe(true);
  });

  it("Line2d signedDistance on the directed line", () => {
    const l = new Line2d(new V2d(0, 0), new V2d(1, 0));
    expect(l.signedDistance(new V2d(0.5, 1))).toBeCloseTo(1, 12);
    expect(l.signedDistance(new V2d(0.5, -1))).toBeCloseTo(-1, 12);
  });

  it("Line3d closestPointToSegment clamps", () => {
    const l = new Line3d(new V3d(0, 0, 0), new V3d(1, 0, 0));
    expect(l.closestPointToSegment(new V3d(2, 1, 0)).approxEqual(new V3d(1, 0, 0), 1e-12)).toBe(true);
    expect(l.closestPointToSegment(new V3d(-2, 1, 0)).approxEqual(new V3d(0, 0, 0), 1e-12)).toBe(true);
    expect(l.closestPointToLine(new V3d(2, 1, 0)).approxEqual(new V3d(2, 0, 0), 1e-12)).toBe(true);
  });

  it("Triangle2d barycentric & contains", () => {
    const t = new Triangle2d(new V2d(0, 0), new V2d(1, 0), new V2d(0, 1));
    const b = t.barycentric(new V2d(0.25, 0.25));
    expect(b.x + b.y + b.z).toBeCloseTo(1, 12);
    expect(t.contains(new V2d(0.25, 0.25))).toBe(true);
    expect(t.contains(new V2d(2, 2))).toBe(false);
  });

  it("Circle2d & Circle3d basics", () => {
    const c2 = new Circle2d(new V2d(0, 0), 2);
    expect(c2.area()).toBeCloseTo(Math.PI * 4, 12);
    expect(c2.contains(new V2d(1, 0))).toBe(true);
    expect(c2.closestPoint(new V2d(4, 0)).approxEqual(new V2d(2, 0), 1e-12)).toBe(true);

    const c3 = new Circle3d(V3d.zero, 1, new V3d(0, 0, 1));
    // (2, 0, 5): in-plane offset (2,0,0) -> clamp to (1,0,0); plane z=0
    expect(c3.closestPoint(new V3d(2, 0, 5)).approxEqual(new V3d(1, 0, 0), 1e-12)).toBe(true);
  });

  it("Quad2d / Quad3d triangulate + area", () => {
    const q2 = new Quad2d(new V2d(0, 0), new V2d(1, 0), new V2d(1, 1), new V2d(0, 1));
    expect(q2.area()).toBeCloseTo(1, 12);
    expect(q2.triangulate().length).toBe(2);

    const q3 = new Quad3d(new V3d(0, 0, 0), new V3d(2, 0, 0), new V3d(2, 3, 0), new V3d(0, 3, 0));
    expect(q3.area()).toBeCloseTo(6, 12);
  });

  it("Polygon3d area for a planar square", () => {
    const poly = new Polygon3d([
      new V3d(0, 0, 0), new V3d(2, 0, 0), new V3d(2, 2, 0), new V3d(0, 2, 0),
    ]);
    expect(poly.area()).toBeCloseTo(4, 12);
    expect(poly.centroid().approxEqual(new V3d(1, 1, 0), 1e-12)).toBe(true);
  });
});
