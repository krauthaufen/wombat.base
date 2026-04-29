import { describe, it, expect } from "vitest";
import { Plane3d } from "../../src/geometry/plane3d.js";
import { Ray3d } from "../../src/geometry/ray3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Plane3d", () => {
  it("fromPointAndNormal: distance to a point above", () => {
    const p = Plane3d.fromPointAndNormal(new V3d(0, 0, 0), new V3d(0, 1, 0));
    expect(p.distanceTo(new V3d(1, 5, 1))).toBeCloseTo(5, 12);
    expect(p.signedDistance(new V3d(1, 5, 1))).toBeCloseTo(5, 12);
    expect(p.signedDistance(new V3d(0, -3, 0))).toBeCloseTo(-3, 12);
  });

  it("ray-plane intersection at z=0", () => {
    const plane = Plane3d.fromPointAndNormal(new V3d(0, 0, 0), new V3d(0, 0, 1));
    const ray = new Ray3d(new V3d(0, 0, 5), new V3d(0, 0, -1));
    const hit = plane.intersection(ray);
    expect(hit).toBeDefined();
    expect(hit!.t).toBeCloseTo(5, 12);
    expect(hit!.point.approxEqual(new V3d(0, 0, 0), 1e-12)).toBe(true);
  });

  it("parallel ray misses", () => {
    const plane = Plane3d.fromPointAndNormal(new V3d(0, 0, 0), new V3d(0, 1, 0));
    const ray = new Ray3d(new V3d(0, 0, 5), new V3d(0, 0, -1));
    expect(plane.intersection(ray)).toBeUndefined();
  });

  it("closestPoint projects onto plane", () => {
    const plane = Plane3d.fromPointAndNormal(new V3d(0, 0, 0), new V3d(0, 1, 0));
    expect(plane.closestPoint(new V3d(2, 7, 3)).approxEqual(new V3d(2, 0, 3), 1e-12)).toBe(true);
  });

  it("flipped flips normal and distance", () => {
    const p = Plane3d.fromPointAndNormal(new V3d(0, 1, 0), new V3d(0, 1, 0));
    const f = p.flipped();
    expect(f.normal.approxEqual(new V3d(0, -1, 0), 1e-12)).toBe(true);
    expect(f.distance).toBeCloseTo(-1, 12);
  });

  it("two-plane intersection yields a ray", () => {
    const xy = Plane3d.fromPointAndNormal(new V3d(0, 0, 0), new V3d(0, 0, 1));
    const yz = Plane3d.fromPointAndNormal(new V3d(0, 0, 0), new V3d(1, 0, 0));
    const r = xy.intersection(yz);
    expect(r).toBeDefined();
    // line should be the y-axis
    expect(Math.abs(r!.direction.normalize().dot(new V3d(0, 1, 0)))).toBeCloseTo(1, 12);
  });
});
