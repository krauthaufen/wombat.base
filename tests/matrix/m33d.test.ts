import { describe, it, expect } from "vitest";
import { M33d } from "../../src/matrix/m33d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("M33d", () => {
  it("identity", () => {
    expect(M33d.identity.M00).toBe(1);
  });

  it("preserves f64 precision", () => {
    const m = new M33d();
    m.M00 = 1.1;
    expect(m.M00).toBe(1.1);
  });

  it("rotationZ via fromRotationAxisAngle: unitX -> unitY", () => {
    const m = M33d.fromRotationAxisAngle(V3d.unitZ, Math.PI / 2);
    const r = m.transform(V3d.unitX);
    expect(r.x).toBeCloseTo(0, 12);
    expect(r.y).toBeCloseTo(1, 12);
  });

  it("inverse round-trip", () => {
    const m = M33d.diagonal(new V3d(2, 3, 4));
    expect(m.mul(m.inverse()).approxEqual(M33d.identity, 1e-12)).toBe(true);
  });

  it("transpose round-trip", () => {
    const m = M33d.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(m.transpose().transpose().equals(m)).toBe(true);
  });

  it("determinant of identity is 1", () => {
    expect(M33d.identity.determinant()).toBe(1);
  });

  it("Symbol.iterator yields row-major order", () => {
    const m = M33d.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...m]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("equals + hashCode determinism", () => {
    const a = M33d.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const b = M33d.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
