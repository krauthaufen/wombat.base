// Per-font lazy tessellation cache.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { Font } from "../../src/font/font.js";
import { GlyphCache, GLYPH_FLOATS_PER_VERTEX } from "../../src/font/glyph-cache.js";

const here = dirname(fileURLToPath(import.meta.url));
const fontBuf = readFileSync(resolve(here, "fixtures/great-vibes.ttf"));
const ab = fontBuf.buffer.slice(
  fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength,
) as ArrayBuffer;
const font = Font.parse(ab);

describe("GlyphCache", () => {
  it("tessellates on first sight, returns cached record on subsequent calls", () => {
    const cache = new GlyphCache(font);
    expect(cache.size).toBe(0);
    const r1 = cache.getChar("A");
    expect(cache.size).toBe(1);
    const r2 = cache.getChar("A");
    expect(cache.size).toBe(1);
    expect(r2).toBe(r1); // identity, not just structural equality
  });

  it("appends to a single growing atlas across multiple glyphs", () => {
    const cache = new GlyphCache(font);
    const a = cache.getChar("A");
    const b = cache.getChar("B");
    expect(b.firstIndex).toBe(a.indexCount);
    expect(b.baseVertex).toBe(a.vertexCount);
    expect(cache.totalVertexCount).toBe(a.vertexCount + b.vertexCount);
    expect(cache.totalIndexCount).toBe(a.indexCount + b.indexCount);
  });

  it("centers glyph vertices around mid-advance", () => {
    const cache = new GlyphCache(font);
    const r = cache.getChar("A");
    const v = cache.vertexBuffer();
    // Only consider non-band vertices: the SDF outline band extends
    // beyond the glyph's natural bbox by ±haloEm, which we don't want
    // to factor into the centering check. Filter by kind != 4.
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < r.vertexCount; i++) {
      const off = (r.baseVertex + i) * GLYPH_FLOATS_PER_VERTEX;
      const kind = v[off + 5]!;
      if (kind > 3.5) continue; // skip band vertices
      const x = v[off]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    // Vertices live in em coords (font_unit / upem) shifted by
    // -advance/2 so the glyph is centered on x = 0. Verify against
    // the native font-unit bbox converted to em.
    const native = font.charBoundingBox("A");
    const upem = font.unitsPerEm;
    expect(minX).toBeCloseTo(native.min.x / upem - r.advance * 0.5, 5);
    expect(maxX).toBeCloseTo(native.max.x / upem - r.advance * 0.5, 5);
  });

  it("empty (whitespace) glyph yields an empty record with zero ranges", () => {
    const cache = new GlyphCache(font);
    const r = cache.getChar(" ");
    expect(r.empty).toBe(true);
    expect(r.indexCount).toBe(0);
    expect(r.vertexCount).toBe(0);
    expect(r.advance).toBeGreaterThan(0);
    // Whitespace doesn't grow the atlas.
    expect(cache.totalVertexCount).toBe(0);
    expect(cache.totalIndexCount).toBe(0);
  });

  it("indices are local to each glyph (range [0, vertexCount))", () => {
    const cache = new GlyphCache(font);
    cache.getChar("H"); // grow the atlas first so 0 isn't a trivial range
    const e = cache.getChar("e");
    const idx = cache.indexBuffer();
    let maxIdx = 0;
    for (let i = e.firstIndex; i < e.firstIndex + e.indexCount; i++) {
      const v = idx[i]!;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(e.vertexCount);
      if (v > maxIdx) maxIdx = v;
    }
    // At least one index reaches near the end of the glyph's vertex range.
    expect(maxIdx).toBeGreaterThan(0);
  });
});
