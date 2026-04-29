// Operator-plugin smoke tests for M44f. Mirrors v3f.operators.test.ts.

import { describe, it, expect } from "vitest";
import { M44f } from "../../src/matrix/m44f.js";
import { V3f } from "../../src/vector/v3f.js";
import { V4f } from "../../src/vector/v4f.js";

describe("M44f — operators (transformer-driven)", () => {
  it("a + b", () => {
    const a = M44f.identity;
    const b = M44f.identity;
    const r = a + b;
    expect(r.M00).toBe(2);
  });

  it("a - b", () => {
    const r = M44f.identity - M44f.identity;
    expect(r.M00).toBe(0);
  });

  it("scalar * matrix (commutative)", () => {
    const r = 2 * M44f.identity;
    expect(r.M00).toBe(2);
  });

  it("matrix * scalar", () => {
    const r = M44f.identity * 3;
    expect(r.M00).toBe(3);
  });

  it("matrix * vector (M44f * V4f)", () => {
    const m = M44f.translation(new V3f(10, 20, 30));
    const v = new V4f(1, 2, 3, 1);
    const r = m * v;
    expect(r.toArray()).toEqual([11, 22, 33, 1]);
  });

  it("matrix * matrix", () => {
    const a = M44f.translation(new V3f(1, 0, 0));
    const b = M44f.translation(new V3f(0, 1, 0));
    const c = a * b;
    expect(c.M03).toBe(1);
    expect(c.M13).toBe(1);
  });

  it("unary -m", () => {
    const m = -M44f.identity;
    expect(m.M00).toBe(-1);
  });

  it("compound +=", () => {
    let m = M44f.identity;
    m += M44f.identity;
    expect(m.M00).toBe(2);
  });
});
