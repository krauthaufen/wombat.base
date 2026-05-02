// Stage 9 — text layout.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { Font } from "../../src/font/font.js";
import {
  layoutText, textToSegments,
} from "../../src/font/layout.js";
import { tessellatePath } from "../../src/geometry/path/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fontBuf = readFileSync(resolve(here, "fixtures/great-vibes.ttf"));
const ab = fontBuf.buffer.slice(
  fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength,
) as ArrayBuffer;
const font = Font.parse(ab);

describe("layoutText", () => {
  it("places consecutive glyphs at their accumulated advances", () => {
    const r = layoutText(font, "Hi");
    expect(r.glyphs.length).toBe(2);
    expect(r.glyphs[0]!.x).toBe(0);
    expect(r.glyphs[1]!.x).toBe(font.advanceWidth("H"));
    expect(r.advance).toBe(
      font.advanceWidth("H") + font.advanceWidth("i"),
    );
  });

  it("layout bounds enclose the union of glyph bboxes", () => {
    const r = layoutText(font, "Hello");
    expect(r.bounds.min.x).toBeLessThan(r.bounds.max.x);
    expect(r.bounds.min.y).toBeLessThan(r.bounds.max.y);
    expect(r.bounds.max.x).toBeLessThanOrEqual(r.advance + 100);
  });

  it("empty string yields no glyphs and zero advance", () => {
    const r = layoutText(font, "");
    expect(r.glyphs.length).toBe(0);
    expect(r.advance).toBe(0);
  });

  it("decodes surrogate-pair codepoints as a single glyph slot", () => {
    // U+1D11E MUSICAL SYMBOL G CLEF — fonts won't have it, but the
    // layout should still produce one slot, not two (one per surrogate).
    const r = layoutText(font, "A𝄞B");
    expect(r.glyphs.length).toBe(3);
    expect(r.glyphs[1]!.codepoint).toBe(0x1d11e);
    expect(r.glyphs[1]!.char).toBe("𝄞");
  });
});

describe("textToSegments", () => {
  it("produces segments and tessellates without errors", () => {
    const { segments, layout } = textToSegments(font, "AB");
    expect(segments.length).toBeGreaterThan(20);
    expect(layout.glyphs.length).toBe(2);
    const r = tessellatePath(segments);
    expect(r.extraction.faces.length).toBeGreaterThan(0);
    expect(r.filledFaces.length).toBeGreaterThan(0);
  });

  it("scale option scales every coordinate uniformly", () => {
    const r1 = textToSegments(font, "A", { scale: 1 });
    const r2 = textToSegments(font, "A", { scale: 0.5 });
    expect(r2.segments.length).toBe(r1.segments.length);
    const head1 = r1.segments[0]!;
    const head2 = r2.segments[0]!;
    expect(head2.start.x).toBeCloseTo(head1.start.x * 0.5, 6);
    expect(head2.start.y).toBeCloseTo(head1.start.y * 0.5, 6);
  });
});
