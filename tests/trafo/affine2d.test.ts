import { describe, it, expect } from "vitest";
import { Affine2d } from "../../src/trafo/affine2d.js";
import { M22d } from "../../src/matrix/m22d.js";
import { V2d } from "../../src/vector/v2d.js";

describe("Affine2d", () => {
  const linear = M22d.fromArray([2, 0, 0, 3]);
  const trans = new V2d(1, 2);
  const a = Affine2d.fromLinearAndTranslation(linear, trans);

  it("identity leaves a point unchanged", () => {
    expect(Affine2d.identity.transform(new V2d(1, 2)).equals(new V2d(1, 2))).toBe(true);
  });

  it("transform applies translation; transformDir does not", () => {
    expect(a.transform(new V2d(1, 1)).equals(new V2d(3, 5))).toBe(true);
    expect(a.transformDir(new V2d(1, 1)).equals(new V2d(2, 3))).toBe(true);
  });

  it("inverse round-trip", () => {
    expect(a.mul(a.inverse()).approxEqual(Affine2d.identity, 1e-10)).toBe(true);
  });

  it("composition law", () => {
    const b = Affine2d.fromLinearAndTranslation(M22d.fromArray([1, 2, 0, 1]), new V2d(-1, 1));
    const v = new V2d(5, 6);
    expect(a.mul(b).transform(v).approxEqual(a.transform(b.transform(v)), 1e-10)).toBe(true);
  });
});
