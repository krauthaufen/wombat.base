import { describe, it, expect } from "vitest";
import { Polygon2d } from "../../src/geometry/polygon2d.js";
import { V2d } from "../../src/vector/v2d.js";

describe("Polygon2d", () => {
  const square = new Polygon2d([
    new V2d(0, 0), new V2d(1, 0), new V2d(1, 1), new V2d(0, 1),
  ]);

  it("unit square has area 1", () => {
    expect(square.area()).toBeCloseTo(1, 12);
    expect(square.signedArea()).toBeCloseTo(1, 12);
  });

  it("centroid at center", () => {
    expect(square.centroid().approxEqual(new V2d(0.5, 0.5), 1e-12)).toBe(true);
  });

  it("contains inside, excludes outside", () => {
    expect(square.contains(new V2d(0.5, 0.5))).toBe(true);
    expect(square.contains(new V2d(2, 2))).toBe(false);
    expect(square.contains(new V2d(-0.1, 0.5))).toBe(false);
  });

  it("winding CCW for the square", () => {
    expect(square.winding()).toBe("ccw");
  });

  it("CW square has negative signedArea", () => {
    const cw = new Polygon2d([
      new V2d(0, 0), new V2d(0, 1), new V2d(1, 1), new V2d(1, 0),
    ]);
    expect(cw.signedArea()).toBeLessThan(0);
    expect(cw.winding()).toBe("cw");
    expect(cw.area()).toBeCloseTo(1, 12);
  });

  it("boundingBox returns the unit AABB", () => {
    const b = square.boundingBox();
    expect(b.min.toArray()).toEqual([0, 0]);
    expect(b.max.toArray()).toEqual([1, 1]);
  });
});
