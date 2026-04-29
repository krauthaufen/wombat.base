import { describe, it, expect } from "vitest";
import { Similarity3d } from "../../src/trafo/similarity3d.js";
import { Euclidean3d } from "../../src/trafo/euclidean3d.js";
import { Rot3d } from "../../src/rotation/rot3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Similarity3d", () => {
  const e = Euclidean3d.fromRotationAndTranslation(
    Rot3d.fromAxisAngle(V3d.unitZ, Math.PI / 2),
    new V3d(1, 2, 3),
  );
  const s = Similarity3d.fromEuclideanAndScale(e, 2);

  it("identity leaves a point unchanged", () => {
    expect(Similarity3d.identity.transform(new V3d(4, 5, 6)).equals(new V3d(4, 5, 6))).toBe(true);
  });

  it("transformDir applies scale and rotation but no translation", () => {
    const d = s.transformDir(new V3d(1, 0, 0));
    // scale 2, then rotate unitX by 90° about Z = (0, 2, 0)
    expect(d.approxEqual(new V3d(0, 2, 0), 1e-12)).toBe(true);
  });

  it("inverse round-trip", () => {
    expect(s.mul(s.inverse()).approxEqual(Similarity3d.identity, 1e-10)).toBe(true);
    expect(s.inverse().mul(s).approxEqual(Similarity3d.identity, 1e-10)).toBe(true);
  });

  it("composition law", () => {
    const b = Similarity3d.fromEuclideanAndScale(
      Euclidean3d.fromRotationAndTranslation(Rot3d.fromAxisAngle(V3d.unitY, 0.3), new V3d(-1, 2, -3)),
      0.5,
    );
    const v = new V3d(7, 8, 9);
    expect(s.mul(b).transform(v).approxEqual(s.transform(b.transform(v)), 1e-10)).toBe(true);
  });

  it("equals / hash", () => {
    const s2 = Similarity3d.fromEuclideanAndScale(e, 2);
    expect(s.equals(s2)).toBe(true);
    expect(s.getHashCode()).toBe(s2.getHashCode());
  });
});
