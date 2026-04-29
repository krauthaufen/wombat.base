import { describe, it, expect } from "vitest";
import { V4ui } from "../../src/vector/v4ui.js";

describe("V4ui — smoke", () => {
  it("truncates floats toward zero on assignment", () => {
    expect(new V4ui(1.9, 2.7, 3.1, 4.5).toArray()).toEqual([1, 2, 3, 4]);
  });

  it("negative input wraps modulo 2^32", () => {
    expect(new V4ui(-1, 0, 0, 0).x).toBe(0xffffffff);
  });

  it("add", () => {
    expect(new V4ui(1, 2, 3, 4).add(V4ui.one).toArray()).toEqual([2, 3, 4, 5]);
  });

  it("bitOr scalar", () => {
    expect(new V4ui(1, 2, 4, 8).bitOr(0x10).toArray()).toEqual([0x11, 0x12, 0x14, 0x18]);
  });

  it("equals is structural", () => {
    expect(new V4ui(1, 2, 3, 4).equals(new V4ui(1, 2, 3, 4))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V4ui(1, 2, 3, 4).getHashCode()).toBe(new V4ui(1, 2, 3, 4).getHashCode());
  });

  it("iterator length 4", () => {
    expect([...new V4ui(7, 8, 9, 10)]).toEqual([7, 8, 9, 10]);
  });
});
