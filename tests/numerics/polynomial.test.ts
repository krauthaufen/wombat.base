// Verbatim port of Aardvark.Tests.PolynomialTests (NUnit → Vitest).
//
// The two heavy-weight RootsTest3 / RootsTest4 sweeps multiply a chain of
// linear factors `(x - x_i)` and verify that `realRoots` recovers the
// original roots within a tight epsilon. They cover unique, double and
// triple-root cases and pin numerical accuracy across the
// Casus-Irreducibilis / Cardano / Ferrari branches.
//
// Step sizes (`0.04`, `0.125`) match the C# `TestPolynomial` test method.

import { describe, it, expect } from "vitest";
import { Polynomial } from "../../src/numerics/polynomial.js";

const POSITIVE_TINY = 4 * Number.EPSILON;

function countDoubles(a: readonly number[], eps: number): number {
  const len = a.length;
  if (len < 2) return 0;
  let count = 0;
  if (Math.abs(a[0]! - a[1]!) < eps) count++;
  if (len < 3) return count;
  if (Math.abs(a[1]! - a[2]!) < eps) count++;
  if (len < 4) return count;
  if (Math.abs(a[2]! - a[3]!) < eps) count++;
  return count;
}

function ascending(...xs: number[]): number[] {
  return [...xs].sort((a, b) => a - b);
}

function mergeAscending(a: readonly number[], b: readonly number[]): number[] {
  const out = [...a, ...b];
  out.sort((x, y) => x - y);
  return out;
}

describe("Polynomial.derivative / multiply / evaluate", () => {
  it("derivative of `5 + 3x + 2x^2` is `3 + 4x`", () => {
    const d = Polynomial.derivative([5, 3, 2]);
    expect(d).toEqual([3, 4]);
  });

  it("multiply: (x - 1)(x - 2) = 2 - 3x + x^2", () => {
    const c = Polynomial.multiply([-1, 1], [-2, 1]);
    expect(c).toEqual([2, -3, 1]);
  });

  it("evaluate: P(x) = 1 + 2x + 3x^2 at x = 4 → 57", () => {
    expect(Polynomial.evaluate([1, 2, 3], 4)).toBe(57);
  });
});

describe("Polynomial.realRoot / realRootsOf (linear & quadratic)", () => {
  it("linear: a = 0 → NaN", () => {
    expect(Polynomial.realRoot(0, 5)).toBeNaN();
  });

  it("linear: 2x - 6 = 0 → 3", () => {
    expect(Polynomial.realRoot(2, -6)).toBeCloseTo(3, 12);
  });

  it("quadratic: x^2 - 5x + 6 = 0 → roots {2, 3} (any order)", () => {
    const r = Polynomial.realRootsOf(1, -5, 6);
    const sorted = ascending(...r.filter(x => !Number.isNaN(x)));
    expect(sorted[0]).toBeCloseTo(2, 12);
    expect(sorted[1]).toBeCloseTo(3, 12);
  });

  it("quadratic: no real root → both NaN", () => {
    const r = Polynomial.realRootsOf(1, 0, 1);
    expect(r[0]).toBeNaN();
    expect(r[1]).toBeNaN();
  });

  it("quadratic: a = 0 falls through to linear", () => {
    const r = Polynomial.realRootsOf(0, 2, -6);
    expect(r[0]).toBeCloseTo(3, 12);
    expect(r[1]).toBeNaN();
  });

  it("quadratic: avoids cancellation for very negative b", () => {
    // x^2 - 1e8 x + 1 = 0 → roots ≈ 1e8 and ≈ 1e-8.
    // The naive formula loses the small root entirely.
    const r = Polynomial.realRootsOf(1, -1e8, 1);
    const sorted = ascending(...r.filter(x => !Number.isNaN(x)));
    expect(sorted[0]).toBeCloseTo(1e-8, 14);
    expect(sorted[1]).toBeCloseTo(1e8, 0);
  });
});

describe("Polynomial.realRoots (array helper)", () => {
  it("ascending coefficient form: -6 + 2x → root 3", () => {
    const roots = Polynomial.realRoots([-6, 2]);
    expect(roots).toHaveLength(1);
    expect(roots[0]).toBeCloseTo(3, 12);
  });

  it("constant polynomial has no roots", () => {
    const roots = Polynomial.realRoots([-6, 0]);
    expect(roots).toEqual([]);
  });
});

describe("Polynomial.realRootsOf (cubic) — Casus Irreducibilis", () => {
  it("x^3 - 3x = 0 → {-√3, 0, √3}", () => {
    const r = Polynomial.realRootsOf(1, 0, -3, 0);
    const s = ascending(...r.filter(x => !Number.isNaN(x)));
    expect(s).toHaveLength(3);
    expect(s[0]).toBeCloseTo(-Math.sqrt(3), 12);
    expect(s[1]).toBeCloseTo(0, 12);
    expect(s[2]).toBeCloseTo(Math.sqrt(3), 12);
  });

  it("(x - 1)(x - 2)(x - 3) → {1, 2, 3}", () => {
    const p123 = Polynomial.multiply(
      Polynomial.multiply([-1, 1], [-2, 1]),
      [-3, 1],
    );
    const r = Polynomial.realRoots(p123);
    expect(r).toHaveLength(3);
    expect(r[0]).toBeCloseTo(1, 12);
    expect(r[1]).toBeCloseTo(2, 12);
    expect(r[2]).toBeCloseTo(3, 12);
  });

  it("(x + 1)^3 = x^3 + 3x^2 + 3x + 1 → triple root -1", () => {
    const r = Polynomial.realRootsOf(1, 3, 3, 1);
    for (const x of r) expect(x).toBeCloseTo(-1, 5);
  });
});

describe("Polynomial.realRootsOf (quartic) — Ferrari", () => {
  it("(x - 1)(x - 2)(x - 3)(x - 4)", () => {
    const p = Polynomial.multiply(
      Polynomial.multiply(Polynomial.multiply([-1, 1], [-2, 1]), [-3, 1]),
      [-4, 1],
    );
    const r = Polynomial.realRoots(p);
    expect(r).toHaveLength(4);
    expect(r[0]).toBeCloseTo(1, 10);
    expect(r[1]).toBeCloseTo(2, 10);
    expect(r[2]).toBeCloseTo(3, 10);
    expect(r[3]).toBeCloseTo(4, 10);
  });

  it("biquadratic x^4 - 5x^2 + 4 → {-2, -1, 1, 2}", () => {
    const r = Polynomial.realRootsOf(1, 0, -5, 0, 4);
    const s = ascending(...r.filter(x => !Number.isNaN(x)));
    expect(s).toHaveLength(4);
    expect(s[0]).toBeCloseTo(-2, 12);
    expect(s[1]).toBeCloseTo(-1, 12);
    expect(s[2]).toBeCloseTo(1, 12);
    expect(s[3]).toBeCloseTo(2, 12);
  });

  it("a = 0 → falls through to cubic", () => {
    const r = Polynomial.realRootsOf(0, 1, -6, 11, -6);
    const s = ascending(...r.filter(x => !Number.isNaN(x)));
    expect(s).toHaveLength(3);
    expect(s[0]).toBeCloseTo(1, 10);
    expect(s[1]).toBeCloseTo(2, 10);
    expect(s[2]).toBeCloseTo(3, 10);
  });
});

describe("Polynomial.withoutDoubleRoots", () => {
  it("collapses pairs within epsilon", () => {
    expect(Polynomial.withoutDoubleRoots([1, 1, 2], 0.001)).toEqual([2]);
    expect(Polynomial.withoutDoubleRoots([1, 2, 2, 3], 0.001)).toEqual([1, 3]);
  });
});

// ---- heavy-weight numerical sweeps (port of RootsTest3 / RootsTest4) ----

function rootsTest3(step: number, epsilon: number): void {
  const half = 0.5 * step;
  for (let x0 = -1.0; x0 < 1.0 + half; x0 += step) {
    const p0 = [-x0, 1.0];
    for (let x1 = -1.0; x1 < 1.0 + half; x1 += step) {
      const p1 = [-x1, 1.0];
      const p01 = Polynomial.multiply(p0, p1);
      for (let x2 = -1.0; x2 < 1.0 + half; x2 += step) {
        const p2 = [-x2, 1.0];
        const p012 = Polynomial.multiply(p01, p2);
        const exact = ascending(x0, x1, x2);
        const roots = Polynomial.realRoots(p012);
        expect(roots.length).toBe(exact.length);
        for (let i = 0; i < 3; i++) {
          expect(Math.abs(exact[i]! - roots[i]!)).toBeLessThan(epsilon);
        }
      }
    }
  }
}

function rootsTest4(step: number, epsilon: number): void {
  const half = 0.5 * step;
  for (let x0 = -1.0; x0 < 1.0 + half; x0 += step) {
    const p0 = [-x0, 1.0];
    for (let x1 = -1.0; x1 < 1.0 + half; x1 += step) {
      const p1 = [-x1, 1.0];
      const p01 = Polynomial.multiply(p0, p1);
      for (let x2 = -1.0; x2 < 1.0 + half; x2 += step) {
        const p2 = [-x2, 1.0];
        const p012 = Polynomial.multiply(p01, p2);
        const t = ascending(x0, x1, x2);
        for (let x3 = -1.0; x3 < 1.0 + half; x3 += step) {
          const p3 = [-x3, 1.0];
          const p0123 = Polynomial.multiply(p012, p3);
          let exact = mergeAscending([x3], t);
          let roots = Polynomial.realRoots(p0123);

          countDoubles(exact, epsilon); // (parity with C# — value unused)

          if (roots.length !== exact.length) {
            exact = Polynomial.withoutDoubleRoots(exact, epsilon);
            roots = Polynomial.withoutDoubleRoots(roots, epsilon);
            expect(roots.length).toBe(exact.length);
          }
          for (let i = 0; i < exact.length; i++) {
            expect(Math.abs(exact[i]! - roots[i]!)).toBeLessThan(epsilon);
          }
        }
      }
    }
  }
}

describe("Polynomial root-recovery sweep (Aardvark TestPolynomial)", () => {
  // C# uses `Fun.Cbrt(PositiveTinyValue)` ≈ 9.6e-6 for cubics
  // and `4 * Fun.Cbrt(PositiveTinyValue)` ≈ 3.85e-5 for quartics.
  const epsCubic = Math.cbrt(POSITIVE_TINY);
  const epsQuartic = 4 * Math.cbrt(POSITIVE_TINY);

  it("cubic root recovery (step = 0.04)", () => {
    rootsTest3(0.04, epsCubic);
  });

  it("quartic root recovery (step = 0.125)", () => {
    rootsTest4(0.125, epsQuartic);
  });
});
