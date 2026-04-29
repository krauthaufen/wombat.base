import { describe, it, expect } from "vitest";
import { Similarity2d } from "../../src/trafo/similarity2d.js";
import { Euclidean2d } from "../../src/trafo/euclidean2d.js";
import { Rot2d } from "../../src/rotation/rot2d.js";
import { V2d } from "../../src/vector/v2d.js";

describe("Similarity2d", () => {
  const e = Euclidean2d.fromRotationAndTranslation(Rot2d.fromRadians(Math.PI / 2), new V2d(1, 2));
  const s = Similarity2d.fromEuclideanAndScale(e, 2);

  it("identity leaves a point unchanged", () => {
    expect(Similarity2d.identity.transform(new V2d(3, 4)).equals(new V2d(3, 4))).toBe(true);
  });

  it("transformDir applies scale + rotation, no translation", () => {
    const d = s.transformDir(new V2d(1, 0));
    expect(d.approxEqual(new V2d(0, 2), 1e-12)).toBe(true);
  });

  it("inverse round-trip", () => {
    expect(s.mul(s.inverse()).approxEqual(Similarity2d.identity, 1e-10)).toBe(true);
  });

  it("composition law", () => {
    const b = Similarity2d.fromEuclideanAndScale(
      Euclidean2d.fromRotationAndTranslation(Rot2d.fromRadians(-0.3), new V2d(-1, 1)),
      0.5,
    );
    const v = new V2d(7, 8);
    expect(s.mul(b).transform(v).approxEqual(s.transform(b.transform(v)), 1e-10)).toBe(true);
  });
});
