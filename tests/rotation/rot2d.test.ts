import { describe, it, expect } from "vitest";
import { Rot2d } from "../../src/rotation/rot2d.js";
import { V2d } from "../../src/vector/v2d.js";
import { M22d } from "../../src/matrix/m22d.js";

describe("Rot2d", () => {
  it("identity has angle 0", () => {
    expect(Rot2d.identity.radians).toBe(0);
  });

  it("fromDegrees / fromRadians", () => {
    expect(Rot2d.fromDegrees(180).radians).toBeCloseTo(Math.PI, 12);
    expect(Rot2d.fromRadians(1.5).radians).toBe(1.5);
  });

  it("transform: 90° rotates unitX onto unitY", () => {
    const r = Rot2d.fromRadians(Math.PI / 2);
    const v = r.transform(V2d.unitX);
    expect(v.x).toBeCloseTo(0, 12);
    expect(v.y).toBeCloseTo(1, 12);
  });

  it("inverse round-trip", () => {
    const r = Rot2d.fromRadians(0.7);
    expect(r.mul(r.inverse()).approxEqual(Rot2d.identity, 1e-12)).toBe(true);
  });

  it("toMatrix matches direct cos/sin construction", () => {
    const r = Rot2d.fromRadians(0.5);
    const m = r.toMatrix();
    const c = Math.cos(0.5), s = Math.sin(0.5);
    const expected = M22d.fromArray([c, -s, s, c]);
    expect(m.approxEqual(expected, 1e-12)).toBe(true);
  });

  it("slerp halfway between 0 and π/2 is π/4", () => {
    const a = Rot2d.identity;
    const b = Rot2d.fromRadians(Math.PI / 2);
    const half = a.slerp(b, 0.5);
    expect(half.radians).toBeCloseTo(Math.PI / 4, 12);
  });

  it("slerp wraps the short way", () => {
    // from 0 to 3π/2 — short path is -π/2
    const a = Rot2d.identity;
    const b = Rot2d.fromRadians(3 * Math.PI / 2);
    const half = a.slerp(b, 1);
    // wrapping yields target angle 0 + (-π/2) = -π/2
    expect(half.radians).toBeCloseTo(-Math.PI / 2, 12);
  });

  it("equals + hashCode determinism", () => {
    const a = Rot2d.fromRadians(0.3);
    const b = Rot2d.fromRadians(0.3);
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });

  it("Symbol.iterator yields [radians]", () => {
    expect([...Rot2d.fromRadians(0.42)]).toEqual([0.42]);
  });
});
