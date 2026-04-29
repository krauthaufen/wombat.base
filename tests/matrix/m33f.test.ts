import { describe, it, expect } from "vitest";
import { M33f } from "../../src/matrix/m33f.js";
import { V3f } from "../../src/vector/v3f.js";

describe("M33f", () => {
  it("identity / row-major layout", () => {
    expect(M33f.identity.M00).toBe(1);
    expect(M33f.identity.M11).toBe(1);
    expect(M33f.identity.M22).toBe(1);
    const m = new M33f();
    m.M01 = 7;
    expect(m._data[1]).toBe(7); // row 0, col 1 = r*3+c = 1
  });

  it("setters round to f32", () => {
    const m = new M33f();
    m.M00 = 1.1;
    expect(m.M00).toBe(Math.fround(1.1));
  });

  it("fromRows / fromCols / fromArray match", () => {
    const a = M33f.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // row-major: row 0 = [1,2,3], col 0 = [1,4,7]
    expect(a.row(0).toArray()).toEqual([1, 2, 3]);
    expect(a.col(0).toArray()).toEqual([1, 4, 7]);
    const fromRows = M33f.fromRows([new V3f(1, 2, 3), new V3f(4, 5, 6), new V3f(7, 8, 9)]);
    expect(fromRows.equals(a)).toBe(true);
  });

  it("rotationZ via fromRotationAxisAngle: unitX -> unitY", () => {
    const m = M33f.fromRotationAxisAngle(V3f.unitZ, Math.PI / 2);
    const r = m.transform(V3f.unitX);
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.y).toBeCloseTo(1, 5);
    expect(r.z).toBeCloseTo(0, 5);
  });

  it("matrix mul: identity * m == m", () => {
    const m = M33f.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(M33f.identity.mul(m).equals(m)).toBe(true);
  });

  it("scalar mul", () => {
    expect(M33f.identity.mul(2).M00).toBe(2);
  });

  it("transpose round-trip", () => {
    const m = M33f.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(m.transpose().transpose().equals(m)).toBe(true);
  });

  it("determinant of identity is 1", () => {
    expect(M33f.identity.determinant()).toBe(1);
  });

  it("inverse of identity is identity", () => {
    expect(M33f.identity.inverse().equals(M33f.identity)).toBe(true);
  });

  it("inverse round-trip on a known invertible matrix", () => {
    const m = M33f.diagonal(new V3f(2, 3, 4));
    expect(m.mul(m.inverse()).approxEqual(M33f.identity, 1e-5)).toBe(true);
  });

  it("equals + hashCode determinism", () => {
    const a = M33f.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const b = M33f.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });

  it("Symbol.iterator yields row-major order", () => {
    const m = M33f.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...m]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
