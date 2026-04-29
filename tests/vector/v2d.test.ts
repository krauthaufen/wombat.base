import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";

describe("V2d — smoke", () => {
  it("preserves f64 precision (not rounded to f32)", () => {
    const v = new V2d(1.1, 0);
    expect(v.x).toBe(1.1);
  });

  it("byteSize is 16", () => {
    expect(V2d.byteSize).toBe(16);
  });

  it("add", () => {
    expect(new V2d(1, 2).add(new V2d(10, 20)).toArray()).toEqual([11, 22]);
  });

  it("equals is structural", () => {
    expect(new V2d(1, 2).equals(new V2d(1, 2))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V2d(3, 4).getHashCode()).toBe(new V2d(3, 4).getHashCode());
  });

  it("iterator yields x, y", () => {
    expect([...new V2d(7, 8)]).toEqual([7, 8]);
  });
});
