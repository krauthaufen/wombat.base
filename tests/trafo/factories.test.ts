// Smoke test for the new static factory methods (Translation/Rotation/Scaling/etc.)
// across the trafo family. Validates that each factory produces a transform
// behaving as advertised on a probe vector.

import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import { V3d } from "../../src/vector/v3d.js";
import { V3f } from "../../src/vector/v3f.js";
import { Rot3d } from "../../src/rotation/rot3d.js";
import { Rot3f } from "../../src/rotation/rot3f.js";
import { Rot2d } from "../../src/rotation/rot2d.js";
import { M44d } from "../../src/matrix/m44d.js";
import { M44f } from "../../src/matrix/m44f.js";
import { M33d } from "../../src/matrix/m33d.js";
import { Trafo3d } from "../../src/trafo/trafo3d.js";
import { Trafo2d } from "../../src/trafo/trafo2d.js";
import { Euclidean3d } from "../../src/trafo/euclidean3d.js";
import { Euclidean2d } from "../../src/trafo/euclidean2d.js";
import { Affine3d } from "../../src/trafo/affine3d.js";
import { Affine2d } from "../../src/trafo/affine2d.js";
import { Similarity3d } from "../../src/trafo/similarity3d.js";
import { Similarity2d } from "../../src/trafo/similarity2d.js";

const HALF_PI = Math.PI / 2;

describe("Trafo3d factories", () => {
  it("translation", () => {
    const r = Trafo3d.translation(new V3d(1, 2, 3)).transform(new V3d(0, 0, 0));
    expect(r.toArray()).toEqual([1, 2, 3]);
  });
  it("scaling (uniform + non-uniform)", () => {
    expect(Trafo3d.scaling(2).transform(new V3d(1, 2, 3)).toArray()).toEqual([2, 4, 6]);
    expect(Trafo3d.scaling(new V3d(1, 2, 3)).transform(new V3d(1, 1, 1)).toArray()).toEqual([1, 2, 3]);
  });
  it("rotation around axis + axis-aligned shortcuts", () => {
    const rZ = Trafo3d.rotationZ(HALF_PI).transform(new V3d(1, 0, 0));
    expect(rZ.x).toBeCloseTo(0); expect(rZ.y).toBeCloseTo(1); expect(rZ.z).toBeCloseTo(0);
    const rAxis = Trafo3d.rotation(new V3d(0, 0, 1), HALF_PI).transform(new V3d(1, 0, 0));
    expect(rAxis.approxEqual(rZ, 1e-9)).toBe(true);
  });
});

describe("Trafo2d factories", () => {
  it("translation, scaling, rotation", () => {
    expect(Trafo2d.translation(new V2d(3, 4)).transform(new V2d(0, 0)).toArray()).toEqual([3, 4]);
    expect(Trafo2d.scaling(2).transform(new V2d(1, 2)).toArray()).toEqual([2, 4]);
    const r = Trafo2d.rotation(HALF_PI).transform(new V2d(1, 0));
    expect(r.x).toBeCloseTo(0); expect(r.y).toBeCloseTo(1);
  });
});

describe("Rot3 factories", () => {
  it("rotationX/Y/Z agree with axis-angle", () => {
    const aRef = Rot3d.fromAxisAngle(new V3d(1, 0, 0), HALF_PI).transform(new V3d(0, 1, 0));
    const aNew = Rot3d.rotationX(HALF_PI).transform(new V3d(0, 1, 0));
    expect(aNew.approxEqual(aRef, 1e-9)).toBe(true);
  });
  it("Rot3f.rotationY rotates X→-Z", () => {
    const r = Rot3f.rotationY(HALF_PI).transform(new V3f(1, 0, 0));
    expect(r.x).toBeCloseTo(0); expect(r.z).toBeCloseTo(-1);
  });
});

describe("Rot2 factory alias", () => {
  it("Rot2d.rotation equals fromRadians", () => {
    expect(Rot2d.rotation(0.7).radians).toBe(0.7);
  });
});

describe("Matrix factories", () => {
  it("M44d.rotation matches axis-angle Rot3d", () => {
    const m = M44d.rotation(new V3d(0, 1, 0), HALF_PI);
    const out = m.transformDir(new V3d(1, 0, 0));
    expect(out.z).toBeCloseTo(-1);
  });
  it("M44f.rotationEuler returns identity for zeros", () => {
    const m = M44f.rotationEuler(0, 0, 0);
    const v = m.transformDir(new V3f(1, 2, 3));
    expect(v.toArray()).toEqual([1, 2, 3]);
  });
  it("M33d 2D-homogeneous translation/rotation/scaling", () => {
    expect(M33d.translation(new V2d(1, 2))._data[2]).toBe(1);
    expect(M33d.scalingUniform(3)._data[0]).toBe(3);
    const r = M33d.rotation(HALF_PI);
    // Rotates (1,0) homogeneously to (0,1)
    expect(r._data[0]).toBeCloseTo(0);
    expect(r._data[3]).toBeCloseTo(1);
  });
});

describe("Euclidean factories", () => {
  it("Euclidean3d.translation/rotation*", () => {
    expect(Euclidean3d.translation(new V3d(1, 2, 3)).transform(new V3d(0, 0, 0)).toArray()).toEqual([1, 2, 3]);
    const r = Euclidean3d.rotationZ(HALF_PI).transform(new V3d(1, 0, 0));
    expect(r.y).toBeCloseTo(1);
  });
  it("Euclidean2d.translation/rotation", () => {
    expect(Euclidean2d.translation(new V2d(3, 4)).transform(new V2d(0, 0)).toArray()).toEqual([3, 4]);
    const r = Euclidean2d.rotation(HALF_PI).transform(new V2d(1, 0));
    expect(r.x).toBeCloseTo(0); expect(r.y).toBeCloseTo(1);
  });
});

describe("Affine factories", () => {
  it("Affine3d translation/scaling/rotation", () => {
    expect(Affine3d.translation(new V3d(1, 2, 3)).transform(new V3d(0, 0, 0)).toArray()).toEqual([1, 2, 3]);
    expect(Affine3d.scaling(2).transform(new V3d(1, 2, 3)).toArray()).toEqual([2, 4, 6]);
    const r = Affine3d.rotationY(HALF_PI).transform(new V3d(1, 0, 0));
    expect(r.z).toBeCloseTo(-1);
  });
  it("Affine2d translation/scaling/rotation", () => {
    expect(Affine2d.translation(new V2d(3, 4)).transform(new V2d(0, 0)).toArray()).toEqual([3, 4]);
    expect(Affine2d.scaling(2).transform(new V2d(1, 2)).toArray()).toEqual([2, 4]);
    const r = Affine2d.rotation(HALF_PI).transform(new V2d(1, 0));
    expect(r.x).toBeCloseTo(0); expect(r.y).toBeCloseTo(1);
  });
});

describe("Similarity factories", () => {
  it("Similarity3d translation/scaling/rotation", () => {
    expect(Similarity3d.translation(new V3d(1, 2, 3)).transform(new V3d(0, 0, 0)).toArray()).toEqual([1, 2, 3]);
    expect(Similarity3d.scaling(2).transform(new V3d(1, 2, 3)).toArray()).toEqual([2, 4, 6]);
    const r = Similarity3d.rotationZ(HALF_PI).transform(new V3d(1, 0, 0));
    expect(r.y).toBeCloseTo(1);
  });
  it("Similarity2d translation/scaling/rotation", () => {
    expect(Similarity2d.translation(new V2d(3, 4)).transform(new V2d(0, 0)).toArray()).toEqual([3, 4]);
    expect(Similarity2d.scaling(2).transform(new V2d(1, 2)).toArray()).toEqual([2, 4]);
    const r = Similarity2d.rotation(HALF_PI).transform(new V2d(1, 0));
    expect(r.x).toBeCloseTo(0); expect(r.y).toBeCloseTo(1);
  });
});

// ─── Aardvark.Base parity additions ────────────────────────────────────────

describe("parity — translation overloads (scalars + Shift)", () => {
  it("Trafo3d.translation(x,y,z) and Translation(Shift3d)", async () => {
    const { Shift3d } = await import("../../src/trafo/shift3d.js");
    expect(Trafo3d.translation(1, 2, 3).transform(V3d.zero).toArray()).toEqual([1, 2, 3]);
    expect(Trafo3d.translation(Shift3d.translation(new V3d(1, 2, 3))).transform(V3d.zero).toArray()).toEqual([1, 2, 3]);
  });
  it("Trafo2d.translation(x,y) and Translation(Shift2d)", async () => {
    const { Shift2d } = await import("../../src/trafo/shift2d.js");
    expect(Trafo2d.translation(1, 2).transform(V2d.zero).toArray()).toEqual([1, 2]);
    expect(Trafo2d.translation(Shift2d.translation(new V2d(1, 2))).transform(V2d.zero).toArray()).toEqual([1, 2]);
  });
  it("Affine3d/Euclidean3d/Similarity3d translate(x,y,z)", () => {
    expect(Affine3d.translation(1, 2, 3).transform(V3d.zero).toArray()).toEqual([1, 2, 3]);
    expect(Euclidean3d.translation(1, 2, 3).transform(V3d.zero).toArray()).toEqual([1, 2, 3]);
    expect(Similarity3d.translation(1, 2, 3).transform(V3d.zero).toArray()).toEqual([1, 2, 3]);
  });
  it("Affine2d/Euclidean2d/Similarity2d translate(x,y)", () => {
    expect(Affine2d.translation(1, 2).transform(V2d.zero).toArray()).toEqual([1, 2]);
    expect(Euclidean2d.translation(1, 2).transform(V2d.zero).toArray()).toEqual([1, 2]);
    expect(Similarity2d.translation(1, 2).transform(V2d.zero).toArray()).toEqual([1, 2]);
  });
});

describe("parity — scaling(x,y,z) and Scale*", () => {
  it("Trafo3d.scaling(2,3,4) and Scaling(Scale3d)", async () => {
    const { Scale3d } = await import("../../src/trafo/scale3d.js");
    expect(Trafo3d.scaling(2, 3, 4).transform(new V3d(1, 1, 1)).toArray()).toEqual([2, 3, 4]);
    expect(Trafo3d.scaling(Scale3d.uniform(5)).transform(new V3d(1, 1, 1)).toArray()).toEqual([5, 5, 5]);
  });
  it("Affine3d.scaling(2,3,4) and Scaling(Scale3d)", async () => {
    const { Scale3d } = await import("../../src/trafo/scale3d.js");
    expect(Affine3d.scaling(2, 3, 4).transform(new V3d(1, 1, 1)).toArray()).toEqual([2, 3, 4]);
    expect(Affine3d.scaling(Scale3d.uniform(5)).transform(new V3d(1, 1, 1)).toArray()).toEqual([5, 5, 5]);
  });
});

describe("parity — rotation(Rot*) overload + InDegrees", () => {
  it("Trafo3d.rotation(Rot3d) matches axis+rad", () => {
    const r = Rot3d.fromAxisAngle(new V3d(0, 0, 1), HALF_PI);
    const out = Trafo3d.rotation(r).transform(new V3d(1, 0, 0));
    expect(out.x).toBeCloseTo(0); expect(out.y).toBeCloseTo(1);
  });
  it("InDegrees variants on Trafo3d", () => {
    const a = Trafo3d.rotationXInDegrees(90).transform(new V3d(0, 1, 0));
    expect(a.z).toBeCloseTo(1);
    const b = Trafo3d.rotationInDegrees(new V3d(0, 0, 1), 90).transform(new V3d(1, 0, 0));
    expect(b.y).toBeCloseTo(1);
  });
  it("rotationEuler(V3d) and rotationEulerInDegrees", () => {
    const a = Trafo3d.rotationEuler(0.1, 0.2, 0.3);
    const b = Trafo3d.rotationEuler(new V3d(0.1, 0.2, 0.3));
    const p = new V3d(1, 1, 1);
    expect(a.transform(p).approxEqual(b.transform(p), 1e-12)).toBe(true);
    const c = Trafo3d.rotationEulerInDegrees(new V3d(0.1, 0.2, 0.3).mul(180 / Math.PI));
    expect(a.transform(p).approxEqual(c.transform(p), 1e-9)).toBe(true);
  });
  it("rotateInto on Trafo3d/Euclidean3d/Similarity3d/Affine3d/Rot3d", () => {
    const exp = new V3d(0, 1, 0);
    expect(Trafo3d.rotateInto(new V3d(1, 0, 0), exp).transform(new V3d(1, 0, 0)).approxEqual(exp, 1e-12)).toBe(true);
    expect(Euclidean3d.rotateInto(new V3d(1, 0, 0), exp).transform(new V3d(1, 0, 0)).approxEqual(exp, 1e-12)).toBe(true);
    expect(Similarity3d.rotateInto(new V3d(1, 0, 0), exp).transform(new V3d(1, 0, 0)).approxEqual(exp, 1e-12)).toBe(true);
    expect(Affine3d.rotateInto(new V3d(1, 0, 0), exp).transform(new V3d(1, 0, 0)).approxEqual(exp, 1e-12)).toBe(true);
    expect(Rot3d.rotateInto(new V3d(1, 0, 0), exp).transform(new V3d(1, 0, 0)).approxEqual(exp, 1e-12)).toBe(true);
  });
  it("rotationInDegrees on 2D types", () => {
    expect(Trafo2d.rotationInDegrees(90).transform(new V2d(1, 0)).y).toBeCloseTo(1);
    expect(Affine2d.rotationInDegrees(90).transform(new V2d(1, 0)).y).toBeCloseTo(1);
    expect(Euclidean2d.rotationInDegrees(90).transform(new V2d(1, 0)).y).toBeCloseTo(1);
    expect(Similarity2d.rotationInDegrees(90).transform(new V2d(1, 0)).y).toBeCloseTo(1);
  });
});

describe("parity — shear, view, projection, basis", () => {
  it("shearXY/XZ/YZ on Trafo3d", () => {
    expect(Trafo3d.shearXY(2, 0).transform(new V3d(1, 0, 0)).toArray()).toEqual([1, 0, 2]);
    expect(Trafo3d.shearXZ(2, 0).transform(new V3d(1, 0, 0)).toArray()).toEqual([1, 2, 0]);
    expect(Trafo3d.shearYZ(2, 0).transform(new V3d(0, 1, 0)).toArray()).toEqual([2, 1, 0]);
  });
  it("viewTrafoRH places eye at origin, looks toward -Z", () => {
    const eye = new V3d(0, 0, 5);
    const t = Trafo3d.viewTrafoRH(eye, new V3d(0, 1, 0), new V3d(0, 0, -1));
    expect(t.transform(eye).approxEqual(V3d.zero, 1e-9)).toBe(true);
  });
  it("orthoProjectionGL maps unit cube corners to ±1", () => {
    const t = Trafo3d.orthoProjectionGL(-1, 1, -1, 1, -1, 1);
    expect(t.transform(new V3d(1, 1, 1)).approxEqual(new V3d(1, 1, -1), 1e-12)).toBe(true);
    expect(t.transform(new V3d(-1, -1, -1)).approxEqual(new V3d(-1, -1, 1), 1e-12)).toBe(true);
  });
  it("fromBasis / fromOrthoNormalBasis", () => {
    const t1 = Trafo3d.fromBasis(new V3d(1, 0, 0), new V3d(0, 1, 0), new V3d(0, 0, 1), new V3d(5, 5, 5));
    expect(t1.transform(V3d.zero).approxEqual(new V3d(5, 5, 5), 1e-12)).toBe(true);
    // fwd maps (1,0,0) → xAxis. Use a 90° rotation about +Z as the basis:
    // xAxis = (0,1,0), yAxis = (-1,0,0), zAxis = (0,0,1).
    const t2 = Trafo3d.fromOrthoNormalBasis(new V3d(0, 1, 0), new V3d(-1, 0, 0), new V3d(0, 0, 1));
    expect(t2.transform(new V3d(1, 0, 0)).approxEqual(new V3d(0, 1, 0), 1e-12)).toBe(true);
    // backward inverts it: (0,1,0) → (1,0,0).
    expect(t2.inverseTransform(new V3d(0, 1, 0)).approxEqual(new V3d(1, 0, 0), 1e-12)).toBe(true);
  });
  it("Trafo2d.fromBasis / fromOrthoNormalBasis", () => {
    const t = Trafo2d.fromBasis(new V2d(1, 0), new V2d(0, 1), new V2d(5, 5));
    expect(t.transform(V2d.zero).approxEqual(new V2d(5, 5), 1e-12)).toBe(true);
  });
});

describe("parity — Rot3d/Rot3f InDegrees + rotateInto", () => {
  it("Rot3d rotationInDegrees + axis-aligned InDegrees", () => {
    const p = new V3d(1, 0, 0);
    expect(Rot3d.rotationInDegrees(new V3d(0, 0, 1), 90).transform(p).y).toBeCloseTo(1);
    expect(Rot3d.rotationXInDegrees(180).transform(new V3d(0, 1, 0)).y).toBeCloseTo(-1);
    expect(Rot3d.rotationYInDegrees(180).transform(p).x).toBeCloseTo(-1);
    expect(Rot3d.rotationZInDegrees(180).transform(p).x).toBeCloseTo(-1);
  });
  it("Rot3f rotationInDegrees + axis-aligned InDegrees", () => {
    expect(Rot3f.rotationInDegrees(new V3f(0, 0, 1), 90).transform(new V3f(1, 0, 0)).y).toBeCloseTo(1);
    expect(Rot3f.rotationXInDegrees(180).transform(new V3f(0, 1, 0)).y).toBeCloseTo(-1);
  });
  it("Rot3f.rotateInto", () => {
    const r = Rot3f.rotateInto(new V3f(1, 0, 0), new V3f(0, 1, 0));
    expect(r.transform(new V3f(1, 0, 0)).approxEqual(new V3f(0, 1, 0), 1e-6)).toBe(true);
  });
});

describe("parity — Shift/Scale overloads", () => {
  it("Shift3d.translation(x,y,z)", async () => {
    const { Shift3d } = await import("../../src/trafo/shift3d.js");
    expect(Shift3d.translation(1, 2, 3).transform(V3d.zero).toArray()).toEqual([1, 2, 3]);
  });
  it("Shift2d.translation(x,y)", async () => {
    const { Shift2d } = await import("../../src/trafo/shift2d.js");
    expect(Shift2d.translation(1, 2).transform(V2d.zero).toArray()).toEqual([1, 2]);
  });
  it("Scale3d.scaling overloads", async () => {
    const { Scale3d } = await import("../../src/trafo/scale3d.js");
    expect(Scale3d.scaling(2).transform(new V3d(1, 1, 1)).toArray()).toEqual([2, 2, 2]);
    expect(Scale3d.scaling(2, 3, 4).transform(new V3d(1, 1, 1)).toArray()).toEqual([2, 3, 4]);
    expect(Scale3d.scaling(new V3d(2, 3, 4)).transform(new V3d(1, 1, 1)).toArray()).toEqual([2, 3, 4]);
  });
  it("Scale2d.scaling overloads", async () => {
    const { Scale2d } = await import("../../src/trafo/scale2d.js");
    expect(Scale2d.scaling(2).transform(new V2d(1, 1)).toArray()).toEqual([2, 2]);
    expect(Scale2d.scaling(2, 3).transform(new V2d(1, 1)).toArray()).toEqual([2, 3]);
  });
});

describe("parity — M44d/M44f/M33d/M33f overloads", () => {
  it("M44d/M44f translation(x,y,z) + scaling(x,y,z) + shear", () => {
    expect(M44d.translation(1, 2, 3).transformPos(V3d.zero).toArray()).toEqual([1, 2, 3]);
    expect(M44f.translation(1, 2, 3).transformPos(new V3f(0, 0, 0)).toArray()).toEqual([1, 2, 3]);
    expect(M44d.scaling(2, 3, 4).transformDir(new V3d(1, 1, 1)).toArray()).toEqual([2, 3, 4]);
    expect(M44d.shearXY(2, 0).transformDir(new V3d(1, 0, 0)).toArray()).toEqual([1, 0, 2]);
  });
  it("M33d translation(x,y) + scaling(x,y)", () => {
    expect(M33d.translation(1, 2)._data[2]).toBe(1);
    expect(M33d.translation(1, 2)._data[5]).toBe(2);
    const s = M33d.scaling(2, 3);
    expect(s._data[0]).toBe(2);
    expect(s._data[4]).toBe(3);
  });
});
