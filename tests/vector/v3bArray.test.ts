import { describe, it, expect } from "vitest";
import { V3b } from "../../src/vector/v3b.js";
import { V3bArray } from "../../src/vector/array/v3bArray.js";

describe("V3bArray", () => {
  it("construction and layout", () => {
    const arr = new V3bArray(2);
    expect(arr.buffer.byteLength).toBe(6);
    arr.setComponents(1, true, false, true);
    const u8 = new Uint8Array(arr.buffer);
    expect([u8[3], u8[4], u8[5]]).toEqual([1, 0, 1]);
  });

  it("get/set round-trip and structural equals", () => {
    const arr = V3bArray.fromIterable([new V3b(true, false, true)]);
    expect(arr.get(0).equals(new V3b(true, false, true))).toBe(true);
  });

  it("viewAt aliases", () => {
    const arr = new V3bArray(2);
    const v = arr.viewAt(1);
    v.z = true;
    expect(arr.z(1)).toBe(true);
    expect(arr.z(0)).toBe(false);
  });

  it("forEachInto with scratch", () => {
    const arr = V3bArray.fromIterable([new V3b(true, false, false), new V3b(false, true, true)]);
    const counts: number[] = [];
    arr.forEachInto(new V3b(), (v) => counts.push(v.countTrue()));
    expect(counts).toEqual([1, 2]);
  });

  it("setAllTrue / setAllFalse + setX boolean", () => {
    const arr = new V3bArray(2);
    arr.setAllTrue();
    expect(arr.get(0).all()).toBe(true);
    arr.setAllFalse();
    expect(arr.get(0).any()).toBe(false);
    arr.setY(1, true);
    expect(arr.y(1)).toBe(true);
  });
});
