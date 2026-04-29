import { describe, it, expect } from "vitest";
import { qr } from "../../src/linalg/qr.js";
import {
  fromM44d, matMul, transposeMatrix, identityMatrixView, newMatrixView,
} from "../../src/linalg/matrix-view.js";
import { M44d } from "../../src/matrix/m44d.js";

function approxEqual(a: Float64Array, b: Float64Array, eps: number) {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(eps);
  }
}

describe("QR decomposition (Householder)", () => {
  it("Q*R approx A and Q is orthogonal for a 4x4", () => {
    const A = fromM44d(M44d.fromArray([
      12, -51,   4,  2,
       6, 167, -68,  1,
      -4,  24, -41,  7,
       3,   2,   9, 11,
    ]));
    const { Q, R } = qr(A);
    const QR = matMul(Q, R);
    approxEqual(QR.data, A.data, 1e-9);
    // Q*Q^T = I
    const QQT = matMul(Q, transposeMatrix(Q));
    approxEqual(QQT.data, identityMatrixView(4).data, 1e-10);
    // R upper-triangular
    for (let i = 1; i < 4; i++) {
      for (let j = 0; j < i; j++) {
        expect(R.data[i * 4 + j]).toBe(0);
      }
    }
  });

  it("works on rectangular (5x3)", () => {
    const A = newMatrixView(5, 3);
    A.data.set([
      1, 2, 3,
      4, 5, 6,
      7, 8, 10,
      2, 1, 4,
      0, 1, 2,
    ]);
    const { Q, R } = qr(A);
    const QR = matMul(Q, R);
    approxEqual(QR.data, A.data, 1e-9);
    const QQT = matMul(Q, transposeMatrix(Q));
    approxEqual(QQT.data, identityMatrixView(5).data, 1e-10);
  });
});
