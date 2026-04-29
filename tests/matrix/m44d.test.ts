import { describe, it, expect } from "vitest";
import { M44d } from "../../src/matrix/m44d.js";
import { V3d } from "../../src/vector/v3d.js";
import { V4d } from "../../src/vector/v4d.js";

describe("M44d", () => {
  it("identity is correct", () => {
    expect(M44d.identity.M00).toBe(1);
    expect(M44d.identity.M11).toBe(1);
  });

  it("preserves f64 precision", () => {
    const m = new M44d();
    m.M00 = 1.1;
    expect(m.M00).toBe(1.1); // not rounded to f32
  });

  it("translation + transformPos", () => {
    const m = M44d.translation(new V3d(1, 2, 3));
    expect(m.transformPos(new V3d(10, 20, 30)).toArray()).toEqual([11, 22, 33]);
  });

  it("inverse round-trip", () => {
    const m = M44d.translation(new V3d(1, 2, 3)).mul(M44d.scaling(new V3d(2, 3, 4)));
    expect(m.mul(m.inverse()).approxEqual(M44d.identity, 1e-12)).toBe(true);
  });

  it("transpose round-trip", () => {
    const m = M44d.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(m.transpose().transpose().equals(m)).toBe(true);
  });

  it("determinant of identity is 1", () => {
    expect(M44d.identity.determinant()).toBe(1);
  });

  it("lookAt(eye=origin, target=-Z, up=Y) is identity-like (eye=origin)", () => {
    const m = M44d.lookAt(V3d.zero, new V3d(0, 0, -1), new V3d(0, 1, 0));
    // mapping origin should yield origin
    expect(m.transformPos(V3d.zero).approxEqual(V3d.zero, 1e-12)).toBe(true);
    // a point at -Z should remain on -Z axis (in front of camera)
    const p = m.transformPos(new V3d(0, 0, -5));
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(0, 12);
    expect(p.z).toBeCloseTo(-5, 12);
  });

  it("perspectiveProjection has -1 in the row-3 column-2 slot", () => {
    const m = M44d.perspectiveProjection(Math.PI / 4, 1, 0.1, 100);
    expect(m.M32).toBe(-1);
  });

  it("orthographicProjection maps the canonical box to NDC", () => {
    const m = M44d.orthographicProjection(-1, 1, -1, 1, 0.1, 100);
    const a = m.transformPos(new V3d(1, 1, 0));
    expect(a.x).toBeCloseTo(1, 10);
    expect(a.y).toBeCloseTo(1, 10);
  });

  it("Symbol.iterator yields row-major order", () => {
    const m = M44d.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect([...m]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("equals + hashCode determinism", () => {
    const a = M44d.translation(new V3d(1, 2, 3));
    const b = M44d.translation(new V3d(1, 2, 3));
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });

  it("mul with V4d", () => {
    const m = M44d.scaling(new V3d(2, 3, 4));
    const v = m.mul(new V4d(1, 1, 1, 1));
    expect(v.toArray()).toEqual([2, 3, 4, 1]);
  });
});
