import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  LineSegment, ArcSegment,
  buildPlanarGraph, extractFaces,
  computeWindings, filledFaceIndices,
} from "../../src/geometry/path/index.js";

function ccwSquare(x: number, y: number, w: number, h: number): LineSegment[] {
  return [
    new LineSegment(new V2d(x, y), new V2d(x + w, y)),
    new LineSegment(new V2d(x + w, y), new V2d(x + w, y + h)),
    new LineSegment(new V2d(x + w, y + h), new V2d(x, y + h)),
    new LineSegment(new V2d(x, y + h), new V2d(x, y)),
  ];
}

function cwSquare(x: number, y: number, w: number, h: number): LineSegment[] {
  return [
    new LineSegment(new V2d(x, y), new V2d(x, y + h)),
    new LineSegment(new V2d(x, y + h), new V2d(x + w, y + h)),
    new LineSegment(new V2d(x + w, y + h), new V2d(x + w, y)),
    new LineSegment(new V2d(x + w, y), new V2d(x, y)),
  ];
}

describe("winding — basics", () => {
  it("CCW square: outer = 0, interior = +1", () => {
    const g = buildPlanarGraph(ccwSquare(0, 0, 1, 1));
    const w = computeWindings(extractFaces(g), g);
    expect(w.length).toBe(2);
    const sorted = [...w].sort((a, b) => a - b);
    expect(sorted).toEqual([0, 1]);
  });

  it("CW square: outer = 0, interior = -1", () => {
    const g = buildPlanarGraph(cwSquare(0, 0, 1, 1));
    const w = computeWindings(extractFaces(g), g);
    const sorted = [...w].sort((a, b) => a - b);
    expect(sorted).toEqual([-1, 0]);
  });

  // Disconnected DCEL components — KNOWN LIMITATION. When two
  // closed contours are nested but do NOT touch, each lives in its
  // own connected component of the half-edge graph. A single DCEL
  // face cycle on Component B's forward direction is geometrically
  // the union of "outside the inner square" — which spans BOTH the
  // ring (between outer and inner) AND the unbounded plane (outside
  // outer). pickInteriorPoint returns one or the other depending on
  // which boundary edge it samples; ray-casting from each gives a
  // different winding number, so the DCEL face's "winding" is not
  // well-defined.
  //
  // The standard fix is to add bridge edges between components so
  // the planar graph becomes connected. Tracked as a future Stage
  // 3.5 ("connect disconnected components") — see project notes.
  it.todo("annulus (CCW outer + CW inner hole) — needs Stage 3.5 component bridging");
  it.todo("nested CCW contours — needs Stage 3.5 component bridging");
  it.todo("filledFaceIndices on disconnected nested contours — needs Stage 3.5");

  it("disconnected CCW squares: each interior fills independently", () => {
    const g = buildPlanarGraph([
      ...ccwSquare(0, 0, 1, 1),
      ...ccwSquare(5, 0, 1, 1),
    ]);
    const ext = extractFaces(g);
    const w = computeWindings(ext, g);
    expect(w.length).toBe(4);
    const sorted = [...w].sort((a, b) => a - b);
    expect(sorted).toEqual([0, 0, 1, 1]);
    const filled = filledFaceIndices(ext, g);
    expect(filled.length).toBe(2);
  });

  it("circle + diameter: half-discs both filled (each winding = 1)", () => {
    const arc = ArcSegment.circular(new V2d(0, 0), 1, 0, 2 * Math.PI);
    const chord = new LineSegment(new V2d(-1, 0), new V2d(1, 0));
    const g = buildPlanarGraph([arc, chord]);
    const w = computeWindings(extractFaces(g), g);
    expect(w.length).toBe(3);
    const sorted = [...w].sort((a, b) => a - b);
    expect(sorted).toEqual([0, 1, 1]);
  });
});
