export {
  type PathSegment,
  type PathSegmentKind,
  LineSegment,
  Bezier2Segment,
  Bezier3Segment,
  ArcSegment,
} from "./segment.js";
export { Path } from "./path.js";
export { intersections, DEFAULT_EPS } from "./intersect.js";
export {
  PlanarGraph,
  type PlanarEdge,
  buildPlanarGraph,
} from "./planar-graph.js";
export {
  type HalfEdge,
  type Face,
  type FaceExtractionResult,
  extractFaces,
} from "./face-extract.js";
export { computeWindings, filledFaceIndices } from "./winding.js";
export { type FillRule, FillRules } from "./fill-rule.js";
export {
  type ComponentInfo,
  type ComponentDecomposition,
  detectComponents,
} from "./components.js";
export { connectComponents } from "./bridge.js";
export { tessellatePath, type TessellationResult } from "./tessellate.js";
export {
  type CurveTriangle,
  type CurveTriangleKind,
  classifyBezier2,
  classifyArc,
  classifyBezier3,
  classifyCurve,
} from "./loop-blinn.js";
