import { describe, it, expect } from "vitest";
import { Trafo2d } from "../../src/trafo/trafo2d.js";
import { M33d } from "../../src/matrix/m33d.js";
import { V2d } from "../../src/vector/v2d.js";

describe("Trafo2d", () => {
  const translation = (x: number, y: number) => {
    const m = M33d.copy(M33d.identity);
    m._data[2] = x;
    m._data[5] = y;
    return m;
  };

  it("identity has identity forward and backward", () => {
    expect(Trafo2d.identity.forward.approxEqual(M33d.identity, 1e-12)).toBe(true);
    expect(Trafo2d.identity.backward.approxEqual(M33d.identity, 1e-12)).toBe(true);
  });

  it("forward * backward = identity for fromMatrix", () => {
    const t = Trafo2d.fromMatrix(translation(2, -3));
    expect(t.forward.mul(t.backward).approxEqual(M33d.identity, 1e-10)).toBe(true);
  });

  it("transform applies translation; transformDir does not", () => {
    const t = Trafo2d.fromMatrix(translation(10, 20));
    expect(t.transform(new V2d(1, 2)).approxEqual(new V2d(11, 22), 1e-12)).toBe(true);
    expect(t.transformDir(new V2d(1, 2)).approxEqual(new V2d(1, 2), 1e-12)).toBe(true);
  });

  it("inverse swaps forward and backward", () => {
    const t = Trafo2d.fromMatrix(translation(1, 2));
    const inv = t.inverse();
    expect(inv.forward.equals(t.backward)).toBe(true);
    expect(inv.backward.equals(t.forward)).toBe(true);
  });

  it("composition law (Aardvark Trafo convention: a*b = do a first, then b)", () => {
    const a = Trafo2d.fromMatrix(translation(1, 0));
    const b = Trafo2d.fromMatrix(translation(0, 2));
    const v = new V2d(3, 4);
    expect(a.mul(b).transform(v).approxEqual(b.transform(a.transform(v)), 1e-12)).toBe(true);
  });

  it("equals / hash", () => {
    const a = Trafo2d.fromMatrix(translation(1, 2));
    const b = Trafo2d.fromMatrix(translation(1, 2));
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
