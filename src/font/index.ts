// Public surface for `@aardworx/wombat.base/font`.
//
// Glyph outline → PathSegment lowering. Wraps opentype.js (TTF / OTF
// / WOFF / WOFF2 parsing) and emits PathSegments in math y-up
// coordinates ready for the Stage 0–6a path tessellator.

export { Font } from "./font.js";
export {
  type GlyphPathCommand,
  type GlyphCommandsCarrier,
  type GlyphPathOptions,
  pathFromGlyph,
  pathFromGlyphCommands,
} from "./glyph-path.js";
export {
  type ShapedGlyph,
  type LayoutResult,
  type LayoutOptions,
  layoutText,
  segmentsFromLayout,
  textToSegments,
} from "./layout.js";
export {
  type GlyphRecord,
  GlyphCache,
  GLYPH_FLOATS_PER_VERTEX,
} from "./glyph-cache.js";
