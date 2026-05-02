// Gauss-Legendre quadrature on [a, b].
//
// `gaussLegendre(n)` returns the nodes/weights for the unit interval
// [-1, 1]. `integrate` rescales to an arbitrary [a, b] and evaluates
// `sum_i w_i * f(x_i)`. 8-point is exact for polynomials up to
// degree 15 and gives ~14–15 digit accuracy for smooth transcendental
// integrands; 16-point is exact up to degree 31.
//
// Used by the path-segment module for Bezier / arc length and any
// transcendental integral arising from curve-curve work.

interface QuadratureRule {
  readonly nodes: ReadonlyArray<number>;
  readonly weights: ReadonlyArray<number>;
}

// Pre-computed 8-point and 16-point rules on [-1, 1]. Constants from
// standard tables (Abramowitz & Stegun Table 25.4); symmetric so we
// list only the positive half and mirror on use.
const GL8_HALF: ReadonlyArray<readonly [number, number]> = [
  [0.1834346424956498, 0.3626837833783620],
  [0.5255324099163290, 0.3137066458778873],
  [0.7966664774136267, 0.2223810344533745],
  [0.9602898564975363, 0.1012285362903763],
];

const GL16_HALF: ReadonlyArray<readonly [number, number]> = [
  [0.0950125098376374, 0.1894506104550685],
  [0.2816035507792589, 0.1826034150449236],
  [0.4580167776572274, 0.1691565193950025],
  [0.6178762444026438, 0.1495959888165767],
  [0.7554044083550030, 0.1246289712555339],
  [0.8656312023878318, 0.0951585116824928],
  [0.9445750230732326, 0.0622535239386479],
  [0.9894009349916499, 0.0271524594117541],
];

function expand(half: ReadonlyArray<readonly [number, number]>): QuadratureRule {
  const nodes: number[] = [];
  const weights: number[] = [];
  for (const [x, w] of half) { nodes.push(-x); weights.push(w); }
  for (const [x, w] of half) { nodes.push(x); weights.push(w); }
  return { nodes, weights };
}

const RULE_8 = expand(GL8_HALF);
const RULE_16 = expand(GL16_HALF);

function ruleFor(order: 8 | 16): QuadratureRule {
  return order === 8 ? RULE_8 : RULE_16;
}

/** Integrate `f` over `[a, b]` using n-point Gauss-Legendre. */
export function integrate(
  f: (x: number) => number,
  a: number,
  b: number,
  order: 8 | 16 = 16,
): number {
  const rule = ruleFor(order);
  const half = (b - a) * 0.5;
  const mid = (b + a) * 0.5;
  let s = 0;
  for (let i = 0; i < rule.nodes.length; i++) {
    s += rule.weights[i]! * f(mid + half * rule.nodes[i]!);
  }
  return s * half;
}

/**
 * Adaptive Simpson-style integration over `[a, b]` using two halves
 * compared to one whole; recurses where the difference exceeds `tol`.
 * Robust for integrands that vary rapidly over part of the interval
 * (e.g. arc length when curvature is uneven).
 */
export function integrateAdaptive(
  f: (x: number) => number,
  a: number,
  b: number,
  tol: number = 1e-12,
  order: 8 | 16 = 16,
  maxDepth: number = 20,
): number {
  function go(lo: number, hi: number, whole: number, depth: number): number {
    const mid = (lo + hi) * 0.5;
    const left = integrate(f, lo, mid, order);
    const right = integrate(f, mid, hi, order);
    const sum = left + right;
    if (depth <= 0 || Math.abs(sum - whole) < tol) return sum;
    return go(lo, mid, left, depth - 1) + go(mid, hi, right, depth - 1);
  }
  const whole = integrate(f, a, b, order);
  return go(a, b, whole, maxDepth);
}
