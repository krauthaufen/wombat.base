import { describe, it, expect } from "vitest";
import { Triangle3d } from "../../src/geometry/triangle3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Triangle3d", () => {
  it("area of unit right triangle is 0.5", () => {
    const t = new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(0, 1, 0));
    expect(t.area()).toBeCloseTo(0.5, 12);
  });

  it("normal of XY triangle is +Z", () => {
    const t = new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(0, 1, 0));
    expect(t.normal().approxEqual(new V3d(0, 0, 1), 1e-12)).toBe(true);
  });

  it("centroid barycentric is (1/3, 1/3, 1/3)", () => {
    const t = new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(0, 1, 0));
    const c = t.centroid();
    const b = t.barycentric(c);
    expect(b.x).toBeCloseTo(1 / 3, 12);
    expect(b.y).toBeCloseTo(1 / 3, 12);
    expect(b.z).toBeCloseTo(1 / 3, 12);
  });

  it("contains projects to plane", () => {
    const t = new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(0, 1, 0));
    expect(t.contains(new V3d(0.25, 0.25, 5))).toBe(true);
    expect(t.contains(new V3d(2, 2, 0))).toBe(false);
  });
});
