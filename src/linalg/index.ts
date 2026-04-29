// Sub-barrel for the linear-algebra subsystem.

export {
  type MatrixViewD,
  newMatrixView,
  fromM22d, fromM33d, fromM44d,
  fromM22f, fromM33f, fromM44f,
  toM22d, toM33d, toM44d,
  toM22f, toM33f, toM44f,
} from "./matrix-view.js";

export { type LU, lu } from "./lu.js";
export { type QR, qr } from "./qr.js";
export { cholesky } from "./cholesky.js";
export { type SymmetricEigen, symmetricEigen } from "./eigen.js";
export { type SVD, svd } from "./svd.js";
export { solveLinear, solveLeastSquares } from "./solve.js";
