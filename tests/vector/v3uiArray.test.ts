import { describe, it, expect } from "vitest";
import { V3ui } from "../../src/vector/v3ui.js";
import { V3uiArray } from "../../src/vector/array/v3uiArray.js";

describe("V3uiArray", () => {
  it("construction and layout", () => {
    const arr = new V3uiArray(2);
    expect(arr.buffer.byteLength).toBe(24);
    arr.setComponents(1, 10, 20, 30);
    const u32 = new Uint32Array(arr.buffer);
    expect([u32[3], u32[4], u32[5]]).toEqual([10, 20, 30]);
  });

  it("get/set + structural equals", () => {
    const arr = V3uiArray.fromIterable([new V3ui(1, 2, 3)]);
    expect(arr.get(0).equals(new V3ui(1, 2, 3))).toBe(true);
  });

  it("viewAt aliases", () => {
    const arr = V3uiArray.fromIterable([new V3ui(1, 2, 3)]);
    const v = arr.viewAt(0);
    v.z = 99;
    expect(arr.z(0)).toBe(99);
  });

  it("forEachInto", () => {
    const arr = V3uiArray.fromIterable([new V3ui(1, 2, 3), new V3ui(4, 5, 6)]);
    const xs: number[] = [];
    arr.forEachInto(new V3ui(), (v) => xs.push(v.x));
    expect(xs).toEqual([1, 4]);
  });

  it("negative input wraps modulo 2^32", () => {
    const arr = new V3uiArray(1);
    arr.setComponents(0, -1, 5, -2);
    expect(arr.x(0)).toBe(0xFFFFFFFF);
    expect(arr.y(0)).toBe(5);
    expect(arr.z(0)).toBe(0xFFFFFFFE);
  });

  it("addInPlace + scaleInPlace", () => {
    const a = V3uiArray.fromIterable([new V3ui(1, 2, 3)]);
    a.addInPlace(new V3ui(10, 20, 30));
    expect(a.get(0).toArray()).toEqual([11, 22, 33]);
    a.addInPlace(1);
    expect(a.get(0).toArray()).toEqual([12, 23, 34]);
    a.scaleInPlace(2);
    expect(a.get(0).toArray()).toEqual([24, 46, 68]);
  });
});
