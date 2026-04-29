import { describe, it, expect } from "vitest";
import { V2f } from "../../src/vector/v2f.js";

describe("V2f — operators", () => {
  it("+, -, unary -", () => {
    expect((new V2f(1, 2) + new V2f(3, 4)).toArray()).toEqual([4, 6]);
    expect((new V2f(5, 5) - new V2f(1, 2)).toArray()).toEqual([4, 3]);
    expect((-new V2f(1, -2)).toArray()).toEqual([-1, 2]);
  });
  it("scalar mul commutative, hadamard", () => {
    expect((new V2f(1, 2) * 3).toArray()).toEqual([3, 6]);
    expect((3 * new V2f(1, 2)).toArray()).toEqual([3, 6]);
    expect((new V2f(1, 2) * new V2f(3, 4)).toArray()).toEqual([3, 8]);
  });
  it("compound", () => {
    let r = new V2f(1, 2);
    r += new V2f(10, 20);
    r *= 2;
    expect(r.toArray()).toEqual([22, 44]);
  });
});
