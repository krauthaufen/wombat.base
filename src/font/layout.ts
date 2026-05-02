// Stage 9 — text layout.
//
// Sequential left-to-right shaping for Latin (and any other script
// whose codepoints map 1:1 to glyphs). Each codepoint becomes one
// glyph placed at the running pen X; the pen advances by the glyph's
// `advanceWidth` plus any kerning applied between consecutive glyphs.
//
// Coordinates: math y-up, in the font's native units (typically
// 1000 or 2048 per em). Callers scale to a target em-height via
// `scale: targetEmHeight / font.unitsPerEm` on the lowering step.
//
// Out of scope (deferred to future work):
//   - Cluster-level shaping (Arabic / Indic / Tibetan / Khmer):
//     planned hook is harfbuzzjs as an opt-in plugin so wombat.base
//     stays small. The interface here will accept pre-shaped glyph
//     runs once that lands.
//   - Bidi reordering (RTL embedding): the layout function preserves
//     codepoint order; callers that need RTL reorder upstream.
//   - Multi-line wrapping / break-finding: the layout function lays
//     out a single line; word-break / line-break logic belongs in a
//     higher-level wrapper.

import type { Font } from "./font.js";
import { V2d } from "../vector/v2d.js";
import { Box2d } from "../box/box2d.js";
import type { PathSegment } from "../geometry/path/segment.js";
import { pathFromGlyph } from "./glyph-path.js";

export interface ShapedGlyph {
  /** Source codepoint (32-bit so SMP characters round-trip). */
  readonly codepoint: number;
  /** The single-character string for this codepoint (uses
   *  surrogate pair for SMP). Convenient for downstream tools. */
  readonly char: string;
  /** Glyph index into the font (opentype.js's `glyph.index`). */
  readonly glyphIndex: number;
  /** Pen X at which this glyph starts, in font units. */
  readonly x: number;
  /** Pen Y for this glyph (always 0 in single-line layout, kept
   *  here so multi-line / RTL extensions can populate it). */
  readonly y: number;
  /** This glyph's `advanceWidth` (font units). Sum + kerning =
   *  next glyph's `x` for monotone left-to-right shaping. */
  readonly advance: number;
}

export interface LayoutResult {
  readonly glyphs: ReadonlyArray<ShapedGlyph>;
  /** Total advance from origin to the post-last-glyph pen position. */
  readonly advance: number;
  /** Union of all glyph bounding boxes in font units (math y-up). */
  readonly bounds: Box2d;
}

export interface LayoutOptions {
  /** Apply opentype.js KERN-table pairs between consecutive glyphs.
   *  Defaults to true. Fonts without a KERN table are unaffected. */
  readonly kerning?: boolean;
}

/**
 * Shape `text` left-to-right in `font` units. One glyph per Unicode
 * codepoint via `font.raw.charToGlyph` (no GSUB substitutions, no
 * ligatures, no script-specific shaping). Surrogate pairs are
 * decoded into 32-bit codepoints so SMP characters work.
 */
export function layoutText(
  font: Font, text: string, options: LayoutOptions = {},
): LayoutResult {
  const useKerning = options.kerning ?? true;
  const codepoints = decodeCodepoints(text);
  const glyphs: ShapedGlyph[] = [];
  let bounds = Box2d.empty;
  let pen = 0;
  let prevGlyph: ReturnType<Font["raw"]["charToGlyph"]> | undefined;
  for (const cp of codepoints) {
    const ch = String.fromCodePoint(cp);
    const otGlyph = font.raw.charToGlyph(ch);
    if (useKerning && prevGlyph) {
      pen += font.raw.getKerningValue(prevGlyph, otGlyph);
    }
    const advance = otGlyph.advanceWidth ?? 0;
    glyphs.push({
      codepoint: cp,
      char: ch,
      glyphIndex: otGlyph.index,
      x: pen,
      y: 0,
      advance,
    });
    // Glyph bbox + pen offset → contributes to layout bounds.
    const bb = otGlyph.getBoundingBox();
    if (Number.isFinite(bb.x1) && Number.isFinite(bb.x2)) {
      bounds = bounds.extend(new V2d(pen + bb.x1, bb.y1));
      bounds = bounds.extend(new V2d(pen + bb.x2, bb.y2));
    }
    pen += advance;
    prevGlyph = otGlyph;
  }
  return { glyphs, advance: pen, bounds };
}

/**
 * Lower a `LayoutResult` to a flat `PathSegment[]` in math y-up
 * font units. Each glyph's outline is lowered with its layout
 * `(x, y)` baked into the offset so all sub-paths share a common
 * coordinate frame ready for the path tessellator.
 */
export function segmentsFromLayout(
  font: Font, layout: LayoutResult,
  options: { scale?: number; offset?: V2d } = {},
): PathSegment[] {
  const scale = options.scale ?? 1;
  const offX = options.offset?.x ?? 0;
  const offY = options.offset?.y ?? 0;
  const out: PathSegment[] = [];
  for (const g of layout.glyphs) {
    const otGlyph = font.raw.charToGlyph(g.char);
    const segs = pathFromGlyph(otGlyph, {
      scale,
      offset: new V2d(offX + g.x * scale, offY + g.y * scale),
    });
    for (const s of segs) out.push(s);
  }
  return out;
}

/**
 * Convenience: layout + lower to PathSegments in one call.
 */
export function textToSegments(
  font: Font, text: string,
  options: { scale?: number; offset?: V2d; kerning?: boolean } = {},
): { segments: PathSegment[]; layout: LayoutResult } {
  const layout = layoutText(font, text, { kerning: options.kerning ?? true });
  const segments = segmentsFromLayout(font, layout, {
    ...(options.scale !== undefined ? { scale: options.scale } : {}),
    ...(options.offset !== undefined ? { offset: options.offset } : {}),
  });
  return { segments, layout };
}

// ─────────────────────────────────────────────────────────────────

/** Iterate Unicode codepoints (handles surrogate pairs). */
function decodeCodepoints(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i)!;
    out.push(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return out;
}
