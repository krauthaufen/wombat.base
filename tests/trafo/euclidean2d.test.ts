import { describe, it, expect } from "vitest";
import { Euclidean2d } from "../../src/trafo/euclidean2d.js";
import { Rot2d } from "../../src/rotation/rot2d.js";
import { V2d } from "../../src/vector/v2d.js";

describe("Euclidean2d", () => {
  const e = Euclidean2d.fromRotationAndTranslation(Rot2d.fromRadians(Math.PI / 2), new V2d(10, 20));

  it("identity leaves a point unchanged", () => {
    expect(Euclidean2d.identity.transform(new V2d(1, 2)).equals(new V2d(1, 2))).toBe(true);
  });

  it("transform applies translation; transformDir does not", () => {
    const p = e.transform(new V2d(1, 0));
    const d = e.transformDir(new V2d(1, 0));
    expect(p.approxEqual(new V2d(10, 21), 1e-12)).toBe(true);
    expect(d.approxEqual(new V2d(0, 1), 1e-12)).toBe(true);
  });

  it("inverse round-trip", () => {
    expect(e.mul(e.inverse()).approxEqual(Euclidean2d.identity, 1e-12)).toBe(true);
  });

  it("composition law", () => {
    const a = Euclidean2d.fromRotationAndTranslation(Rot2d.fromRadians(0.3), new V2d(1, 2));
    const b = Euclidean2d.fromRotationAndTranslation(Rot2d.fromRadians(-0.5), new V2d(-3, 4));
    const v = new V2d(5, 6);
    expect(a.mul(b).transform(v).approxEqual(a.transform(b.transform(v)), 1e-12)).toBe(true);
  });
});
