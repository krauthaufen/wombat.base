// Two-sided Jacobi SVD.
//
// For an m x n matrix A:
//   A = U * diag(s) * V^T
// where U is m x m orthogonal, V is n x n orthogonal, and `s` is a
// length-min(m, n) vector of non-negative singular values in
// descending order.
//
// Algorithm: one-sided Jacobi on A^T A is hard to keep numerically
// stable; we instead use the two-sided variant — work on a square
// "padded" matrix of size max(m,n) and apply Jacobi rotations on
// the right (V) until off-diagonal mass falls below tol * ||A||_F.
// For the common case of small matrices (the only case that matters
// for v0.1 — 4x4 transforms, 3x3 covariances, etc.) this converges
// in a handful of sweeps.
//
// Reference: Brent & Luk, "The Solution of Singular-Value and
// Symmetric Eigenvalue Problems on Multiprocessor Arrays" (1985).

import {
  type MatrixViewD,
  cloneMatrixView,
  identityMatrixView,
  newMatrixView,
} from "./matrix-view.js";

export interface SVD {
  readonly U: MatrixViewD;
  readonly singularValues: Float64Array;
  readonly V: MatrixViewD;
}

export function svd(
  a: MatrixViewD,
  opts?: { maxIter?: number; tol?: number },
): SVD {
  const m = a.rows;
  const n = a.cols;
  const maxIter = opts?.maxIter ?? 100;
  const tol = opts?.tol ?? 1e-14;

  // We run one-sided Jacobi on the columns of A: rotate column pairs
  // (p, q) so that they become orthogonal. After convergence the
  // norms of the columns are the singular values, the normalised
  // columns form U (extended to an orthonormal basis), and the
  // accumulated rotations form V.
  //
  // For m < n, we transpose, run, and swap U/V at the end — this
  // keeps the algorithm in the "tall or square" regime where the
  // bookkeeping is simpler.

  const transposed = m < n;
  const work = transposed ? transposeOf(a) : cloneMatrixView(a);
  const M = work.rows;
  const N = work.cols;

  // V starts as identity (n x n in the working orientation = N x N).
  const V = identityMatrixView(N);

  // Frobenius norm of A for the convergence threshold.
  let frobSq = 0;
  for (let i = 0; i < work.data.length; i++) frobSq += work.data[i]! * work.data[i]!;
  const frob = Math.sqrt(frobSq);
  const target = (tol * frob) * (tol * frob); // compare squared off-diagonal mass

  for (let sweep = 0; sweep < maxIter; sweep++) {
    let off = 0;
    for (let p = 0; p < N - 1; p++) {
      for (let q = p + 1; q < N; q++) {
        // dot products on columns p and q of `work`
        let alpha = 0; // ||col p||^2
        let beta = 0;  // ||col q||^2
        let gamma = 0; // <col p, col q>
        for (let i = 0; i < M; i++) {
          const xp = work.data[i * N + p]!;
          const xq = work.data[i * N + q]!;
          alpha += xp * xp;
          beta += xq * xq;
          gamma += xp * xq;
        }
        off += gamma * gamma;
        if (Math.abs(gamma) < 1e-30) continue;

        // Jacobi rotation that diagonalises the 2x2 block [[alpha, gamma],[gamma, beta]].
        const zeta = (beta - alpha) / (2 * gamma);
        let t: number;
        if (zeta === 0) {
          t = 1;
        } else if (zeta > 0) {
          t = 1 / (zeta + Math.sqrt(1 + zeta * zeta));
        } else {
          t = 1 / (zeta - Math.sqrt(1 + zeta * zeta));
        }
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;

        // apply rotation to columns p, q of work and V
        for (let i = 0; i < M; i++) {
          const xp = work.data[i * N + p]!;
          const xq = work.data[i * N + q]!;
          work.data[i * N + p] = c * xp - s * xq;
          work.data[i * N + q] = s * xp + c * xq;
        }
        for (let i = 0; i < N; i++) {
          const vp = V.data[i * N + p]!;
          const vq = V.data[i * N + q]!;
          V.data[i * N + p] = c * vp - s * vq;
          V.data[i * N + q] = s * vp + c * vq;
        }
      }
    }
    if (off <= target) break;
  }

  // Now `work` has orthogonal columns. Singular values are their norms.
  const k = Math.min(M, N);
  const sigma = new Float64Array(N);
  const U = newMatrixView(M, M);
  for (let j = 0; j < N; j++) {
    let s2 = 0;
    for (let i = 0; i < M; i++) s2 += work.data[i * N + j]! * work.data[i * N + j]!;
    sigma[j] = Math.sqrt(s2);
  }

  // Sort columns by descending singular value, building permutation.
  const order = Array.from({ length: N }, (_, i) => i);
  order.sort((x, y) => sigma[y]! - sigma[x]!);

  // Fill U's first k columns from normalised work columns (in sorted order).
  // For m > n we have N = n columns of work; the remaining M - n columns
  // of U get filled by extending to an orthonormal basis (modified
  // Gram-Schmidt against standard basis vectors).
  const sortedSigma = new Float64Array(k);
  const Vsorted = newMatrixView(N, N);
  for (let j = 0; j < N; j++) {
    const src = order[j]!;
    if (j < k) sortedSigma[j] = sigma[src]!;
    for (let i = 0; i < N; i++) Vsorted.data[i * N + j] = V.data[i * N + src]!;
  }
  for (let j = 0; j < Math.min(k, N); j++) {
    const src = order[j]!;
    const sj = sigma[src]!;
    if (sj > 0) {
      for (let i = 0; i < M; i++) U.data[i * M + j] = work.data[i * N + src]! / sj;
    }
  }

  // Extend U to a full orthonormal basis if needed (for j >= k or
  // for zero singular values).
  fillOrthonormal(U, k);

  if (transposed) {
    // Original A had m < n; we factored A^T = U' * S * V'^T.
    // Hence A = V' * S * U'^T, so the caller's U is our V (M x M = n x n)
    // and the caller's V is our U (N x N = m x m). But sizes differ:
    // we computed U as M x M (= n x n) and Vsorted as N x N (= m x m).
    // Need to repackage so that returned U is m x m and V is n x n.
    return { U: Vsorted, singularValues: sortedSigma, V: U };
  }
  return { U, singularValues: sortedSigma, V: Vsorted };
}

function transposeOf(a: MatrixViewD): MatrixViewD {
  const out = newMatrixView(a.cols, a.rows);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      out.data[j * a.rows + i] = a.data[i * a.cols + j]!;
    }
  }
  return out;
}

/**
 * U has its first `validCols` columns already filled with mutually
 * orthonormal vectors (some may be zero — those will be replaced).
 * Fill the remaining columns by orthogonalising standard basis
 * vectors against the existing columns (modified Gram-Schmidt).
 */
function fillOrthonormal(U: MatrixViewD, validCols: number): void {
  const M = U.rows;
  // First, replace any zero columns in [0, validCols) with orthogonal directions.
  const used = new Array<boolean>(M).fill(false);
  // Identify existing non-zero columns and lock them in.
  for (let j = 0; j < validCols; j++) {
    let nz = false;
    for (let i = 0; i < M; i++) if (U.data[i * M + j] !== 0) { nz = true; break; }
    if (!nz) {
      // need to fill this column too
      fillSingleColumn(U, j, used);
    }
  }
  for (let j = validCols; j < M; j++) {
    fillSingleColumn(U, j, used);
  }
}

function fillSingleColumn(U: MatrixViewD, col: number, used: boolean[]): void {
  const M = U.rows;
  // Pick a standard basis vector e_k that hasn't been "used".
  for (let attempt = 0; attempt < M; attempt++) {
    let k = -1;
    for (let i = 0; i < M; i++) if (!used[i]) { k = i; break; }
    if (k < 0) k = attempt; // fallback (shouldn't happen)
    const candidate = new Float64Array(M);
    candidate[k] = 1;
    used[k] = true;
    // orthogonalise against all already-filled columns of U (i.e. cols [0..col))
    for (let j = 0; j < col; j++) {
      let dot = 0;
      for (let i = 0; i < M; i++) dot += candidate[i]! * U.data[i * M + j]!;
      for (let i = 0; i < M; i++) candidate[i] = candidate[i]! - dot * U.data[i * M + j]!;
    }
    let nrm2 = 0;
    for (let i = 0; i < M; i++) nrm2 += candidate[i]! * candidate[i]!;
    if (nrm2 > 1e-24) {
      const inv = 1 / Math.sqrt(nrm2);
      for (let i = 0; i < M; i++) U.data[i * M + col] = candidate[i]! * inv;
      return;
    }
    // try next basis vector
  }
}
