import { describe, it, expect } from "vitest";
import { M44f } from "../../src/matrix/m44f.js";
import { V3f } from "../../src/vector/v3f.js";
import { V4f } from "../../src/vector/v4f.js";

describe("M44f — construction", () => {
  it("default constructor is zero", () => {
    const m = new M44f();
    expect(m.toArray()).toEqual(new Array(16).fill(0));
  });

  it("identity has 1s on the diagonal", () => {
    const m = M44f.identity;
    expect(m.M00).toBe(1);
    expect(m.M11).toBe(1);
    expect(m.M22).toBe(1);
    expect(m.M33).toBe(1);
    expect(m.M01).toBe(0);
    expect(m.M30).toBe(0);
  });

  it("fromRows / fromCols / fromArray are consistent", () => {
    const a = M44f.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    // row-major: row 0 is [1,2,3,4]
    expect(a.row(0).toArray()).toEqual([1, 2, 3, 4]);
    expect(a.col(0).toArray()).toEqual([1, 5, 9, 13]);

    const fromRows = M44f.fromRows([
      new V4f(1, 2, 3, 4),
      new V4f(5, 6, 7, 8),
      new V4f(9, 10, 11, 12),
      new V4f(13, 14, 15, 16),
    ]);
    expect(fromRows.equals(a)).toBe(true);

    const fromCols = M44f.fromCols([
      new V4f(1, 5, 9, 13),
      new V4f(2, 6, 10, 14),
      new V4f(3, 7, 11, 15),
      new V4f(4, 8, 12, 16),
    ]);
    expect(fromCols.equals(a)).toBe(true);
  });

  it("diagonal", () => {
    const m = M44f.diagonal(new V4f(1, 2, 3, 4));
    expect([m.M00, m.M11, m.M22, m.M33]).toEqual([1, 2, 3, 4]);
  });
});

describe("M44f — row-major layout invariant", () => {
  it("M00 is _data[0], M01 is _data[1], M10 is _data[4]", () => {
    const m = new M44f();
    m.M00 = 10;
    m.M10 = 20;
    m.M01 = 30;
    expect(m._data[0]).toBe(10);
    expect(m._data[4]).toBe(20);
    expect(m._data[1]).toBe(30);
  });

  it("setters round to f32", () => {
    const m = new M44f();
    m.M00 = 1.1;
    expect(m.M00).toBe(Math.fround(1.1));
    expect(m.M00).not.toBe(1.1);
  });
});

describe("M44f — geometric construction", () => {
  it("translation places the offsets in the last column", () => {
    const m = M44f.translation(new V3f(1, 2, 3));
    expect(m.M03).toBe(1);
    expect(m.M13).toBe(2);
    expect(m.M23).toBe(3);
    expect(m.M33).toBe(1);
  });

  it("scaling is diagonal", () => {
    const m = M44f.scaling(new V3f(2, 3, 4));
    expect([m.M00, m.M11, m.M22, m.M33]).toEqual([2, 3, 4, 1]);
  });

  it("rotationZ(pi/2) sends unitX -> unitY", () => {
    const m = M44f.rotationZ(Math.PI / 2);
    const r = m.transform(new V4f(1, 0, 0, 1));
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.y).toBeCloseTo(1, 5);
  });
});

describe("M44f — arithmetic", () => {
  it("add", () => {
    const a = M44f.identity;
    const b = M44f.identity;
    expect(a.add(b).M00).toBe(2);
  });

  it("scalar mul", () => {
    const m = M44f.identity.mul(3);
    expect(m.M00).toBe(3);
  });

  it("matrix mul: identity * m === m", () => {
    const m = M44f.translation(new V3f(1, 2, 3));
    expect(M44f.identity.mul(m).equals(m)).toBe(true);
  });

  it("matrix mul: translation composes by addition", () => {
    const a = M44f.translation(new V3f(1, 0, 0));
    const b = M44f.translation(new V3f(0, 1, 0));
    const c = a.mul(b);
    expect(c.M03).toBe(1);
    expect(c.M13).toBe(1);
  });

  it("transformPos applies translation; transformDir does not", () => {
    const t = M44f.translation(new V3f(10, 20, 30));
    const p = t.transformPos(new V3f(1, 2, 3));
    expect(p.toArray()).toEqual([Math.fround(11), Math.fround(22), Math.fround(33)]);
    const d = t.transformDir(new V3f(1, 2, 3));
    expect(d.toArray()).toEqual([1, 2, 3]);
  });
});

describe("M44f — transpose / determinant / inverse", () => {
  it("transpose round-trip", () => {
    const m = M44f.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(m.transpose().transpose().equals(m)).toBe(true);
  });

  it("determinant of identity is 1", () => {
    expect(M44f.identity.determinant()).toBe(1);
  });

  it("inverse of identity is identity", () => {
    expect(M44f.identity.inverse().equals(M44f.identity)).toBe(true);
  });

  it("inverse round-trip on a known invertible matrix", () => {
    const m = M44f.translation(new V3f(1, 2, 3)).mul(M44f.scaling(new V3f(2, 3, 4)));
    const id = m.mul(m.inverse());
    expect(id.approxEqual(M44f.identity, 1e-4)).toBe(true);
  });
});

describe("M44f — equality / hash / iteration", () => {
  it("equals exact-bit", () => {
    const a = M44f.fromArray(new Array(16).fill(1.1));
    const b = M44f.fromArray(new Array(16).fill(1.1));
    expect(a.equals(b)).toBe(true);
  });

  it("getHashCode is deterministic", () => {
    const a = M44f.translation(new V3f(1, 2, 3));
    const b = M44f.translation(new V3f(1, 2, 3));
    expect(a.getHashCode()).toBe(b.getHashCode());
  });

  it("Symbol.iterator yields row-major order", () => {
    const m = M44f.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect([...m]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });
});

describe("M44f — alloc-free static variants", () => {
  it("addInto", () => {
    const a = M44f.identity;
    const b = M44f.identity;
    const t = new M44f();
    M44f.addInto(a, b, t);
    expect(t.M00).toBe(2);
  });

  it("mulInto with vector target", () => {
    const m = M44f.translation(new V3f(10, 20, 30));
    const v = new V4f(1, 2, 3, 1);
    const out = new V4f();
    M44f.mulInto(m, v, out);
    expect(out.toArray()).toEqual([11, 22, 33, 1]);
  });

  it("transformPosInto / transformDirInto", () => {
    const m = M44f.translation(new V3f(10, 20, 30));
    const v = new V3f(1, 2, 3);
    const t = new V3f();
    M44f.transformPosInto(m, v, t);
    expect(t.toArray()).toEqual([11, 22, 33]);
    M44f.transformDirInto(m, v, t);
    expect(t.toArray()).toEqual([1, 2, 3]);
  });
});
