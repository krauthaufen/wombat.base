import { describe, it, expect } from "vitest";
import { Rot3f } from "../../src/rotation/rot3f.js";
import { V3f } from "../../src/vector/v3f.js";

describe("Rot3f", () => {
  it("identity is (1,0,0,0)", () => {
    expect(Rot3f.identity.toArray()).toEqual([1, 0, 0, 0]);
  });

  it("fromAxisAngle(unitX, π/2) rotates unitY -> unitZ", () => {
    const r = Rot3f.fromAxisAngle(V3f.unitX, Math.PI / 2);
    const v = r.transform(V3f.unitY);
    expect(v.x).toBeCloseTo(0, 5);
    expect(v.y).toBeCloseTo(0, 5);
    expect(v.z).toBeCloseTo(1, 5);
  });

  it("inverse round-trip", () => {
    const r = Rot3f.fromAxisAngle(new V3f(1, 2, 3), 0.7);
    expect(r.mul(r.inverse()).approxEqual(Rot3f.identity, 1e-5)).toBe(true);
  });

  it("toMatrix / fromMatrix round-trip", () => {
    const r = Rot3f.fromAxisAngle(new V3f(0.1, -0.2, 0.7).normalize(), 0.9);
    const r2 = Rot3f.fromMatrix(r.toMatrix());
    const d = r.w * r2.w + r.x * r2.x + r.y * r2.y + r.z * r2.z;
    expect(Math.abs(d)).toBeCloseTo(1, 5);
  });

  it("rounds to f32 on construct", () => {
    const r = new Rot3f(1.1, 0, 0, 0);
    expect(r.w).toBe(Math.fround(1.1));
  });

  it("slerp halfway", () => {
    const r = Rot3f.fromAxisAngle(V3f.unitX, Math.PI / 2);
    const half = Rot3f.identity.slerp(r, 0.5);
    const expected = Rot3f.fromAxisAngle(V3f.unitX, Math.PI / 4);
    expect(half.approxEqual(expected, 1e-5)).toBe(true);
  });

  it("equals + hashCode determinism", () => {
    const a = new Rot3f(0.5, 0.5, 0.5, 0.5);
    const b = new Rot3f(0.5, 0.5, 0.5, 0.5);
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
