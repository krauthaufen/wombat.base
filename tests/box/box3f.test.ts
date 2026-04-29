import { describe, it, expect } from "vitest";
import { Box3f } from "../../src/box/box3f.js";
import { V3f } from "../../src/vector/v3f.js";

describe("Box3f — smoke", () => {
  it("empty + extend yields singleton", () => {
    const b = Box3f.empty.extend(new V3f(1, 2, 3));
    expect(b.min.toArray()).toEqual([1, 2, 3]);
    expect(b.max.toArray()).toEqual([1, 2, 3]);
  });

  it("size / center / volume / surfaceArea", () => {
    const b = Box3f.fromMinMax(new V3f(0, 0, 0), new V3f(1, 2, 3));
    expect(b.size().toArray()).toEqual([1, 2, 3]);
    expect(b.center().toArray()).toEqual([0.5, 1, 1.5]);
    expect(b.volume()).toBe(6);
    expect(b.surfaceArea()).toBe(2 * (2 + 6 + 3));
  });

  it("fromCenterRadius / fromPoints / fromBoxes", () => {
    expect(Box3f.fromCenterRadius(new V3f(0, 0, 0), 1).max.toArray()).toEqual([1, 1, 1]);
    const fp = Box3f.fromPoints([new V3f(1, 5, -2), new V3f(-3, 2, 4)]);
    expect(fp.min.toArray()).toEqual([-3, 2, -2]);
    expect(fp.max.toArray()).toEqual([1, 5, 4]);
    const fb = Box3f.fromBoxes([
      Box3f.fromMinMax(new V3f(0, 0, 0), new V3f(1, 1, 1)),
      Box3f.fromMinMax(new V3f(2, 2, 2), new V3f(3, 3, 3)),
    ]);
    expect(fb.min.toArray()).toEqual([0, 0, 0]);
    expect(fb.max.toArray()).toEqual([3, 3, 3]);
  });

  it("contains and intersects", () => {
    const b = Box3f.fromMinMax(new V3f(0, 0, 0), new V3f(1, 1, 1));
    expect(b.contains(new V3f(0.5, 0.5, 0.5))).toBe(true);
    expect(b.contains(new V3f(2, 0, 0))).toBe(false);
    expect(b.intersects(Box3f.fromMinMax(new V3f(0.5, 0, 0), new V3f(2, 2, 2)))).toBe(true);
    expect(b.intersects(Box3f.fromMinMax(new V3f(2, 2, 2), new V3f(3, 3, 3)))).toBe(false);
  });

  it("extend a point already inside leaves box unchanged", () => {
    const b = Box3f.fromMinMax(new V3f(0, 0, 0), new V3f(10, 10, 10));
    expect(b.extend(new V3f(5, 5, 5)).equals(b)).toBe(true);
  });

  it("equals / hashCode determinism", () => {
    const a = Box3f.fromMinMax(new V3f(1, 2, 3), new V3f(4, 5, 6));
    const b = Box3f.fromMinMax(new V3f(1, 2, 3), new V3f(4, 5, 6));
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
