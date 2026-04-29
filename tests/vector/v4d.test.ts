import { describe, it, expect } from "vitest";
import { V4d } from "../../src/vector/v4d.js";

describe("V4d — smoke", () => {
  it("preserves f64 precision", () => {
    expect(new V4d(1.1, 0, 0, 0).x).toBe(1.1);
  });

  it("byteSize is 32", () => {
    expect(V4d.byteSize).toBe(32);
  });

  it("unitW", () => {
    expect(V4d.unitW.toArray()).toEqual([0, 0, 0, 1]);
  });

  it("add", () => {
    expect(new V4d(1, 2, 3, 4).add(V4d.one).toArray()).toEqual([2, 3, 4, 5]);
  });

  it("equals is structural", () => {
    expect(new V4d(1, 2, 3, 4).equals(new V4d(1, 2, 3, 4))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V4d(1, 2, 3, 4).getHashCode()).toBe(new V4d(1, 2, 3, 4).getHashCode());
  });

  it("iterator length 4", () => {
    expect([...new V4d(1, 2, 3, 4)]).toEqual([1, 2, 3, 4]);
  });
});
