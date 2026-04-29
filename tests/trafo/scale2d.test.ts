import { describe, it, expect } from "vitest";
import { Scale2d } from "../../src/trafo/scale2d.js";
import { V2d } from "../../src/vector/v2d.js";

describe("Scale2d", () => {
  it("identity leaves a point unchanged", () => {
    expect(Scale2d.identity.transform(new V2d(1, 2)).equals(new V2d(1, 2))).toBe(true);
  });

  it("uniform / from factories", () => {
    expect(Scale2d.uniform(3).transform(new V2d(1, 1)).equals(new V2d(3, 3))).toBe(true);
    expect(Scale2d.from(new V2d(2, 5)).transform(new V2d(1, 1)).equals(new V2d(2, 5))).toBe(true);
  });

  it("inverse round-trip", () => {
    const t = Scale2d.from(new V2d(2, 3));
    expect(t.mul(t.inverse()).approxEqual(Scale2d.identity, 1e-12)).toBe(true);
  });

  it("composition law", () => {
    const a = Scale2d.from(new V2d(2, 3));
    const b = Scale2d.from(new V2d(0.5, 4));
    const v = new V2d(7, 8);
    expect(a.mul(b).transform(v).approxEqual(a.transform(b.transform(v)), 1e-12)).toBe(true);
  });
});
