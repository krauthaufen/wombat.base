// Vector swizzle accessors — `.xy`, `.xyz`, `.zyx`, `.rgba`, …
// Installed on V2f/V3f/V4f prototypes at module load via
// `installSwizzles`. Verifies both the `xyzw` typed access and
// runtime-only `rgba` / `stpq` aliases.

import { describe, expect, it } from "vitest";
import { V2f, V3f, V4f } from "../../src/index.js";

describe("V2f swizzles", () => {
  const v = new V2f(1, 2);
  it(".xy → V2f", () => {
    const r = v.xy;
    expect(r).toBeInstanceOf(V2f);
    expect(r.x).toBe(1);
    expect(r.y).toBe(2);
  });
  it(".yx swaps", () => {
    const r = v.yx;
    expect(r.x).toBe(2);
    expect(r.y).toBe(1);
  });
  // V2f swizzles cap at length 2 — promoting to V3f/V4f goes
  // through the explicit `new V3f(v2.x, v2.y, z)` constructor form.
});

describe("V3f swizzles", () => {
  const v = new V3f(10, 20, 30);
  it(".xyz → identity-shaped V3f", () => {
    const r = v.xyz;
    expect(r).toBeInstanceOf(V3f);
    expect(r.x).toBe(10); expect(r.y).toBe(20); expect(r.z).toBe(30);
  });
  it(".xy / .yz / .xz pull pairs", () => {
    expect(v.xy.x).toBe(10); expect(v.xy.y).toBe(20);
    expect(v.yz.x).toBe(20); expect(v.yz.y).toBe(30);
    expect(v.xz.x).toBe(10); expect(v.xz.y).toBe(30);
  });
  it(".zyx reverses", () => {
    expect(v.zyx.x).toBe(30);
    expect(v.zyx.y).toBe(20);
    expect(v.zyx.z).toBe(10);
  });
  // V3f swizzles cap at length 3. Promoting to V4f via repeats
  // (`v3.xxxx`) isn't supported; use `new V4f(v3, w)` instead.
});

describe("V4f swizzles", () => {
  const v = new V4f(1, 2, 3, 4);
  it(".xyz drops w", () => {
    const r = v.xyz;
    expect(r).toBeInstanceOf(V3f);
    expect(r.x).toBe(1); expect(r.y).toBe(2); expect(r.z).toBe(3);
  });
  it(".wzyx fully reverses", () => {
    const r = v.wzyx;
    expect(r.x).toBe(4); expect(r.y).toBe(3); expect(r.z).toBe(2); expect(r.w).toBe(1);
  });
  it(".xy / .zw split", () => {
    expect(v.xy.x).toBe(1); expect(v.xy.y).toBe(2);
    expect(v.zw.x).toBe(3); expect(v.zw.y).toBe(4);
  });
});

describe("rgba / stpq alias families (runtime-only, dynamic access)", () => {
  it("V4f.rgba reads as the same vector", () => {
    const v = new V4f(1, 2, 3, 4);
    // Untyped indexer — rgba family isn't on the V4f static type
    // (would clash with `abs` / `lt` etc.) but is registered on
    // the prototype at load time.
    const r = (v as unknown as Record<string, V4f>)["rgba"]!;
    expect(r).toBeInstanceOf(V4f);
    expect(r.x).toBe(1); expect(r.y).toBe(2); expect(r.z).toBe(3); expect(r.w).toBe(4);
  });
  it("V3f.bgr reverses (dynamic)", () => {
    const v = new V3f(1, 2, 3);
    const r = (v as unknown as Record<string, V3f>)["bgr"]!;
    expect(r.x).toBe(3); expect(r.y).toBe(2); expect(r.z).toBe(1);
  });
  it("V2f.st aliases xy", () => {
    const v = new V2f(7, 8);
    const r = (v as unknown as Record<string, V2f>)["st"]!;
    expect(r.x).toBe(7); expect(r.y).toBe(8);
  });
});

describe("swizzle independence — modifying source doesn't mutate result", () => {
  it("V3f.xyz returns a fresh V3f", () => {
    const v = new V3f(1, 2, 3);
    const r = v.xyz;
    v.x = 999;
    expect(r.x).toBe(1);
  });
});

describe("static I/O constants (1=I, 0=O bit-pattern combinations)", () => {
  it("V2f: OO/OI/IO/II", () => {
    expect(V2f.OO.x).toBe(0); expect(V2f.OO.y).toBe(0);
    expect(V2f.OI.x).toBe(0); expect(V2f.OI.y).toBe(1);
    expect(V2f.IO.x).toBe(1); expect(V2f.IO.y).toBe(0);
    expect(V2f.II.x).toBe(1); expect(V2f.II.y).toBe(1);
  });

  it("V3f: all 8 combinations match unitX/unitY/unitZ/zero/one alternatives", () => {
    expect(V3f.IOO).toBe(V3f.IOO); // referenced statically
    expect(V3f.IOO.x).toBe(1); expect(V3f.IOO.y).toBe(0); expect(V3f.IOO.z).toBe(0);
    expect(V3f.OIO.x).toBe(0); expect(V3f.OIO.y).toBe(1); expect(V3f.OIO.z).toBe(0);
    expect(V3f.OOI.x).toBe(0); expect(V3f.OOI.y).toBe(0); expect(V3f.OOI.z).toBe(1);
    expect(V3f.III.x).toBe(1); expect(V3f.III.y).toBe(1); expect(V3f.III.z).toBe(1);
    expect(V3f.OOO.x).toBe(0); expect(V3f.OOO.y).toBe(0); expect(V3f.OOO.z).toBe(0);
    expect(V3f.IIO.x).toBe(1); expect(V3f.IIO.y).toBe(1); expect(V3f.IIO.z).toBe(0);
    expect(V3f.OII.x).toBe(0); expect(V3f.OII.y).toBe(1); expect(V3f.OII.z).toBe(1);
    expect(V3f.IOI.x).toBe(1); expect(V3f.IOI.y).toBe(0); expect(V3f.IOI.z).toBe(1);
  });

  it("V4f: spot-check the 16 combinations", () => {
    expect(V4f.IOOI.x).toBe(1); expect(V4f.IOOI.y).toBe(0); expect(V4f.IOOI.z).toBe(0); expect(V4f.IOOI.w).toBe(1);
    expect(V4f.OOOO.x).toBe(0); expect(V4f.OOOO.w).toBe(0);
    expect(V4f.IIII.x).toBe(1); expect(V4f.IIII.w).toBe(1);
    expect(V4f.OIIO.x).toBe(0); expect(V4f.OIIO.y).toBe(1); expect(V4f.OIIO.z).toBe(1); expect(V4f.OIIO.w).toBe(0);
    expect(V4f.IIOI.x).toBe(1); expect(V4f.IIOI.y).toBe(1); expect(V4f.IIOI.z).toBe(0); expect(V4f.IIOI.w).toBe(1);
  });
});
