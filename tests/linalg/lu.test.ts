import { describe, it, expect } from "vitest";
import { lu } from "../../src/linalg/lu.js";
import {
  fromM44d, matMul, newMatrixView,
} from "../../src/linalg/matrix-view.js";
import { M44d } from "../../src/matrix/m44d.js";

describe("LU decomposition", () => {
  it("L*U recovers P*A and determinant matches M44d.determinant", () => {
    const A = M44d.fromArray([
       3,  1,  4,  1,
       5,  9,  2,  6,
       5,  3,  5,  8,
       9,  7,  9,  3,
    ]);
    const view = fromM44d(A);
    const { L, U, P, sign } = lu(view);

    const LU = matMul(L, U);
    // Build P*A explicitly
    const n = 4;
    const PA = newMatrixView(n, n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        PA.data[i * n + j] = view.data[P[i]! * n + j]!;
      }
    }
    for (let i = 0; i < n * n; i++) {
      expect(Math.abs(LU.data[i]! - PA.data[i]!)).toBeLessThan(1e-10);
    }

    // det(A) = sign * prod(diag U)
    let detU = 1;
    for (let i = 0; i < n; i++) detU *= U.data[i * n + i]!;
    const detPredicted = sign * detU;
    expect(Math.abs(detPredicted - A.determinant())).toBeLessThan(1e-9);
  });

  it("throws on singular matrix", () => {
    const A = newMatrixView(3, 3);
    A.data.set([1, 2, 3, 2, 4, 6, 7, 8, 9]); // row 1 = 2 * row 0
    expect(() => lu(A)).toThrow();
  });

  it("accepts M44d directly", () => {
    const m = M44d.identity;
    const { L, U } = lu(m);
    expect(L.data[0]).toBe(1);
    expect(U.data[0]).toBe(1);
  });
});
