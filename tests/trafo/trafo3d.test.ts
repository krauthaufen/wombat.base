import { describe, it, expect } from "vitest";
import { Trafo3d } from "../../src/trafo/trafo3d.js";
import { M44d } from "../../src/matrix/m44d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Trafo3d", () => {
  it("identity has identity forward and backward", () => {
    expect(Trafo3d.identity.forward.approxEqual(M44d.identity, 1e-12)).toBe(true);
    expect(Trafo3d.identity.backward.approxEqual(M44d.identity, 1e-12)).toBe(true);
  });

  it("forward * backward = identity for fromMatrix", () => {
    const m = M44d.translation(new V3d(2, -3, 4)).mul(M44d.rotationY(0.7));
    const t = Trafo3d.fromMatrix(m);
    expect(t.forward.mul(t.backward).approxEqual(M44d.identity, 1e-10)).toBe(true);
  });

  it("transform applies translation; transformDir does not", () => {
    const t = Trafo3d.fromMatrix(M44d.translation(new V3d(10, 20, 30)));
    expect(t.transform(new V3d(1, 2, 3)).equals(new V3d(11, 22, 33))).toBe(true);
    expect(t.transformDir(new V3d(1, 2, 3)).equals(new V3d(1, 2, 3))).toBe(true);
  });

  it("inverse swaps forward and backward (O(1))", () => {
    const t = Trafo3d.fromMatrix(M44d.translation(new V3d(1, 2, 3)));
    const inv = t.inverse();
    expect(inv.forward.equals(t.backward)).toBe(true);
    expect(inv.backward.equals(t.forward)).toBe(true);
  });

  it("inverse round-trip", () => {
    const t = Trafo3d.fromMatrix(M44d.translation(new V3d(1, 2, 3)).mul(M44d.rotationZ(0.4)));
    expect(t.mul(t.inverse()).forward.approxEqual(M44d.identity, 1e-10)).toBe(true);
  });

  it("composition law (Aardvark Trafo convention: a*b = do a first, then b)", () => {
    const a = Trafo3d.fromMatrix(M44d.rotationX(0.6));
    const b = Trafo3d.fromMatrix(M44d.translation(new V3d(1, 2, 3)));
    const v = new V3d(4, 5, 6);
    expect(a.mul(b).transform(v).approxEqual(b.transform(a.transform(v)), 1e-10)).toBe(true);
  });

  it("then is an alias for mul (both read 'do this first, then other')", () => {
    const a = Trafo3d.fromMatrix(M44d.rotationX(0.4));
    const b = Trafo3d.fromMatrix(M44d.translation(new V3d(2, 0, 0)));
    expect(a.then(b).forward.approxEqual(a.mul(b).forward, 1e-12)).toBe(true);
  });

  it("inverseTransform uses backward", () => {
    const t = Trafo3d.fromMatrix(M44d.translation(new V3d(5, 5, 5)));
    const p = new V3d(1, 2, 3);
    expect(t.inverseTransform(t.transform(p)).approxEqual(p, 1e-10)).toBe(true);
  });

  it("equals / hash", () => {
    const a = Trafo3d.fromMatrix(M44d.translation(new V3d(1, 2, 3)));
    const b = Trafo3d.fromMatrix(M44d.translation(new V3d(1, 2, 3)));
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
