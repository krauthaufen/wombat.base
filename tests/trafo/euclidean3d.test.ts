import { describe, it, expect } from "vitest";
import { Euclidean3d } from "../../src/trafo/euclidean3d.js";
import { Rot3d } from "../../src/rotation/rot3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Euclidean3d", () => {
  const r = Rot3d.fromAxisAngle(V3d.unitZ, Math.PI / 2);
  const t = new V3d(10, 20, 30);
  const e = Euclidean3d.fromRotationAndTranslation(r, t);

  it("identity leaves a point unchanged", () => {
    expect(Euclidean3d.identity.transform(new V3d(1, 2, 3)).equals(new V3d(1, 2, 3))).toBe(true);
  });

  it("transform applies translation; transformDir does not", () => {
    const v = new V3d(1, 0, 0);
    const p = e.transform(v);
    const d = e.transformDir(v);
    // rotation of unitX by 90° about Z = unitY, plus translation
    expect(p.approxEqual(new V3d(0, 1, 0).add(t), 1e-12)).toBe(true);
    expect(d.approxEqual(new V3d(0, 1, 0), 1e-12)).toBe(true);
  });

  it("inverse round-trip", () => {
    expect(e.mul(e.inverse()).approxEqual(Euclidean3d.identity, 1e-12)).toBe(true);
    expect(e.inverse().mul(e).approxEqual(Euclidean3d.identity, 1e-12)).toBe(true);
  });

  it("composition law", () => {
    const a = Euclidean3d.fromRotationAndTranslation(Rot3d.fromAxisAngle(V3d.unitX, 0.7), new V3d(1, 2, 3));
    const b = Euclidean3d.fromRotationAndTranslation(Rot3d.fromAxisAngle(V3d.unitY, -0.3), new V3d(-4, 5, -6));
    const v = new V3d(7, 8, 9);
    expect(a.mul(b).transform(v).approxEqual(a.transform(b.transform(v)), 1e-10)).toBe(true);
  });

  it("then is the dual of mul", () => {
    const a = Euclidean3d.fromRotationAndTranslation(Rot3d.fromAxisAngle(V3d.unitX, 0.4), new V3d(1, 0, 0));
    const b = Euclidean3d.fromRotationAndTranslation(Rot3d.fromAxisAngle(V3d.unitY, 0.5), new V3d(0, 2, 0));
    expect(a.then(b).approxEqual(b.mul(a), 1e-12)).toBe(true);
  });

  it("equals / hash", () => {
    const e2 = Euclidean3d.fromRotationAndTranslation(r, t);
    expect(e.equals(e2)).toBe(true);
    expect(e.getHashCode()).toBe(e2.getHashCode());
  });
});
