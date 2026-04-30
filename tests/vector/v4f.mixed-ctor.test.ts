// V4f / V3f mixed-arg constructor forms — `new V4f(v3, w)`,
// `new V3f(v2, z)`, etc. Mirrors GLSL/WGSL `vec4(...)` promotion.

import { describe, expect, it } from "vitest";
import { V2f, V3f, V4f } from "../../src/index.js";

describe("V4f mixed-arg constructors", () => {
  it("V4f(x,y,z,w) — four scalars", () => {
    const v = new V4f(1, 2, 3, 4);
    expect(v.x).toBe(1); expect(v.y).toBe(2);
    expect(v.z).toBe(3); expect(v.w).toBe(4);
  });

  it("V4f(v3, w) — V3f + scalar", () => {
    const v = new V4f(new V3f(1, 2, 3), 4);
    expect([v.x, v.y, v.z, v.w]).toEqual([1, 2, 3, 4]);
  });

  it("V4f(x, v3) — scalar + V3f", () => {
    const v = new V4f(1, new V3f(2, 3, 4));
    expect([v.x, v.y, v.z, v.w]).toEqual([1, 2, 3, 4]);
  });

  it("V4f(v2, z, w) — V2f + 2 scalars", () => {
    const v = new V4f(new V2f(1, 2), 3, 4);
    expect([v.x, v.y, v.z, v.w]).toEqual([1, 2, 3, 4]);
  });

  it("V4f(x, v2, w) — scalar + V2f + scalar", () => {
    const v = new V4f(1, new V2f(2, 3), 4);
    expect([v.x, v.y, v.z, v.w]).toEqual([1, 2, 3, 4]);
  });

  it("V4f(x, y, v2) — 2 scalars + V2f", () => {
    const v = new V4f(1, 2, new V2f(3, 4));
    expect([v.x, v.y, v.z, v.w]).toEqual([1, 2, 3, 4]);
  });

  it("V4f(v2a, v2b) — two V2fs", () => {
    const v = new V4f(new V2f(1, 2), new V2f(3, 4));
    expect([v.x, v.y, v.z, v.w]).toEqual([1, 2, 3, 4]);
  });

  it("V4f() — all zeros", () => {
    const v = new V4f();
    expect([v.x, v.y, v.z, v.w]).toEqual([0, 0, 0, 0]);
  });
});

describe("V3f mixed-arg constructors", () => {
  it("V3f(x, y, z) — three scalars", () => {
    const v = new V3f(1, 2, 3);
    expect([v.x, v.y, v.z]).toEqual([1, 2, 3]);
  });

  it("V3f(v2, z) — V2f + scalar", () => {
    const v = new V3f(new V2f(1, 2), 3);
    expect([v.x, v.y, v.z]).toEqual([1, 2, 3]);
  });

  it("V3f(x, v2) — scalar + V2f", () => {
    const v = new V3f(1, new V2f(2, 3));
    expect([v.x, v.y, v.z]).toEqual([1, 2, 3]);
  });

  it("V3f() — all zeros", () => {
    const v = new V3f();
    expect([v.x, v.y, v.z]).toEqual([0, 0, 0]);
  });
});
