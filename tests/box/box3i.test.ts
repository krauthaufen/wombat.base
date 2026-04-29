import { describe, it, expect } from "vitest";
import { Box3i } from "../../src/box/box3i.js";
import { V3i } from "../../src/vector/v3i.js";

describe("Box3i — smoke", () => {
  it("empty is invalid", () => {
    expect(Box3i.empty.isEmpty()).toBe(true);
  });

  it("fromMinMax / size / center / volume / surfaceArea", () => {
    const b = Box3i.fromMinMax(new V3i(0, 0, 0), new V3i(2, 3, 4));
    expect(b.size().toArray()).toEqual([2, 3, 4]);
    expect(b.center().toArray()).toEqual([1, 1, 2]);
    expect(b.volume()).toBe(24);
    expect(b.surfaceArea()).toBe(2 * (6 + 12 + 8));
  });

  it("fromCenterRadius / fromPoints", () => {
    expect(Box3i.fromCenterRadius(new V3i(0, 0, 0), 1).max.toArray()).toEqual([1, 1, 1]);
    const fp = Box3i.fromPoints([new V3i(1, 5, -2), new V3i(-3, 2, 4)]);
    expect(fp.min.toArray()).toEqual([-3, 2, -2]);
    expect(fp.max.toArray()).toEqual([1, 5, 4]);
  });

  it("contains: known-inside, known-outside, box-in-box", () => {
    const b = Box3i.fromMinMax(new V3i(0, 0, 0), new V3i(10, 10, 10));
    expect(b.contains(new V3i(5, 5, 5))).toBe(true);
    expect(b.contains(new V3i(11, 0, 0))).toBe(false);
    expect(b.contains(Box3i.fromMinMax(new V3i(2, 2, 2), new V3i(8, 8, 8)))).toBe(true);
  });

  it("intersects: overlapping vs disjoint", () => {
    const a = Box3i.fromMinMax(new V3i(0, 0, 0), new V3i(5, 5, 5));
    expect(a.intersects(Box3i.fromMinMax(new V3i(3, 3, 3), new V3i(8, 8, 8)))).toBe(true);
    expect(a.intersects(Box3i.fromMinMax(new V3i(6, 6, 6), new V3i(8, 8, 8)))).toBe(false);
  });

  it("extend on empty yields singleton", () => {
    const b = Box3i.empty.extend(new V3i(1, 2, 3));
    expect(b.min.toArray()).toEqual([1, 2, 3]);
    expect(b.max.toArray()).toEqual([1, 2, 3]);
  });

  it("extend a point already inside leaves box unchanged", () => {
    const b = Box3i.fromMinMax(new V3i(0, 0, 0), new V3i(10, 10, 10));
    expect(b.extend(new V3i(5, 5, 5)).equals(b)).toBe(true);
  });

  it("equals / hashCode determinism", () => {
    const a = Box3i.fromMinMax(new V3i(1, 2, 3), new V3i(4, 5, 6));
    const b = Box3i.fromMinMax(new V3i(1, 2, 3), new V3i(4, 5, 6));
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
