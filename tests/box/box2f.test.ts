import { describe, it, expect } from "vitest";
import { Box2f } from "../../src/box/box2f.js";
import { V2f } from "../../src/vector/v2f.js";

describe("Box2f — smoke", () => {
  it("empty + extend yields singleton", () => {
    const b = Box2f.empty.extend(new V2f(1, 2));
    expect(b.min.toArray()).toEqual([1, 2]);
    expect(b.max.toArray()).toEqual([1, 2]);
  });

  it("fromMinMax / size / center / area", () => {
    const b = Box2f.fromMinMax(new V2f(0, 0), new V2f(2, 4));
    expect(b.size().toArray()).toEqual([2, 4]);
    expect(b.center().toArray()).toEqual([1, 2]);
    expect(b.area()).toBe(8);
  });

  it("fromCenterRadius / fromPoints", () => {
    expect(Box2f.fromCenterRadius(new V2f(0, 0), 1).max.toArray()).toEqual([1, 1]);
    const fp = Box2f.fromPoints([new V2f(1, 5), new V2f(-2, 3)]);
    expect(fp.min.toArray()).toEqual([-2, 3]);
    expect(fp.max.toArray()).toEqual([1, 5]);
  });

  it("contains and intersects", () => {
    const b = Box2f.fromMinMax(new V2f(0, 0), new V2f(10, 10));
    expect(b.contains(new V2f(5, 5))).toBe(true);
    expect(b.contains(new V2f(-1, 5))).toBe(false);
    expect(b.intersects(Box2f.fromMinMax(new V2f(5, 5), new V2f(20, 20)))).toBe(true);
    expect(b.intersects(Box2f.fromMinMax(new V2f(11, 11), new V2f(20, 20)))).toBe(false);
  });

  it("extend a point already inside leaves box unchanged", () => {
    const b = Box2f.fromMinMax(new V2f(0, 0), new V2f(10, 10));
    expect(b.extend(new V2f(5, 5)).equals(b)).toBe(true);
  });

  it("equals / hashCode determinism", () => {
    const a = Box2f.fromMinMax(new V2f(1, 2), new V2f(3, 4));
    const b = Box2f.fromMinMax(new V2f(1, 2), new V2f(3, 4));
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
