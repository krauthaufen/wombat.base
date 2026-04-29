import { describe, it, expect } from "vitest";
import { Shift3d } from "../../src/trafo/shift3d.js";
import { V3d } from "../../src/vector/v3d.js";
import { M44d } from "../../src/matrix/m44d.js";

describe("Shift3d", () => {
  it("identity leaves a point unchanged", () => {
    const p = new V3d(1, 2, 3);
    expect(Shift3d.identity.transform(p).equals(p)).toBe(true);
  });

  it("transform applies offset; transformDir does not", () => {
    const t = Shift3d.translation(new V3d(10, 20, 30));
    expect(t.transform(new V3d(1, 2, 3)).equals(new V3d(11, 22, 33))).toBe(true);
    expect(t.transformDir(new V3d(1, 2, 3)).equals(new V3d(1, 2, 3))).toBe(true);
  });

  it("inverse round-trip", () => {
    const t = new Shift3d(new V3d(3, -1, 7));
    expect(t.mul(t.inverse()).approxEqual(Shift3d.identity, 1e-12)).toBe(true);
  });

  it("composition law", () => {
    const a = new Shift3d(new V3d(1, 2, 3));
    const b = new Shift3d(new V3d(-4, 5, -6));
    const v = new V3d(7, 8, 9);
    expect(a.mul(b).transform(v).approxEqual(a.transform(b.transform(v)), 1e-12)).toBe(true);
  });

  it("toMatrix matches M44d.translation", () => {
    const t = new Shift3d(new V3d(1, 2, 3));
    expect(t.toMatrix().approxEqual(M44d.translation(new V3d(1, 2, 3)), 1e-12)).toBe(true);
  });

  it("equals and hashCode are deterministic", () => {
    const a = new Shift3d(new V3d(1, 2, 3));
    const b = new Shift3d(new V3d(1, 2, 3));
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
