import { describe, it, expect } from "vitest";
import { Scale3d } from "../../src/trafo/scale3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Scale3d", () => {
  it("identity leaves a point unchanged", () => {
    const p = new V3d(1, 2, 3);
    expect(Scale3d.identity.transform(p).equals(p)).toBe(true);
  });

  it("uniform and from factories", () => {
    expect(Scale3d.uniform(2).transform(new V3d(1, 1, 1)).equals(new V3d(2, 2, 2))).toBe(true);
    expect(Scale3d.from(new V3d(1, 2, 3)).transform(new V3d(1, 1, 1)).equals(new V3d(1, 2, 3))).toBe(true);
  });

  it("inverse round-trip", () => {
    const t = Scale3d.from(new V3d(2, 3, 5));
    expect(t.mul(t.inverse()).approxEqual(Scale3d.identity, 1e-12)).toBe(true);
  });

  it("composition law", () => {
    const a = Scale3d.from(new V3d(2, 3, 4));
    const b = Scale3d.from(new V3d(1, 0.5, 2));
    const v = new V3d(7, 8, 9);
    expect(a.mul(b).transform(v).approxEqual(a.transform(b.transform(v)), 1e-12)).toBe(true);
  });

  it("equals / hash determinism", () => {
    const a = Scale3d.from(new V3d(2, 3, 4));
    const b = Scale3d.from(new V3d(2, 3, 4));
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
