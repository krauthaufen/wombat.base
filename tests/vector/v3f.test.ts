import { describe, it, expect } from "vitest";
import { V3f } from "../../src/vector/v3f.js";
import { V3b } from "../../src/vector/v3b.js";

describe("V3f — construction", () => {
  it("default constructor is zero", () => {
    const v = new V3f();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });

  it("rounds to f32 on assignment", () => {
    const v = new V3f(1.1, 0, 0);
    expect(v.x).toBe(Math.fround(1.1));
    expect(v.x).not.toBe(1.1);     // not f64-precision
  });

  it("zero/one/unitX/unitY/unitZ are correct", () => {
    expect(V3f.zero.toArray()).toEqual([0, 0, 0]);
    expect(V3f.one.toArray()).toEqual([1, 1, 1]);
    expect(V3f.unitX.toArray()).toEqual([1, 0, 0]);
    expect(V3f.unitY.toArray()).toEqual([0, 1, 0]);
    expect(V3f.unitZ.toArray()).toEqual([0, 0, 1]);
  });

  it("splat assigns the same value to all components", () => {
    expect(V3f.splat(7).toArray()).toEqual([7, 7, 7]);
  });

  it("byteSize and componentCount agree with the storage layout", () => {
    expect(V3f.componentCount).toBe(3);
    expect(V3f.byteSize).toBe(12);
  });
});

describe("V3f — additive group", () => {
  it("add", () => {
    expect(new V3f(1, 2, 3).add(new V3f(10, 20, 30)).toArray()).toEqual([11, 22, 33]);
  });
  it("sub", () => {
    expect(new V3f(10, 20, 30).sub(new V3f(1, 2, 3)).toArray()).toEqual([9, 18, 27]);
  });
  it("neg", () => {
    expect(new V3f(1, -2, 3).neg().toArray()).toEqual([-1, 2, -3]);
  });
});

describe("V3f — vector space", () => {
  it("scalar multiply", () => {
    expect(new V3f(1, 2, 3).mul(2).toArray()).toEqual([2, 4, 6]);
  });
  it("Hadamard multiply", () => {
    expect(new V3f(1, 2, 3).mul(new V3f(2, 3, 4)).toArray()).toEqual([2, 6, 12]);
  });
  it("scalar divide", () => {
    expect(new V3f(2, 4, 6).div(2).toArray()).toEqual([1, 2, 3]);
  });
  it("component divide", () => {
    expect(new V3f(6, 12, 24).div(new V3f(2, 3, 4)).toArray()).toEqual([3, 4, 6]);
  });
  it("mod", () => {
    expect(new V3f(7, 8, 9).mod(3).toArray()).toEqual([1, 2, 0]);
  });
});

describe("V3f — geometry", () => {
  it("dot", () => {
    expect(new V3f(1, 2, 3).dot(new V3f(4, 5, 6))).toBe(32);
  });
  it("cross of unit X and Y is unit Z", () => {
    expect(V3f.unitX.cross(V3f.unitY).equals(V3f.unitZ)).toBe(true);
  });
  it("length / lengthSquared", () => {
    const v = new V3f(3, 4, 0);
    expect(v.lengthSquared()).toBe(25);
    expect(v.length()).toBe(5);
  });
  it("distance / distanceSquared", () => {
    const a = new V3f(1, 0, 0);
    const b = new V3f(4, 4, 0);
    expect(a.distanceSquared(b)).toBe(25);
    expect(a.distance(b)).toBe(5);
  });
  it("normalize gives unit length", () => {
    const v = new V3f(3, 4, 0).normalize();
    expect(v.length()).toBeCloseTo(1, 5);
  });
  it("normalizeSafe falls back on zero", () => {
    const fallback = V3f.unitX;
    expect(V3f.zero.normalizeSafe(fallback).equals(fallback)).toBe(true);
  });
  it("lerp halfway is the midpoint", () => {
    const a = V3f.zero;
    const b = V3f.one.mul(10);
    expect(a.lerp(b, 0.5).toArray()).toEqual([5, 5, 5]);
  });
});

describe("V3f — component-wise math", () => {
  it("abs", () => {
    expect(new V3f(-1, 2, -3).abs().toArray()).toEqual([1, 2, 3]);
  });
  it("min / max", () => {
    const a = new V3f(1, 5, 3);
    const b = new V3f(4, 2, 6);
    expect(a.min(b).toArray()).toEqual([1, 2, 3]);
    expect(a.max(b).toArray()).toEqual([4, 5, 6]);
  });
  it("clamp", () => {
    const v = new V3f(-1, 5, 100);
    const lo = V3f.zero;
    const hi = V3f.splat(10);
    expect(v.clamp(lo, hi).toArray()).toEqual([0, 5, 10]);
  });
  it("floor/ceil/round/fract/sign", () => {
    const v = new V3f(1.6, -1.6, 0);
    expect(v.floor().toArray()).toEqual([1, -2, 0]);
    expect(v.ceil().toArray()).toEqual([2, -1, 0]);
    expect(v.round().toArray()).toEqual([2, -2, 0]);
    expect(v.fract().toArray()).toEqual([
      Math.fround(1.6) - Math.floor(Math.fround(1.6)),
      Math.fround(-1.6) - Math.floor(Math.fround(-1.6)),
      0,
    ]);
    expect(v.sign().toArray()).toEqual([1, -1, 0]);
  });
});

describe("V3f — reductions", () => {
  it("min/max/sum components", () => {
    const v = new V3f(3, 1, 2);
    expect(v.minComp()).toBe(1);
    expect(v.maxComp()).toBe(3);
    expect(v.sumComp()).toBe(6);
  });
});

describe("V3f — equality / hashing / iteration", () => {
  it("equals is structural over the f32 stored values", () => {
    const a = new V3f(1.1, 2, 3);
    const b = new V3f(1.1, 2, 3);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(new V3f(1, 2, 3))).toBe(false);
  });

  it("approxEqual respects eps", () => {
    const a = new V3f(0, 0, 0);
    const b = new V3f(1e-7, 0, 0);
    expect(a.approxEqual(b, 1e-6)).toBe(true);
    expect(a.approxEqual(b, 1e-9)).toBe(false);
  });

  it("getHashCode is deterministic and equals-consistent", () => {
    const a = new V3f(1.5, -2.25, 7);
    const b = new V3f(1.5, -2.25, 7);
    expect(a.getHashCode()).toBe(b.getHashCode());
    const c = new V3f(1.5, -2.25, 8);
    expect(a.getHashCode()).not.toBe(c.getHashCode());
  });

  it("Symbol.iterator yields x, y, z", () => {
    const v = new V3f(7, 8, 9);
    expect([...v]).toEqual([7, 8, 9]);
  });
});

describe("V3f — component-wise comparison", () => {
  it("lt returns V3b", () => {
    const r = new V3f(1, 5, 3).lt(new V3f(2, 2, 4));
    expect(r).toBeInstanceOf(V3b);
    expect(r.toArray()).toEqual([true, false, true]);
  });
  it("le", () => {
    expect(new V3f(1, 2, 3).le(new V3f(1, 1, 4)).toArray()).toEqual([true, false, true]);
  });
  it("gt", () => {
    expect(new V3f(1, 2, 3).gt(new V3f(0, 2, 4)).toArray()).toEqual([true, false, false]);
  });
  it("ge", () => {
    expect(new V3f(1, 2, 3).ge(new V3f(1, 3, 3)).toArray()).toEqual([true, false, true]);
  });
  it("eq is component-wise (distinct from equals)", () => {
    expect(new V3f(1, 2, 3).eq(new V3f(1, 0, 3)).toArray()).toEqual([true, false, true]);
  });
  it("neq", () => {
    expect(new V3f(1, 2, 3).neq(new V3f(1, 0, 3)).toArray()).toEqual([false, true, false]);
  });
});

describe("V3f — alloc-free static variants", () => {
  it("addInto writes into target without allocation", () => {
    const a = new V3f(1, 2, 3);
    const b = new V3f(10, 20, 30);
    const t = new V3f();
    const r = V3f.addInto(a, b, t);
    expect(r).toBe(t);
    expect(t.toArray()).toEqual([11, 22, 33]);
  });

  it("addInto target may alias an input", () => {
    const a = new V3f(1, 2, 3);
    V3f.addInto(a, V3f.one, a);
    expect(a.toArray()).toEqual([2, 3, 4]);
  });

  it("mulInto handles scalar and vector RHS", () => {
    const t = new V3f();
    V3f.mulInto(new V3f(1, 2, 3), 2, t);
    expect(t.toArray()).toEqual([2, 4, 6]);
    V3f.mulInto(new V3f(1, 2, 3), new V3f(2, 3, 4), t);
    expect(t.toArray()).toEqual([2, 6, 12]);
  });
});
