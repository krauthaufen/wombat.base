import { describe, it, expect } from "vitest";
import { V3ui } from "../../src/vector/v3ui.js";

describe("V3ui — smoke", () => {
  it("truncates floats toward zero on assignment", () => {
    expect(new V3ui(1.9, 2.7, 3.1).toArray()).toEqual([1, 2, 3]);
  });

  it("negative input wraps modulo 2^32", () => {
    expect(new V3ui(-1, 0, 0).x).toBe(0xffffffff);
  });

  it("add", () => {
    expect(new V3ui(1, 2, 3).add(V3ui.one).toArray()).toEqual([2, 3, 4]);
  });

  it("cross of unit X and Y is unit Z", () => {
    expect(V3ui.unitX.cross(V3ui.unitY).equals(V3ui.unitZ)).toBe(true);
  });

  it("equals is structural", () => {
    expect(new V3ui(1, 2, 3).equals(new V3ui(1, 2, 3))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V3ui(1, 2, 3).getHashCode()).toBe(new V3ui(1, 2, 3).getHashCode());
  });

  it("iterator yields integers", () => {
    expect([...new V3ui(7, 8, 9)]).toEqual([7, 8, 9]);
  });
});
