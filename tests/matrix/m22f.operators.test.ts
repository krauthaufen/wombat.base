import { describe, it, expect } from "vitest";
import { M22f } from "../../src/matrix/m22f.js";
import { V2f } from "../../src/vector/v2f.js";

describe("M22f — operators", () => {
  it("+, -, unary -", () => {
    const a = M22f.identity;
    const b = M22f.identity;
    const r = a + b;
    expect(r.M00).toBe(2);
    expect((-M22f.identity).M00).toBe(-1);
  });
  it("scalar mul, both sides", () => {
    expect((M22f.identity * 3).M00).toBe(3);
    expect((3 * M22f.identity).M00).toBe(3);
  });
  it("matrix * vector", () => {
    const m = M22f.fromRows([new V2f(1, 2), new V2f(3, 4)]);
    const v = new V2f(1, 1);
    const r = m * v;
    expect(r.toArray()).toEqual([3, 7]);
  });
  it("matrix * matrix", () => {
    const r = M22f.identity * M22f.identity;
    expect(r.M00).toBe(1);
  });
});
