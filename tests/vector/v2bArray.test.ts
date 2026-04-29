import { describe, it, expect } from "vitest";
import { V2b } from "../../src/vector/v2b.js";
import { V2bArray } from "../../src/vector/array/v2bArray.js";

describe("V2bArray", () => {
  it("construction: zero-filled, byteLength = length * 2", () => {
    const arr = new V2bArray(3);
    expect(arr.length).toBe(3);
    expect(arr.buffer.byteLength).toBe(6);
    for (let i = 0; i < 3; i++) {
      expect(arr.get(i).equals(new V2b(false, false))).toBe(true);
    }
  });

  it("packed AoS layout — element i lives at bytes [2i, 2i+1]", () => {
    const arr = new V2bArray(2);
    arr.set(1, new V2b(true, false));
    const u8 = new Uint8Array(arr.buffer);
    expect(u8[2]).toBe(1);
    expect(u8[3]).toBe(0);
  });

  it("get/set round-trip", () => {
    const arr = V2bArray.fromIterable([new V2b(true, false), new V2b(false, true)]);
    expect(arr.get(0).equals(new V2b(true, false))).toBe(true);
    expect(arr.get(1).equals(new V2b(false, true))).toBe(true);
  });

  it("viewAt aliases the buffer", () => {
    const arr = V2bArray.fromIterable([new V2b(true, false)]);
    const v = arr.viewAt(0);
    v.y = true;
    expect(arr.y(0)).toBe(true);
  });

  it("forEachInto with scratch", () => {
    const arr = V2bArray.fromIterable([new V2b(true, false), new V2b(false, true)]);
    const seen: boolean[][] = [];
    const scratch = new V2b();
    arr.forEachInto(scratch, (v) => seen.push([v.x, v.y]));
    expect(seen).toEqual([[true, false], [false, true]]);
  });

  it("setAllTrue / setAllFalse", () => {
    const arr = new V2bArray(2);
    arr.setAllTrue();
    expect(arr.x(0)).toBe(true); expect(arr.y(1)).toBe(true);
    arr.setAllFalse();
    expect(arr.x(0)).toBe(false); expect(arr.y(1)).toBe(false);
  });

  it("setX / setY accept booleans", () => {
    const arr = new V2bArray(1);
    arr.setX(0, true);
    expect(arr.x(0)).toBe(true);
  });
});
