import { describe, it, expect } from "vitest";
import { symmetricEigen } from "../../src/linalg/eigen.js";
import { matMul, transposeMatrix, newMatrixView, identityMatrixView } from "../../src/linalg/matrix-view.js";

describe("Symmetric eigen-decomposition (Jacobi)", () => {
  it("decomposes a known 4x4 symmetric matrix", () => {
    // Tridiagonal symmetric matrix
    const A = newMatrixView(4, 4);
    A.data.set([
       4, -1,  0,  0,
      -1,  4, -1,  0,
       0, -1,  4, -1,
       0,  0, -1,  4,
    ]);
    const { eigenvalues, eigenvectors } = symmetricEigen(A);

    // descending
    for (let i = 1; i < 4; i++) {
      expect(eigenvalues[i - 1]!).toBeGreaterThanOrEqual(eigenvalues[i]! - 1e-12);
    }

    // V * V^T = I
    const VVt = matMul(eigenvectors, transposeMatrix(eigenvectors));
    const I = identityMatrixView(4).data;
    for (let i = 0; i < 16; i++) {
      expect(Math.abs(VVt.data[i]! - I[i]!)).toBeLessThan(1e-10);
    }

    // A * v_i ≈ λ_i * v_i
    for (let i = 0; i < 4; i++) {
      const v = new Float64Array(4);
      for (let r = 0; r < 4; r++) v[r] = eigenvectors.data[r * 4 + i]!;
      const Av = new Float64Array(4);
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let c = 0; c < 4; c++) s += A.data[r * 4 + c]! * v[c]!;
        Av[r] = s;
      }
      for (let r = 0; r < 4; r++) {
        expect(Math.abs(Av[r]! - eigenvalues[i]! * v[r]!)).toBeLessThan(1e-9);
      }
    }
  });

  it("handles a diagonal matrix", () => {
    const A = newMatrixView(3, 3);
    A.data.set([5, 0, 0, 0, 1, 0, 0, 0, 3]);
    const { eigenvalues } = symmetricEigen(A);
    expect(eigenvalues[0]).toBe(5);
    expect(eigenvalues[1]).toBe(3);
    expect(eigenvalues[2]).toBe(1);
  });
});
