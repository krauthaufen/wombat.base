import { describe, it, expect } from "vitest";
import { V3i } from "../../src/vector/v3i.js";

describe("V3i — smoke", () => {
  it("truncates floats toward zero on assignment", () => {
    expect(new V3i(1.9, -1.9, 2.5).toArray()).toEqual([1, -1, 2]);
  });

  it("add", () => {
    expect(new V3i(1, 2, 3).add(V3i.one).toArray()).toEqual([2, 3, 4]);
  });

  it("cross of unit X and Y is unit Z", () => {
    expect(V3i.unitX.cross(V3i.unitY).equals(V3i.unitZ)).toBe(true);
  });

  it("bitOr scalar", () => {
    expect(new V3i(1, 2, 4).bitOr(8).toArray()).toEqual([9, 10, 12]);
  });

  it("equals is structural", () => {
    expect(new V3i(1, 2, 3).equals(new V3i(1, 2, 3))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V3i(1, 2, 3).getHashCode()).toBe(new V3i(1, 2, 3).getHashCode());
  });

  it("iterator yields integers", () => {
    expect([...new V3i(7, 8, 9)]).toEqual([7, 8, 9]);
  });
});
