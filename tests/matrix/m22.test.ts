import { describe, it, expect } from "vitest";
import { M22f } from "../../src/matrix/m22f.js";
import { M22d } from "../../src/matrix/m22d.js";
import { V2f } from "../../src/vector/v2f.js";
import { V2d } from "../../src/vector/v2d.js";

describe("M22f / M22d — smoke", () => {
  it("M22f identity / inverse / transpose", () => {
    expect(M22f.identity.determinant()).toBe(1);
    const m = M22f.diagonal(new V2f(2, 4));
    expect(m.mul(m.inverse()).approxEqual(M22f.identity, 1e-5)).toBe(true);
    expect(m.transpose().transpose().equals(m)).toBe(true);
  });

  it("M22f transform: scaling by 2 doubles V2f(1,1)", () => {
    const m = M22f.diagonal(new V2f(2, 2));
    expect(m.transform(new V2f(1, 1)).toArray()).toEqual([2, 2]);
  });

  it("M22d identity", () => {
    expect(M22d.identity.M00).toBe(1);
    const m = M22d.diagonal(new V2d(2, 4));
    expect(m.mul(m.inverse()).approxEqual(M22d.identity, 1e-12)).toBe(true);
  });
});
