// Public barrel for `@aardworx/wombat.base`.

export * from "./scalar.js";

// Vectors
export { V2b } from "./vector/v2b.js";
export { V3b } from "./vector/v3b.js";
export { V4b } from "./vector/v4b.js";
export { V2i } from "./vector/v2i.js";
export { V3i } from "./vector/v3i.js";
export { V4i } from "./vector/v4i.js";
export { V2ui } from "./vector/v2ui.js";
export { V3ui } from "./vector/v3ui.js";
export { V4ui } from "./vector/v4ui.js";
export { V2f, V2fOf } from "./vector/v2f.js";
export { V3f, V3fOf } from "./vector/v3f.js";
export { V4f, V4fOf } from "./vector/v4f.js";
export { V2d } from "./vector/v2d.js";
export { V3d } from "./vector/v3d.js";
export { V4d } from "./vector/v4d.js";

// Square matrices
export { M22f } from "./matrix/m22f.js";
export { M33f } from "./matrix/m33f.js";
export { M44f } from "./matrix/m44f.js";
export { M22d } from "./matrix/m22d.js";
export { M33d } from "./matrix/m33d.js";
export { M44d } from "./matrix/m44d.js";

// Rectangular matrices
export { M23f } from "./matrix/m23f.js";
export { M24f } from "./matrix/m24f.js";
export { M32f } from "./matrix/m32f.js";
export { M34f } from "./matrix/m34f.js";
export { M42f } from "./matrix/m42f.js";
export { M43f } from "./matrix/m43f.js";
export { M23d } from "./matrix/m23d.js";
export { M24d } from "./matrix/m24d.js";
export { M32d } from "./matrix/m32d.js";
export { M34d } from "./matrix/m34d.js";
export { M42d } from "./matrix/m42d.js";
export { M43d } from "./matrix/m43d.js";

// Random
export { XoroShiro128Plus } from "./random/xoroshiro128.js";

// Rotations
export { Rot2f } from "./rotation/rot2f.js";
export { Rot2d } from "./rotation/rot2d.js";
export { Rot3f, type EulerOrder as EulerOrderF } from "./rotation/rot3f.js";
export { Rot3d, type EulerOrder } from "./rotation/rot3d.js";

// Ranges & bounding boxes
export { Range1i } from "./box/range1i.js";
export { Range1f } from "./box/range1f.js";
export { Range1d } from "./box/range1d.js";
export { Box2i } from "./box/box2i.js";
export { Box3i } from "./box/box3i.js";
export { Box2f } from "./box/box2f.js";
export { Box3f } from "./box/box3f.js";
export { Box2d } from "./box/box2d.js";
export { Box3d } from "./box/box3d.js";

// 3D transformations
export { Shift3d } from "./trafo/shift3d.js";
export { Scale3d } from "./trafo/scale3d.js";
export { Euclidean3d } from "./trafo/euclidean3d.js";
export { Similarity3d } from "./trafo/similarity3d.js";
export { Affine3d } from "./trafo/affine3d.js";
export { Trafo3d } from "./trafo/trafo3d.js";

// 2D transformations
export { Shift2d } from "./trafo/shift2d.js";
export { Scale2d } from "./trafo/scale2d.js";
export { Euclidean2d } from "./trafo/euclidean2d.js";
export { Similarity2d } from "./trafo/similarity2d.js";
export { Affine2d } from "./trafo/affine2d.js";
export { Trafo2d } from "./trafo/trafo2d.js";

// Linear algebra
export {
  type LU, lu,
  type QR, qr,
  cholesky,
  type SymmetricEigen, symmetricEigen,
  type SVD, svd,
  solveLinear, solveLeastSquares,
} from "./linalg/index.js";
export {
  type MatrixViewD,
  newMatrixView,
} from "./linalg/matrix-view.js";

// Geometry primitives
export { Plane3d } from "./geometry/plane3d.js";
export { Ray2d } from "./geometry/ray2d.js";
export { Ray3d } from "./geometry/ray3d.js";
export { Line2d } from "./geometry/line2d.js";
export { Line3d } from "./geometry/line3d.js";
export { Triangle2d } from "./geometry/triangle2d.js";
export { Triangle3d } from "./geometry/triangle3d.js";
export { Sphere3d } from "./geometry/sphere3d.js";
export { Circle2d } from "./geometry/circle2d.js";
export { Circle3d } from "./geometry/circle3d.js";
export { Quad2d } from "./geometry/quad2d.js";
export { Quad3d } from "./geometry/quad3d.js";
export { Polygon2d } from "./geometry/polygon2d.js";
export { Polygon3d } from "./geometry/polygon3d.js";
export { Cylinder3d } from "./geometry/cylinder3d.js";
export { Cone3d } from "./geometry/cone3d.js";
export {
  type IIntersectable,
  type IIntersectHit,
  Intersectable,
} from "./geometry/intersectable.js";
export {
  Bvh,
  type BvhItem,
  type BvhHit,
  BVH_SPLIT_LIMIT,
} from "./geometry/bvh.js";
export {
  type PathSegment,
  type PathSegmentKind,
  LineSegment,
  Bezier2Segment,
  Bezier3Segment,
  ArcSegment,
  Path,
  intersections as pathSegmentIntersections,
  DEFAULT_EPS as PATH_INTERSECTION_DEFAULT_EPS,
  // Stage 2–3
  PlanarGraph,
  type PlanarEdge,
  buildPlanarGraph,
  type HalfEdge,
  type Face,
  type FaceExtractionResult,
  extractFaces,
  computeWindings,
  filledFaceIndices,
  // Stage 3.5
  type FillRule,
  FillRules,
  type ComponentInfo,
  type ComponentDecomposition,
  detectComponents,
  connectComponents,
  tessellatePath,
  type TessellationResult,
  // Stage 4–5
  type CurveTriangle,
  type CurveTriangleKind,
  classifyBezier2,
  classifyArc,
  classifyBezier3,
  classifyCurve,
  cubicToQuadratics,
  type FlatTriangle,
  type FaceTriangulation,
  earClip,
  triangulateFace,
  triangulateFilledFaces,
  // Stage 6a
  type TessellationBuffers,
  compileTessellation,
  VERTEX_KIND_INTERIOR,
  VERTEX_KIND_BEZIER2,
  VERTEX_KIND_ARC,
  VERTEX_BYTE_SIZE,
} from "./geometry/path/index.js";

// Numerics
export { Polynomial } from "./numerics/polynomial.js";
export * as Quadrature from "./numerics/quadrature.js";

// Spatial cells
export { Cell } from "./cell/cell.js";
export { Cell2d } from "./cell/cell2d.js";

// Array views (for now, just the float ones — others can wait)
export { V2fArray } from "./vector/array/v2fArray.js";
export { V3fArray } from "./vector/array/v3fArray.js";
export { V4fArray } from "./vector/array/v4fArray.js";
export { V2dArray } from "./vector/array/v2dArray.js";
export { V3dArray } from "./vector/array/v3dArray.js";
export { V4dArray } from "./vector/array/v4dArray.js";
export { V2bArray } from "./vector/array/v2bArray.js";
export { V3bArray } from "./vector/array/v3bArray.js";
export { V4bArray } from "./vector/array/v4bArray.js";
export { V2iArray } from "./vector/array/v2iArray.js";
export { V3iArray } from "./vector/array/v3iArray.js";
export { V4iArray } from "./vector/array/v4iArray.js";
export { V2uiArray } from "./vector/array/v2uiArray.js";
export { V3uiArray } from "./vector/array/v3uiArray.js";
export { V4uiArray } from "./vector/array/v4uiArray.js";
