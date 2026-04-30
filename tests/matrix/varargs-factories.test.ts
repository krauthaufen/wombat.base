// Matrix `fromCols` / `fromRows` accept either an array of column /
// row vectors or varargs. The varargs form is what wombat.shader
// emits for static-factory recognition; the array form is the
// canonical CPU API and stays unchanged.

import { describe, expect, it } from "vitest";
import {
  M22f, M33f, M44f,
  V2f, V3f, V4f,
} from "../../src/index.js";

describe("matrix varargs factories", () => {
  it("M44f.fromCols accepts both array and varargs forms identically", () => {
    const c0 = new V4f(1, 0, 0, 0);
    const c1 = new V4f(0, 1, 0, 0);
    const c2 = new V4f(0, 0, 1, 0);
    const c3 = new V4f(0, 0, 0, 1);
    const a = M44f.fromCols([c0, c1, c2, c3]);
    const b = M44f.fromCols(c0, c1, c2, c3);
    expect(a.toArray()).toEqual(b.toArray());
  });

  it("M44f.fromRows accepts varargs", () => {
    const r0 = new V4f(1, 2, 3, 4);
    const r1 = new V4f(5, 6, 7, 8);
    const r2 = new V4f(9, 10, 11, 12);
    const r3 = new V4f(13, 14, 15, 16);
    const m = M44f.fromRows(r0, r1, r2, r3);
    expect(m.toArray()).toEqual(M44f.fromRows([r0, r1, r2, r3]).toArray());
  });

  it("M33f.fromCols / M22f.fromCols varargs work", () => {
    const a = M33f.fromCols(new V3f(1, 0, 0), new V3f(0, 1, 0), new V3f(0, 0, 1));
    expect(a.toArray()).toEqual(M33f.identity.toArray());
    const b = M22f.fromCols(new V2f(1, 0), new V2f(0, 1));
    expect(b.toArray()).toEqual(M22f.identity.toArray());
  });
});
