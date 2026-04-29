// QR decomposition via Householder reflections.
//
// For an m x n matrix A (m >= n typical, but algorithm handles any
// shape), produces:
//   Q : m x m orthogonal
//   R : m x n upper-triangular (zeros below the diagonal)
//   A = Q * R
//
// Reference: Golub & Van Loan, "Matrix Computations", §5.2.

import {
  type MatrixViewD,
  cloneMatrixView,
  newMatrixView,
  identityMatrixView,
} from "./matrix-view.js";

export interface QR {
  readonly Q: MatrixViewD;
  readonly R: MatrixViewD;
}

export function qr(a: MatrixViewD): QR {
  const m = a.rows, n = a.cols;
  const R = cloneMatrixView(a);
  const Q = identityMatrixView(m);

  const v = new Float64Array(m);
  const steps = Math.min(m - 1, n);

  for (let k = 0; k < steps; k++) {
    // build Householder vector v for column k of R, rows k..m-1
    let normSq = 0;
    for (let i = k; i < m; i++) {
      const x = R.data[i * n + k]!;
      v[i] = x;
      normSq += x * x;
    }
    const norm = Math.sqrt(normSq);
    if (norm === 0) continue;
    const x0 = v[k]!;
    const sign = x0 >= 0 ? 1 : -1;
    v[k] = x0 + sign * norm; // shift first component
    // recompute v^T v
    let vNormSq = 0;
    for (let i = k; i < m; i++) vNormSq += v[i]! * v[i]!;
    if (vNormSq === 0) continue;
    const beta = 2 / vNormSq;

    // R := H * R   (only columns k..n-1, rows k..m-1 are affected)
    for (let j = k; j < n; j++) {
      let dot = 0;
      for (let i = k; i < m; i++) dot += v[i]! * R.data[i * n + j]!;
      const f = beta * dot;
      for (let i = k; i < m; i++) {
        R.data[i * n + j] = R.data[i * n + j]! - f * v[i]!;
      }
    }

    // Q := Q * H   (apply on the right; affects columns k..m-1 of Q)
    for (let i = 0; i < m; i++) {
      let dot = 0;
      for (let j = k; j < m; j++) dot += Q.data[i * m + j]! * v[j]!;
      const f = beta * dot;
      for (let j = k; j < m; j++) {
        Q.data[i * m + j] = Q.data[i * m + j]! - f * v[j]!;
      }
    }
  }

  // clean numerical noise below diagonal of R
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < Math.min(i, n); j++) R.data[i * n + j] = 0;
  }
  return { Q, R };
}
