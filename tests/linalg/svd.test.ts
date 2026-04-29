import { describe, it, expect } from "vitest";
import { svd } from "../../src/linalg/svd.js";
import { matMul, transposeMatrix, newMatrixView, identityMatrixView } from "../../src/linalg/matrix-view.js";

function mulDiag(U: Float64Array, m: number, sigma: Float64Array, k: number, n: number, V: Float64Array) {
  // returns U * diag(sigma) * V^T  (m x n)
  const out = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      const lim = Math.min(k, m, n);
      for (let l = 0; l < lim; l++) {
        s += U[i * m + l]! * sigma[l]! * V[j * n + l]!;
      }
      out[i * n + j] = s;
    }
  }
  return out;
}

describe("SVD (two-sided Jacobi)", () => {
  it("A ≈ U * diag(s) * V^T for a 4x4", () => {
    const A = newMatrixView(4, 4);
    A.data.set([
       1,  2,  3,  4,
       5,  6,  7,  8,
       9, 10, 11, 12,
      13, 14, 15, 17, // perturbed slightly to avoid exact singularity
    ]);
    const { U, singularValues, V } = svd(A);

    // descending and non-negative
    for (let i = 0; i < singularValues.length; i++) {
      expect(singularValues[i]!).toBeGreaterThanOrEqual(0);
    }
    for (let i = 1; i < singularValues.length; i++) {
      expect(singularValues[i - 1]!).toBeGreaterThanOrEqual(singularValues[i]!);
    }

    // U, V orthogonal
    const UUt = matMul(U, transposeMatrix(U));
    const I4 = identityMatrixView(4).data;
    for (let i = 0; i < 16; i++) expect(Math.abs(UUt.data[i]! - I4[i]!)).toBeLessThan(1e-9);
    const VVt = matMul(V, transposeMatrix(V));
    for (let i = 0; i < 16; i++) expect(Math.abs(VVt.data[i]! - I4[i]!)).toBeLessThan(1e-9);

    // A ≈ U S V^T
    const recon = mulDiag(U.data, 4, singularValues, singularValues.length, 4, V.data);
    for (let i = 0; i < 16; i++) {
      expect(Math.abs(recon[i]! - A.data[i]!)).toBeLessThan(1e-8);
    }
  });

  it("handles a near-singular matrix", () => {
    const A = newMatrixView(4, 4);
    A.data.set([
      1, 2, 3, 4,
      2, 4, 6, 8,    // 2 * row 0
      0, 1, 0, 1,
      1, 0, 1, 0,
    ]);
    const { U, singularValues, V } = svd(A);
    // Smallest singular value should be effectively zero
    expect(singularValues[singularValues.length - 1]!).toBeLessThan(1e-9);
    // Reconstruct and verify
    const recon = mulDiag(U.data, 4, singularValues, singularValues.length, 4, V.data);
    for (let i = 0; i < 16; i++) {
      expect(Math.abs(recon[i]! - A.data[i]!)).toBeLessThan(1e-8);
    }
  });

  it("works on rectangular (5x3 and 3x5)", () => {
    const A = newMatrixView(5, 3);
    A.data.set([
      1, 2, 3,
      4, 5, 6,
      7, 8, 10,
      2, 1, 4,
      0, 1, 2,
    ]);
    const { U, singularValues, V } = svd(A);
    expect(U.rows).toBe(5);
    expect(V.rows).toBe(3);
    const recon = mulDiag(U.data, 5, singularValues, 3, 3, V.data);
    for (let i = 0; i < 15; i++) {
      expect(Math.abs(recon[i]! - A.data[i]!)).toBeLessThan(1e-8);
    }

    const B = newMatrixView(3, 5);
    B.data.set([
      1, 2, 3, 4, 5,
      6, 7, 8, 9, 1,
      2, 3, 4, 5, 6,
    ]);
    const r = svd(B);
    expect(r.U.rows).toBe(3);
    expect(r.V.rows).toBe(5);
    const recon2 = mulDiag(r.U.data, 3, r.singularValues, 3, 5, r.V.data);
    for (let i = 0; i < 15; i++) {
      expect(Math.abs(recon2[i]! - B.data[i]!)).toBeLessThan(1e-8);
    }
  });
});
