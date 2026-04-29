// Linear solve and least-squares solve.
//
//   solveLinear(A, b)         — square A; uses LU; throws if singular.
//   solveLeastSquares(A, b)   — m x n A; uses QR; falls through to
//                               SVD pseudo-inverse for rank-deficient
//                               cases.

import { type MatrixViewD } from "./matrix-view.js";
import { lu, applyPermutation } from "./lu.js";
import { qr } from "./qr.js";
import { svd } from "./svd.js";

const RANK_TOL = 1e-12;

export function solveLinear(a: MatrixViewD, b: Float64Array): Float64Array {
  if (a.rows !== a.cols) {
    throw new Error(`[solveLinear] matrix must be square, got ${a.rows}x${a.cols}`);
  }
  if (b.length !== a.rows) {
    throw new Error(`[solveLinear] b length ${b.length} doesn't match A rows ${a.rows}`);
  }
  const { L, U, P } = lu(a);
  const n = a.rows;
  const pb = applyPermutation(P, b);
  // forward solve L y = pb
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = pb[i]!;
    for (let j = 0; j < i; j++) s -= L.data[i * n + j]! * y[j]!;
    y[i] = s; // L has unit diagonal
  }
  // back solve U x = y
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]!;
    for (let j = i + 1; j < n; j++) s -= U.data[i * n + j]! * x[j]!;
    const d = U.data[i * n + i]!;
    if (d === 0) throw new Error("[solveLinear] singular matrix");
    x[i] = s / d;
  }
  return x;
}

export function solveLeastSquares(a: MatrixViewD, b: Float64Array): Float64Array {
  const m = a.rows, n = a.cols;
  if (b.length !== m) {
    throw new Error(`[solveLeastSquares] b length ${b.length} doesn't match A rows ${m}`);
  }

  // QR path. If R has any near-zero diagonal in the leading min(m,n)
  // block, we treat the system as rank-deficient and switch to SVD.
  const { Q, R } = qr(a);
  const k = Math.min(m, n);

  let r0 = 0;
  for (let i = 0; i < k; i++) {
    const d = Math.abs(R.data[i * n + i]!);
    if (d > r0) r0 = d;
  }
  let rankDeficient = false;
  if (r0 === 0) rankDeficient = true;
  else {
    for (let i = 0; i < k; i++) {
      if (Math.abs(R.data[i * n + i]!) < RANK_TOL * r0) { rankDeficient = true; break; }
    }
  }
  if (m < n) rankDeficient = true; // QR back-sub needs m >= n

  if (!rankDeficient) {
    // y = Q^T b; back-solve R[:n,:n] x = y[:n]
    const y = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      let s = 0;
      for (let j = 0; j < m; j++) s += Q.data[j * m + i]! * b[j]!;
      y[i] = s;
    }
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i]!;
      for (let j = i + 1; j < n; j++) s -= R.data[i * n + j]! * x[j]!;
      x[i] = s / R.data[i * n + i]!;
    }
    return x;
  }

  // SVD pseudo-inverse: x = V * S^+ * U^T * b
  const { U, singularValues, V } = svd(a);
  let smax = 0;
  for (let i = 0; i < singularValues.length; i++) {
    if (singularValues[i]! > smax) smax = singularValues[i]!;
  }
  const cutoff = RANK_TOL * smax;

  // u = U^T * b (length m)
  const u = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    let s = 0;
    for (let j = 0; j < m; j++) s += U.data[j * m + i]! * b[j]!;
    u[i] = s;
  }
  // scale by 1/sigma where sigma > cutoff (length min(m,n))
  const kk = Math.min(m, n);
  const z = new Float64Array(n);
  for (let i = 0; i < kk; i++) {
    const sv = singularValues[i]!;
    z[i] = sv > cutoff ? u[i]! / sv : 0;
  }
  // x = V * z
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += V.data[i * n + j]! * z[j]!;
    x[i] = s;
  }
  return x;
}
