// Public surface for `@aardworx/wombat.base/svg`.
//
// SVG path-d parsing → PathSegment lowering. Coordinates remain in
// SVG-native y-DOWN; callers wanting math y-up apply a y-flip
// transform after.

export { pathFromSvgD, type SvgPathOptions } from "./path.js";
