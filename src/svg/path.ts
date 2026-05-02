// SVG `<path d="…">` parser → `PathSegment[]`.
//
// Parses the W3C SVG 1.1 path-data grammar. Commands handled:
//
//   M m   moveto              C c   cubic Bezier
//   L l   lineto              S s   smooth cubic Bezier (reflect prev c2)
//   H h   horizontal lineto   Q q   quadratic Bezier
//   V v   vertical lineto     T t   smooth quadratic Bezier (reflect prev c1)
//   Z z   closepath           A a   elliptical arc
//
// Lowercase commands are relative to the current pen; uppercase are
// absolute. Implicit command repetition after the first parameter
// group is handled (`M 0,0 1,1 2,2` = M then implicit L L).
//
// Coordinate conventions: SVG path-data is in the viewport's native
// y-DOWN system. We pass coordinates through unchanged — callers who
// want math y-up should apply a y-flip transform afterwards (e.g. via
// the demo's `transformSegs(segs, 0, 0, 1, -1)`). Keeping SVG
// semantics intact lets callers render the result inside an `<svg>`
// element with the same `viewBox` for a 1:1 reference.
//
// SVG `A` (elliptical arc) is lowered to one or more `ArcSegment`s
// via the W3C Implementation-Notes appendix-B endpoint→centre
// conversion. The result preserves arc-length parametrisation
// (start/end angles + delta) so the Loop-Blinn arc classifier can
// process them directly.

import { V2d } from "../vector/v2d.js";
import {
  type PathSegment,
  LineSegment, Bezier2Segment, Bezier3Segment, ArcSegment,
} from "../geometry/path/segment.js";

export interface SvgPathOptions {
  /** Tolerance for treating two consecutive points as identical. */
  readonly eps?: number;
}

/**
 * Parse an SVG `d` attribute string and return the equivalent
 * `PathSegment[]` in SVG-native coordinates (y-DOWN). Multi-subpath
 * d-strings yield a flat list with each sub-path's segments in
 * command order.
 */
export function pathFromSvgD(
  d: string, options: SvgPathOptions = {},
): PathSegment[] {
  const eps = options.eps ?? 1e-12;
  const tokens = tokenize(d);

  const out: PathSegment[] = [];
  let pen = new V2d(0, 0);
  let anchor: V2d | undefined;
  /** Last cubic control2 (for S smoothing). */
  let lastCubic2: V2d | undefined;
  /** Last quadratic control1 (for T smoothing). */
  let lastQuad1: V2d | undefined;

  let i = 0;
  let cmd: string | undefined;
  const readNum = (): number => {
    const t = tokens[i++];
    if (t === undefined || typeof t !== "number") {
      throw new Error(`pathFromSvgD: expected number near token ${i}`);
    }
    return t;
  };
  const readPt = (relative: boolean): V2d => {
    const x = readNum();
    const y = readNum();
    return relative ? new V2d(pen.x + x, pen.y + y) : new V2d(x, y);
  };
  const closeIfOpen = (): void => {
    if (anchor && (Math.abs(pen.x - anchor.x) > eps || Math.abs(pen.y - anchor.y) > eps)) {
      out.push(new LineSegment(pen, anchor));
      pen = anchor;
    }
  };

  while (i < tokens.length) {
    const tok = tokens[i];
    if (typeof tok === "string") {
      cmd = tok;
      i++;
      // Z / z: no parameters; close immediately.
      if (cmd === "Z" || cmd === "z") {
        closeIfOpen();
        if (anchor) pen = anchor;
        lastCubic2 = undefined;
        lastQuad1 = undefined;
        cmd = undefined;
        continue;
      }
    } else if (cmd === undefined) {
      throw new Error(`pathFromSvgD: number with no preceding command at token ${i}`);
    }
    // We need a command in scope here.
    if (cmd === undefined) continue;
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case "M": {
        const p = readPt(rel);
        pen = p; anchor = p;
        // Implicit subsequent points become L / l.
        cmd = rel ? "l" : "L";
        lastCubic2 = undefined;
        lastQuad1 = undefined;
        break;
      }
      case "L": {
        const p = readPt(rel);
        if (Math.abs(pen.x - p.x) > eps || Math.abs(pen.y - p.y) > eps) {
          out.push(new LineSegment(pen, p));
          pen = p;
        }
        lastCubic2 = undefined;
        lastQuad1 = undefined;
        break;
      }
      case "H": {
        const x = readNum();
        const p = new V2d(rel ? pen.x + x : x, pen.y);
        if (Math.abs(pen.x - p.x) > eps) {
          out.push(new LineSegment(pen, p));
          pen = p;
        }
        lastCubic2 = undefined;
        lastQuad1 = undefined;
        break;
      }
      case "V": {
        const y = readNum();
        const p = new V2d(pen.x, rel ? pen.y + y : y);
        if (Math.abs(pen.y - p.y) > eps) {
          out.push(new LineSegment(pen, p));
          pen = p;
        }
        lastCubic2 = undefined;
        lastQuad1 = undefined;
        break;
      }
      case "C": {
        const c1 = readPt(rel), c2 = readPt(rel), p = readPt(rel);
        out.push(new Bezier3Segment(pen, c1, c2, p));
        pen = p;
        lastCubic2 = c2;
        lastQuad1 = undefined;
        break;
      }
      case "S": {
        const c1 = lastCubic2
          ? new V2d(2 * pen.x - lastCubic2.x, 2 * pen.y - lastCubic2.y)
          : pen;
        const c2 = readPt(rel), p = readPt(rel);
        out.push(new Bezier3Segment(pen, c1, c2, p));
        pen = p;
        lastCubic2 = c2;
        lastQuad1 = undefined;
        break;
      }
      case "Q": {
        const c1 = readPt(rel), p = readPt(rel);
        out.push(new Bezier2Segment(pen, c1, p));
        pen = p;
        lastQuad1 = c1;
        lastCubic2 = undefined;
        break;
      }
      case "T": {
        const c1 = lastQuad1
          ? new V2d(2 * pen.x - lastQuad1.x, 2 * pen.y - lastQuad1.y)
          : pen;
        const p = readPt(rel);
        out.push(new Bezier2Segment(pen, c1, p));
        pen = p;
        lastQuad1 = c1;
        lastCubic2 = undefined;
        break;
      }
      case "A": {
        const rx = readNum(), ry = readNum();
        const rotDeg = readNum();
        const largeArc = readNum() !== 0;
        const sweep = readNum() !== 0;
        const p = readPt(rel);
        const arcs = svgArcToArcSegments(pen, p, rx, ry, rotDeg, largeArc, sweep);
        for (const a of arcs) out.push(a);
        pen = p;
        lastCubic2 = undefined;
        lastQuad1 = undefined;
        break;
      }
      default:
        throw new Error(`pathFromSvgD: unsupported command '${cmd}'`);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Tokenizer
// ─────────────────────────────────────────────────────────────────

/** Tokens are either single-char commands (`"M"`, `"l"`, …) or
 *  numbers. Whitespace and commas separate tokens; signs and dots
 *  may also start a new number without an explicit separator. */
type Token = string | number;

function tokenize(d: string): Token[] {
  const out: Token[] = [];
  const n = d.length;
  let i = 0;
  while (i < n) {
    const c = d[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === ",") {
      i++; continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      out.push(c);
      i++;
      continue;
    }
    // Number: optional sign, digits, dot, digits, exponent.
    let j = i;
    if (c === "+" || c === "-") j++;
    let sawDot = false;
    while (j < n) {
      const ch = d[j]!;
      if (ch >= "0" && ch <= "9") { j++; continue; }
      if (ch === ".") {
        if (sawDot) break;
        sawDot = true; j++; continue;
      }
      if (ch === "e" || ch === "E") {
        j++;
        if (d[j] === "+" || d[j] === "-") j++;
        while (j < n && d[j]! >= "0" && d[j]! <= "9") j++;
        break;
      }
      break;
    }
    if (j === i || (j === i + 1 && (c === "+" || c === "-" || c === "."))) {
      throw new Error(`pathFromSvgD: invalid character '${c}' at offset ${i}`);
    }
    out.push(parseFloat(d.slice(i, j)));
    i = j;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// SVG elliptical arc → ArcSegment(s)
// ─────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

/**
 * SVG endpoint-arc parameterisation → centre / axes / sweep, per
 * W3C SVG 1.1 Implementation Notes appendix B.2.4. Returns a single
 * `ArcSegment` (the planar-graph + Loop-Blinn pipeline already
 * handles |Δθ| > π/2 internally via `classifyArc`'s piece split).
 *
 * Degenerate cases per the spec:
 *   - rx == 0 || ry == 0  → emit a LineSegment.
 *   - Fun.ApproximateEquals(start, end) → emit nothing (zero arc).
 *   - rx, ry get auto-scaled if the radii are too small to
 *     reach the endpoint (Λ > 1, eqs. F.6.6.2-F.6.6.3).
 */
function svgArcToArcSegments(
  start: V2d, end: V2d,
  rxIn: number, ryIn: number, rotDeg: number,
  largeArc: boolean, sweep: boolean,
): PathSegment[] {
  if (Math.abs(start.x - end.x) < 1e-12 && Math.abs(start.y - end.y) < 1e-12) {
    return [];
  }
  let rx = Math.abs(rxIn), ry = Math.abs(ryIn);
  if (rx < 1e-12 || ry < 1e-12) return [new LineSegment(start, end)];

  const phi = rotDeg * Math.PI / 180;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);

  // F.6.5.1 — translate-and-rotate to a frame where the ellipse is
  // axis-aligned at the origin.
  const dx = (start.x - end.x) * 0.5;
  const dy = (start.y - end.y) * 0.5;
  const x1p =  cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // F.6.6.2 — radius correction.
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    rx *= s; ry *= s;
  }

  // F.6.5.2 — centre in the rotated frame.
  const rx2 = rx * rx, ry2 = ry * ry;
  const x1p2 = x1p * x1p, y1p2 = y1p * y1p;
  let factor = (rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2)
             / (rx2 * y1p2 + ry2 * x1p2);
  if (factor < 0) factor = 0; // numerical safety
  const sign = (largeArc === sweep) ? -1 : 1;
  const coef = sign * Math.sqrt(factor);
  const cxp =  coef * (rx * y1p) / ry;
  const cyp = -coef * (ry * x1p) / rx;

  // F.6.5.3 — un-rotate / un-translate the centre.
  const cx = cosPhi * cxp - sinPhi * cyp + (start.x + end.x) * 0.5;
  const cy = sinPhi * cxp + cosPhi * cyp + (start.y + end.y) * 0.5;

  // F.6.5.4-6 — start angle and sweep delta.
  const ux = ( x1p - cxp) / rx, uy = ( y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx, vy = (-y1p - cyp) / ry;
  const angle = (ux2: number, uy2: number, vx2: number, vy2: number): number => {
    const dot = ux2 * vx2 + uy2 * vy2;
    const len = Math.hypot(ux2, uy2) * Math.hypot(vx2, vy2);
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux2 * vy2 - uy2 * vx2 < 0) a = -a;
    return a;
  };
  const theta1 = angle(1, 0, ux, uy);
  let dTheta = angle(ux, uy, vx, vy);
  if (!sweep && dTheta > 0) dTheta -= TAU;
  else if (sweep && dTheta < 0) dTheta += TAU;

  // Build the ArcSegment with explicit endpoints — `fromAngles`
  // would re-evaluate cos/sin of `theta1 + dTheta` which can drift
  // off `end` by ~1e-15 and break the planar-graph endpoint identity.
  const axis0 = new V2d(rx * cosPhi, rx * sinPhi);
  const axis1 = new V2d(-ry * sinPhi, ry * cosPhi);
  const center = new V2d(cx, cy);
  return [new ArcSegment(start, end, center, axis0, axis1, theta1, dTheta)];
}
