import { describe, it, expect } from "vitest";
import { Trafo3d } from "../../src/trafo/trafo3d.js";
import { Shift3d } from "../../src/trafo/shift3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Trafo3d / Shift3d — operators", () => {
  it("Trafo3d composition order: a * b means 'do a first, then b'", () => {
    // a translates by (1,0,0); b translates by (0,2,0).
    // (a * b).transform(origin) should equal b.transform(a.transform(origin))
    // = b.transform((1,0,0)) = (1,2,0).
    const a = Shift3d.translation(new V3d(1, 0, 0)).toTrafo3d();
    const b = Shift3d.translation(new V3d(0, 2, 0)).toTrafo3d();
    const composed = a * b;
    const out = composed.transform(new V3d(0, 0, 0));
    expect(out.toArray()).toEqual([1, 2, 0]);
  });

  it("Shift3d composition: standard math order (b first, then a)", () => {
    // Shift uses standard math convention: (a * b).transform(v) = a.transform(b.transform(v))
    const a = Shift3d.translation(new V3d(1, 0, 0));
    const b = Shift3d.translation(new V3d(0, 2, 0));
    const composed = a * b;
    expect(composed.transform(new V3d(0, 0, 0)).toArray()).toEqual([1, 2, 0]);
  });
});
