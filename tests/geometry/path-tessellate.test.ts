import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import {
  LineSegment, Path,
  tessellatePath, FillRules,
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

describe("tessellatePath", () => {
  it("annulus with non-zero rule: 1 filled face (the ring)", () => {
    const segs = [
      ...ccwSquare(0, 0, 4, 4),
      ...cwSquare(1, 1, 2, 2),
    ];
    const r = tessellatePath(segs);
    expect(r.filledFaces.length).toBe(1);
    // The filled face has area = outer − hole = 16 − 4 = 12.
    const f = r.extraction.faces[r.filledFaces[0]!]!;
    expect(f.signedArea).toBeCloseTo(12, 8);
  });

  it("annulus with even-odd rule: same single filled face", () => {
    // Annulus has windings {0, 0, 1}. Even-odd treats 1 as filled,
    // matching non-zero in this configuration.
    const segs = [
      ...ccwSquare(0, 0, 4, 4),
      ...cwSquare(1, 1, 2, 2),
    ];
    const r = tessellatePath(segs, FillRules.evenOdd);
    expect(r.filledFaces.length).toBe(1);
  });

  it("nested CCW with even-odd rule excludes the inner disc", () => {
    // Windings {0, 1, 2}. Even-odd: only winding=1 (the ring) is
    // filled. Inner disc (winding=2) is excluded.
    const segs = [
      ...ccwSquare(0, 0, 4, 4),
      ...ccwSquare(1, 1, 2, 2),
    ];
    const r = tessellatePath(segs, FillRules.evenOdd);
    expect(r.filledFaces.length).toBe(1);
    expect(r.windings[r.filledFaces[0]!]).toBe(1);
  });

  it("accepts Path objects and raw segments interchangeably", () => {
    const outerPath = new Path(ccwSquare(0, 0, 4, 4));
    const innerSegs = cwSquare(1, 1, 2, 2);
    const r = tessellatePath([outerPath, ...innerSegs]);
    expect(r.filledFaces.length).toBe(1);
  });
});
