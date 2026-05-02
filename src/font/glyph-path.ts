// Lower an `opentype.js` Glyph (or its raw path command list) to a
// `Path` of `PathSegment`s in math y-up coordinates.
//
// `Glyph.path.commands` already uses font-native y-up (positive y =
// above baseline), which matches our math convention. We therefore
// pass coordinates through unchanged — callers who want a different
// frame can apply a Trafo2d / Affine2d after the fact.
//
// Zero-length L commands are dropped (a common artefact in many TTF
// command streams) and Z auto-closes the current sub-path with a
// LineSegment back to the M anchor when the pen has drifted off.
//
// Multi-subpath glyphs (counter-loops, separate outer / stroke
// contours, …) return a flat `PathSegment[]` concatenating every
// sub-path's segments in command order. The tessellator's
// `tessellatePath` accepts that shape directly via its
// `Path | PathSegment` union.

import { V2d } from "../vector/v2d.js";
import {
  type PathSegment,
  LineSegment, Bezier2Segment, Bezier3Segment,
} from "../geometry/path/segment.js";

/** A subset of opentype.js's `PathCommand` shapes — we only need M /
 *  L / Q / C / Z and they're stable across opentype.js versions. */
export type GlyphPathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "Q"; x1: number; y1: number; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Z" };

/** Anything with a `path.commands: GlyphPathCommand[]` shape — i.e.
 *  an opentype.js `Glyph`, a `Path`, or any compatible carrier. */
export interface GlyphCommandsCarrier {
  readonly path: { readonly commands: ReadonlyArray<GlyphPathCommand> };
}

export interface GlyphPathOptions {
  /** Uniform scale applied to every coordinate. Default: 1. */
  readonly scale?: number;
  /** Translation applied AFTER scaling. Default: (0, 0). */
  readonly offset?: V2d;
  /** Tolerance for treating two consecutive points as identical
   *  (e.g. zero-length L commands). Default: 1e-12. */
  readonly eps?: number;
}

/**
 * Lower a list of glyph path commands (opentype.js shape) to a flat
 * `PathSegment[]` in math y-up coordinates. Multi-subpath glyphs are
 * concatenated in command order; sub-paths are still individually
 * closed (Z auto-emits a back-to-anchor LineSegment when needed).
 */
export function pathFromGlyphCommands(
  commands: ReadonlyArray<GlyphPathCommand>,
  options: GlyphPathOptions = {},
): PathSegment[] {
  const scale = options.scale ?? 1;
  const offX = options.offset?.x ?? 0;
  const offY = options.offset?.y ?? 0;
  const eps = options.eps ?? 1e-12;
  const xform = (x: number, y: number): V2d =>
    new V2d(x * scale + offX, y * scale + offY);

  const segments: PathSegment[] = [];
  let pen: V2d | undefined;
  let anchor: V2d | undefined;
  const closeIfOpen = (): void => {
    if (pen && anchor
        && (Math.abs(pen.x - anchor.x) > eps || Math.abs(pen.y - anchor.y) > eps)) {
      segments.push(new LineSegment(pen, anchor));
    }
  };

  for (const c of commands) {
    switch (c.type) {
      case "M": {
        const p = xform(c.x, c.y);
        pen = p; anchor = p;
        break;
      }
      case "L": {
        const p = xform(c.x, c.y);
        if (pen
            && (Math.abs(pen.x - p.x) > eps || Math.abs(pen.y - p.y) > eps)) {
          segments.push(new LineSegment(pen, p));
          pen = p;
        }
        break;
      }
      case "Q": {
        const ctrl = xform(c.x1, c.y1);
        const p = xform(c.x, c.y);
        if (pen) { segments.push(new Bezier2Segment(pen, ctrl, p)); pen = p; }
        break;
      }
      case "C": {
        const c1 = xform(c.x1, c.y1);
        const c2 = xform(c.x2, c.y2);
        const p = xform(c.x, c.y);
        if (pen) { segments.push(new Bezier3Segment(pen, c1, c2, p)); pen = p; }
        break;
      }
      case "Z":
        closeIfOpen();
        if (anchor) pen = anchor;
        break;
    }
  }
  closeIfOpen();
  return segments;
}

/**
 * Convenience wrapper that pulls the command list out of an
 * opentype.js Glyph (or any carrier with a `path.commands` field)
 * and lowers it.
 */
export function pathFromGlyph(
  glyph: GlyphCommandsCarrier, options: GlyphPathOptions = {},
): PathSegment[] {
  return pathFromGlyphCommands(glyph.path.commands, options);
}
