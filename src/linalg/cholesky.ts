// Cholesky decomposition: A = L L^T for symmetric positive-definite A.
//
// Banachiewicz (row-by-row) variant; throws if A is not SPD (i.e.
// a non-positive number is encountered on the diagonal during factor).

import { type MatrixViewD, newMatrixView } from "./matrix-view.js";

export function cholesky(a: MatrixViewD): MatrixViewD {
  if (a.rows !== a.cols) {
    throw new Error(`[cholesky] matrix must be square, got ${a.rows}x${a.cols}`);
  }
  const n = a.rows;
  const L = newMatrixView(n, n);
  const A = a.data;
  const Ld = L.data;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i * n + j]!;
      for (let k = 0; k < j; k++) {
        sum -= Ld[i * n + k]! * Ld[j * n + k]!;
      }
      if (i === j) {
        if (sum <= 0) {
          throw new Error("[cholesky] matrix is not symmetric positive-definite");
        }
        Ld[i * n + j] = Math.sqrt(sum);
      } else {
        Ld[i * n + j] = sum / Ld[j * n + j]!;
      }
    }
  }
  return L;
}
