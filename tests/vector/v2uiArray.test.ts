import { describe, it, expect } from "vitest";
import { V2ui } from "../../src/vector/v2ui.js";
import { V2uiArray } from "../../src/vector/array/v2uiArray.js";

describe("V2uiArray", () => {
  it("construction and layout", () => {
    const arr = new V2uiArray(2);
    expect(arr.buffer.byteLength).toBe(16);
    arr.setComponents(1, 10, 20);
    const u32 = new Uint32Array(arr.buffer);
    expect([u32[2], u32[3]]).toEqual([10, 20]);
  });

  it("get/set + structural equals", () => {
    const arr = V2uiArray.fromIterable([new V2ui(1, 2)]);
    expect(arr.get(0).equals(new V2ui(1, 2))).toBe(true);
  });

  it("viewAt aliases", () => {
    const arr = V2uiArray.fromIterable([new V2ui(1, 2)]);
    const v = arr.viewAt(0);
    v.x = 99;
    expect(arr.x(0)).toBe(99);
  });

  it("forEachInto", () => {
    const arr = V2uiArray.fromIterable([new V2ui(1, 2), new V2ui(3, 4)]);
    const ys: number[] = [];
    arr.forEachInto(new V2ui(), (v) => ys.push(v.y));
    expect(ys).toEqual([2, 4]);
  });

  it("negative input wraps modulo 2^32", () => {
    const arr = new V2uiArray(1);
    arr.setComponents(0, -1, -2);
    expect(arr.x(0)).toBe(0xFFFFFFFF);
    expect(arr.y(0)).toBe(0xFFFFFFFE);
  });

  it("addInPlace + scaleInPlace", () => {
    const a = V2uiArray.fromIterable([new V2ui(1, 2)]);
    a.addInPlace(new V2ui(10, 20));
    expect(a.get(0).toArray()).toEqual([11, 22]);
    a.addInPlace(1);
    expect(a.get(0).toArray()).toEqual([12, 23]);
    a.scaleInPlace(2);
    expect(a.get(0).toArray()).toEqual([24, 46]);
  });
});
