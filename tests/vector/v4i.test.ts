import { describe, it, expect } from "vitest";
import { V4i } from "../../src/vector/v4i.js";

describe("V4i — smoke", () => {
  it("truncates floats toward zero on assignment", () => {
    expect(new V4i(1.9, -1.9, 2.5, -3.7).toArray()).toEqual([1, -1, 2, -3]);
  });

  it("add", () => {
    expect(new V4i(1, 2, 3, 4).add(V4i.one).toArray()).toEqual([2, 3, 4, 5]);
  });

  it("bitXor", () => {
    expect(new V4i(1, 2, 3, 4).bitXor(new V4i(1, 1, 1, 1)).toArray()).toEqual([0, 3, 2, 5]);
  });

  it("equals is structural", () => {
    expect(new V4i(1, 2, 3, 4).equals(new V4i(1, 2, 3, 4))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V4i(1, 2, 3, 4).getHashCode()).toBe(new V4i(1, 2, 3, 4).getHashCode());
  });

  it("iterator length 4", () => {
    expect([...new V4i(7, 8, 9, 10)]).toEqual([7, 8, 9, 10]);
  });
});
