import { describe, it, expect } from "vitest";
import { Ray3d } from "../../src/geometry/ray3d.js";
import { Triangle3d } from "../../src/geometry/triangle3d.js";
import { Sphere3d } from "../../src/geometry/sphere3d.js";
import { Box3d } from "../../src/box/box3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Ray3d", () => {
  it("Möller–Trumbore hits a known triangle at known barycentric", () => {
    const tri = new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(0, 1, 0));
    const ray = new Ray3d(new V3d(0.25, 0.25, 1), new V3d(0, 0, -1));
    const hit = ray.intersection(tri);
    expect(hit).toBeDefined();
    expect(hit!.t).toBeCloseTo(1, 12);
    expect(hit!.u).toBeCloseTo(0.25, 12);
    expect(hit!.v).toBeCloseTo(0.25, 12);
    expect(hit!.point.approxEqual(new V3d(0.25, 0.25, 0), 1e-12)).toBe(true);
  });

  it("misses triangle when outside", () => {
    const tri = new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(0, 1, 0));
    const ray = new Ray3d(new V3d(2, 2, 1), new V3d(0, 0, -1));
    expect(ray.intersection(tri)).toBeUndefined();
  });

  it("sphere intersection: tMin/tMax", () => {
    const s = new Sphere3d(V3d.zero, 1);
    const ray = new Ray3d(new V3d(0, 0, -5), new V3d(0, 0, 1));
    const hit = ray.intersection(s);
    expect(hit).toBeDefined();
    expect(hit!.tMin).toBeCloseTo(4, 12);
    expect(hit!.tMax).toBeCloseTo(6, 12);
  });

  it("box slab method: through a unit cube along +X", () => {
    const box = Box3d.fromMinMax(new V3d(0, 0, 0), new V3d(1, 1, 1));
    const ray = new Ray3d(new V3d(-2, 0.5, 0.5), new V3d(1, 0, 0));
    const hit = ray.intersection(box);
    expect(hit).toBeDefined();
    expect(hit!.tMin).toBeCloseTo(2, 12);
    expect(hit!.tMax).toBeCloseTo(3, 12);
  });
});
