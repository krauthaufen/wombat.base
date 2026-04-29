import { describe, it, expect } from "vitest";
import { V3d } from "../../src/vector/v3d.js";

describe("V3d — smoke", () => {
  it("preserves f64 precision", () => {
    expect(new V3d(1.1, 0, 0).x).toBe(1.1);
  });

  it("byteSize is 24", () => {
    expect(V3d.byteSize).toBe(24);
  });

  it("cross of unit X and Y is unit Z", () => {
    expect(V3d.unitX.cross(V3d.unitY).equals(V3d.unitZ)).toBe(true);
  });

  it("add", () => {
    expect(new V3d(1, 2, 3).add(V3d.one).toArray()).toEqual([2, 3, 4]);
  });

  it("equals is structural", () => {
    expect(new V3d(1, 2, 3).equals(new V3d(1, 2, 3))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V3d(1, 2, 3).getHashCode()).toBe(new V3d(1, 2, 3).getHashCode());
  });

  it("iterator length 3", () => {
    expect([...new V3d(7, 8, 9)]).toEqual([7, 8, 9]);
  });
});
