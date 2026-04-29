import { describe, it, expect } from "vitest";
import { solveLinear, solveLeastSquares } from "../../src/linalg/solve.js";
import { newMatrixView } from "../../src/linalg/matrix-view.js";

describe("solveLinear", () => {
  it("solves a known 4x4 system", () => {
    const A = newMatrixView(4, 4);
    A.data.set([
       3,  1,  4,  1,
       5,  9,  2,  6,
       5,  3,  5,  8,
       9,  7,  9,  3,
    ]);
    const expected = new Float64Array([1, -2, 3, 0.5]);
    // b = A * expected
    const b = new Float64Array(4);
    for (let i = 0; i < 4; i++) {
      let s = 0;
      for (let j = 0; j < 4; j++) s += A.data[i * 4 + j]! * expected[j]!;
      b[i] = s;
    }
    const x = solveLinear(A, b);
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(x[i]! - expected[i]!)).toBeLessThan(1e-10);
    }
    // round-trip A*x ≈ b
    for (let i = 0; i < 4; i++) {
      let s = 0;
      for (let j = 0; j < 4; j++) s += A.data[i * 4 + j]! * x[j]!;
      expect(Math.abs(s - b[i]!)).toBeLessThan(1e-9);
    }
  });
});

describe("solveLeastSquares", () => {
  it("minimises residual on overdetermined system (5 rows, 3 cols)", () => {
    const A = newMatrixView(5, 3);
    A.data.set([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
      1, 1, 1,
      1, 2, 3,
    ]);
    const b = new Float64Array([1, 2, 3, 6.1, 14.2]); // close to [1,2,3]
    const x = solveLeastSquares(A, b);

    // residual r = b - A*x; should be small (minimum norm by normal equations)
    const r = new Float64Array(5);
    for (let i = 0; i < 5; i++) {
      let s = b[i]!;
      for (let j = 0; j < 3; j++) s -= A.data[i * 3 + j]! * x[j]!;
      r[i] = s;
    }
    // perturb x slightly and confirm residual grows
    let baseRes = 0;
    for (let i = 0; i < 5; i++) baseRes += r[i]! * r[i]!;

    for (let dim = 0; dim < 3; dim++) {
      const x2 = new Float64Array(x);
      x2[dim] = x2[dim]! + 0.01;
      let res2 = 0;
      for (let i = 0; i < 5; i++) {
        let s = b[i]!;
        for (let j = 0; j < 3; j++) s -= A.data[i * 3 + j]! * x2[j]!;
        res2 += s * s;
      }
      expect(res2).toBeGreaterThan(baseRes - 1e-12);
    }
  });

  it("handles rank-deficient system via SVD pseudo-inverse without throwing", () => {
    const A = newMatrixView(4, 3);
    // columns 0 and 2 are linearly dependent (col2 = 2*col0)
    A.data.set([
      1, 0, 2,
      2, 1, 4,
      3, 1, 6,
      4, 0, 8,
    ]);
    // b in the column space
    const b = new Float64Array([3, 6, 9, 12]);
    const x = solveLeastSquares(A, b);
    expect(x.length).toBe(3);
    // verify A*x ≈ b within tolerance
    for (let i = 0; i < 4; i++) {
      let s = 0;
      for (let j = 0; j < 3; j++) s += A.data[i * 3 + j]! * x[j]!;
      expect(Math.abs(s - b[i]!)).toBeLessThan(1e-8);
    }
  });
});
