// Generic dense float64 matrix view used by the linear-algebra
// algorithms (LU, QR, Cholesky, symmetric eigen, SVD).
//
// Storage is ROW-MAJOR: element (r, c) lives at `data[r * cols + c]`.
// All linalg algorithms work in float64 internally; float32 inputs
// (M22f / M33f / M44f) get converted up to f64 for the computation
// and converted back to f32 by the caller-visible result type.

import { M22d } from "../matrix/m22d.js";
import { M33d } from "../matrix/m33d.js";
import { M44d } from "../matrix/m44d.js";
import { M22f } from "../matrix/m22f.js";
import { M33f } from "../matrix/m33f.js";
import { M44f } from "../matrix/m44f.js";

export interface MatrixViewD {
  readonly rows: number;
  readonly cols: number;
  readonly data: Float64Array; // row-major, length rows*cols
}

export function newMatrixView(rows: number, cols: number): MatrixViewD {
  if (rows <= 0 || cols <= 0) throw new Error("[matrix-view] rows/cols must be positive");
  return { rows, cols, data: new Float64Array(rows * cols) };
}

export function cloneMatrixView(m: MatrixViewD): MatrixViewD {
  const out = newMatrixView(m.rows, m.cols);
  out.data.set(m.data);
  return out;
}

export function identityMatrixView(n: number): MatrixViewD {
  const out = newMatrixView(n, n);
  for (let i = 0; i < n; i++) out.data[i * n + i] = 1;
  return out;
}

// ---------- conversions: M??d ----------

export function fromM22d(m: M22d): MatrixViewD {
  const v = newMatrixView(2, 2);
  v.data.set(m._data);
  return v;
}

export function fromM33d(m: M33d): MatrixViewD {
  const v = newMatrixView(3, 3);
  v.data.set(m._data);
  return v;
}

export function fromM44d(m: M44d): MatrixViewD {
  const v = newMatrixView(4, 4);
  v.data.set(m._data);
  return v;
}

export function toM22d(view: MatrixViewD): M22d {
  if (view.rows !== 2 || view.cols !== 2) {
    throw new Error(`[matrix-view] toM22d: expected 2x2, got ${view.rows}x${view.cols}`);
  }
  const m = new M22d();
  for (let i = 0; i < 4; i++) m._data[i] = view.data[i]!;
  return m;
}

export function toM33d(view: MatrixViewD): M33d {
  if (view.rows !== 3 || view.cols !== 3) {
    throw new Error(`[matrix-view] toM33d: expected 3x3, got ${view.rows}x${view.cols}`);
  }
  const m = new M33d();
  for (let i = 0; i < 9; i++) m._data[i] = view.data[i]!;
  return m;
}

export function toM44d(view: MatrixViewD): M44d {
  if (view.rows !== 4 || view.cols !== 4) {
    throw new Error(`[matrix-view] toM44d: expected 4x4, got ${view.rows}x${view.cols}`);
  }
  const m = new M44d();
  for (let i = 0; i < 16; i++) m._data[i] = view.data[i]!;
  return m;
}

// ---------- conversions: M??f (lossy through f32) ----------

export function fromM22f(m: M22f): MatrixViewD {
  const v = newMatrixView(2, 2);
  for (let i = 0; i < 4; i++) v.data[i] = m._data[i]!;
  return v;
}

export function fromM33f(m: M33f): MatrixViewD {
  const v = newMatrixView(3, 3);
  for (let i = 0; i < 9; i++) v.data[i] = m._data[i]!;
  return v;
}

export function fromM44f(m: M44f): MatrixViewD {
  const v = newMatrixView(4, 4);
  for (let i = 0; i < 16; i++) v.data[i] = m._data[i]!;
  return v;
}

export function toM22f(view: MatrixViewD): M22f {
  if (view.rows !== 2 || view.cols !== 2) {
    throw new Error(`[matrix-view] toM22f: expected 2x2, got ${view.rows}x${view.cols}`);
  }
  const m = new M22f();
  for (let i = 0; i < 4; i++) m._data[i] = view.data[i]!;
  return m;
}

export function toM33f(view: MatrixViewD): M33f {
  if (view.rows !== 3 || view.cols !== 3) {
    throw new Error(`[matrix-view] toM33f: expected 3x3, got ${view.rows}x${view.cols}`);
  }
  const m = new M33f();
  for (let i = 0; i < 9; i++) m._data[i] = view.data[i]!;
  return m;
}

export function toM44f(view: MatrixViewD): M44f {
  if (view.rows !== 4 || view.cols !== 4) {
    throw new Error(`[matrix-view] toM44f: expected 4x4, got ${view.rows}x${view.cols}`);
  }
  const m = new M44f();
  for (let i = 0; i < 16; i++) m._data[i] = view.data[i]!;
  return m;
}

// ---------- shared helpers ----------

/** dense matrix multiply A (m x k) * B (k x n) -> out (m x n). */
export function matMul(a: MatrixViewD, b: MatrixViewD): MatrixViewD {
  if (a.cols !== b.rows) {
    throw new Error(`[matrix-view] matMul: shape mismatch ${a.rows}x${a.cols} * ${b.rows}x${b.cols}`);
  }
  const m = a.rows, k = a.cols, n = b.cols;
  const out = newMatrixView(m, n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let p = 0; p < k; p++) s += a.data[i * k + p]! * b.data[p * n + j]!;
      out.data[i * n + j] = s;
    }
  }
  return out;
}

/** transpose. */
export function transposeMatrix(a: MatrixViewD): MatrixViewD {
  const out = newMatrixView(a.cols, a.rows);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      out.data[j * a.rows + i] = a.data[i * a.cols + j]!;
    }
  }
  return out;
}

/** Frobenius norm (square root of sum of squares). */
export function frobenius(a: MatrixViewD): number {
  let s = 0;
  for (let i = 0; i < a.data.length; i++) {
    const v = a.data[i]!;
    s += v * v;
  }
  return Math.sqrt(s);
}
