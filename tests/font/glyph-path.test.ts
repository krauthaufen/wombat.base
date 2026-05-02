// Stage 7 — TTF outline → PathSegment lowering.
//
// Loads the bundled Great Vibes fixture font, parses it via the
// `Font` wrapper, and verifies the lowered `PathSegment[]` against
// expected invariants. Exercises:
//
//   - units / metrics surface (unitsPerEm, ascender/descender),
//   - command-shape coverage (M / L / Q / Z) on a real glyph,
//   - `scale` / `offset` options,
//   - tessellation round-trip on the lowered segments (feeds them
//     to `tessellatePath` and checks the planar graph + face
//     extraction succeed).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { Font } from "../../src/font/font.js";
import { pathFromGlyphCommands } from "../../src/font/glyph-path.js";
import { tessellatePath } from "../../src/geometry/path/index.js";
import { V2d } from "../../src/vector/v2d.js";

const here = dirname(fileURLToPath(import.meta.url));
const fontBuf = readFileSync(resolve(here, "fixtures/great-vibes.ttf"));
const ab = fontBuf.buffer.slice(
  fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength,
) as ArrayBuffer;

const font = Font.parse(ab);

describe("Font / Great Vibes", () => {
  it("exposes the parsed metrics", () => {
    expect(font.unitsPerEm).toBe(1000);
    expect(font.ascender).toBeGreaterThan(0);
    expect(font.descender).toBeLessThan(0);
  });

  it("returns a non-empty path for a printable glyph", () => {
    const segs = font.charToSegments("A");
    expect(segs.length).toBeGreaterThan(10);
    const kinds = new Set(segs.map((s) => s.kind));
    // Great Vibes uses TrueType outlines (quadratics dominate; no cubics).
    expect(kinds.has("bezier2")).toBe(true);
    expect(kinds.has("bezier3")).toBe(false);
  });

  it("returns an empty path for a whitespace glyph", () => {
    const segs = font.charToSegments(" ");
    expect(segs.length).toBe(0);
  });

  it("respects scale and offset options", () => {
    const a1 = font.charToSegments("A");
    const a2 = font.charToSegments("A", {
      scale: 0.5,
      offset: new V2d(10, 20),
    });
    // Same number of segments, scaled / translated coords.
    expect(a2.length).toBe(a1.length);
    const head1 = a1[0]!;
    const head2 = a2[0]!;
    expect(head2.start.x).toBeCloseTo(head1.start.x * 0.5 + 10, 6);
    expect(head2.start.y).toBeCloseTo(head1.start.y * 0.5 + 20, 6);
  });

  it("bbox is in math y-up font coords", () => {
    const bb = font.charBoundingBox("A");
    // For Great Vibes, the descender of capital A reaches below the
    // baseline (y < 0) but the cap-height is positive (y > 0).
    expect(bb.min.y).toBeLessThan(0);
    expect(bb.max.y).toBeGreaterThan(0);
    expect(bb.min.x).toBeLessThan(bb.max.x);
  });

  it("ampersand tessellates without errors", () => {
    const segs = font.charToSegments("&");
    // Real glyph with multiple sub-paths (outer + counter loop).
    expect(segs.length).toBeGreaterThan(50);
    const r = tessellatePath(segs);
    expect(r.extraction.faces.length).toBeGreaterThan(0);
    // At least one face should be selected by the default nonZero rule.
    expect(r.filledFaces.length).toBeGreaterThan(0);
  });
});

describe("pathFromGlyphCommands", () => {
  it("lowers the four canonical command kinds", () => {
    const segs = pathFromGlyphCommands([
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 1, y: 0 },
      { type: "Q", x1: 1.5, y1: 0.5, x: 1, y: 1 },
      { type: "C", x1: 0.7, y1: 1.1, x2: 0.3, y2: 1.1, x: 0, y: 1 },
      { type: "Z" },
    ]);
    expect(segs.map((s) => s.kind)).toEqual(["line", "bezier2", "bezier3", "line"]);
    // Closed: last segment ends back at (0, 0).
    expect(segs[segs.length - 1]!.end.x).toBeCloseTo(0, 9);
    expect(segs[segs.length - 1]!.end.y).toBeCloseTo(0, 9);
  });

  it("drops zero-length L commands", () => {
    const segs = pathFromGlyphCommands([
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 0, y: 0 }, // zero-length; should be dropped
      { type: "Q", x1: 0.5, y1: 0.5, x: 1, y: 0 },
      { type: "L", x: 0, y: 0 },
    ]);
    // Expected: bez2 + closing line (the zero-length L is dropped).
    expect(segs.length).toBe(2);
    expect(segs[0]!.kind).toBe("bezier2");
    expect(segs[1]!.kind).toBe("line");
  });

  it("Z without a trailing M auto-closes only when needed", () => {
    const segs = pathFromGlyphCommands([
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 1, y: 0 },
      { type: "L", x: 0, y: 0 }, // pen already at anchor before Z
      { type: "Z" },
    ]);
    // No extra closing segment because pen == anchor at Z time.
    expect(segs.length).toBe(2);
    expect(segs.every((s) => s.kind === "line")).toBe(true);
  });
});
