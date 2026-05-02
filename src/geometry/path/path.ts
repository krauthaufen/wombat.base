// Path — ordered, closed sequence of `PathSegment`s in 2D.
//
// Closed-path invariant: each `seg[i].end` matches `seg[i+1].start`,
// and `seg[last].end` matches `seg[0].start`. The constructor
// validates this within an absolute tolerance.
//
// A Path may consist of multiple curves chained end-to-end, including
// any mix of lines / quadratic Beziers / cubic Beziers / arcs. The
// downstream pipeline (intersection, planar-graph extraction, fill
// resolution, triangulation) treats every kind natively — see
// `segment.ts`.

import { Box2d } from "../../box/box2d.js";
import type { PathSegment } from "./segment.js";

const CLOSURE_EPS = 1e-9;

export class Path {
  readonly segments: ReadonlyArray<PathSegment>;

  /**
   * Construct from a non-empty list of segments. Throws if the
   * sequence is not connected end-to-start, or if the final segment's
   * end does not meet the first segment's start.
   */
  constructor(segments: ReadonlyArray<PathSegment>) {
    if (segments.length === 0) {
      throw new Error("Path: must contain at least one segment");
    }
    for (let i = 0; i + 1 < segments.length; i++) {
      const a = segments[i]!.end;
      const b = segments[i + 1]!.start;
      if (a.distance(b) > CLOSURE_EPS) {
        throw new Error(
          `Path: segment ${i}.end ${a.toString()} does not match `
          + `segment ${i + 1}.start ${b.toString()}`,
        );
      }
    }
    const first = segments[0]!.start;
    const last = segments[segments.length - 1]!.end;
    if (first.distance(last) > CLOSURE_EPS) {
      throw new Error(
        `Path: closing gap between last segment end ${last.toString()} `
        + `and first segment start ${first.toString()}`,
      );
    }
    this.segments = segments;
  }

  /** Tight axis-aligned bounding box of the union of all segments. */
  bounds(): Box2d {
    return Box2d.fromBoxes(this.segments.map(s => s.bounds()));
  }

  /** Total arc length, summed over segments. */
  length(): number {
    let s = 0;
    for (const seg of this.segments) s += seg.length();
    return s;
  }

  /**
   * Signed area enclosed by the path via Green's theorem:
   * `Σᵢ (1/2) ∫(x dy - y dx) along seg[i]`. Positive in y-up means
   * counter-clockwise (interior on the left of travel direction).
   */
  signedArea(): number {
    let s = 0;
    for (const seg of this.segments) s += seg.signedAreaTerm();
    return s;
  }

  /** True if the path is wound clockwise (signed area negative in y-up). */
  isClockwise(): boolean { return this.signedArea() < 0; }

  /**
   * Reverse traversal direction: segments in reverse order, each
   * individually reversed. Closure is preserved.
   */
  reverse(): Path {
    const rev: PathSegment[] = [];
    for (let i = this.segments.length - 1; i >= 0; i--) {
      rev.push(this.segments[i]!.reverse());
    }
    return new Path(rev);
  }
}
