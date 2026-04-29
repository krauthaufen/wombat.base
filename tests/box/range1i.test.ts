import { describe, it, expect } from "vitest";
import { Range1i } from "../../src/box/range1i.js";

describe("Range1i — smoke", () => {
  it("empty is invalid and isEmpty", () => {
    const e = Range1i.empty;
    expect(e.isEmpty()).toBe(true);
    expect(e.isValid()).toBe(false);
  });

  it("fromMinMax / size / center", () => {
    const r = Range1i.fromMinMax(2, 10);
    expect(r.size()).toBe(8);
    expect(r.center()).toBe(6);
  });

  it("single yields a singleton", () => {
    const r = Range1i.single(5);
    expect(r.size()).toBe(0);
    expect(r.contains(5)).toBe(true);
  });

  it("contains a value vs out-of-range", () => {
    const r = Range1i.fromMinMax(0, 10);
    expect(r.contains(5)).toBe(true);
    expect(r.contains(11)).toBe(false);
    expect(r.contains(Range1i.fromMinMax(2, 8))).toBe(true);
  });

  it("intersects overlapping vs disjoint", () => {
    const a = Range1i.fromMinMax(0, 5);
    expect(a.intersects(Range1i.fromMinMax(3, 9))).toBe(true);
    expect(a.intersects(Range1i.fromMinMax(7, 10))).toBe(false);
  });

  it("extend on empty yields singleton", () => {
    const r = Range1i.empty.extend(7);
    expect(r.equals(Range1i.single(7))).toBe(true);
  });

  it("extend a value already inside leaves range unchanged", () => {
    const r = Range1i.fromMinMax(0, 10);
    expect(r.extend(5).equals(r)).toBe(true);
  });

  it("equals / hashCode determinism", () => {
    const a = Range1i.fromMinMax(1, 5);
    const b = Range1i.fromMinMax(1, 5);
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });

  it("union / intersection", () => {
    const a = Range1i.fromMinMax(0, 5);
    const b = Range1i.fromMinMax(3, 9);
    expect(a.union(b).equals(Range1i.fromMinMax(0, 9))).toBe(true);
    expect(a.intersection(b).equals(Range1i.fromMinMax(3, 5))).toBe(true);
  });
});
