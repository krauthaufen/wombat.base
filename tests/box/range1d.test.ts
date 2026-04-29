import { describe, it, expect } from "vitest";
import { Range1d } from "../../src/box/range1d.js";

describe("Range1d — smoke", () => {
  it("empty + extend yields singleton", () => {
    const r = Range1d.empty.extend(1.25);
    expect(r.min).toBe(1.25);
    expect(r.max).toBe(1.25);
  });

  it("size / center / contains", () => {
    const r = Range1d.fromMinMax(-1, 3);
    expect(r.size()).toBe(4);
    expect(r.center()).toBe(1);
    expect(r.contains(0)).toBe(true);
    expect(r.contains(4)).toBe(false);
  });

  it("intersects / intersection / union", () => {
    const a = Range1d.fromMinMax(0, 5);
    const b = Range1d.fromMinMax(3, 9);
    expect(a.intersects(b)).toBe(true);
    expect(a.union(b).equals(Range1d.fromMinMax(0, 9))).toBe(true);
    expect(a.intersection(b).equals(Range1d.fromMinMax(3, 5))).toBe(true);
  });

  it("equals / hashCode determinism", () => {
    const a = Range1d.fromMinMax(0.1, 0.2);
    const b = Range1d.fromMinMax(0.1, 0.2);
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
