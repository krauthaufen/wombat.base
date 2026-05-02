// Verbatim port of Aardvark.Base.Polynomial (C# → TypeScript).
//
// Polynomials are stored with ASCENDING coefficients:
//   coeff[0] + coeff[1] x + coeff[2] x^2 + ... + coeff[n-1] x^(n-1)
//
// Real-root finders return a fixed-arity tuple, with NaN slots padding when
// fewer real roots exist. The numerical tricks mirror Aardvark exactly:
//
//   * b-sign-aware quadratic formula to avoid catastrophic cancellation,
//   * Cardano's method with Casus Irreducibilis (sin/cos branch) for cubics,
//   * Ferrari's method for quartics with a +tiny sign-flip safeguard
//     (`u`, `v` clamped to 0 when below PositiveTinyValue — original
//     comment: "+tiny instead of 0 improves unique root accuracy by a
//     factor of 10^5!").
//
// Method names are camelCased: `derivative`, `multiply`, `evaluate`,
// `realRoot`, `realRootOfNormed`, `realRootsOf`, `realRootsOfNormed`,
// `realRootsOfDepressed`, `oneRealRootOfNormed`. The C# `out` parameters
// map to tuple returns; double `(double, double)` etc. become
// `[number, number]` etc. with NaN padding.

// `Constant<double>.PositiveTinyValue = 4 * doubleEps`
// where `doubleEps = nextAfter(1.0) - 1.0 = 2^-52`.
// Hence: 4 * 2^-52 = 8.881784197001252e-16.
const POSITIVE_TINY_VALUE = 4 * Number.EPSILON;

/** `Fun.IsTiny(x)` — true when `|x| < PositiveTinyValue`. */
function isTiny(x: number): boolean {
  return Math.abs(x) < POSITIVE_TINY_VALUE;
}

/**
 * Sort three numbers ascending. NaNs (used as "no root" sentinels) are
 * pushed to the end so that real values keep the canonical leading slots.
 * Mirrors Aardvark's `TupleExtensions.CreateAscending`, which for the
 * cubic Casus-Irreducibilis branch always receives three finite reals.
 */
function createAscending3(a: number, b: number, c: number): [number, number, number] {
  const arr = [a, b, c];
  arr.sort((x, y) => {
    if (Number.isNaN(x)) return Number.isNaN(y) ? 0 : 1;
    if (Number.isNaN(y)) return -1;
    return x - y;
  });
  return [arr[0]!, arr[1]!, arr[2]!];
}

// ---------------------------------------------------------------------------
// Polynomial algebra
// ---------------------------------------------------------------------------

/**
 * Polynomial derivative of an ascending-coefficient polynomial.
 * Throws when the polynomial has fewer than two coefficients
 * (the derivative of a constant has no representation).
 */
export function derivative(coeff: readonly number[]): number[] {
  const len = coeff.length - 1;
  if (len < 1) throw new Error("argument");
  const r = new Array<number>(len);
  r[0] = coeff[1]!;
  if (len < 2) return r;
  for (let i = 1, j = 2; i < len; i = j++) {
    r[i] = j * coeff[j]!;
  }
  return r;
}

/**
 * Polynomial product of two ascending-coefficient polynomials.
 */
export function multiply(c0: readonly number[], c1: readonly number[]): number[] {
  const l0 = c0.length;
  const l1 = c1.length;
  const r = new Array<number>(l0 + l1 - 1).fill(0);
  for (let i0 = 0; i0 < l0; i0++) {
    for (let i1 = 0; i1 < l1; i1++) {
      r[i0 + i1]! += c0[i0]! * c1[i1]!;
    }
  }
  return r;
}

/**
 * Horner-style evaluation of an ascending-coefficient polynomial at `x`.
 */
export function evaluate(coeff: readonly number[], x: number): number {
  let i = coeff.length - 1;
  if (i < 0) throw new Error("argument");
  let value = coeff[i--]!;
  while (i >= 0) value = x * value + coeff[i--]!;
  return value;
}

/**
 * Horner-style evaluation of the derivative of an ascending-coefficient
 * polynomial at `x`:  coeff[1] + 2 coeff[2] x + ... + (n-1) coeff[n-1] x^(n-2).
 */
export function evaluateDerivative(coeff: readonly number[], x: number): number {
  let i = coeff.length - 1;
  if (i < 0) throw new Error("argument");
  let value = i * coeff[i]!;
  --i;
  while (i > 0) { value = x * value + i * coeff[i]!; --i; }
  return value;
}

// ---------------------------------------------------------------------------
// Linear
// ---------------------------------------------------------------------------

/**
 * Real root of `a x + b = 0`. Returns `NaN` when `a` is tiny.
 */
export function realRoot(a: number, b: number): number {
  if (isTiny(a)) return NaN;
  return -b / a;
}

/** `x + p = 0`  →  `-p`. */
export function realRootOfNormed(p: number): number {
  return -p;
}

// ---------------------------------------------------------------------------
// Quadratic
// ---------------------------------------------------------------------------

/**
 * Real roots of `a x^2 + b x + c = 0`. Double roots are returned as a pair
 * of identical values. If only one (linear) root exists, it is stored in
 * the first entry and the second entry is NaN. If no real roots exist,
 * both entries are NaN.
 *
 * Uses the b-sign-aware variant of the quadratic formula to avoid
 * catastrophic cancellation in `-b ± √Δ`.
 */
export function realRootsOfQuadratic(a: number, b: number, c: number): [number, number] {
  if (isTiny(a)) {
    if (isTiny(b)) return [NaN, NaN];
    return [-c / b, NaN];
  }
  const r = b * b - 4 * a * c;
  if (r < 0) return [NaN, NaN];
  if (b < 0) {                               // prevent cancellation
    const d = -b + Math.sqrt(r);
    return [2 * c / d, d / (2 * a)];
  } else {
    const d = -b - Math.sqrt(r);
    return [d / (2 * a), 2 * c / d];
  }
}

/**
 * Real roots of `x^2 + p x + q = 0`. Double roots are returned as a pair
 * of identical values; no real roots produces `[NaN, NaN]`.
 */
export function realRootsOfNormedQuadratic(p: number, q: number): [number, number] {
  const p2 = p / 2.0;
  const d = p2 * p2 - q;

  if (d < 0) return [NaN, NaN];
  if (p2 > 0.0) {                            // prevent cancellation
    const r = -(p2 + Math.sqrt(d));
    return [r, q / r];
  } else {
    const r = Math.sqrt(d) - p2;
    return [q / r, r];
  }
}

// ---------------------------------------------------------------------------
// Cubic
// ---------------------------------------------------------------------------

/**
 * Real roots of `a x^3 + b x^2 + c x + d = 0`. Double / triple solutions
 * are returned as repeated values; imaginary / non-existing solutions as
 * NaN. Falls through to the quadratic when `a` is tiny.
 */
export function realRootsOfCubic(
  a: number, b: number, c: number, d: number,
): [number, number, number] {
  if (isTiny(a)) {
    const r = realRootsOfQuadratic(b, c, d);
    return [r[0], r[1], NaN];
  }
  return realRootsOfNormedCubic(b / a, c / a, d / a);
}

/**
 * Real roots of `x^3 + c2 x^2 + c1 x + c0 = 0`.
 * Double / triple solutions are returned as repeated values; imaginary or
 * non-existing solutions as NaN.
 */
export function realRootsOfNormedCubic(
  c2: number, c1: number, c0: number,
): [number, number, number] {
  // ------ eliminate quadric term (x = y - c2/3): x^3 + p x + q = 0
  let d = c2 * c2;
  const p3 = (1 / 3.0) * /* p */ (-(1 / 3.0) * d + c1);
  const q2 = (1 / 2.0) * /* q */ (((2 / 27.0) * d - (1 / 3.0) * c1) * c2 + c0);
  const p3c = p3 * p3 * p3;
  const shift = (1 / 3.0) * c2;
  d = q2 * q2 + p3c;
  if (d < 0) {           // casus irreducibilis: three real solutions
    const phi = (1 / 3.0) * Math.acos(-q2 / Math.sqrt(-p3c));
    const t = 2 * Math.sqrt(-p3);
    const r0 =  t * Math.cos(phi) - shift;
    const r1 = -t * Math.cos(phi + Math.PI / 3.0) - shift;
    const r2 = -t * Math.cos(phi - Math.PI / 3.0) - shift;
    return createAscending3(r0, r1, r2);
  }
  // else if (isTiny(q2))                         // one triple root
  // {                                            // too unlikely for
  //     const r = -(1/3.0) * c2;                 // special handling
  //     return [r, r, r];                        // to pay off
  // }
  d = Math.sqrt(d);                  // one single and one double root
  const uav = Math.cbrt(d - q2) - Math.cbrt(d + q2);
  const s0 = uav - shift;
  const s1 = -0.5 * uav - shift;
  return s0 < s1 ? [s0, s1, s1] : [s1, s1, s0];
}

/**
 * Real roots of the depressed cubic `x^3 + p x + q = 0`.
 * Double / triple solutions are repeated values; non-existing as NaN.
 */
export function realRootsOfDepressedCubic(p: number, q: number): [number, number, number] {
  const p3 = (1 / 3.0) * p;
  const q2 = (1 / 2.0) * q;
  const p3c = p3 * p3 * p3;
  let d = q2 * q2 + p3c;
  if (d < 0) { // ---------- casus irreducibilis: three real solutions
    const phi = (1 / 3.0) * Math.acos(-q2 / Math.sqrt(-p3c));
    const t = 2 * Math.sqrt(-p3);
    const r0 =  t * Math.cos(phi);
    const r1 = -t * Math.cos(phi + Math.PI / 3.0);
    const r2 = -t * Math.cos(phi - Math.PI / 3.0);
    return createAscending3(r0, r1, r2);
  }
  d = Math.sqrt(d);  // one triple root or a single and a double root
  const s0 = Math.cbrt(d - q2) - Math.cbrt(d + q2);
  const s1 = -0.5 * s0;
  return s0 < s1 ? [s0, s1, s1] : [s1, s1, s0];
}

/**
 * One real root of `x^3 + c2 x^2 + c1 x + c0 = 0`.
 * Used as the single-root entry point for the resolvent cubic in the
 * quartic solver.
 */
export function oneRealRootOfNormed(c2: number, c1: number, c0: number): number {
  // ------ eliminate quadric term (x = y - c2/3): x^3 + p x + q = 0
  let d = c2 * c2;
  const p3 = (1 / 3.0) * /* p */ (-(1 / 3.0) * d + c1);
  const q2 = (1 / 2.0) * /* q */ (((2 / 27.0) * d - (1 / 3.0) * c1) * c2 + c0);
  const p3c = p3 * p3 * p3;
  d = q2 * q2 + p3c;
  if (d < 0) {                // casus irreducibilis: three real roots
    return 2 * Math.sqrt(-p3) * Math.cos(
      (1 / 3.0) * Math.acos(-q2 / Math.sqrt(-p3c)),
    ) - (1 / 3.0) * c2;
  }
  d = Math.sqrt(d);  // one triple root or a single and a double root
  return Math.cbrt(d - q2) - Math.cbrt(d + q2) - (1 / 3.0) * c2;
}

// ---------------------------------------------------------------------------
// Quartic (Ferrari)
// ---------------------------------------------------------------------------

function countNonNaNs2(p: [number, number]): number {
  return (Number.isNaN(p[0]) ? 0 : 1) + (Number.isNaN(p[1]) ? 0 : 1);
}
function countNonNaNs3(t: [number, number, number]): number {
  return (Number.isNaN(t[0]) ? 0 : 1)
       + (Number.isNaN(t[1]) ? 0 : 1)
       + (Number.isNaN(t[2]) ? 0 : 1);
}

/**
 * Merge a sorted triple (some leading entries non-NaN, NaNs at tail) with
 * an extra value `d` that should be inserted in sorted order, then add
 * `shift` to every produced entry. NaN-pads the result to length 4.
 */
function mergeSortedAndShift3(
  t: [number, number, number], d: number, shift: number,
): [number, number, number, number] {
  const tc = countNonNaNs3(t);
  const q: [number, number, number, number] = [0, 0, 0, 0];
  let i = 0, ti = 0;
  while (ti < tc) {
    if (t[ti]! < d) {
      q[i++] = t[ti++]! + shift;
    } else {
      q[i++] = d + shift;
      break;
    }
  }
  while (ti < tc) q[i++] = t[ti++]! + shift;
  while (i < 4) q[i++] = NaN;
  return q;
}

/**
 * Merge two sorted pairs (NaN-padded) into a sorted quadruple, adding
 * `shift` to every produced entry. NaN-pads the result.
 */
function mergeSortedAndShift22(
  p0: [number, number], p1: [number, number], shift: number,
): [number, number, number, number] {
  const c0 = countNonNaNs2(p0);
  const c1 = countNonNaNs2(p1);
  const q: [number, number, number, number] = [0, 0, 0, 0];
  let i = 0, i0 = 0, i1 = 0;
  while (i0 < c0 && i1 < c1) {
    if (p0[i0]! < p1[i1]!) q[i++] = p0[i0++]! + shift;
    else                    q[i++] = p1[i1++]! + shift;
  }
  while (i0 < c0) q[i++] = p0[i0++]! + shift;
  while (i1 < c1) q[i++] = p1[i1++]! + shift;
  while (i < 4) q[i++] = NaN;
  return q;
}

/**
 * Real roots of `a x^4 + b x^3 + c x^2 + d x + e = 0`.
 * Double / triple solutions are repeated values; imaginary / non-existing
 * solutions are NaN. Falls through to the cubic when `a` is tiny.
 */
export function realRootsOfQuartic(
  a: number, b: number, c: number, d: number, e: number,
): [number, number, number, number] {
  if (isTiny(a)) {
    const r = realRootsOfCubic(b, c, d, e);
    return [r[0], r[1], r[2], NaN];
  }
  return realRootsOfNormedQuartic(b / a, c / a, d / a, e / a);
}

/**
 * Real roots of `x^4 + c3 x^3 + c2 x^2 + c1 x + c0 = 0` via Ferrari's
 * method. Double / triple roots replicate; non-existing ones are NaN.
 */
export function realRootsOfNormedQuartic(
  c3: number, c2: number, c1: number, c0: number,
): [number, number, number, number] {
  // eliminate cubic term (x = y - c3/4):  x^4 + p x^2 + q x + r = 0
  const e = c3 * c3;
  const p = -(3 / 8.0) * e + c2;
  const q = ((1 / 8.0) * e - (1 / 2.0) * c2) * c3 + c1;
  const r = ((1 / 16.0) * c2 - (3 / 256.0) * e) * e - (1 / 4.0) * c3 * c1 + c0;

  if (isTiny(r)) { // ---- no absolute term: y (y^3 + p y + q) = 0
    return mergeSortedAndShift3(
      realRootsOfDepressedCubic(p, q), 0.0, -(1 / 4.0) * c3,
    );
  }
  // ----------------------- take one root of the resolvent cubic...
  const z = oneRealRootOfNormed(
    -(1 / 2.0) * p, -r, (1 / 2.0) * r * p - (1 / 8.0) * q * q,
  );
  // --------------------------- ...to build two quadratic equations
  let u = z * z - r;
  let v = 2.0 * z - p;
  if (u < POSITIVE_TINY_VALUE)            // +tiny instead of 0
    u = 0.0;                              // improves unique
  else                                    // root accuracy by a
    u = Math.sqrt(u);                     // factor of 10^5!
  if (v < POSITIVE_TINY_VALUE)            // values greater than
    v = 0.0;                              // +tiny == 4 * eps
  else                                    // do not seem to
    v = Math.sqrt(v);                     // improve accuraccy!
  const q1 = q < 0 ? -v : v;
  return mergeSortedAndShift22(
    realRootsOfNormedQuadratic(q1, z - u),
    realRootsOfNormedQuadratic(-q1, z + u),
    -(1 / 4.0) * c3,
  );
}

// ---------------------------------------------------------------------------
// Overloaded entry points (matching the public namespace surface)
// ---------------------------------------------------------------------------

export function realRootsOf(a: number, b: number, c: number): [number, number];
export function realRootsOf(a: number, b: number, c: number, d: number): [number, number, number];
export function realRootsOf(a: number, b: number, c: number, d: number, e: number): [number, number, number, number];
export function realRootsOf(
  a: number, b: number, c: number, d?: number, e?: number,
): [number, number] | [number, number, number] | [number, number, number, number] {
  if (e !== undefined) return realRootsOfQuartic(a, b, c, d!, e);
  if (d !== undefined) return realRootsOfCubic(a, b, c, d);
  return realRootsOfQuadratic(a, b, c);
}

export function realRootsOfNormed(p: number, q: number): [number, number];
export function realRootsOfNormed(c2: number, c1: number, c0: number): [number, number, number];
export function realRootsOfNormed(c3: number, c2: number, c1: number, c0: number): [number, number, number, number];
export function realRootsOfNormed(
  a: number, b: number, c?: number, d?: number,
): [number, number] | [number, number, number] | [number, number, number, number] {
  if (d !== undefined) return realRootsOfNormedQuartic(a, b, c!, d);
  if (c !== undefined) return realRootsOfNormedCubic(a, b, c);
  return realRootsOfNormedQuadratic(a, b);
}

// ---------------------------------------------------------------------------
// `RealRoots` / `RealRootsNormed` (array-in / array-out helpers)
// ---------------------------------------------------------------------------

function nonNan1(root: number): number[] {
  return Number.isNaN(root) ? [] : [root];
}
function nonNan2(p: readonly [number, number]): number[] {
  if (Number.isNaN(p[0])) return Number.isNaN(p[1]) ? [] : [p[1]];
  return Number.isNaN(p[1]) ? [p[0]] : [p[0], p[1]];
}
function nonNan3(t: readonly [number, number, number]): number[] {
  const out: number[] = [];
  if (!Number.isNaN(t[0])) out.push(t[0]);
  if (!Number.isNaN(t[1])) out.push(t[1]);
  if (!Number.isNaN(t[2])) out.push(t[2]);
  return out;
}
function nonNan4(q: readonly [number, number, number, number]): number[] {
  const out: number[] = [];
  if (!Number.isNaN(q[0])) out.push(q[0]);
  if (!Number.isNaN(q[1])) out.push(q[1]);
  if (!Number.isNaN(q[2])) out.push(q[2]);
  if (!Number.isNaN(q[3])) out.push(q[3]);
  return out;
}

/**
 * Real roots of an ascending-coefficient polynomial of degree ≤ 4.
 * Double / triple roots appear as repeated values. Throws for degree ≥ 5.
 */
export function realRoots(coeff: readonly number[]): number[] {
  switch (coeff.length) {
    case 0:
    case 1: return [];
    case 2: return nonNan1(realRoot(coeff[1]!, coeff[0]!));
    case 3: return nonNan2(realRootsOfQuadratic(coeff[2]!, coeff[1]!, coeff[0]!));
    case 4: return nonNan3(realRootsOfCubic(coeff[3]!, coeff[2]!, coeff[1]!, coeff[0]!));
    case 5: return nonNan4(realRootsOfQuartic(coeff[4]!, coeff[3]!, coeff[2]!, coeff[1]!, coeff[0]!));
    default: throw new Error("not implemented");
  }
}

/**
 * Real roots of a normalized ascending-coefficient polynomial of degree ≤ 4
 * (the leading coefficient is implicitly 1 and not part of the input).
 */
export function realRootsNormed(coeff: readonly number[]): number[] {
  switch (coeff.length) {
    case 0: return [];
    case 1: return [realRootOfNormed(coeff[0]!)];
    case 2: return nonNan2(realRootsOfNormedQuadratic(coeff[1]!, coeff[0]!));
    case 3: return nonNan3(realRootsOfNormedCubic(coeff[2]!, coeff[1]!, coeff[0]!));
    case 4: return nonNan4(realRootsOfNormedQuartic(coeff[3]!, coeff[2]!, coeff[1]!, coeff[0]!));
    default: throw new Error("not implemented");
  }
}

/**
 * Returns a copy of an array of roots without any double roots with an
 * absolute difference smaller than `epsilon`. Roots with odd multiplicity
 * remain as single roots.
 */
export function withoutDoubleRoots(a: readonly number[], epsilon: number): number[] {
  const last = a.length - 1;
  if (last < 4) return withoutDoubleRoots4(a, epsilon);
  const r: number[] = [];
  let i = 0;
  while (i < last) {
    const j = i + 1;
    if (Math.abs(a[i]! - a[j]!) < epsilon) { i += 2; continue; }
    r.push(a[i]!);
    i = j;
  }
  if (i === last) r.push(a[i]!);
  return r;
}

function withoutDoubleRoots4(a: readonly number[], eps: number): number[] {
  const len = a.length;
  if (len < 2) return [...a];
  if (Math.abs(a[0]! - a[1]!) < eps) {
    if (len < 3) return [];
    if (len < 4) return [a[2]!];
    if (Math.abs(a[2]! - a[3]!) < eps) return [];
    return [a[2]!, a[3]!];
  } else {
    if (len < 3) return [...a];
    if (Math.abs(a[1]! - a[2]!) < eps) {
      if (len < 4) return [a[0]!];
      return [a[0]!, a[3]!];
    } else {
      if (len < 4) return [...a];
      if (Math.abs(a[2]! - a[3]!) < eps) return [a[0]!, a[1]!];
      return [...a];
    }
  }
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export interface PolynomialNamespace {
  derivative(coeff: readonly number[]): number[];
  multiply(c0: readonly number[], c1: readonly number[]): number[];
  evaluate(coeff: readonly number[], x: number): number;
  evaluateDerivative(coeff: readonly number[], x: number): number;
  realRoot(a: number, b: number): number;
  realRootOfNormed(p: number): number;
  realRootsOf(a: number, b: number, c: number): [number, number];
  realRootsOf(a: number, b: number, c: number, d: number): [number, number, number];
  realRootsOf(a: number, b: number, c: number, d: number, e: number): [number, number, number, number];
  realRootsOfNormed(p: number, q: number): [number, number];
  realRootsOfNormed(c2: number, c1: number, c0: number): [number, number, number];
  realRootsOfNormed(c3: number, c2: number, c1: number, c0: number): [number, number, number, number];
  realRootsOfDepressed(p: number, q: number): [number, number, number];
  oneRealRootOfNormed(c2: number, c1: number, c0: number): number;
  realRoots(coeff: readonly number[]): number[];
  realRootsNormed(coeff: readonly number[]): number[];
  withoutDoubleRoots(a: readonly number[], epsilon: number): number[];
}

export const Polynomial: PolynomialNamespace = {
  derivative,
  multiply,
  evaluate,
  evaluateDerivative,
  realRoot,
  realRootOfNormed,
  realRootsOf: realRootsOf as PolynomialNamespace["realRootsOf"],
  realRootsOfNormed: realRootsOfNormed as PolynomialNamespace["realRootsOfNormed"],
  realRootsOfDepressed: realRootsOfDepressedCubic,
  oneRealRootOfNormed,
  realRoots,
  realRootsNormed,
  withoutDoubleRoots,
};
