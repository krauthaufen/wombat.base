// PathSegment — discriminated union of {Line, Bezier2, Bezier3, Arc}
// in 2D. Faithful port of Aardvark.Rendering.Text's path-segment
// model: arcs are first-class ellipse arcs, NOT decomposed to
// Beziers. Every downstream pass (intersection, planar-graph,
// triangulation, Loop-Blinn) handles all four kinds natively.
//
// Conventions:
//   - All segments are 2D (V2d).
//   - The `t` parameter runs over [0, 1].
//   - `signedAreaTerm()` returns the segment's contribution to the
//     enclosed signed area of a closed path via Green's theorem
//     ((1/2) ∫(x dy - y dx)). Sum across a closed Path yields total
//     signed area; positive = counter-clockwise in y-up.
//   - `bounds()` returns a TIGHT axis-aligned box (analytic extrema,
//     not the control-hull / endpoint-only approximation).

import { V2d } from "../../vector/v2d.js";
import { Box2d } from "../../box/box2d.js";
import { integrate } from "../../numerics/quadrature.js";

export type PathSegmentKind = "line" | "bezier2" | "bezier3" | "arc";

// Tagged union of the four segment classes below.
export type PathSegment =
  | LineSegment
  | Bezier2Segment
  | Bezier3Segment
  | ArcSegment;

// ---------------------------------------------------------------------------
// LineSegment
// ---------------------------------------------------------------------------

export class LineSegment {
  readonly kind = "line" as const;
  readonly start: V2d;
  readonly end: V2d;

  constructor(start: V2d, end: V2d) {
    this.start = start;
    this.end = end;
  }

  eval(t: number): V2d { return this.start.lerp(this.end, t); }
  derivative(_t: number): V2d { return this.end.sub(this.start); }
  bounds(): Box2d { return Box2d.fromPoints([this.start, this.end]); }

  split(t: number): [LineSegment, LineSegment] {
    const m = this.eval(t);
    return [new LineSegment(this.start, m), new LineSegment(m, this.end)];
  }

  reverse(): LineSegment { return new LineSegment(this.end, this.start); }
  length(): number { return this.end.distance(this.start); }

  signedAreaTerm(): number {
    return 0.5 * (this.start.x * this.end.y - this.end.x * this.start.y);
  }
}

// ---------------------------------------------------------------------------
// Bezier2Segment — quadratic Bezier
// ---------------------------------------------------------------------------

export class Bezier2Segment {
  readonly kind = "bezier2" as const;
  readonly start: V2d;
  readonly control: V2d;
  readonly end: V2d;

  constructor(p0: V2d, p1: V2d, p2: V2d) {
    this.start = p0;
    this.control = p1;
    this.end = p2;
  }

  eval(t: number): V2d {
    const u = 1 - t;
    return this.start.mul(u * u)
      .add(this.control.mul(2 * u * t))
      .add(this.end.mul(t * t));
  }

  derivative(t: number): V2d {
    const a = this.control.sub(this.start);
    const b = this.end.sub(this.control);
    return a.mul(2 * (1 - t)).add(b.mul(2 * t));
  }

  bounds(): Box2d {
    // Extrema of P(t): solve x'(t) = y'(t) = 0 separately.
    // P(t) = P0 + 2t(P1-P0) + t²(P2 - 2P1 + P0)
    // P'(t) = 2(P1-P0) + 2t(P2 - 2P1 + P0) = 0
    //   => t = (P0 - P1) / (P0 - 2P1 + P2)
    const pts: V2d[] = [this.start, this.end];
    const dx = this.start.x - 2 * this.control.x + this.end.x;
    if (dx !== 0) {
      const t = (this.start.x - this.control.x) / dx;
      if (t > 0 && t < 1) pts.push(this.eval(t));
    }
    const dy = this.start.y - 2 * this.control.y + this.end.y;
    if (dy !== 0) {
      const t = (this.start.y - this.control.y) / dy;
      if (t > 0 && t < 1) pts.push(this.eval(t));
    }
    return Box2d.fromPoints(pts);
  }

  split(t: number): [Bezier2Segment, Bezier2Segment] {
    // De Casteljau.
    const q0 = this.start.lerp(this.control, t);
    const q1 = this.control.lerp(this.end, t);
    const r = q0.lerp(q1, t);
    return [
      new Bezier2Segment(this.start, q0, r),
      new Bezier2Segment(r, q1, this.end),
    ];
  }

  reverse(): Bezier2Segment {
    return new Bezier2Segment(this.end, this.control, this.start);
  }

  length(): number {
    // |P'(t)| = |2(1-t)A + 2tB|, A = P1-P0, B = P2-P1.
    const a = this.control.sub(this.start);
    const b = this.end.sub(this.control);
    const f = (t: number): number => {
      const ux = a.x + t * (b.x - a.x);
      const uy = a.y + t * (b.y - a.y);
      return 2 * Math.sqrt(ux * ux + uy * uy);
    };
    return integrate(f, 0, 1, 16);
  }

  signedAreaTerm(): number {
    // (1/2) ∫₀¹ (x y' - y x') dt. Integrand is a degree-3 polynomial,
    // so 16-point Gauss-Legendre evaluates it exactly.
    const f = (t: number): number => {
      const u = 1 - t;
      const x = this.start.x * u * u + 2 * this.control.x * u * t + this.end.x * t * t;
      const y = this.start.y * u * u + 2 * this.control.y * u * t + this.end.y * t * t;
      const xp = 2 * (this.control.x - this.start.x) * u + 2 * (this.end.x - this.control.x) * t;
      const yp = 2 * (this.control.y - this.start.y) * u + 2 * (this.end.y - this.control.y) * t;
      return x * yp - y * xp;
    };
    return 0.5 * integrate(f, 0, 1, 16);
  }
}

// ---------------------------------------------------------------------------
// Bezier3Segment — cubic Bezier
// ---------------------------------------------------------------------------

export class Bezier3Segment {
  readonly kind = "bezier3" as const;
  readonly start: V2d;
  readonly control1: V2d;
  readonly control2: V2d;
  readonly end: V2d;

  constructor(p0: V2d, p1: V2d, p2: V2d, p3: V2d) {
    this.start = p0;
    this.control1 = p1;
    this.control2 = p2;
    this.end = p3;
  }

  eval(t: number): V2d {
    const u = 1 - t;
    const u2 = u * u, t2 = t * t;
    return this.start.mul(u2 * u)
      .add(this.control1.mul(3 * u2 * t))
      .add(this.control2.mul(3 * u * t2))
      .add(this.end.mul(t2 * t));
  }

  derivative(t: number): V2d {
    const u = 1 - t;
    const a = this.control1.sub(this.start).mul(3 * u * u);
    const b = this.control2.sub(this.control1).mul(6 * u * t);
    const c = this.end.sub(this.control2).mul(3 * t * t);
    return a.add(b).add(c);
  }

  bounds(): Box2d {
    // P'(t) per coordinate is quadratic in t. Solve for each axis.
    // x(t) coefficients (in t): see comment above; derivative roots:
    //   x'(t) = 3 [ (1-t)² (x1-x0) + 2(1-t)t (x2-x1) + t² (x3-x2) ]
    //         = 3 [ A + 2 B t + C t² ]
    // where A = x1-x0 - 2(x2-x1) + (x3-x2) ? Let's derive:
    //   = 3 [(x1-x0)(1-2t+t²) + 2(x2-x1)(t-t²) + (x3-x2)t²]
    //   = 3 [(x1-x0) + (-2(x1-x0) + 2(x2-x1)) t + ((x1-x0) - 2(x2-x1) + (x3-x2)) t²]
    //   coefficients: c0 = x1-x0, c1 = 2(x2-2x1+x0), c2 = x3-3x2+3x1-x0
    const pts: V2d[] = [this.start, this.end];
    const collectExtrema = (a: number, b: number, c: number, d: number, push: (t: number) => void): void => {
      const c0 = b - a;
      const c1 = 2 * (a - 2 * b + c);
      const c2 = -a + 3 * b - 3 * c + d;
      // c2 t² + c1 t + c0 = 0
      if (c2 === 0) {
        if (c1 !== 0) {
          const t = -c0 / c1;
          if (t > 0 && t < 1) push(t);
        }
        return;
      }
      const disc = c1 * c1 - 4 * c2 * c0;
      if (disc < 0) return;
      const s = Math.sqrt(disc);
      const t1 = (-c1 + s) / (2 * c2);
      const t2 = (-c1 - s) / (2 * c2);
      if (t1 > 0 && t1 < 1) push(t1);
      if (t2 > 0 && t2 < 1) push(t2);
    };
    const tsX: number[] = [];
    const tsY: number[] = [];
    collectExtrema(this.start.x, this.control1.x, this.control2.x, this.end.x, t => tsX.push(t));
    collectExtrema(this.start.y, this.control1.y, this.control2.y, this.end.y, t => tsY.push(t));
    for (const t of tsX) pts.push(this.eval(t));
    for (const t of tsY) pts.push(this.eval(t));
    return Box2d.fromPoints(pts);
  }

  split(t: number): [Bezier3Segment, Bezier3Segment] {
    // De Casteljau.
    const q0 = this.start.lerp(this.control1, t);
    const q1 = this.control1.lerp(this.control2, t);
    const q2 = this.control2.lerp(this.end, t);
    const r0 = q0.lerp(q1, t);
    const r1 = q1.lerp(q2, t);
    const s = r0.lerp(r1, t);
    return [
      new Bezier3Segment(this.start, q0, r0, s),
      new Bezier3Segment(s, r1, q2, this.end),
    ];
  }

  reverse(): Bezier3Segment {
    return new Bezier3Segment(this.end, this.control2, this.control1, this.start);
  }

  length(): number {
    const f = (t: number): number => this.derivative(t).length();
    return integrate(f, 0, 1, 16);
  }

  signedAreaTerm(): number {
    // (1/2) ∫₀¹ (x y' - y x') dt. The integrand is a degree-5
    // polynomial, so 16-point Gauss-Legendre evaluates it exactly
    // (rule is exact up to degree 31).
    const f = (t: number): number => {
      const u = 1 - t;
      const u2 = u * u, t2 = t * t;
      const x = this.start.x * u2 * u
        + this.control1.x * 3 * u2 * t
        + this.control2.x * 3 * u * t2
        + this.end.x * t2 * t;
      const y = this.start.y * u2 * u
        + this.control1.y * 3 * u2 * t
        + this.control2.y * 3 * u * t2
        + this.end.y * t2 * t;
      const xp = (this.control1.x - this.start.x) * 3 * u2
        + (this.control2.x - this.control1.x) * 6 * u * t
        + (this.end.x - this.control2.x) * 3 * t2;
      const yp = (this.control1.y - this.start.y) * 3 * u2
        + (this.control2.y - this.control1.y) * 6 * u * t
        + (this.end.y - this.control2.y) * 3 * t2;
      return x * yp - y * xp;
    };
    return 0.5 * integrate(f, 0, 1, 16);
  }
}

// ---------------------------------------------------------------------------
// ArcSegment — elliptic arc, FIRST-CLASS (not lowered to Beziers).
// ---------------------------------------------------------------------------

/**
 * Elliptic arc, parametrised the same way Aardvark.Rendering.Text /
 * Aardvark.Base.Ellipse2d does:
 *   - `center`
 *   - two semi-axis vectors `axis0`, `axis1` (each carries direction
 *     AND magnitude, so rotation + radii are baked in together)
 *   - `startAngle` θ₀ (in the ellipse's parametric frame, radians)
 *   - `deltaAngle` Δθ — signed sweep (positive ccw)
 *
 * P(t) = center + cos(θ) · axis0 + sin(θ) · axis1   where θ = θ₀ + t·Δθ
 *
 * `axis0` and `axis1` are normally orthogonal (the standard semi-axes),
 * but the math also works for any pair of independent vectors — every
 * downstream pass treats them as raw vectors, not a (radii, rotation)
 * pair, which keeps intersection / bounds / area code free of separate
 * rotation matrices.
 */
export class ArcSegment {
  readonly kind = "arc" as const;
  /** Explicit start point — stored, NOT recomputed from `startAngle`.
   * Crucial for the closed-path invariant and for the planar-graph
   * stage: two arcs that share a vertex must compare bit-exact, which
   * trig-derived endpoints would not. */
  readonly start: V2d;
  /** Explicit end point — stored, NOT recomputed. */
  readonly end: V2d;
  readonly center: V2d;
  readonly axis0: V2d;
  readonly axis1: V2d;
  readonly startAngle: number;
  readonly deltaAngle: number;

  constructor(
    start: V2d, end: V2d,
    center: V2d, axis0: V2d, axis1: V2d,
    startAngle: number, deltaAngle: number,
  ) {
    this.start = start;
    this.end = end;
    this.center = center;
    this.axis0 = axis0;
    this.axis1 = axis1;
    this.startAngle = startAngle;
    this.deltaAngle = deltaAngle;
  }

  /**
   * Build an arc from `(center, axis0, axis1, startAngle, deltaAngle)`,
   * computing the endpoints once. Use this when you don't already
   * have explicit endpoints to thread through.
   */
  static fromAngles(
    center: V2d, axis0: V2d, axis1: V2d,
    startAngle: number, deltaAngle: number,
  ): ArcSegment {
    const evalAt = (theta: number): V2d => {
      const c = Math.cos(theta), s = Math.sin(theta);
      return new V2d(
        center.x + c * axis0.x + s * axis1.x,
        center.y + c * axis0.y + s * axis1.y,
      );
    };
    return new ArcSegment(
      evalAt(startAngle), evalAt(startAngle + deltaAngle),
      center, axis0, axis1, startAngle, deltaAngle,
    );
  }

  /** Circular arc, axis-aligned parametric frame. */
  static circular(
    center: V2d, radius: number, startAngle: number, deltaAngle: number,
  ): ArcSegment {
    return ArcSegment.fromAngles(
      center, new V2d(radius, 0), new V2d(0, radius), startAngle, deltaAngle,
    );
  }

  /**
   * Axis-aligned-then-rotated ellipse arc with explicit semi-axes
   * `(rx, ry)` and a rotation angle of the rx-axis from +x.
   */
  static fromRadiiRotation(
    center: V2d, rx: number, ry: number, rotation: number,
    startAngle: number, deltaAngle: number,
  ): ArcSegment {
    const c = Math.cos(rotation), s = Math.sin(rotation);
    return ArcSegment.fromAngles(
      center,
      new V2d(rx * c, rx * s),
      new V2d(-ry * s, ry * c),
      startAngle, deltaAngle,
    );
  }

  private pointAt(theta: number): V2d {
    const c = Math.cos(theta), s = Math.sin(theta);
    return new V2d(
      this.center.x + c * this.axis0.x + s * this.axis1.x,
      this.center.y + c * this.axis0.y + s * this.axis1.y,
    );
  }

  private tangentAt(theta: number): V2d {
    // dP/dθ = -sin θ · axis0 + cos θ · axis1
    const c = Math.cos(theta), s = Math.sin(theta);
    return new V2d(
      -s * this.axis0.x + c * this.axis1.x,
      -s * this.axis0.y + c * this.axis1.y,
    );
  }

  eval(t: number): V2d {
    if (t <= 0) return this.start;
    if (t >= 1) return this.end;
    return this.pointAt(this.startAngle + t * this.deltaAngle);
  }

  derivative(t: number): V2d {
    return this.tangentAt(this.startAngle + t * this.deltaAngle).mul(this.deltaAngle);
  }

  bounds(): Box2d {
    // Extrema of x(θ) = cx + cos θ · axis0.x + sin θ · axis1.x
    //   dx/dθ = -sin θ · axis0.x + cos θ · axis1.x = 0
    //     => tan θ = axis1.x / axis0.x  (one solution mod π)
    // Likewise for y. Collect both candidates plus their +π shifts,
    // then their +2kπ images falling inside the arc range.
    const pts: V2d[] = [this.start, this.end];
    const thetaX = Math.atan2(this.axis1.x, this.axis0.x);
    const thetaY = Math.atan2(this.axis1.y, this.axis0.y);
    const lo = this.deltaAngle >= 0 ? this.startAngle : this.startAngle + this.deltaAngle;
    const hi = this.deltaAngle >= 0 ? this.startAngle + this.deltaAngle : this.startAngle;
    const candidates = [thetaX, thetaX + Math.PI, thetaY, thetaY + Math.PI];
    for (const c of candidates) {
      const k0 = Math.ceil((lo - c) / (2 * Math.PI));
      let theta = c + 2 * Math.PI * k0;
      let k = 0;
      while (theta <= hi + 1e-15 && k < 16) {
        if (theta >= lo - 1e-15) pts.push(this.pointAt(theta));
        theta += 2 * Math.PI;
        k += 1;
      }
    }
    return Box2d.fromPoints(pts);
  }

  split(t: number): [ArcSegment, ArcSegment] {
    // Share the midpoint V2d by-identity between the two halves so
    // `left.end === right.start` exactly — the tessellator's
    // planar-graph step depends on bit-identical shared vertices.
    const midDelta = t * this.deltaAngle;
    const midAngle = this.startAngle + midDelta;
    const midPoint = this.pointAt(midAngle);
    return [
      new ArcSegment(
        this.start, midPoint,
        this.center, this.axis0, this.axis1,
        this.startAngle, midDelta,
      ),
      new ArcSegment(
        midPoint, this.end,
        this.center, this.axis0, this.axis1,
        midAngle, this.deltaAngle - midDelta,
      ),
    ];
  }

  reverse(): ArcSegment {
    // Re-use the existing start/end V2d instances so consecutive
    // reversed segments stay bit-identically connected.
    return new ArcSegment(
      this.end, this.start,
      this.center, this.axis0, this.axis1,
      this.startAngle + this.deltaAngle,
      -this.deltaAngle,
    );
  }

  length(): number {
    // |dP/dθ|² = sin²θ |axis0|² - 2 sinθ cosθ (axis0·axis1) + cos²θ |axis1|²
    const a0 = this.axis0, a1 = this.axis1;
    const aa = a0.dot(a0), ab = a0.dot(a1), bb = a1.dot(a1);
    if (Math.abs(aa - bb) < 1e-15 && Math.abs(ab) < 1e-15) {
      // Circular case — closed form.
      return Math.sqrt(aa) * Math.abs(this.deltaAngle);
    }
    const f = (theta: number): number => {
      const s = Math.sin(theta), c = Math.cos(theta);
      return Math.sqrt(s * s * aa - 2 * s * c * ab + c * c * bb);
    };
    const a = this.startAngle;
    const b = this.startAngle + this.deltaAngle;
    return Math.abs(integrate(f, Math.min(a, b), Math.max(a, b), 16));
  }

  signedAreaTerm(): number {
    // (1/2) ∫(x dy - y dx) along the arc. Decompose P = center + Δ(θ).
    //   ∫(x dy - y dx) = cx(y_end - y_start) - cy(x_end - x_start)
    //                  + ∫(Δx · dΔy/dθ - Δy · dΔx/dθ) dθ
    // Expanding the centred piece in (axis0, axis1) collapses to a
    // constant: (axis0 × axis1) · dθ. Integral over Δθ is therefore
    // (axis0.x · axis1.y - axis0.y · axis1.x) · Δθ.
    const s = this.start, e = this.end;
    const cross = this.axis0.x * this.axis1.y - this.axis0.y * this.axis1.x;
    return 0.5 * (
      this.center.x * (e.y - s.y)
      - this.center.y * (e.x - s.x)
      + cross * this.deltaAngle
    );
  }
}

// ---------------------------------------------------------------------------
// Generic helpers across the union
// ---------------------------------------------------------------------------

/** Evaluate any segment at parameter `t ∈ [0, 1]`. */
export function evalSegment(s: PathSegment, t: number): V2d { return s.eval(t); }

/** Tight axis-aligned bounding box of a segment. */
export function segmentBounds(s: PathSegment): Box2d { return s.bounds(); }
