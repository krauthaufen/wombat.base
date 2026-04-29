// Cross-type operator tests: parity with Aardvark.Base mixed-type operators.
// Each test multiplies two transformations of different families and checks
// the result against the equivalent matrix-multiplied transformation on a
// probe point.

import { describe, it, expect } from "vitest";
import { V3d } from "../../src/vector/v3d.js";
import { V4d } from "../../src/vector/v4d.js";
import { M44d } from "../../src/matrix/m44d.js";
import { Rot3d } from "../../src/rotation/rot3d.js";
import { Trafo3d } from "../../src/trafo/trafo3d.js";
import { Trafo2d } from "../../src/trafo/trafo2d.js";
import { Euclidean3d } from "../../src/trafo/euclidean3d.js";
import { Affine3d } from "../../src/trafo/affine3d.js";
import { Similarity3d } from "../../src/trafo/similarity3d.js";
import { Scale3d } from "../../src/trafo/scale3d.js";
import { Shift3d } from "../../src/trafo/shift3d.js";

const EPS = 1e-12;
const probe = new V3d(0.7, -1.3, 2.1);

// Apply a homogeneous matrix to a 3D point and return a V3d.
function applyM(m: M44d, p: V3d): V3d {
  const v = m.transform(new V4d(p.x, p.y, p.z, 1));
  return new V3d(v.x / v.w, v.y / v.w, v.z / v.w);
}

const rot = Rot3d.fromAxisAngle(new V3d(0.3, -0.7, 0.5).normalize(), 1.1);
const shift = new Shift3d(new V3d(2, 3, 4));
const scale = Scale3d.scaling(1.5, 2.5, 0.5);
const euclidean = new Euclidean3d(rot, new V3d(-1, 0.5, 2));
const similarity = new Similarity3d(euclidean, 1.7);
const affine = new Affine3d(rot.toMatrix().mul(1.5), new V3d(0.2, -0.4, 0.6));

describe("mixed 3D operators — match matrix composition", () => {
  // Helper: cast through `as any` to bypass TS errors when we mix types
  // with operators (needed because boperators rewrites at build time but
  // the test source is parsed by TS during plugin run; using `.toMatrix()`
  // we get unambiguous matrix-form references for the expected value).
  function check(name: string, lhs: () => unknown, rhsMatrix: M44d) {
    const out = lhs() as { transform?: (p: V3d) => V3d; toMatrix?: () => M44d };
    if (out instanceof V4d) {
      const expected = rhsMatrix.transform(new V4d(probe.x, probe.y, probe.z, 1));
      // V4d outputs: just check matrix-applied version (transform-of-V4d)
      return;
    }
    const o = out as { toMatrix(): M44d };
    const got = applyM(o.toMatrix(), probe);
    const want = applyM(rhsMatrix, probe);
    expect(got.approxEqual(want, EPS)).toBe(true);
  }

  it("Affine3d * M44d → M44d", () => {
    const m = M44d.translation(1, 2, 3);
    const r = affine * m;
    expect(applyM(r, probe).approxEqual(applyM(affine.toMatrix().mul(m), probe), EPS)).toBe(true);
  });
  it("M44d * Affine3d → M44d", () => {
    const m = M44d.translation(1, 2, 3);
    const r = m * affine;
    expect(applyM(r, probe).approxEqual(applyM(m.mul(affine.toMatrix()), probe), EPS)).toBe(true);
  });
  it("Affine3d * Euclidean3d → Affine3d", () => {
    const r = affine * euclidean;
    expect(applyM(r.toMatrix(), probe).approxEqual(applyM(affine.toMatrix().mul(euclidean.toMatrix()), probe), EPS)).toBe(true);
  });
  it("Euclidean3d * Affine3d → Affine3d", () => {
    const r = euclidean * affine;
    expect(applyM(r.toMatrix(), probe).approxEqual(applyM(euclidean.toMatrix().mul(affine.toMatrix()), probe), EPS)).toBe(true);
  });
  it("Affine3d * Rot3d → Affine3d", () => {
    const r = affine * rot;
    expect(applyM(r.toMatrix(), probe).approxEqual(applyM(affine.toMatrix().mul(rot.toMatrixHomogeneous()), probe), EPS)).toBe(true);
  });
  it("Rot3d * Affine3d → Affine3d", () => {
    const r = rot * affine;
    expect(applyM(r.toMatrix(), probe).approxEqual(applyM(rot.toMatrixHomogeneous().mul(affine.toMatrix()), probe), EPS)).toBe(true);
  });
  it("Affine3d * Scale3d → Affine3d", () => {
    const r = affine * scale;
    expect(applyM(r.toMatrix(), probe).approxEqual(applyM(affine.toMatrix().mul(scale.toMatrix()), probe), EPS)).toBe(true);
  });
  it("Scale3d * Affine3d → Affine3d", () => {
    const r = scale * affine;
    expect(applyM(r.toMatrix(), probe).approxEqual(applyM(scale.toMatrix().mul(affine.toMatrix()), probe), EPS)).toBe(true);
  });
  it("Affine3d * Shift3d → Affine3d", () => {
    const r = affine * shift;
    expect(applyM(r.toMatrix(), probe).approxEqual(applyM(affine.toMatrix().mul(shift.toMatrix()), probe), EPS)).toBe(true);
  });
  it("Shift3d * Affine3d → Affine3d", () => {
    const r = shift * affine;
    expect(applyM(r.toMatrix(), probe).approxEqual(applyM(shift.toMatrix().mul(affine.toMatrix()), probe), EPS)).toBe(true);
  });
  it("Affine3d * Similarity3d → Affine3d", () => {
    const r = affine * similarity;
    expect(applyM(r.toMatrix(), probe).approxEqual(applyM(affine.toMatrix().mul(similarity.toMatrix()), probe), EPS)).toBe(true);
  });
  it("Similarity3d * Affine3d → Affine3d", () => {
    const r = similarity * affine;
    expect(applyM(r.toMatrix(), probe).approxEqual(applyM(similarity.toMatrix().mul(affine.toMatrix()), probe), EPS)).toBe(true);
  });

  it("Euclidean3d * Rot3d / Rot3d * Euclidean3d → Euclidean3d", () => {
    const a = euclidean * rot;
    const b = rot * euclidean;
    expect(applyM(a.toMatrix(), probe).approxEqual(applyM(euclidean.toMatrix().mul(rot.toMatrixHomogeneous()), probe), EPS)).toBe(true);
    expect(applyM(b.toMatrix(), probe).approxEqual(applyM(rot.toMatrixHomogeneous().mul(euclidean.toMatrix()), probe), EPS)).toBe(true);
  });
  it("Euclidean3d * Shift3d / Shift3d * Euclidean3d → Euclidean3d", () => {
    const a = euclidean * shift;
    const b = shift * euclidean;
    expect(applyM(a.toMatrix(), probe).approxEqual(applyM(euclidean.toMatrix().mul(shift.toMatrix()), probe), EPS)).toBe(true);
    expect(applyM(b.toMatrix(), probe).approxEqual(applyM(shift.toMatrix().mul(euclidean.toMatrix()), probe), EPS)).toBe(true);
  });
  it("Euclidean3d * Scale3d / Scale3d * Euclidean3d → Affine3d", () => {
    const a = euclidean * scale;
    const b = scale * euclidean;
    expect(applyM(a.toMatrix(), probe).approxEqual(applyM(euclidean.toMatrix().mul(scale.toMatrix()), probe), EPS)).toBe(true);
    expect(applyM(b.toMatrix(), probe).approxEqual(applyM(scale.toMatrix().mul(euclidean.toMatrix()), probe), EPS)).toBe(true);
  });

  it("Rot3d * Shift3d / Shift3d * Rot3d → Euclidean3d", () => {
    const a = rot * shift;
    const b = shift * rot;
    expect(applyM(a.toMatrix(), probe).approxEqual(applyM(rot.toMatrixHomogeneous().mul(shift.toMatrix()), probe), EPS)).toBe(true);
    expect(applyM(b.toMatrix(), probe).approxEqual(applyM(shift.toMatrix().mul(rot.toMatrixHomogeneous()), probe), EPS)).toBe(true);
  });
  it("Rot3d * Scale3d / Scale3d * Rot3d → Affine3d", () => {
    const a = rot * scale;
    const b = scale * rot;
    expect(applyM(a.toMatrix(), probe).approxEqual(applyM(rot.toMatrixHomogeneous().mul(scale.toMatrix()), probe), EPS)).toBe(true);
    expect(applyM(b.toMatrix(), probe).approxEqual(applyM(scale.toMatrix().mul(rot.toMatrixHomogeneous()), probe), EPS)).toBe(true);
  });
  it("Shift3d * Scale3d / Scale3d * Shift3d → Affine3d", () => {
    const a = shift * scale;
    const b = scale * shift;
    expect(applyM(a.toMatrix(), probe).approxEqual(applyM(shift.toMatrix().mul(scale.toMatrix()), probe), EPS)).toBe(true);
    expect(applyM(b.toMatrix(), probe).approxEqual(applyM(scale.toMatrix().mul(shift.toMatrix()), probe), EPS)).toBe(true);
  });

  it("Similarity3d cross types", () => {
    const cases: Array<[string, () => { toMatrix(): M44d }, M44d]> = [
      ["S * Rot",   () => similarity * rot,        similarity.toMatrix().mul(rot.toMatrixHomogeneous())],
      ["Rot * S",   () => rot * similarity,        rot.toMatrixHomogeneous().mul(similarity.toMatrix())],
      ["S * Shift", () => similarity * shift,      similarity.toMatrix().mul(shift.toMatrix())],
      ["Shift * S", () => shift * similarity,      shift.toMatrix().mul(similarity.toMatrix())],
      ["S * Scale", () => similarity * scale,      similarity.toMatrix().mul(scale.toMatrix())],
      ["Scale * S", () => scale * similarity,      scale.toMatrix().mul(similarity.toMatrix())],
      ["S * Eucl",  () => similarity * euclidean,  similarity.toMatrix().mul(euclidean.toMatrix())],
      ["Eucl * S",  () => euclidean * similarity,  euclidean.toMatrix().mul(similarity.toMatrix())],
    ];
    for (const [, f, expected] of cases) {
      const r = f();
      expect(applyM(r.toMatrix(), probe).approxEqual(applyM(expected, probe), EPS)).toBe(true);
    }
  });

  it("Rot3d * V3d / Scale3d * V3d / Shift3d * V3d", () => {
    expect((rot * probe).approxEqual(rot.transform(probe), EPS)).toBe(true);
    expect((scale * probe).approxEqual(scale.transform(probe), EPS)).toBe(true);
    expect((shift * probe).approxEqual(shift.transform(probe), EPS)).toBe(true);
  });

  it("Rot3d * M44d / Scale3d * M44d / Shift3d * M44d", () => {
    const m = M44d.translation(1, 2, 3);
    expect(applyM(rot * m, probe).approxEqual(applyM(rot.toMatrixHomogeneous().mul(m), probe), EPS)).toBe(true);
    expect(applyM(scale * m, probe).approxEqual(applyM(scale.toMatrix().mul(m), probe), EPS)).toBe(true);
    expect(applyM(shift * m, probe).approxEqual(applyM(shift.toMatrix().mul(m), probe), EPS)).toBe(true);
  });
});
