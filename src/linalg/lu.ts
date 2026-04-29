// LU decomposition with partial (row) pivoting.
//
// PA = LU, with L unit-lower-triangular and U upper-triangular.
// `P` is a permutation list: row `i` of the original A maps to row
// `P[i]` of `PA`. Equivalently, `(PA)[i] = A[P[i]]`.
//
// Reference: Numerical Recipes, LAPACK DGETRF (Doolittle variant).
//
// Accepts MatrixViewD or any of M22d/M33d/M44d (and M22f/M33f/M44f
// — converted to f64 for the factorisation; the L/U/P returned are
// MatrixViewD in f64).

import {
  type MatrixViewD,
  cloneMatrixView,
  newMatrixView,
  fromM22d, fromM33d, fromM44d,
} from "./matrix-view.js";
import { M22d } from "../matrix/m22d.js";
import { M33d } from "../matrix/m33d.js";
import { M44d } from "../matrix/m44d.js";

export interface LU {
  readonly L: MatrixViewD;
  readonly U: MatrixViewD;
  readonly P: number[];
  readonly sign: 1 | -1;
}

export function lu(a: MatrixViewD): LU;
export function lu(a: M22d): LU;
export function lu(a: M33d): LU;
export function lu(a: M44d): LU;
export function lu(a: MatrixViewD | M22d | M33d | M44d): LU {
  const view =
    a instanceof M22d ? fromM22d(a) :
    a instanceof M33d ? fromM33d(a) :
    a instanceof M44d ? fromM44d(a) :
    cloneMatrixView(a);

  if (view.rows !== view.cols) {
    throw new Error(`[lu] matrix must be square, got ${view.rows}x${view.cols}`);
  }
  const n = view.rows;
  const m = view.data; // working copy; will hold L (below diag) and U (on/above diag) at the end

  const P = new Array<number>(n);
  for (let i = 0; i < n; i++) P[i] = i;
  let sign: 1 | -1 = 1;

  for (let k = 0; k < n; k++) {
    // partial pivot: find max |m[i,k]| for i in [k..n)
    let maxAbs = Math.abs(m[k * n + k]!);
    let pivot = k;
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(m[i * n + k]!);
      if (v > maxAbs) { maxAbs = v; pivot = i; }
    }
    if (maxAbs === 0) {
      throw new Error("[lu] singular matrix");
    }
    if (pivot !== k) {
      // swap rows k and pivot
      for (let j = 0; j < n; j++) {
        const t = m[k * n + j]!;
        m[k * n + j] = m[pivot * n + j]!;
        m[pivot * n + j] = t;
      }
      const tp = P[k]!; P[k] = P[pivot]!; P[pivot] = tp;
      sign = -sign as 1 | -1;
    }
    // eliminate below
    const pivVal = m[k * n + k]!;
    for (let i = k + 1; i < n; i++) {
      const f = m[i * n + k]! / pivVal;
      m[i * n + k] = f; // store multiplier in L position
      for (let j = k + 1; j < n; j++) {
        m[i * n + j] = m[i * n + j]! - f * m[k * n + j]!;
      }
    }
  }

  const L = newMatrixView(n, n);
  const U = newMatrixView(n, n);
  for (let i = 0; i < n; i++) {
    L.data[i * n + i] = 1;
    for (let j = 0; j < i; j++) L.data[i * n + j] = m[i * n + j]!;
    for (let j = i; j < n; j++) U.data[i * n + j] = m[i * n + j]!;
  }
  return { L, U, P, sign };
}

/** Apply a permutation P (as returned by lu) to a vector b: out[i] = b[P[i]]. */
export function applyPermutation(P: number[], b: Float64Array): Float64Array {
  const n = P.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = b[P[i]!]!;
  return out;
}
