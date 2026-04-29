// End-to-end test that the operator transformer is wired correctly.
// Each `it` body uses operators that ts-patch+@aardworx/aardvark-operators
// must rewrite into method calls before vitest runs them. If the
// plugin isn't active these tests fail at compile time (V3f doesn't
// support `+` natively) — so seeing them green confirms the toolchain
// is working end-to-end.

import { describe, it, expect } from "vitest";
import { V3f } from "../../src/vector/v3f.js";

describe("V3f — operators (transformer-driven)", () => {
  it("a + b", () => {
    const a = new V3f(1, 2, 3);
    const b = new V3f(10, 20, 30);
    const r = a + b;
    expect(r.toArray()).toEqual([11, 22, 33]);
  });

  it("a - b", () => {
    const r = new V3f(10, 20, 30) - new V3f(1, 2, 3);
    expect(r.toArray()).toEqual([9, 18, 27]);
  });

  it("vec * scalar", () => {
    const r = new V3f(1, 2, 3) * 2;
    expect(r.toArray()).toEqual([2, 4, 6]);
  });

  it("scalar * vec (commutative)", () => {
    const r = 2 * new V3f(1, 2, 3);
    expect(r.toArray()).toEqual([2, 4, 6]);
  });

  it("vec * vec (Hadamard)", () => {
    const r = new V3f(1, 2, 3) * new V3f(2, 3, 4);
    expect(r.toArray()).toEqual([2, 6, 12]);
  });

  it("vec / scalar", () => {
    const r = new V3f(2, 4, 6) / 2;
    expect(r.toArray()).toEqual([1, 2, 3]);
  });

  it("unary -v", () => {
    const r = -new V3f(1, -2, 3);
    expect(r.toArray()).toEqual([-1, 2, -3]);
  });

  it("chained: a + b * 2 - c", () => {
    const a = new V3f(1, 0, 0);
    const b = new V3f(2, 0, 0);
    const c = new V3f(0, 0, 1);
    const r = a + b * 2 - c;
    expect(r.toArray()).toEqual([5, 0, -1]);
  });

  it("parenthesised: (a + b) * 2 + c", () => {
    const a = new V3f(1, 0, 0);
    const b = new V3f(2, 0, 0);
    const c = new V3f(0, 0, 1);
    const r = (a + b) * 2 + c;
    expect(r.toArray()).toEqual([6, 0, 1]);
  });

  it("compound +=", () => {
    let r = new V3f(1, 2, 3);
    r += new V3f(10, 20, 30);
    expect(r.toArray()).toEqual([11, 22, 33]);
  });

  it("compound *= scalar", () => {
    let r = new V3f(1, 2, 3);
    r *= 2;
    expect(r.toArray()).toEqual([2, 4, 6]);
  });

  it("real algebra reads naturally", () => {
    // Reflect a vector across a plane normal.
    const v = new V3f(1, 1, 0);
    const n = new V3f(0, 1, 0);
    // r = v - 2 * (v·n) * n
    const r = v - 2 * v.dot(n) * n;
    expect(r.equals(new V3f(1, -1, 0))).toBe(true);
  });
});
