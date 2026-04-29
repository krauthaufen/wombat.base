import { describe, it, expect } from "vitest";
import { Ray3d } from "../../src/geometry/ray3d.js";
import { Triangle3d } from "../../src/geometry/triangle3d.js";
import { Sphere3d } from "../../src/geometry/sphere3d.js";
import { Box3d } from "../../src/box/box3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Ray3d", () => {
  it("Möller–Trumbore hits a known triangle at known t", () => {
    const tri = new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(0, 1, 0));
    const ray = new Ray3d(new V3d(0.25, 0.25, 1), new V3d(0, 0, -1));
    const t = ray.intersection(tri);
    expect(t).toBeCloseTo(1, 12);
    expect(ray.pointAt(t!).approxEqual(new V3d(0.25, 0.25, 0), 1e-12)).toBe(true);
  });

  it("misses triangle when outside", () => {
    const tri = new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(0, 1, 0));
    const ray = new Ray3d(new V3d(2, 2, 1), new V3d(0, 0, -1));
    expect(ray.intersection(tri)).toBeUndefined();
  });

  it("sphere: returns first non-negative t (entry)", () => {
    const s = new Sphere3d(V3d.zero, 1);
    const ray = new Ray3d(new V3d(0, 0, -5), new V3d(0, 0, 1));
    expect(ray.intersection(s)).toBeCloseTo(4, 12);
  });

  it("sphere: origin inside the sphere returns the exit t", () => {
    const s = new Sphere3d(V3d.zero, 1);
    const ray = new Ray3d(V3d.zero, new V3d(0, 0, 1));
    expect(ray.intersection(s)).toBeCloseTo(1, 12);
  });

  it("box slab method: through a unit cube along +X", () => {
    const box = Box3d.fromMinMax(new V3d(0, 0, 0), new V3d(1, 1, 1));
    const ray = new Ray3d(new V3d(-2, 0.5, 0.5), new V3d(1, 0, 0));
    expect(ray.intersection(box)).toBeCloseTo(2, 12);
  });

  it("box: origin inside the box returns the exit t", () => {
    const box = Box3d.fromMinMax(new V3d(-1, -1, -1), new V3d(1, 1, 1));
    const ray = new Ray3d(V3d.zero, new V3d(1, 0, 0));
    expect(ray.intersection(box)).toBeCloseTo(1, 12);
  });
});
