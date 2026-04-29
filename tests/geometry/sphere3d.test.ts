import { describe, it, expect } from "vitest";
import { Sphere3d } from "../../src/geometry/sphere3d.js";
import { Box3d } from "../../src/box/box3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Sphere3d", () => {
  it("contains and distance", () => {
    const s = new Sphere3d(V3d.zero, 2);
    expect(s.contains(new V3d(1, 0, 0))).toBe(true);
    expect(s.contains(new V3d(3, 0, 0))).toBe(false);
    expect(s.distance(new V3d(5, 0, 0))).toBeCloseTo(3, 12);
  });

  it("sphere-box intersects: sphere inside box", () => {
    const s = new Sphere3d(new V3d(5, 5, 5), 1);
    const box = Box3d.fromMinMax(V3d.zero, new V3d(10, 10, 10));
    expect(s.intersects(box)).toBe(true);
  });

  it("sphere-box: far outside", () => {
    const s = new Sphere3d(new V3d(50, 50, 50), 1);
    const box = Box3d.fromMinMax(V3d.zero, new V3d(10, 10, 10));
    expect(s.intersects(box)).toBe(false);
  });

  it("fromPoints encloses all points", () => {
    const pts = [new V3d(1, 0, 0), new V3d(-1, 0, 0), new V3d(0, 2, 0), new V3d(0, 0, 3)];
    const s = Sphere3d.fromPoints(pts);
    for (const p of pts) {
      expect(p.distanceSquared(s.center)).toBeLessThanOrEqual(s.radius * s.radius + 1e-9);
    }
  });
});
