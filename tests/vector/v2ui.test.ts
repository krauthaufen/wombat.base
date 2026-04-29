import { describe, it, expect } from "vitest";
import { V2ui } from "../../src/vector/v2ui.js";

describe("V2ui — smoke", () => {
  it("truncates floats toward zero on assignment", () => {
    expect(new V2ui(1.9, 2.7).toArray()).toEqual([1, 2]);
  });

  it("negative input wraps modulo 2^32", () => {
    expect(new V2ui(-1, 0).x).toBe(0xffffffff);
  });

  it("add", () => {
    expect(new V2ui(1, 2).add(new V2ui(10, 20)).toArray()).toEqual([11, 22]);
  });

  it("bitAnd", () => {
    expect(new V2ui(7, 5).bitAnd(3).toArray()).toEqual([3, 1]);
  });

  it("equals is structural", () => {
    expect(new V2ui(1, 2).equals(new V2ui(1, 2))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V2ui(1, 2).getHashCode()).toBe(new V2ui(1, 2).getHashCode());
  });

  it("iterator yields integers", () => {
    expect([...new V2ui(7, 8)]).toEqual([7, 8]);
  });
});
