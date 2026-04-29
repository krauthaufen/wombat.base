import { describe, it, expect } from "vitest";
import { Affine3d } from "../../src/trafo/affine3d.js";
import { M33d } from "../../src/matrix/m33d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Affine3d", () => {
  const linear = M33d.fromArray([2, 0, 0, 0, 3, 0, 0, 0, 5]);
  const trans = new V3d(1, 2, 3);
  const a = Affine3d.fromLinearAndTranslation(linear, trans);

  it("identity leaves a point unchanged", () => {
    expect(Affine3d.identity.transform(new V3d(1, 2, 3)).equals(new V3d(1, 2, 3))).toBe(true);
  });

  it("transformDir does not apply translation", () => {
    expect(a.transformDir(new V3d(1, 1, 1)).equals(new V3d(2, 3, 5))).toBe(true);
    expect(a.transform(new V3d(1, 1, 1)).equals(new V3d(3, 5, 8))).toBe(true);
  });

  it("inverse round-trip", () => {
    expect(a.mul(a.inverse()).approxEqual(Affine3d.identity, 1e-10)).toBe(true);
  });

  it("composition law", () => {
    const linB = M33d.fromArray([1, 2, 0, 0, 1, 0, 0, 0, 1]);
    const b = Affine3d.fromLinearAndTranslation(linB, new V3d(-1, 0, 1));
    const v = new V3d(7, 8, 9);
    expect(a.mul(b).transform(v).approxEqual(a.transform(b.transform(v)), 1e-10)).toBe(true);
  });

  it("equals / hash", () => {
    const a2 = Affine3d.fromLinearAndTranslation(linear, trans);
    expect(a.equals(a2)).toBe(true);
    expect(a.getHashCode()).toBe(a2.getHashCode());
  });
});
