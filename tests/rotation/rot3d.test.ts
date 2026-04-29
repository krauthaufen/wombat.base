import { describe, it, expect } from "vitest";
import { Rot3d } from "../../src/rotation/rot3d.js";
import { V3d } from "../../src/vector/v3d.js";
import { M33d } from "../../src/matrix/m33d.js";

describe("Rot3d", () => {
  it("identity is (1,0,0,0)", () => {
    expect(Rot3d.identity.toArray()).toEqual([1, 0, 0, 0]);
  });

  it("fromAxisAngle(unitX, π/2) rotates unitY -> unitZ", () => {
    const r = Rot3d.fromAxisAngle(V3d.unitX, Math.PI / 2);
    const v = r.transform(V3d.unitY);
    expect(v.x).toBeCloseTo(0, 12);
    expect(v.y).toBeCloseTo(0, 12);
    expect(v.z).toBeCloseTo(1, 12);
  });

  it("inverse round-trip", () => {
    const r = Rot3d.fromAxisAngle(new V3d(1, 2, 3), 0.7);
    expect(r.mul(r.inverse()).approxEqual(Rot3d.identity, 1e-12)).toBe(true);
  });

  it("conjugate equals inverse for unit quaternions", () => {
    const r = Rot3d.fromAxisAngle(new V3d(0, 1, 0), 0.4);
    expect(r.conjugate().approxEqual(r.inverse(), 1e-12)).toBe(true);
  });

  it("toMatrix matches M33d.fromRotationAxisAngle", () => {
    const axis = new V3d(0.3, 0.4, 0.5).normalize();
    const a = 0.6;
    const r = Rot3d.fromAxisAngle(axis, a);
    const expected = M33d.fromRotationAxisAngle(axis, a);
    expect(r.toMatrix().approxEqual(expected, 1e-12)).toBe(true);
  });

  it("fromMatrix round-trip", () => {
    const r = Rot3d.fromAxisAngle(new V3d(0.1, -0.2, 0.7).normalize(), 0.9);
    const r2 = Rot3d.fromMatrix(r.toMatrix());
    // quaternion may flip sign — compare via matrix or via dot
    const d =
      r.w * r2.w + r.x * r2.x + r.y * r2.y + r.z * r2.z;
    expect(Math.abs(d)).toBeCloseTo(1, 10);
  });

  it("fromTwoVectors sends from -> to", () => {
    const from = new V3d(1, 0, 0);
    const to = new V3d(0, 1, 0);
    const q = Rot3d.fromTwoVectors(from, to);
    expect(q.transform(from).approxEqual(to, 1e-12)).toBe(true);
  });

  it("fromTwoVectors handles antipodal inputs", () => {
    const from = new V3d(1, 0, 0);
    const to = new V3d(-1, 0, 0);
    const q = Rot3d.fromTwoVectors(from, to);
    expect(q.transform(from).approxEqual(to, 1e-12)).toBe(true);
  });

  it("fromEuler/toEuler round-trip (xyz)", () => {
    const r = Rot3d.fromEuler(0.2, -0.3, 0.5, "xyz");
    const e = r.toEuler("xyz");
    const r2 = Rot3d.fromEuler(e.x, e.y, e.z, "xyz");
    expect(r.toMatrix().approxEqual(r2.toMatrix(), 1e-12)).toBe(true);
  });

  it("slerp halfway between identity and 90°-X is 45°-X", () => {
    const r = Rot3d.fromAxisAngle(V3d.unitX, Math.PI / 2);
    const half = Rot3d.identity.slerp(r, 0.5);
    const expected = Rot3d.fromAxisAngle(V3d.unitX, Math.PI / 4);
    expect(half.approxEqual(expected, 1e-12)).toBe(true);
  });

  it("nlerp halfway is unit-length", () => {
    const r = Rot3d.fromAxisAngle(V3d.unitX, Math.PI / 2);
    const half = Rot3d.identity.nlerp(r, 0.5);
    expect(half.length()).toBeCloseTo(1, 12);
  });

  it("toAxisAngle round-trip", () => {
    const axis = new V3d(0, 0, 1);
    const a = 0.8;
    const { axis: a2, angle } = Rot3d.fromAxisAngle(axis, a).toAxisAngle();
    expect(angle).toBeCloseTo(a, 12);
    expect(a2.approxEqual(axis, 1e-12)).toBe(true);
  });

  it("Hamilton product is non-commutative", () => {
    const a = Rot3d.fromAxisAngle(V3d.unitX, 0.5);
    const b = Rot3d.fromAxisAngle(V3d.unitY, 0.7);
    expect(a.mul(b).approxEqual(b.mul(a), 1e-3)).toBe(false);
  });

  it("Symbol.iterator yields W, X, Y, Z", () => {
    const r = new Rot3d(0.1, 0.2, 0.3, 0.4);
    expect([...r]).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it("equals + hashCode determinism", () => {
    const a = new Rot3d(0.5, 0.5, 0.5, 0.5);
    const b = new Rot3d(0.5, 0.5, 0.5, 0.5);
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
