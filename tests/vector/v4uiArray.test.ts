import { describe, it, expect } from "vitest";
import { V4ui } from "../../src/vector/v4ui.js";
import { V4uiArray } from "../../src/vector/array/v4uiArray.js";

describe("V4uiArray", () => {
  it("construction and layout", () => {
    const arr = new V4uiArray(2);
    expect(arr.buffer.byteLength).toBe(32);
    arr.setComponents(1, 10, 20, 30, 40);
    const u32 = new Uint32Array(arr.buffer);
    expect([u32[4], u32[5], u32[6], u32[7]]).toEqual([10, 20, 30, 40]);
  });

  it("get/set + structural equals", () => {
    const arr = V4uiArray.fromIterable([new V4ui(1, 2, 3, 4)]);
    expect(arr.get(0).equals(new V4ui(1, 2, 3, 4))).toBe(true);
  });

  it("viewAt aliases", () => {
    const arr = V4uiArray.fromIterable([new V4ui(1, 2, 3, 4)]);
    const v = arr.viewAt(0);
    v.w = 99;
    expect(arr.w(0)).toBe(99);
  });

  it("forEachInto", () => {
    const arr = V4uiArray.fromIterable([new V4ui(1, 2, 3, 4)]);
    let seen = 0;
    arr.forEachInto(new V4ui(), (v) => { seen = v.x + v.y + v.z + v.w; });
    expect(seen).toBe(10);
  });

  it("negative input wraps modulo 2^32", () => {
    const arr = new V4uiArray(1);
    arr.setComponents(0, -1, 0, -1, 0);
    expect(arr.x(0)).toBe(0xFFFFFFFF);
    expect(arr.z(0)).toBe(0xFFFFFFFF);
  });

  it("addInPlace + scaleInPlace", () => {
    const a = V4uiArray.fromIterable([new V4ui(1, 2, 3, 4)]);
    a.addInPlace(new V4ui(10, 20, 30, 40));
    expect(a.get(0).toArray()).toEqual([11, 22, 33, 44]);
    a.addInPlace(1);
    expect(a.get(0).toArray()).toEqual([12, 23, 34, 45]);
    a.scaleInPlace(2);
    expect(a.get(0).toArray()).toEqual([24, 46, 68, 90]);
  });
});
