import { describe, it, expect } from "vitest";
import { V4i } from "../../src/vector/v4i.js";
import { V4iArray } from "../../src/vector/array/v4iArray.js";

describe("V4iArray", () => {
  it("construction and layout", () => {
    const arr = new V4iArray(2);
    expect(arr.buffer.byteLength).toBe(32);
    arr.setComponents(1, 10, 20, 30, 40);
    const i32 = new Int32Array(arr.buffer);
    expect([i32[4], i32[5], i32[6], i32[7]]).toEqual([10, 20, 30, 40]);
  });

  it("get/set + structural equals", () => {
    const arr = V4iArray.fromIterable([new V4i(1, 2, 3, 4)]);
    expect(arr.get(0).equals(new V4i(1, 2, 3, 4))).toBe(true);
  });

  it("viewAt aliases", () => {
    const arr = V4iArray.fromIterable([new V4i(1, 2, 3, 4)]);
    const v = arr.viewAt(0);
    v.w = 99;
    expect(arr.w(0)).toBe(99);
  });

  it("forEachInto", () => {
    const arr = V4iArray.fromIterable([new V4i(1, 2, 3, 4)]);
    let seen = 0;
    arr.forEachInto(new V4i(), (v) => { seen = v.x + v.y + v.z + v.w; });
    expect(seen).toBe(10);
  });

  it("Int32Array truncates", () => {
    const arr = new V4iArray(1);
    arr.setComponents(0, 1.9, -1.9, 2.5, -3.7);
    expect(arr.get(0).toArray()).toEqual([1, -1, 2, -3]);
  });

  it("addInPlace + scaleInPlace", () => {
    const a = V4iArray.fromIterable([new V4i(1, 1, 1, 1)]);
    a.addInPlace(new V4i(10, 20, 30, 40));
    expect(a.get(0).toArray()).toEqual([11, 21, 31, 41]);
    a.addInPlace(1);
    expect(a.get(0).toArray()).toEqual([12, 22, 32, 42]);
    a.scaleInPlace(2);
    expect(a.get(0).toArray()).toEqual([24, 44, 64, 84]);
  });
});
