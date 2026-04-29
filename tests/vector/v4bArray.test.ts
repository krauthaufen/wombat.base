import { describe, it, expect } from "vitest";
import { V4b } from "../../src/vector/v4b.js";
import { V4bArray } from "../../src/vector/array/v4bArray.js";

describe("V4bArray", () => {
  it("construction and layout", () => {
    const arr = new V4bArray(2);
    expect(arr.buffer.byteLength).toBe(8);
    arr.setComponents(1, true, false, true, false);
    const u8 = new Uint8Array(arr.buffer);
    expect([u8[4], u8[5], u8[6], u8[7]]).toEqual([1, 0, 1, 0]);
  });

  it("get/set round-trip", () => {
    const arr = V4bArray.fromIterable([new V4b(true, false, true, false)]);
    expect(arr.get(0).equals(new V4b(true, false, true, false))).toBe(true);
  });

  it("viewAt aliases", () => {
    const arr = new V4bArray(1);
    const v = arr.viewAt(0);
    v.w = true;
    expect(arr.w(0)).toBe(true);
  });

  it("forEachInto with scratch", () => {
    const arr = V4bArray.fromIterable([new V4b(true, true, false, false), new V4b(true, true, true, true)]);
    const all: boolean[] = [];
    arr.forEachInto(new V4b(), (v) => all.push(v.all()));
    expect(all).toEqual([false, true]);
  });

  it("setAllTrue / setAllFalse", () => {
    const arr = new V4bArray(2);
    arr.setAllTrue();
    expect(arr.get(1).all()).toBe(true);
    arr.setAllFalse();
    expect(arr.get(1).any()).toBe(false);
    arr.setW(0, true);
    expect(arr.w(0)).toBe(true);
  });
});
