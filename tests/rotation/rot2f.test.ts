import { describe, it, expect } from "vitest";
import { Rot2f } from "../../src/rotation/rot2f.js";
import { V2f } from "../../src/vector/v2f.js";

describe("Rot2f", () => {
  it("identity has angle 0", () => {
    expect(Rot2f.identity.radians).toBe(0);
  });

  it("transform: 90° rotates unitX onto unitY", () => {
    const r = Rot2f.fromRadians(Math.PI / 2);
    const v = r.transform(V2f.unitX);
    expect(v.x).toBeCloseTo(0, 5);
    expect(v.y).toBeCloseTo(1, 5);
  });

  it("inverse round-trip", () => {
    const r = Rot2f.fromRadians(0.7);
    expect(r.mul(r.inverse()).approxEqual(Rot2f.identity, 1e-5)).toBe(true);
  });

  it("rounds to f32 on construct", () => {
    const r = new Rot2f(1.1);
    expect(r.radians).toBe(Math.fround(1.1));
  });

  it("slerp halfway between 0 and π/2 is π/4", () => {
    const half = Rot2f.identity.slerp(Rot2f.fromRadians(Math.PI / 2), 0.5);
    expect(half.radians).toBeCloseTo(Math.PI / 4, 5);
  });

  it("toMatrix preserves transform", () => {
    const r = Rot2f.fromRadians(0.3);
    const m = r.toMatrix();
    const v = m.transform(V2f.unitX);
    const w = r.transform(V2f.unitX);
    expect(v.approxEqual(w, 1e-6)).toBe(true);
  });

  it("equals + hashCode determinism", () => {
    const a = Rot2f.fromRadians(0.3);
    const b = Rot2f.fromRadians(0.3);
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
