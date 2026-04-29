import { describe, it, expect } from "vitest";
import { Box2d } from "../../src/box/box2d.js";
import { V2d } from "../../src/vector/v2d.js";

describe("Box2d — smoke", () => {
  it("empty + extend yields singleton", () => {
    const b = Box2d.empty.extend(new V2d(0.5, -0.5));
    expect(b.min.toArray()).toEqual([0.5, -0.5]);
    expect(b.max.toArray()).toEqual([0.5, -0.5]);
  });

  it("size / center / area", () => {
    const b = Box2d.fromMinMax(new V2d(0, 0), new V2d(3, 4));
    expect(b.size().toArray()).toEqual([3, 4]);
    expect(b.center().toArray()).toEqual([1.5, 2]);
    expect(b.area()).toBe(12);
  });

  it("contains / intersects", () => {
    const b = Box2d.fromMinMax(new V2d(0, 0), new V2d(1, 1));
    expect(b.contains(new V2d(0.5, 0.5))).toBe(true);
    expect(b.contains(new V2d(2, 2))).toBe(false);
    expect(b.intersects(Box2d.fromMinMax(new V2d(0.5, 0.5), new V2d(2, 2)))).toBe(true);
    expect(b.intersects(Box2d.fromMinMax(new V2d(2, 2), new V2d(3, 3)))).toBe(false);
  });

  it("equals / hashCode determinism", () => {
    const a = Box2d.fromMinMax(new V2d(1, 2), new V2d(3, 4));
    const b = Box2d.fromMinMax(new V2d(1, 2), new V2d(3, 4));
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
