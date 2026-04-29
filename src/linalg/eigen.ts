// Symmetric eigen-decomposition via cyclic Jacobi rotations.
//
// For a symmetric A, returns eigenvalues sorted in descending order
// and the corresponding eigenvectors as columns of `eigenvectors`:
//   A * v_i = lambda_i * v_i
//
// Reference: Golub & Van Loan §8.4.

import {
  type MatrixViewD,
  cloneMatrixView,
  identityMatrixView,
} from "./matrix-view.js";

export interface SymmetricEigen {
  readonly eigenvalues: Float64Array;
  readonly eigenvectors: MatrixViewD;
}

export function symmetricEigen(
  a: MatrixViewD,
  opts?: { maxIter?: number; tol?: number },
): SymmetricEigen {
  if (a.rows !== a.cols) {
    throw new Error(`[symmetricEigen] matrix must be square, got ${a.rows}x${a.cols}`);
  }
  const n = a.rows;
  const maxIter = opts?.maxIter ?? 100;
  const tol = opts?.tol ?? 1e-14;

  // Working copy A (mutated in place); V accumulates eigenvectors as columns.
  const A = cloneMatrixView(a).data;
  const V = identityMatrixView(n).data;

  function offDiag(): number {
    let s = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = A[i * n + j]!;
        s += v * v;
      }
    }
    return Math.sqrt(s);
  }

  // Frobenius scale for the convergence threshold.
  let frobSq = 0;
  for (let i = 0; i < n * n; i++) frobSq += A[i]! * A[i]!;
  const target = tol * Math.sqrt(frobSq);

  for (let sweep = 0; sweep < maxIter; sweep++) {
    if (offDiag() <= target) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q]!;
        if (Math.abs(apq) < 1e-300) continue;
        const app = A[p * n + p]!;
        const aqq = A[q * n + q]!;
        // compute rotation
        let t: number;
        if (Math.abs(apq) < 1e-30 * Math.abs(app - aqq)) {
          t = apq / (app - aqq);
        } else {
          const theta = (aqq - app) / (2 * apq);
          if (theta >= 0) {
            t = 1 / (theta + Math.sqrt(1 + theta * theta));
          } else {
            t = 1 / (theta - Math.sqrt(1 + theta * theta));
          }
        }
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;

        // update A: rotate rows/cols p and q
        A[p * n + p] = app - t * apq;
        A[q * n + q] = aqq + t * apq;
        A[p * n + q] = 0;
        A[q * n + p] = 0;
        for (let i = 0; i < n; i++) {
          if (i === p || i === q) continue;
          const aip = A[i * n + p]!;
          const aiq = A[i * n + q]!;
          A[i * n + p] = c * aip - s * aiq;
          A[p * n + i] = A[i * n + p]!;
          A[i * n + q] = s * aip + c * aiq;
          A[q * n + i] = A[i * n + q]!;
        }
        // update V: rotate columns p and q
        for (let i = 0; i < n; i++) {
          const vip = V[i * n + p]!;
          const viq = V[i * n + q]!;
          V[i * n + p] = c * vip - s * viq;
          V[i * n + q] = s * vip + c * viq;
        }
      }
    }
  }

  // collect eigenvalues, sort descending
  const idx = Array.from({ length: n }, (_, i) => i);
  const evals = new Float64Array(n);
  for (let i = 0; i < n; i++) evals[i] = A[i * n + i]!;
  idx.sort((x, y) => evals[y]! - evals[x]!);

  const eigenvalues = new Float64Array(n);
  const eigenvectors: MatrixViewD = { rows: n, cols: n, data: new Float64Array(n * n) };
  for (let k = 0; k < n; k++) {
    const src = idx[k]!;
    eigenvalues[k] = evals[src]!;
    for (let i = 0; i < n; i++) {
      eigenvectors.data[i * n + k] = V[i * n + src]!;
    }
  }
  return { eigenvalues, eigenvectors };
}
