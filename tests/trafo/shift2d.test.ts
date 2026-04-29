import { describe, it, expect } from "vitest";
import { Shift2d } from "../../src/trafo/shift2d.js";
import { V2d } from "../../src/vector/v2d.js";

describe("Shift2d", () => {
  it("identity leaves a point unchanged", () => {
    expect(Shift2d.identity.transform(new V2d(1, 2)).equals(new V2d(1, 2))).toBe(true);
  });

  it("transform applies offset; transformDir does not", () => {
    const t = Shift2d.translation(new V2d(10, 20));
    expect(t.transform(new V2d(1, 2)).equals(new V2d(11, 22))).toBe(true);
    expect(t.transformDir(new V2d(1, 2)).equals(new V2d(1, 2))).toBe(true);
  });

  it("inverse round-trip", () => {
    const t = new Shift2d(new V2d(3, -1));
    expect(t.mul(t.inverse()).approxEqual(Shift2d.identity, 1e-12)).toBe(true);
  });

  it("composition law", () => {
    const a = new Shift2d(new V2d(1, 2));
    const b = new Shift2d(new V2d(-4, 5));
    const v = new V2d(7, 8);
    expect(a.mul(b).transform(v).approxEqual(a.transform(b.transform(v)), 1e-12)).toBe(true);
  });
});
