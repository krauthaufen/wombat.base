// Scalar constants and free helpers. Free exports — no class.

export const PI = Math.PI;
export const TAU = 2 * Math.PI;
export const HALF_PI = Math.PI / 2;
export const QUARTER_PI = Math.PI / 4;

export const EPS_F = 1.1920929e-7; // 2^-23
export const EPS_D = 2.220446049250313e-16; // 2^-52

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Returns x - floor(x); always non-negative. */
export function fract(x: number): number {
  return x - Math.floor(x);
}

/** sign(0) === 0; sign(-0) === 0; sign(NaN) === NaN. */
export function sign0(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

export function step(edge: number, x: number): boolean {
  return x >= edge;
}

/** Wraps `x` into [lo, hi) with a non-negative remainder. */
export function wrap(x: number, lo: number, hi: number): number {
  const range = hi - lo;
  if (range <= 0) return lo;
  const m = ((x - lo) % range + range) % range;
  return lo + m;
}

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export function nearestPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  const lower = 1 << Math.floor(Math.log2(n));
  const upper = lower << 1;
  return n - lower < upper - n ? lower : upper;
}

export function log2Floor(n: number): number {
  if (n <= 0) return -Infinity;
  return Math.floor(Math.log2(n));
}

export function log2Ceil(n: number): number {
  if (n <= 0) return -Infinity;
  return Math.ceil(Math.log2(n));
}

/** True if both numbers agree to within `eps` absolute distance. */
export function approxEqual(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) <= eps;
}
