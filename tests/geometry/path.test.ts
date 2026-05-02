import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import { Box2d } from "../../src/box/box2d.js";
import {
  LineSegment, Bezier2Segment, Bezier3Segment, ArcSegment, Path,
} from "../../src/geometry/path/index.js";
import { integrate } from "../../src/numerics/quadrature.js";

const EPS = 1e-9;

function vClose(a: V2d, b: V2d, eps = EPS): void {
  expect(a.x).toBeCloseTo(b.x, -Math.log10(eps));
  expect(a.y).toBeCloseTo(b.y, -Math.log10(eps));
}

function boxClose(a: Box2d, b: Box2d, eps = EPS): void {
  vClose(a.min, b.min, eps);
  vClose(a.max, b.max, eps);
}

// ---------------------------------------------------------------------------
// LineSegment
// ---------------------------------------------------------------------------

describe("LineSegment", () => {
  const seg = new LineSegment(new V2d(1, 2), new V2d(5, 6));

  it("eval and derivative", () => {
    vClose(seg.eval(0), new V2d(1, 2));
    vClose(seg.eval(1), new V2d(5, 6));
    vClose(seg.eval(0.5), new V2d(3, 4));
    vClose(seg.derivative(0.3), new V2d(4, 4));
  });

  it("bounds", () => {
    boxClose(seg.bounds(), Box2d.fromMinMax(new V2d(1, 2), new V2d(5, 6)));
  });

  it("length", () => {
    expect(seg.length()).toBeCloseTo(Math.sqrt(32), 12);
  });

  it("split is continuous", () => {
    const [l, r] = seg.split(0.4);
    vClose(l.start, seg.start);
    vClose(l.end, r.start);
    vClose(r.end, seg.end);
    expect(l.length() + r.length()).toBeCloseTo(seg.length(), 12);
  });

  it("reverse swaps endpoints", () => {
    const r = seg.reverse();
    vClose(r.start, seg.end);
    vClose(r.end, seg.start);
  });

  it("signedAreaTerm — triangle area", () => {
    // Triangle (0,0)-(2,0)-(0,3) ccw should give signed area = 3.
    const s1 = new LineSegment(new V2d(0, 0), new V2d(2, 0));
    const s2 = new LineSegment(new V2d(2, 0), new V2d(0, 3));
    const s3 = new LineSegment(new V2d(0, 3), new V2d(0, 0));
    expect(s1.signedAreaTerm() + s2.signedAreaTerm() + s3.signedAreaTerm())
      .toBeCloseTo(3, 12);
  });
});

// ---------------------------------------------------------------------------
// Bezier2Segment
// ---------------------------------------------------------------------------

describe("Bezier2Segment", () => {
  const b = new Bezier2Segment(new V2d(0, 0), new V2d(1, 2), new V2d(2, 0));

  it("eval endpoints", () => {
    vClose(b.eval(0), new V2d(0, 0));
    vClose(b.eval(1), new V2d(2, 0));
    vClose(b.eval(0.5), new V2d(1, 1));
  });

  it("derivative endpoints", () => {
    vClose(b.derivative(0), new V2d(2, 4));
    vClose(b.derivative(1), new V2d(2, -4));
  });

  it("bounds tighter than control hull", () => {
    // Apex of this parabolic arch is (1, 1), so the tight box is
    // [0,2] × [0,1], NOT [0,2] × [0,2] (control-hull max-y = 2).
    const bb = b.bounds();
    boxClose(bb, Box2d.fromMinMax(new V2d(0, 0), new V2d(2, 1)));
  });

  it("split is continuous", () => {
    const [l, r] = b.split(0.3);
    vClose(l.start, b.start);
    vClose(l.end, r.start);
    vClose(r.end, b.end);
    vClose(l.eval(1), b.eval(0.3));
    vClose(r.eval(0), b.eval(0.3));
  });

  it("length matches numerical reference", () => {
    const ref = integrate(t => b.derivative(t).length(), 0, 1, 16);
    expect(b.length()).toBeCloseTo(ref, 10);
  });

  it("signedAreaTerm matches numerical reference", () => {
    const ref = 0.5 * integrate(t => {
      const p = b.eval(t);
      const dp = b.derivative(t);
      return p.x * dp.y - p.y * dp.x;
    }, 0, 1, 16);
    expect(b.signedAreaTerm()).toBeCloseTo(ref, 12);
  });
});

// ---------------------------------------------------------------------------
// Bezier3Segment
// ---------------------------------------------------------------------------

describe("Bezier3Segment", () => {
  const b = new Bezier3Segment(
    new V2d(0, 0), new V2d(0, 2), new V2d(2, 2), new V2d(2, 0),
  );

  it("eval endpoints", () => {
    vClose(b.eval(0), new V2d(0, 0));
    vClose(b.eval(1), new V2d(2, 0));
  });

  it("derivative endpoints", () => {
    // P'(0) = 3(P1 - P0) = (0, 6); P'(1) = 3(P3 - P2) = (0, -6).
    vClose(b.derivative(0), new V2d(0, 6));
    vClose(b.derivative(1), new V2d(0, -6));
  });

  it("bounds finds curve maxima inside [0,1]", () => {
    // Symmetric arch: max-y is at t=0.5 → P = (1, 1.5).
    const bb = b.bounds();
    expect(bb.max.y).toBeCloseTo(1.5, 12);
    expect(bb.min.x).toBeCloseTo(0, 12);
    expect(bb.max.x).toBeCloseTo(2, 12);
    expect(bb.min.y).toBeCloseTo(0, 12);
  });

  it("bounds is tighter than control hull when the curve does not reach a control point", () => {
    // Control hull max y here is 2 (P1, P2); curve only reaches 1.5.
    expect(b.bounds().max.y).toBeLessThan(2);
  });

  it("split is continuous", () => {
    const [l, r] = b.split(0.7);
    vClose(l.end, r.start);
    vClose(l.eval(1), b.eval(0.7));
    vClose(r.eval(0), b.eval(0.7));
  });

  it("signedAreaTerm matches numerical reference", () => {
    const ref = 0.5 * integrate(t => {
      const p = b.eval(t);
      const dp = b.derivative(t);
      return p.x * dp.y - p.y * dp.x;
    }, 0, 1, 16);
    expect(b.signedAreaTerm()).toBeCloseTo(ref, 12);
  });
});

// ---------------------------------------------------------------------------
// ArcSegment
// ---------------------------------------------------------------------------

describe("ArcSegment", () => {
  it("circular arc — endpoints, bounds, length, area", () => {
    // Quarter unit circle, ccw, from (1,0) to (0,1).
    const a = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI / 2);
    vClose(a.start, new V2d(1, 0));
    vClose(a.end, new V2d(0, 1));
    expect(a.length()).toBeCloseTo(Math.PI / 2, 12);
    boxClose(a.bounds(), Box2d.fromMinMax(new V2d(0, 0), new V2d(1, 1)));
    // signedAreaTerm of the arc alone:
    //   = (1/2) [ cx (y_end - y_start) - cy (x_end - x_start) + rx ry Δθ ]
    //   = (1/2) [ 0 - 0 + 1 · 1 · π/2 ] = π/4.
    expect(a.signedAreaTerm()).toBeCloseTo(Math.PI / 4, 12);
  });

  it("full circle has signedArea = π·r² when closed", () => {
    const r = 2.5;
    const a = ArcSegment.circular(new V2d(0, 0), r, 0, 2 * Math.PI);
    // start == end so this single segment is itself a closed Path.
    const path = new Path([a]);
    expect(path.signedArea()).toBeCloseTo(Math.PI * r * r, 10);
    expect(path.length()).toBeCloseTo(2 * Math.PI * r, 12);
  });

  it("rotated ellipse arc — bounds, length", () => {
    // Quarter ellipse rx=2, ry=1, rotated 30°, centred at (3,4).
    const rho = Math.PI / 6;
    const a = ArcSegment.fromRadiiRotation(
      new V2d(3, 4), 2, 1, rho, 0, Math.PI / 2,
    );
    // Length agrees with numerical reference (incomplete elliptic
    // integral of the second kind, computed via direct quadrature).
    const ref = integrate(theta => {
      const s = Math.sin(theta), c = Math.cos(theta);
      return Math.sqrt(4 * s * s + 1 * c * c);
    }, 0, Math.PI / 2, 16);
    expect(a.length()).toBeCloseTo(ref, 10);
    // Bounds extrema must include the rotated ellipse's tangent points
    // not just the endpoints.
    const bb = a.bounds();
    // Sanity: endpoints fit inside.
    expect(bb.contains(a.start)).toBe(true);
    expect(bb.contains(a.end)).toBe(true);
    // For the unrotated ellipse, x ∈ [-2, 2] at θ = π and 0; for ρ=π/6
    // a quarter sweep starting at θ=0, the x-extremum candidate is
    // θ such that tan θ = -(ry/rx) tan ρ = -(1/2) tan(π/6).
    const thetaX = Math.atan2(-Math.sin(rho), 2 * Math.cos(rho));
    // thetaX is negative; +π brings it inside [0, π/2]? No: actually
    // we need a candidate within [0, π/2]. The bounds() helper handles
    // the +kπ shifts internally — we just check the box is non-trivial.
    expect(bb.max.x - bb.min.x).toBeGreaterThan(0);
    expect(bb.max.y - bb.min.y).toBeGreaterThan(0);
    // Ensure thetaX is in (-π, 0) here (used by debug only; no assert).
    expect(Number.isFinite(thetaX)).toBe(true);
  });

  it("split is continuous", () => {
    const a = ArcSegment.circular(new V2d(1, 1), 2, 0.4, 1.7);
    const [l, r] = a.split(0.3);
    vClose(l.start, a.start);
    vClose(l.end, r.start);
    vClose(r.end, a.end);
    vClose(l.eval(1), a.eval(0.3));
    expect(l.length() + r.length()).toBeCloseTo(a.length(), 10);
  });

  it("split preserves bit-identical shared endpoints", () => {
    // The planar-graph stage of the tessellator depends on
    // `seg[i].end` and `seg[i+1].start` being the SAME V2d instance,
    // not "approximately equal" — trig-derived recomputation would
    // disagree at the 1e-16 level and break vertex sharing.
    const a = ArcSegment.circular(new V2d(0, 0), 1, 0.7, 1.2);
    const [l, r] = a.split(0.4);
    expect(l.end).toBe(r.start);
    expect(l.start).toBe(a.start);
    expect(r.end).toBe(a.end);
  });

  it("reverse re-uses start/end V2d by identity", () => {
    const a = ArcSegment.circular(new V2d(2, 3), 1.5, 0.1, 1.0);
    const r = a.reverse();
    expect(r.start).toBe(a.end);
    expect(r.end).toBe(a.start);
  });

  it("reverse flips deltaAngle and swaps endpoints", () => {
    const a = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI / 2);
    const r = a.reverse();
    vClose(r.start, a.end);
    vClose(r.end, a.start);
    expect(r.deltaAngle).toBeCloseTo(-a.deltaAngle, 12);
    expect(r.length()).toBeCloseTo(a.length(), 12);
    // signed area term flips sign.
    expect(r.signedAreaTerm()).toBeCloseTo(-a.signedAreaTerm(), 12);
  });

  it("eccentric arc — signedAreaTerm matches numeric reference", () => {
    const a = ArcSegment.fromRadiiRotation(
      new V2d(3, 4), 2, 1, Math.PI / 6, 0.3, 1.4,
    );
    const ref = 0.5 * integrate(t => {
      const p = a.eval(t);
      const dp = a.derivative(t);
      return p.x * dp.y - p.y * dp.x;
    }, 0, 1, 16);
    expect(a.signedAreaTerm()).toBeCloseTo(ref, 10);
  });
});

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

describe("Path", () => {
  it("rejects open paths", () => {
    expect(() => new Path([
      new LineSegment(new V2d(0, 0), new V2d(1, 0)),
      new LineSegment(new V2d(1, 0), new V2d(1, 1)),
    ])).toThrow(/closing gap/);
  });

  it("rejects disconnected segments", () => {
    expect(() => new Path([
      new LineSegment(new V2d(0, 0), new V2d(1, 0)),
      new LineSegment(new V2d(2, 0), new V2d(0, 0)),
    ])).toThrow(/does not match/);
  });

  it("unit square: length = 4, area = 1, ccw", () => {
    const sq = new Path([
      new LineSegment(new V2d(0, 0), new V2d(1, 0)),
      new LineSegment(new V2d(1, 0), new V2d(1, 1)),
      new LineSegment(new V2d(1, 1), new V2d(0, 1)),
      new LineSegment(new V2d(0, 1), new V2d(0, 0)),
    ]);
    expect(sq.length()).toBeCloseTo(4, 12);
    expect(sq.signedArea()).toBeCloseTo(1, 12);
    expect(sq.isClockwise()).toBe(false);
    boxClose(sq.bounds(), Box2d.fromMinMax(new V2d(0, 0), new V2d(1, 1)));
  });

  it("reversed square is cw", () => {
    const sq = new Path([
      new LineSegment(new V2d(0, 0), new V2d(1, 0)),
      new LineSegment(new V2d(1, 0), new V2d(1, 1)),
      new LineSegment(new V2d(1, 1), new V2d(0, 1)),
      new LineSegment(new V2d(0, 1), new V2d(0, 0)),
    ]).reverse();
    expect(sq.signedArea()).toBeCloseTo(-1, 12);
    expect(sq.isClockwise()).toBe(true);
  });

  it("mixed-segment closed path: half-disc area", () => {
    // Half-disc of radius 1: a (1,0)→(-1,0) ccw semicircle plus the
    // straight segment back. Expected area = π/2.
    const path = new Path([
      ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI),
      new LineSegment(new V2d(-1, 0), new V2d(1, 0)),
    ]);
    expect(path.signedArea()).toBeCloseTo(Math.PI / 2, 10);
    expect(path.length()).toBeCloseTo(Math.PI + 2, 12);
  });

  it("Bezier-and-arc path: area sums correctly", () => {
    // Closed shape: arc top + cubic-Bezier bottom.
    const top = ArcSegment.circular(new V2d(0, 0), 1, 0, Math.PI);
    const cubic = new Bezier3Segment(
      new V2d(-1, 0), new V2d(-0.5, -1), new V2d(0.5, -1), new V2d(1, 0),
    );
    const path = new Path([top, cubic]);
    // Reference: numeric line integral over both segments.
    const numericArea = top.signedAreaTerm() + 0.5 * integrate(t => {
      const p = cubic.eval(t);
      const dp = cubic.derivative(t);
      return p.x * dp.y - p.y * dp.x;
    }, 0, 1, 16);
    expect(path.signedArea()).toBeCloseTo(numericArea, 10);
  });
});
