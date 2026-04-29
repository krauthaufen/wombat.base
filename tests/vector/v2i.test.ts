import { describe, it, expect } from "vitest";
import { V2i } from "../../src/vector/v2i.js";

describe("V2i — smoke", () => {
  it("truncates floats toward zero on assignment", () => {
    expect(new V2i(1.9, -1.9).toArray()).toEqual([1, -1]);
  });

  it("add", () => {
    expect(new V2i(1, 2).add(new V2i(10, 20)).toArray()).toEqual([11, 22]);
  });

  it("bitAnd / shiftLeft", () => {
    expect(new V2i(7, 5).bitAnd(3).toArray()).toEqual([3, 1]);
    expect(new V2i(1, 2).shiftLeft(2).toArray()).toEqual([4, 8]);
  });

  it("crossZ", () => {
    expect(new V2i(1, 0).crossZ(new V2i(0, 1))).toBe(1);
  });

  it("equals is structural", () => {
    expect(new V2i(1, 2).equals(new V2i(1, 2))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V2i(1, 2).getHashCode()).toBe(new V2i(1, 2).getHashCode());
  });

  it("iterator yields integers", () => {
    expect([...new V2i(7, 8)]).toEqual([7, 8]);
  });
});
