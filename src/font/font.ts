// Thin wrapper around `opentype.js` so callers can stay inside the
// wombat.base API surface (which uses our own V2d / PathSegment types
// in math y-up). The underlying parsed `opentype.Font` is exposed via
// `raw` for callers that need shape metrics, kerning tables, or other
// data that this wrapper hasn't surfaced yet.

import * as opentype from "opentype.js";
import { Box2d } from "../box/box2d.js";
import type { PathSegment } from "../geometry/path/segment.js";
import {
  pathFromGlyph, type GlyphPathOptions,
} from "./glyph-path.js";

export class Font {
  private constructor(
    /** The parsed opentype.js `Font`. Callers needing kerning,
     *  feature tables, or other low-level data can read it directly. */
    readonly raw: opentype.Font,
  ) {}

  /**
   * Parse an in-memory font (TTF / OTF / WOFF / WOFF2 in browsers
   * that have it; opentype.js handles all four).
   */
  static parse(buffer: ArrayBuffer): Font {
    return new Font(opentype.parse(buffer));
  }

  /**
   * Fetch a font from a URL (browser / Node 18+ `fetch`) and parse.
   */
  static async load(url: string | URL): Promise<Font> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Font.load: ${res.status} ${res.statusText} fetching ${url}`);
    }
    return Font.parse(await res.arrayBuffer());
  }

  /** Font's units-per-em (typical 1000 for OTF, 2048 for TTF). */
  get unitsPerEm(): number { return this.raw.unitsPerEm; }
  /** Ascender in font units (positive = above baseline, math y-up). */
  get ascender(): number { return this.raw.ascender; }
  /** Descender in font units (negative = below baseline). */
  get descender(): number { return this.raw.descender; }

  /**
   * Lower a single character (or BMP code-point string) to a flat
   * `PathSegment[]` in font units, math y-up.
   *
   * Use `options.scale` / `options.offset` to place the glyph in
   * world coordinates. The glyph's natural origin is the typographic
   * baseline at x = 0, y = 0; positive y goes up to the ascender.
   */
  charToSegments(char: string, options?: GlyphPathOptions): PathSegment[] {
    return pathFromGlyph(this.raw.charToGlyph(char), options);
  }

  /** Advance width of `char` in font units. */
  advanceWidth(char: string): number {
    return this.raw.charToGlyph(char).advanceWidth ?? 0;
  }

  /**
   * Bounding box of `char` in font units, math y-up — i.e. y1 < y2,
   * with positive y above the baseline. Empty glyphs return a
   * `Box2d.invalid`-style box (caller should check).
   */
  charBoundingBox(char: string): Box2d {
    const bb = this.raw.charToGlyph(char).getBoundingBox();
    // opentype's getBoundingBox returns font-native y-up, no flip.
    return new Box2d(bb.x1, bb.y1, bb.x2, bb.y2);
  }
}
