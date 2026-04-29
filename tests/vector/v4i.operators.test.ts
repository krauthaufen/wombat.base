import { describe, it, expect } from "vitest";
import { V4i } from "../../src/vector/v4i.js";
import { V3ui } from "../../src/vector/v3ui.js";

describe("V4i — operators (signed integer)", () => {
  it("basic ops", () => {
    expect((new V4i(1, 2, 3, 4) + new V4i(10, 20, 30, 40)).toArray()).toEqual([11, 22, 33, 44]);
    expect((-new V4i(1, -2, 3, -4)).toArray()).toEqual([-1, 2, -3, 4]);
    expect((new V4i(1, 2, 3, 4) * 2).toArray()).toEqual([2, 4, 6, 8]);
    expect((2 * new V4i(1, 2, 3, 4)).toArray()).toEqual([2, 4, 6, 8]);
  });
});

describe("V3ui — operators (unsigned: no unary -)", () => {
  it("binary subtraction works", () => {
    expect((new V3ui(10, 20, 30) - new V3ui(1, 2, 3)).toArray()).toEqual([9, 18, 27]);
  });
  it("scalar mul commutative", () => {
    expect((new V3ui(1, 2, 3) * 2).toArray()).toEqual([2, 4, 6]);
    expect((2 * new V3ui(1, 2, 3)).toArray()).toEqual([2, 4, 6]);
  });
});
