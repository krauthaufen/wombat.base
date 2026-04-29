import { describe, it, expect } from "vitest";
import { V3i } from "../../src/vector/v3i.js";
import { V3iArray } from "../../src/vector/array/v3iArray.js";

describe("V3iArray", () => {
  it("construction and layout", () => {
    const arr = new V3iArray(2);
    expect(arr.buffer.byteLength).toBe(24);
    arr.setComponents(1, 10, 20, 30);
    const i32 = new Int32Array(arr.buffer);
    expect([i32[3], i32[4], i32[5]]).toEqual([10, 20, 30]);
  });

  it("get/set round-trip", () => {
    const arr = V3iArray.fromIterable([new V3i(1, 2, 3)]);
    expect(arr.get(0).equals(new V3i(1, 2, 3))).toBe(true);
  });

  it("viewAt aliases", () => {
    const arr = V3iArray.fromIterable([new V3i(1, 2, 3)]);
    const v = arr.viewAt(0);
    v.z = 99;
    expect(arr.z(0)).toBe(99);
  });

  it("forEachInto", () => {
    const arr = V3iArray.fromIterable([new V3i(1, 2, 3), new V3i(4, 5, 6)]);
    const sums: number[] = [];
    arr.forEachInto(new V3i(), (v) => sums.push(v.sumComp()));
    expect(sums).toEqual([6, 15]);
  });

  it("Int32Array truncates non-integers", () => {
    const arr = new V3iArray(1);
    arr.setComponents(0, 1.9, -1.9, 2.5);
    expect(arr.get(0).toArray()).toEqual([1, -1, 2]);
  });

  it("addInPlace vec / scalar / array, scaleInPlace", () => {
    const a = V3iArray.fromIterable([new V3i(1, 1, 1), new V3i(2, 2, 2)]);
    a.addInPlace(new V3i(10, 0, 0));
    expect(a.get(0).toArray()).toEqual([11, 1, 1]);
    a.addInPlace(5);
    expect(a.get(0).toArray()).toEqual([16, 6, 6]);
    a.scaleInPlace(2);
    expect(a.get(0).toArray()).toEqual([32, 12, 12]);
  });
});
