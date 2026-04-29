import { describe, it, expect } from "vitest";
import { V2i } from "../../src/vector/v2i.js";
import { V2iArray } from "../../src/vector/array/v2iArray.js";

describe("V2iArray", () => {
  it("construction: byteLength = length * 8", () => {
    const arr = new V2iArray(3);
    expect(arr.buffer.byteLength).toBe(24);
  });

  it("packed AoS layout", () => {
    const arr = new V2iArray(2);
    arr.set(1, new V2i(10, 20));
    const i32 = new Int32Array(arr.buffer);
    expect([i32[2], i32[3]]).toEqual([10, 20]);
  });

  it("get/set round-trip + structural equals", () => {
    const arr = V2iArray.fromIterable([new V2i(1, 2), new V2i(3, 4)]);
    expect(arr.get(0).equals(new V2i(1, 2))).toBe(true);
  });

  it("viewAt aliases", () => {
    const arr = V2iArray.fromIterable([new V2i(1, 2)]);
    const v = arr.viewAt(0);
    v.x = 99;
    expect(arr.x(0)).toBe(99);
  });

  it("forEachInto with scratch", () => {
    const arr = V2iArray.fromIterable([new V2i(1, 2), new V2i(3, 4)]);
    const xs: number[] = [];
    arr.forEachInto(new V2i(), (v) => xs.push(v.x));
    expect(xs).toEqual([1, 3]);
  });

  it("Int32Array truncates non-integers toward zero", () => {
    const arr = new V2iArray(1);
    arr.setComponents(0, 3.7, -2.9);
    expect(arr.x(0)).toBe(3);
    expect(arr.y(0)).toBe(-2);
  });

  it("addInPlace vec / scalar / array, scaleInPlace", () => {
    const a = V2iArray.fromIterable([new V2i(1, 2), new V2i(3, 4)]);
    a.addInPlace(new V2i(10, 0));
    expect(a.get(0).toArray()).toEqual([11, 2]);
    a.addInPlace(1);
    expect(a.get(0).toArray()).toEqual([12, 3]);
    a.scaleInPlace(2);
    expect(a.get(0).toArray()).toEqual([24, 6]);
  });
});
