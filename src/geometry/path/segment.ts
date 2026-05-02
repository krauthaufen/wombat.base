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
 * Elliptic arc parametrised by:
 *   - centre `c`
 *   - radii `(rx, ry)` (positive, before rotation)
 *   - `rotation` of the major axis from +x, in radians
 *   - `startAngle` θ₀ in the unrotated ellipse frame, radians
 *   - `deltaAngle` Δθ — signed sweep (positive ccw); |Δθ| typically ≤ 2π
 *
 * P(t) = c + R(ρ) · (rx cos θ, ry sin θ)  where  θ = θ₀ + t·Δθ
 *
 * Storing native ellipse params (rather than SVG endpoint params) keeps
 * every downstream pass — intersection, length, area, triangulation —
 * working on the actual curve, not a polyline / Bezier approximation.
 */
export class ArcSegment {
  readonly kind = "arc" as const;
  readonly center: V2d;
  readonly radii: V2d;
  readonly rotation: number;
  readonly startAngle: number;
  readonly deltaAngle: number;

  constructor(
    center: V2d,
    radii: V2d,
    rotation: number,
    startAngle: number,
    deltaAngle: number,
  ) {
    this.center = center;
    this.radii = radii;
    this.rotation = rotation;
    this.startAngle = startAngle;
    this.deltaAngle = deltaAngle;
  }

  /** Construct a circular arc (rx = ry = radius, rotation irrelevant). */
  static circular(
    center: V2d, radius: number, startAngle: number, deltaAngle: number,
  ): ArcSegment {
    return new ArcSegment(center, new V2d(radius, radius), 0, startAngle, deltaAngle);
  }

  private pointAt(theta: number): V2d {
    const cr = Math.cos(this.rotation), sr = Math.sin(this.rotation);
    const ux = this.radii.x * Math.cos(theta);
    const uy = this.radii.y * Math.sin(theta);
    return new V2d(
      this.center.x + ux * cr - uy * sr,
      this.center.y + ux * sr + uy * cr,
    );
  }

  private tangentAt(theta: number): V2d {
    // dP/dθ in world frame.
    const cr = Math.cos(this.rotation), sr = Math.sin(this.rotation);
    const dux = -this.radii.x * Math.sin(theta);
    const duy = this.radii.y * Math.cos(theta);
    return new V2d(dux * cr - duy * sr, dux * sr + duy * cr);
  }

  get start(): V2d { return this.pointAt(this.startAngle); }
  get end(): V2d { return this.pointAt(this.startAngle + this.deltaAngle); }

  eval(t: number): V2d {
    return this.pointAt(this.startAngle + t * this.deltaAngle);
  }

  derivative(t: number): V2d {
    return this.tangentAt(this.startAngle + t * this.deltaAngle).mul(this.deltaAngle);
  }

  bounds(): Box2d {
    // Extrema of x(θ) and y(θ) within [θ₀, θ₀+Δθ].
    //   dx/dθ = 0  =>  tan θ = -(ry/rx) tan ρ
    //   dy/dθ = 0  =>  tan θ =  (ry/rx) cot ρ
    // Each gives a θ in (-π, π] modulo π — collect both copies plus
    // their +2kπ shifts that lie within the arc range.
    const pts: V2d[] = [this.start, this.end];
    const cr = Math.cos(this.rotation), sr = Math.sin(this.rotation);
    const rx = this.radii.x, ry = this.radii.y;
    const thetaX = Math.atan2(-ry * sr, rx * cr);
    const thetaY = Math.atan2(ry * cr, rx * sr);
    const lo = this.deltaAngle >= 0 ? this.startAngle : this.startAngle + this.deltaAngle;
    const hi = this.deltaAngle >= 0 ? this.startAngle + this.deltaAngle : this.startAngle;
    const candidates = [thetaX, thetaX + Math.PI, thetaY, thetaY + Math.PI];
    for (const c of candidates) {
      // Shift c by 2π to land in [lo, hi] if possible.
      const span = hi - lo;
      let k = Math.ceil((lo - c) / (2 * Math.PI));
      let theta = c + 2 * Math.PI * k;
      while (theta <= hi + 1e-15) {
        if (theta >= lo - 1e-15 && span >= 0) pts.push(this.pointAt(theta));
        theta += 2 * Math.PI;
        k += 1;
        if (k > 10) break; // safety
      }
    }
    return Box2d.fromPoints(pts);
  }

  split(t: number): [ArcSegment, ArcSegment] {
    const mid = t * this.deltaAngle;
    return [
      new ArcSegment(this.center, this.radii, this.rotation, this.startAngle, mid),
      new ArcSegment(this.center, this.radii, this.rotation, this.startAngle + mid, this.deltaAngle - mid),
    ];
  }

  reverse(): ArcSegment {
    return new ArcSegment(
      this.center, this.radii, this.rotation,
      this.startAngle + this.deltaAngle,
      -this.deltaAngle,
    );
  }

  length(): number {
    const rx = this.radii.x, ry = this.radii.y;
    if (rx === ry) return rx * Math.abs(this.deltaAngle);
    // ∫|dP/dθ| dθ = ∫ sqrt(rx² sin²θ + ry² cos²θ) dθ.
    // (Rotation `ρ` is an isometry, so it drops out of the integrand.)
    const f = (theta: number): number => {
      const s = Math.sin(theta), c = Math.cos(theta);
      return Math.sqrt(rx * rx * s * s + ry * ry * c * c);
    };
    const a = this.startAngle;
    const b = this.startAngle + this.deltaAngle;
    return Math.abs(integrate(f, Math.min(a, b), Math.max(a, b), 16));
  }

  signedAreaTerm(): number {
    // (1/2) ∫(x dy - y dx) along the arc.
    // Decompose P = c + Δ(θ) where Δ is the centred ellipse evaluation.
    //   ∫ x dy = cx (y_end - y_start) + ∫ Δx · dΔy/dθ dθ
    //   ∫ y dx = cy (x_end - x_start) + ∫ Δy · dΔx/dθ dθ
    // The centred-frame piece simplifies: rotation is an isometry, so
    //   ∫ (Δx dΔy - Δy dΔx)/dθ dθ = rx · ry · Δθ.
    const s = this.start, e = this.end;
    return 0.5 * (
      this.center.x * (e.y - s.y)
      - this.center.y * (e.x - s.x)
      + this.radii.x * this.radii.y * this.deltaAngle
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
