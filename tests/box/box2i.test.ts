import { describe, it, expect } from "vitest";
import { Box2i } from "../../src/box/box2i.js";
import { V2i } from "../../src/vector/v2i.js";

describe("Box2i — smoke", () => {
  it("empty is invalid", () => {
    expect(Box2i.empty.isEmpty()).toBe(true);
  });

  it("fromMinMax / size / center / area", () => {
    const b = Box2i.fromMinMax(new V2i(0, 0), new V2i(4, 6));
    expect(b.size().toArray()).toEqual([4, 6]);
    expect(b.center().toArray()).toEqual([2, 3]);
    expect(b.area()).toBe(24);
  });

  it("fromCenterRadius", () => {
    const b = Box2i.fromCenterRadius(new V2i(5, 5), 2);
    expect(b.min.toArray()).toEqual([3, 3]);
    expect(b.max.toArray()).toEqual([7, 7]);
  });

  it("fromPoints", () => {
    const b = Box2i.fromPoints([new V2i(1, 5), new V2i(-2, 3), new V2i(4, -1)]);
    expect(b.min.toArray()).toEqual([-2, -1]);
    expect(b.max.toArray()).toEqual([4, 5]);
  });

  it("contains point and box", () => {
    const b = Box2i.fromMinMax(new V2i(0, 0), new V2i(10, 10));
    expect(b.contains(new V2i(5, 5))).toBe(true);
    expect(b.contains(new V2i(11, 5))).toBe(false);
    expect(b.contains(Box2i.fromMinMax(new V2i(2, 2), new V2i(8, 8)))).toBe(true);
  });

  it("intersects: overlap vs disjoint", () => {
    const a = Box2i.fromMinMax(new V2i(0, 0), new V2i(5, 5));
    expect(a.intersects(Box2i.fromMinMax(new V2i(3, 3), new V2i(9, 9)))).toBe(true);
    expect(a.intersects(Box2i.fromMinMax(new V2i(6, 6), new V2i(9, 9)))).toBe(false);
  });

  it("extend on empty yields singleton", () => {
    const b = Box2i.empty.extend(new V2i(3, 4));
    expect(b.min.toArray()).toEqual([3, 4]);
    expect(b.max.toArray()).toEqual([3, 4]);
  });

  it("extend a point already inside leaves box unchanged", () => {
    const b = Box2i.fromMinMax(new V2i(0, 0), new V2i(10, 10));
    expect(b.extend(new V2i(5, 5)).equals(b)).toBe(true);
  });

  it("equals / hashCode determinism", () => {
    const a = Box2i.fromMinMax(new V2i(1, 2), new V2i(3, 4));
    const b = Box2i.fromMinMax(new V2i(1, 2), new V2i(3, 4));
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
