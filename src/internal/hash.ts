// Hash helpers — kept compatible with `@aardworx/wombat.adaptive`'s
// `defaultHash` (`datastructures/equality.ts`). Numbers are mixed
// with the same bit-pattern hash; `combine` uses the same FNV-1a
// prime so a primitive that walks its components and hashes them
// produces a value indistinguishable from one a consumer hand-rolls
// using `defaultHash` directly.

const FNV_PRIME = 0x01000193;
const FNV_OFFSET = 0x811c9dc5;

/** 32-bit hash for a JS number. Stable across runs and platforms. */
export function hashNumber(n: number): number {
  if (n === 0) return 0;
  if (Number.isInteger(n) && n === (n | 0)) return n | 0;
  const buf = new ArrayBuffer(8);
  new Float64Array(buf)[0] = n;
  const ints = new Uint32Array(buf);
  return (ints[0]! ^ ints[1]!) | 0;
}

/** Combines a running hash with a fresh component hash. */
export function combineHash(seed: number, component: number): number {
  let h = (seed ^ component) | 0;
  h = Math.imul(h, FNV_PRIME);
  return h | 0;
}

/** Hash an arbitrary number of components in order. */
export function hashComponents(...components: readonly number[]): number {
  let h = FNV_OFFSET;
  for (const c of components) {
    h = combineHash(h, hashNumber(c));
  }
  return h;
}
