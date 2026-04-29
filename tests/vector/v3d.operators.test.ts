import { describe, it, expect } from "vitest";
import { V3d } from "../../src/vector/v3d.js";

describe("V3d — operators", () => {
  it("a + b", () => {
    expect((new V3d(1, 2, 3) + new V3d(10, 20, 30)).toArray()).toEqual([11, 22, 33]);
  });
  it("a - b, unary -", () => {
    expect((new V3d(5, 5, 5) - new V3d(1, 2, 3)).toArray()).toEqual([4, 3, 2]);
    expect((-new V3d(1, -2, 3)).toArray()).toEqual([-1, 2, -3]);
  });
  it("vec * scalar / scalar * vec", () => {
    expect((new V3d(1, 2, 3) * 2).toArray()).toEqual([2, 4, 6]);
    expect((2 * new V3d(1, 2, 3)).toArray()).toEqual([2, 4, 6]);
  });
  it("vec * vec hadamard", () => {
    expect((new V3d(1, 2, 3) * new V3d(2, 3, 4)).toArray()).toEqual([2, 6, 12]);
  });
  it("vec / scalar", () => {
    expect((new V3d(2, 4, 6) / 2).toArray()).toEqual([1, 2, 3]);
  });
  it("compound +=, *=", () => {
    let r = new V3d(1, 2, 3);
    r += new V3d(10, 20, 30);
    expect(r.toArray()).toEqual([11, 22, 33]);
    r *= 2;
    expect(r.toArray()).toEqual([22, 44, 66]);
  });
});
