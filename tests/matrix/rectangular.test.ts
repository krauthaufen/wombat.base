import { describe, it, expect } from "vitest";
import { M23f } from "../../src/matrix/m23f.js";
import { M32f } from "../../src/matrix/m32f.js";
import { M24f } from "../../src/matrix/m24f.js";
import { M42f } from "../../src/matrix/m42f.js";
import { M34f } from "../../src/matrix/m34f.js";
import { M43f } from "../../src/matrix/m43f.js";
import { M23d } from "../../src/matrix/m23d.js";
import { M32d } from "../../src/matrix/m32d.js";
import { M24d } from "../../src/matrix/m24d.js";
import { M42d } from "../../src/matrix/m42d.js";
import { M34d } from "../../src/matrix/m34d.js";
import { M43d } from "../../src/matrix/m43d.js";
import { V2f } from "../../src/vector/v2f.js";
import { V3f } from "../../src/vector/v3f.js";
import { V4f } from "../../src/vector/v4f.js";

describe("Rectangular matrices — smoke", () => {
  it("M23f construction + transpose -> M32f + transform", () => {
    const m = M23f.fromArray([1, 2, 3, 4, 5, 6]);
    // row-major: row 0 = [1,2,3], col 0 = [1,4]
    expect(m.row(0).toArray()).toEqual([1, 2, 3]);
    expect(m.col(0).toArray()).toEqual([1, 4]);
    const t = m.transpose();
    expect(t).toBeInstanceOf(M32f);
    // transpose row 0 = original col 0 = [1, 4]
    expect(t.row(0).toArray()).toEqual([1, 4]);
    // M23f * V3f -> V2f; first column of M is row 0 of result = [1, 4]
    const v = m.transform(new V3f(1, 0, 0));
    expect(v.toArray()).toEqual([1, 4]);
  });

  it("M32f transpose -> M23f", () => {
    const m = M32f.fromArray([1, 2, 3, 4, 5, 6]);
    expect(m.transpose()).toBeInstanceOf(M23f);
    // row-major: col 0 = [1, 3, 5]
    const v = m.transform(new V2f(1, 0));
    expect(v.toArray()).toEqual([1, 3, 5]);
  });

  it("M24f transpose -> M42f", () => {
    const m = M24f.fromArray([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(m.transpose()).toBeInstanceOf(M42f);
    const v = m.transform(new V4f(1, 0, 0, 0));
    // row-major: col 0 = [1, 5]
    expect(v.toArray()).toEqual([1, 5]);
  });

  it("M42f transpose -> M24f", () => {
    const m = M42f.fromArray([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(m.transpose()).toBeInstanceOf(M24f);
    const v = m.transform(new V2f(1, 0));
    // row-major: col 0 = [1, 3, 5, 7]
    expect(v.toArray()).toEqual([1, 3, 5, 7]);
  });

  it("M34f transpose -> M43f", () => {
    const m = M34f.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(m.transpose()).toBeInstanceOf(M43f);
    const v = m.transform(new V4f(1, 0, 0, 0));
    // row-major: col 0 = [1, 5, 9]
    expect(v.toArray()).toEqual([1, 5, 9]);
  });

  it("M43f transpose -> M34f", () => {
    const m = M43f.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(m.transpose()).toBeInstanceOf(M34f);
    const v = m.transform(new V3f(1, 0, 0));
    // row-major: col 0 = [1, 4, 7, 10]
    expect(v.toArray()).toEqual([1, 4, 7, 10]);
  });

  // double counterparts: existence, construction, transpose round-trip
  it("double rectangulars exist + transpose round-trip", () => {
    const a23 = M23d.fromArray([1, 2, 3, 4, 5, 6]);
    expect(a23.transpose()).toBeInstanceOf(M32d);
    expect(a23.transpose().transpose().equals(a23)).toBe(true);

    const a24 = M24d.fromArray([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(a24.transpose()).toBeInstanceOf(M42d);
    expect(a24.transpose().transpose().equals(a24)).toBe(true);

    const a34 = M34d.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(a34.transpose()).toBeInstanceOf(M43d);
    expect(a34.transpose().transpose().equals(a34)).toBe(true);
  });

  it("rectangular add + scalar mul", () => {
    const a = M23f.fromArray([1, 2, 3, 4, 5, 6]);
    const b = M23f.fromArray([10, 20, 30, 40, 50, 60]);
    expect(a.add(b).toArray()).toEqual([11, 22, 33, 44, 55, 66]);
    expect(a.mul(2).toArray()).toEqual([2, 4, 6, 8, 10, 12]);
  });
});
