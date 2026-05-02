// Stage 8 — SVG path-d → PathSegment lowering.
//
// Covers each command kind on its own and a mixed real-world `d`
// string, plus implicit-repetition, smooth-curve reflection, the
// arc endpoint→centre conversion, and tessellation round-trip.

import { describe, it, expect } from "vitest";
import { pathFromSvgD } from "../../src/svg/path.js";
import { ArcSegment, Bezier2Segment, Bezier3Segment, LineSegment } from "../../src/geometry/path/segment.js";
import { tessellatePath } from "../../src/geometry/path/index.js";

describe("pathFromSvgD — basic commands", () => {
  it("M + L absolute", () => {
    const segs = pathFromSvgD("M 10 20 L 30 40");
    expect(segs.length).toBe(1);
    expect(segs[0]).toBeInstanceOf(LineSegment);
    expect(segs[0]!.start.x).toBe(10); expect(segs[0]!.start.y).toBe(20);
    expect(segs[0]!.end.x).toBe(30);   expect(segs[0]!.end.y).toBe(40);
  });

  it("M + L relative", () => {
    const segs = pathFromSvgD("M 10 20 l 5 5");
    expect(segs[0]!.end.x).toBe(15);
    expect(segs[0]!.end.y).toBe(25);
  });

  it("H / V (horizontal / vertical)", () => {
    const segs = pathFromSvgD("M 0 0 H 10 V 5 h -3 v -1");
    expect(segs.length).toBe(4);
    expect(segs[0]!.end.x).toBe(10); expect(segs[0]!.end.y).toBe(0);
    expect(segs[1]!.end.x).toBe(10); expect(segs[1]!.end.y).toBe(5);
    expect(segs[2]!.end.x).toBe(7);  expect(segs[2]!.end.y).toBe(5);
    expect(segs[3]!.end.x).toBe(7);  expect(segs[3]!.end.y).toBe(4);
  });

  it("Q / T (quadratic + smooth quadratic)", () => {
    const segs = pathFromSvgD("M 0 0 Q 5 5 10 0 T 20 0");
    expect(segs.length).toBe(2);
    expect(segs[0]).toBeInstanceOf(Bezier2Segment);
    expect(segs[1]).toBeInstanceOf(Bezier2Segment);
    // T's reflected control = 2 * pen - prev_q1 = 2*(10,0) - (5,5) = (15,-5)
    const t = segs[1] as Bezier2Segment;
    expect(t.control.x).toBe(15);
    expect(t.control.y).toBe(-5);
  });

  it("C / S (cubic + smooth cubic)", () => {
    const segs = pathFromSvgD("M 0 0 C 1 1 2 2 3 0 S 5 -2 6 0");
    expect(segs.length).toBe(2);
    expect(segs[0]).toBeInstanceOf(Bezier3Segment);
    const s = segs[1] as Bezier3Segment;
    // S's reflected c1 = 2*(3,0) - (2,2) = (4,-2)
    expect(s.control1.x).toBe(4);
    expect(s.control1.y).toBe(-2);
    expect(s.control2.x).toBe(5);
    expect(s.end.x).toBe(6);
  });

  it("Z closes the sub-path with an implicit line", () => {
    const segs = pathFromSvgD("M 0 0 L 10 0 L 10 10 Z");
    expect(segs.length).toBe(3);
    expect(segs[2]!.end.x).toBe(0);
    expect(segs[2]!.end.y).toBe(0);
  });

  it("implicit repetition after M / L / Q / C", () => {
    // After "M 0 0", "5 5 10 10" should chain implicit Ls.
    const segs = pathFromSvgD("M 0 0 5 5 10 10");
    expect(segs.length).toBe(2);
    expect(segs[0]!.end.x).toBe(5);
    expect(segs[1]!.end.x).toBe(10);
  });

  it("comma / no-space tokenization", () => {
    const segs = pathFromSvgD("M0,0L10,0L10,10z");
    expect(segs.length).toBe(3);
  });
});

describe("pathFromSvgD — arc command (A / a)", () => {
  it("circular arc — quarter circle", () => {
    // (10,0) to (0,10), small arc with CW sweep — only the
    // (10,10)-centred quarter satisfies "small + CW (in y-down)".
    const segs = pathFromSvgD("M 10 0 A 10 10 0 0 0 0 10");
    expect(segs.length).toBe(1);
    expect(segs[0]).toBeInstanceOf(ArcSegment);
    const a = segs[0] as ArcSegment;
    expect(a.center.x).toBeCloseTo(10, 6);
    expect(a.center.y).toBeCloseTo(10, 6);
    expect(Math.abs(a.deltaAngle)).toBeCloseTo(Math.PI / 2, 6);
    // Endpoints must equal the original SVG points (V2d identity for
    // start/end is preserved through the planar-graph stage).
    expect(a.start.x).toBe(10); expect(a.start.y).toBe(0);
    expect(a.end.x).toBe(0);    expect(a.end.y).toBe(10);
  });

  it("zero-length arc → no segment", () => {
    const segs = pathFromSvgD("M 5 5 A 10 10 0 0 0 5 5");
    expect(segs.length).toBe(0);
  });

  it("rx == 0 falls back to a line", () => {
    const segs = pathFromSvgD("M 0 0 A 0 10 0 0 0 10 10");
    expect(segs.length).toBe(1);
    expect(segs[0]).toBeInstanceOf(LineSegment);
  });
});

describe("pathFromSvgD — round-trip", () => {
  it("a multi-subpath glyph-like outline tessellates without errors", () => {
    // Outer square + inner triangular hole.
    const d = "M 0 0 H 100 V 100 H 0 Z M 25 25 L 75 25 L 50 75 Z";
    const segs = pathFromSvgD(d);
    expect(segs.length).toBeGreaterThanOrEqual(7);
    const r = tessellatePath(segs);
    expect(r.extraction.faces.length).toBeGreaterThan(0);
    expect(r.filledFaces.length).toBeGreaterThan(0);
  });
});
