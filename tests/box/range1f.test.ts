import { describe, it, expect } from "vitest";
import { Range1f } from "../../src/box/range1f.js";

describe("Range1f — smoke", () => {
  it("empty is invalid", () => {
    expect(Range1f.empty.isEmpty()).toBe(true);
  });

  it("fromMinMax / size / center", () => {
    const r = Range1f.fromMinMax(0, 4);
    expect(r.size()).toBe(4);
    expect(r.center()).toBe(2);
  });

  it("contains and intersects", () => {
    const a = Range1f.fromMinMax(0, 5);
    expect(a.contains(2.5)).toBe(true);
    expect(a.contains(6)).toBe(false);
    expect(a.intersects(Range1f.fromMinMax(3, 8))).toBe(true);
    expect(a.intersects(Range1f.fromMinMax(6, 9))).toBe(false);
  });

  it("extend on empty yields singleton", () => {
    const r = Range1f.empty.extend(3.5);
    expect(r.min).toBe(Math.fround(3.5));
    expect(r.max).toBe(Math.fround(3.5));
  });

  it("extend with value already inside is a no-op", () => {
    const r = Range1f.fromMinMax(-1, 1);
    expect(r.extend(0).equals(r)).toBe(true);
  });

  it("equals / hashCode determinism", () => {
    const a = Range1f.fromMinMax(1, 2);
    const b = Range1f.fromMinMax(1, 2);
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });

  it("fromValues", () => {
    const r = Range1f.fromValues([3, 1, 4, 1, 5, 9, 2, 6]);
    expect(r.min).toBe(1);
    expect(r.max).toBe(9);
  });
});
