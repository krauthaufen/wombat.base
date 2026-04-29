import { describe, it, expect } from "vitest";
import { Rot3d } from "../../src/rotation/rot3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Rot3d — operators", () => {
  it("composition via *", () => {
    const r1 = Rot3d.fromAxisAngle(new V3d(0, 0, 1), Math.PI / 2);
    const r2 = Rot3d.fromAxisAngle(new V3d(0, 0, 1), Math.PI / 2);
    const r = r1 * r2;
    // rotating (1,0,0) by π should give roughly (-1,0,0)
    const out = r.transform(new V3d(1, 0, 0));
    expect(out.x).toBeCloseTo(-1);
    expect(out.y).toBeCloseTo(0);
  });
  it("identity * r = r", () => {
    const r = Rot3d.fromAxisAngle(new V3d(0, 1, 0), 0.7);
    const out = (Rot3d.identity * r).transform(new V3d(1, 0, 0));
    const ref = r.transform(new V3d(1, 0, 0));
    expect(out.approxEqual(ref, 1e-9)).toBe(true);
  });
});
