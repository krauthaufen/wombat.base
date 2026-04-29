import { describe, it, expect } from "vitest";
import { cholesky } from "../../src/linalg/cholesky.js";
import { matMul, transposeMatrix, newMatrixView } from "../../src/linalg/matrix-view.js";

describe("Cholesky decomposition", () => {
  it("L * L^T recovers a known SPD matrix", () => {
    // A = M^T M for a random-ish M, guaranteed SPD.
    const A = newMatrixView(4, 4);
    A.data.set([
      18,  22,  54,  42,
      22,  70,  86,  62,
      54,  86, 174, 134,
      42,  62, 134, 106,
    ]);
    const L = cholesky(A);
    const LLt = matMul(L, transposeMatrix(L));
    for (let i = 0; i < 16; i++) {
      expect(Math.abs(LLt.data[i]! - A.data[i]!)).toBeLessThan(1e-9);
    }
    // L is lower-triangular
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        expect(L.data[i * 4 + j]).toBe(0);
      }
    }
  });

  it("throws on non-SPD matrix", () => {
    const A = newMatrixView(2, 2);
    A.data.set([1, 2, 2, 1]); // eigenvalues -1 and 3
    expect(() => cholesky(A)).toThrow();
  });
});
