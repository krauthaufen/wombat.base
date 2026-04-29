// XoroShiro128+ — fast PRNG with 128-bit state, ~2^64 period.
//
// Reference: https://prng.di.unimi.it/xoroshiro128plus.c
//
// State is two 64-bit unsigned integers (s0, s1). JS has no native
// 64-bit int and BigInt is slow on hot paths, so each 64-bit word is
// split into a (lo, hi) pair of uint32 limbs stored in a Uint32Array
// of length 4: [s0.lo, s0.hi, s1.lo, s1.hi].
//
// 64-bit primitives (lo/hi pairs) are implemented inline:
//   xor : a ^= b           (per limb)
//   add : full carry add   (carry from lo into hi)
//   rotl: rotate-left by k (split for k<32 vs k>=32)
//
// Recurrence (from the C reference, MIT licence):
//   const result = s0 + s1;
//   s1 ^= s0;
//   s0 = rotl(s0, 24) ^ s1 ^ (s1 << 16);
//   s1 = rotl(s1, 37);
//   return result;     // upper 64 bits truncated to 32 for nextUint32
//
// For seeding, splitmix64 is used: classic mixing constants
//   0xbf58476d1ce4e5b9, 0x94d049bb133111eb, increment 0x9e3779b97f4a7c15.
// We consume four 32-bit halves (= two 64-bit splitmix outputs) to
// fill the four limbs of state.

import { TAU } from "../scalar.js";
import { V2f } from "../vector/v2f.js";
import { V3f } from "../vector/v3f.js";
import { V4f } from "../vector/v4f.js";
import { V2d } from "../vector/v2d.js";
import { V3d } from "../vector/v3d.js";
import { V4d } from "../vector/v4d.js";
import { Rot3d } from "../rotation/rot3d.js";
import { Box3d } from "../box/box3d.js";

// Placeholder kept around in case anyone is still relying on the
// structural shape. Box3d satisfies it.
interface Box3dLike {
  readonly min: V3d;
  readonly max: V3d;
}

// ---------- 64-bit helpers on (lo, hi) uint32 pairs ----------
//
// Each helper writes its result into the destination pair via a
// caller-supplied two-element scratch (lo, hi) — return values would
// allocate. We keep them as module-private functions returning a
// 2-element tuple via a shared scratch array to minimise GC.

const SCRATCH = new Uint32Array(2); // reused; never escapes module

/** rotl64((lo, hi), k): rotate-left by k in [0, 64). Writes into SCRATCH. */
function rotl64(lo: number, hi: number, k: number): void {
  // Normalise k to [0, 64).
  k &= 63;
  if (k === 0) {
    SCRATCH[0] = lo;
    SCRATCH[1] = hi;
    return;
  }
  if (k < 32) {
    // (hi:lo) << k | (hi:lo) >>> (64-k)
    const k2 = 32 - k;
    SCRATCH[0] = ((lo << k) | (hi >>> k2)) >>> 0;
    SCRATCH[1] = ((hi << k) | (lo >>> k2)) >>> 0;
  } else {
    // k in [32, 63]; treat as swap-then-rotate by (k-32).
    const k1 = k - 32;
    if (k1 === 0) {
      SCRATCH[0] = hi;
      SCRATCH[1] = lo;
      return;
    }
    const k2 = 32 - k1;
    SCRATCH[0] = ((hi << k1) | (lo >>> k2)) >>> 0;
    SCRATCH[1] = ((lo << k1) | (hi >>> k2)) >>> 0;
  }
}

/** add64((aLo, aHi), (bLo, bHi)): writes (lo, hi) into SCRATCH with full carry. */
function add64(aLo: number, aHi: number, bLo: number, bHi: number): void {
  const lo = (aLo + bLo) >>> 0;
  const carry = lo < aLo >>> 0 ? 1 : 0;
  const hi = (aHi + bHi + carry) >>> 0;
  SCRATCH[0] = lo;
  SCRATCH[1] = hi;
}

/** mul64((aLo, aHi), (bLo, bHi)): writes low 64 bits of product into SCRATCH. */
function mul64(aLo: number, aHi: number, bLo: number, bHi: number): void {
  // 16-bit halves so each partial product fits in 53 bits.
  const a0 = aLo & 0xffff, a1 = aLo >>> 16;
  const a2 = aHi & 0xffff, a3 = aHi >>> 16;
  const b0 = bLo & 0xffff, b1 = bLo >>> 16;
  const b2 = bHi & 0xffff, b3 = bHi >>> 16;

  // result = a * b mod 2^64
  // bits  0..15 : a0*b0
  // bits 16..31 : a0*b1 + a1*b0
  // bits 32..47 : a0*b2 + a1*b1 + a2*b0
  // bits 48..63 : a0*b3 + a1*b2 + a2*b1 + a3*b0
  const p00 = a0 * b0;
  const p01 = a0 * b1 + a1 * b0;
  const p02 = a0 * b2 + a1 * b1 + a2 * b0;
  const p03 = a0 * b3 + a1 * b2 + a2 * b1 + a3 * b0;

  const lo0 = p00 & 0xffff;
  const c0 = (p00 >>> 16) + (p01 & 0xffff);
  const lo1 = c0 & 0xffff;
  const c1 = (c0 >>> 16) + (p01 >>> 16) + (p02 & 0xffff);
  const hi0 = c1 & 0xffff;
  const c2 = (c1 >>> 16) + (p02 >>> 16) + (p03 & 0xffff);
  const hi1 = c2 & 0xffff;

  SCRATCH[0] = ((lo1 << 16) | lo0) >>> 0;
  SCRATCH[1] = ((hi1 << 16) | hi0) >>> 0;
}

// ---------- splitmix64 for seed expansion ----------
//
// Updates the state in-place (sLo, sHi -> sLo', sHi') and returns the
// 64-bit mixed output as (out.lo, out.hi). State and result share the
// SCRATCH-style discipline: we use two separate Uint32Array(2)s to
// avoid corruption.

const SM_INC_LO = 0x7f4a7c15 >>> 0;
const SM_INC_HI = 0x9e3779b9 >>> 0;
const SM_M1_LO = 0x1ce4e5b9 >>> 0;
const SM_M1_HI = 0xbf58476d >>> 0;
const SM_M2_LO = 0x133111eb >>> 0;
const SM_M2_HI = 0x94d049bb >>> 0;

/**
 * Performs one splitmix64 step on (state.lo, state.hi).
 * Returns the 64-bit mixed output written into `out` ([lo, hi]).
 * Mutates `state` in place.
 */
function splitmixStep(state: Uint32Array, out: Uint32Array): void {
  // state += INC
  add64(state[0]!, state[1]!, SM_INC_LO, SM_INC_HI);
  state[0] = SCRATCH[0]!;
  state[1] = SCRATCH[1]!;

  // z = state
  let zLo = state[0]!;
  let zHi = state[1]!;

  // z = (z ^ (z >> 30)) * M1
  let shLo = (zLo >>> 30) | ((zHi & 0x3fffffff) << 2);
  let shHi = zHi >>> 30;
  zLo = (zLo ^ shLo) >>> 0;
  zHi = (zHi ^ shHi) >>> 0;
  mul64(zLo, zHi, SM_M1_LO, SM_M1_HI);
  zLo = SCRATCH[0]!;
  zHi = SCRATCH[1]!;

  // z = (z ^ (z >> 27)) * M2
  shLo = (zLo >>> 27) | ((zHi & 0x07ffffff) << 5);
  shHi = zHi >>> 27;
  zLo = (zLo ^ shLo) >>> 0;
  zHi = (zHi ^ shHi) >>> 0;
  mul64(zLo, zHi, SM_M2_LO, SM_M2_HI);
  zLo = SCRATCH[0]!;
  zHi = SCRATCH[1]!;

  // z = z ^ (z >> 31)
  shLo = (zLo >>> 31) | ((zHi & 0x7fffffff) << 1);
  shHi = zHi >>> 31;
  out[0] = (zLo ^ shLo) >>> 0;
  out[1] = (zHi ^ shHi) >>> 0;
}

// Counter for the default constructor — adds entropy when many
// XoroShiro128Plus are constructed in the same millisecond.
let DEFAULT_COUNTER = 0;

export class XoroShiro128Plus {
  /**
   * State as four uint32 limbs: [s0.lo, s0.hi, s1.lo, s1.hi].
   * @internal
   */
  private readonly _s: Uint32Array;

  /**
   * Default constructor mixes Date.now(), an internal counter, and
   * Math.random() into a splitmix64 stream. For deterministic seeding
   * use `XoroShiro128Plus.seeded(seed)`.
   */
  constructor(seedLo?: number, seedHi?: number) {
    this._s = new Uint32Array(4);

    let lo: number, hi: number;
    if (seedLo === undefined && seedHi === undefined) {
      const now = Date.now();
      const ctr = ++DEFAULT_COUNTER;
      const r = Math.floor(Math.random() * 0x100000000) >>> 0;
      // 64-bit seed = (now << 0) XOR (Math.random() << 32) XOR counter
      lo = ((now >>> 0) ^ ctr) >>> 0;
      hi = ((Math.floor(now / 0x100000000) >>> 0) ^ r) >>> 0;
    } else {
      lo = (seedLo ?? 0) >>> 0;
      hi = (seedHi ?? 0) >>> 0;
    }

    XoroShiro128Plus._seedFrom64(this._s, lo, hi);
  }

  /**
   * Constructs a deterministically-seeded generator. Accepts either a
   * `bigint` (used as the full 64-bit seed) or a `number` (coerced to
   * a 64-bit splitmix expansion of its bits).
   */
  static seeded(seed: bigint | number): XoroShiro128Plus {
    const inst = Object.create(XoroShiro128Plus.prototype) as {
      _s: Uint32Array;
    };
    inst._s = new Uint32Array(4);
    let lo: number, hi: number;
    if (typeof seed === "bigint") {
      const mask32 = 0xffffffffn;
      lo = Number(seed & mask32) >>> 0;
      hi = Number((seed >> 32n) & mask32) >>> 0;
    } else {
      // Coerce a JS number to 64 bits: low 32 = signed |0, high 32 =
      // upper part of float reinterpreted via Float64Array overlay.
      const f = new Float64Array(1);
      const u = new Uint32Array(f.buffer);
      f[0] = seed;
      lo = u[0]!;
      hi = u[1]!;
    }
    XoroShiro128Plus._seedFrom64(inst._s, lo, hi);
    return inst as unknown as XoroShiro128Plus;
  }

  /**
   * Fills `s` (length 4) with four splitmix64 outputs derived from
   * the 64-bit seed (lo, hi). Re-seeds with a non-zero state; if the
   * seed is zero, we still get a usable state because splitmix64
   * produces non-zero output for the increment-only path.
   */
  private static _seedFrom64(
    s: Uint32Array,
    seedLo: number,
    seedHi: number,
  ): void {
    const sm = new Uint32Array(2);
    sm[0] = seedLo;
    sm[1] = seedHi;
    const out = new Uint32Array(2);
    // Two splitmix outputs = four uint32 = full state.
    splitmixStep(sm, out);
    s[0] = out[0]!;
    s[1] = out[1]!;
    splitmixStep(sm, out);
    s[2] = out[0]!;
    s[3] = out[1]!;
    // Guarantee non-zero state.
    if ((s[0]! | s[1]! | s[2]! | s[3]!) === 0) {
      s[0] = 1;
    }
  }

  /**
   * Advances the state and returns the upper 32 bits of the 64-bit
   * `s0 + s1` result. The xoroshiro128+ paper notes that the lower
   * bits have weaker linear-complexity properties; the upper 32 bits
   * are the conventional output for 32-bit consumers.
   */
  nextUint32(): number {
    const s = this._s;
    const s0Lo = s[0]!, s0Hi = s[1]!;
    const s1Lo = s[2]!, s1Hi = s[3]!;

    // result = s0 + s1   (we only need the upper 32 bits)
    add64(s0Lo, s0Hi, s1Lo, s1Hi);
    const resultHi = SCRATCH[1]!;

    // s1 ^= s0
    let n1Lo = (s1Lo ^ s0Lo) >>> 0;
    let n1Hi = (s1Hi ^ s0Hi) >>> 0;

    // s0 = rotl(s0, 24) ^ s1 ^ (s1 << 16)
    rotl64(s0Lo, s0Hi, 24);
    let r0Lo = SCRATCH[0]!, r0Hi = SCRATCH[1]!;
    // (s1 << 16) — left-shift the 64-bit s1 by 16
    const sh1Lo = (n1Lo << 16) >>> 0;
    const sh1Hi = (((n1Hi << 16) >>> 0) | (n1Lo >>> 16)) >>> 0;
    r0Lo = (r0Lo ^ n1Lo ^ sh1Lo) >>> 0;
    r0Hi = (r0Hi ^ n1Hi ^ sh1Hi) >>> 0;

    // s1 = rotl(s1, 37)
    rotl64(n1Lo, n1Hi, 37);
    n1Lo = SCRATCH[0]!;
    n1Hi = SCRATCH[1]!;

    s[0] = r0Lo;
    s[1] = r0Hi;
    s[2] = n1Lo;
    s[3] = n1Hi;

    return resultHi >>> 0;
  }

  /**
   * Uniform `[0, 1)` from the upper 53 bits of two consecutive
   * uint32 outputs. Standard double-precision construction:
   *   x = ((hi >>> 5) * 2^26 + (lo >>> 6)) / 2^53.
   */
  nextFloat(): number {
    const a = this.nextUint32() >>> 5; // 27 bits
    const b = this.nextUint32() >>> 6; // 26 bits
    return (a * 0x4000000 + b) / 0x20000000000000; // /2^53
  }

  /** Uniform integer in `[min, max)`. */
  nextInt(min: number, max: number): number {
    const range = max - min;
    if (range <= 0) return min;
    return min + Math.floor(this.nextFloat() * range);
  }

  /** 50/50 boolean. Uses the high bit of nextUint32. */
  nextBoolean(): boolean {
    return (this.nextUint32() & 0x80000000) !== 0;
  }

  // ---------- vectors in unit cube [0, 1)^N ----------

  nextV2f(): V2f {
    return new V2f(this.nextFloat(), this.nextFloat());
  }
  nextV3f(): V3f {
    return new V3f(this.nextFloat(), this.nextFloat(), this.nextFloat());
  }
  nextV4f(): V4f {
    return new V4f(
      this.nextFloat(),
      this.nextFloat(),
      this.nextFloat(),
      this.nextFloat(),
    );
  }

  nextV2d(): V2d {
    return new V2d(this.nextFloat(), this.nextFloat());
  }
  nextV3d(): V3d {
    return new V3d(this.nextFloat(), this.nextFloat(), this.nextFloat());
  }
  nextV4d(): V4d {
    return new V4d(
      this.nextFloat(),
      this.nextFloat(),
      this.nextFloat(),
      this.nextFloat(),
    );
  }

  // ---------- directions on the unit sphere ----------
  //
  // Archimedes' hat-box theorem: projecting the cylinder of radius 1
  // and height 2 onto the sphere preserves area, so sampling
  //   z ∈ [-1, 1], φ ∈ [0, 2π) uniformly
  // yields a uniform distribution on S². No rejection required.

  nextDirectionV3f(): V3f {
    const z = this.nextFloat() * 2 - 1;
    const phi = this.nextFloat() * TAU;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    return new V3f(r * Math.cos(phi), r * Math.sin(phi), z);
  }

  nextDirectionV3d(): V3d {
    const z = this.nextFloat() * 2 - 1;
    const phi = this.nextFloat() * TAU;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    return new V3d(r * Math.cos(phi), r * Math.sin(phi), z);
  }

  /**
   * Uniform sample on SO(3) via Shoemake's algorithm. Returns a unit
   * quaternion as `Rot3d`.
   *
   * Reference: K. Shoemake, "Uniform Random Rotations" (Graphics Gems III).
   */
  nextRotation(): Rot3d {
    const u1 = this.nextFloat();
    const u2 = this.nextFloat();
    const u3 = this.nextFloat();
    const a = Math.sqrt(1 - u1);
    const b = Math.sqrt(u1);
    const t2 = TAU * u2;
    const t3 = TAU * u3;
    // Constructor takes (w, x, y, z).
    return new Rot3d(b * Math.cos(t3), a * Math.sin(t2), a * Math.cos(t2), b * Math.sin(t3));
  }

  // ---------- spatial samplers ----------

  /** Uniform sample inside the AABB `box` (inclusive of min, exclusive of max). */
  nextInBox(box: Box3d): V3d {
    const mn = box.min, mx = box.max;
    return new V3d(
      mn.x + (mx.x - mn.x) * this.nextFloat(),
      mn.y + (mx.y - mn.y) * this.nextFloat(),
      mn.z + (mx.z - mn.z) * this.nextFloat(),
    );
  }

  /**
   * Uniform sample inside the ball of radius `radius` around `center`.
   * Cube-rejection: sample in [-1,1]^3, reject if |p|>1.
   */
  nextInSphere(center: V3d, radius: number): V3d {
    for (;;) {
      const x = this.nextFloat() * 2 - 1;
      const y = this.nextFloat() * 2 - 1;
      const z = this.nextFloat() * 2 - 1;
      const d2 = x * x + y * y + z * z;
      if (d2 <= 1) {
        return new V3d(
          center.x + x * radius,
          center.y + y * radius,
          center.z + z * radius,
        );
      }
    }
  }

  /** Uniform sample on the sphere of radius `radius` around `center`. */
  nextOnSphere(center: V3d, radius: number): V3d {
    const dir = this.nextDirectionV3d();
    return new V3d(
      center.x + dir.x * radius,
      center.y + dir.y * radius,
      center.z + dir.z * radius,
    );
  }

  // ---------- state management ----------

  /** Returns a fully independent generator with the same future sequence. */
  clone(): XoroShiro128Plus {
    const c = Object.create(XoroShiro128Plus.prototype) as {
      _s: Uint32Array;
    };
    c._s = new Uint32Array(this._s);
    return c as unknown as XoroShiro128Plus;
  }

  /** Returns a snapshot of the four limbs `[s0.lo, s0.hi, s1.lo, s1.hi]`. */
  getState(): readonly number[] {
    return [this._s[0]!, this._s[1]!, this._s[2]!, this._s[3]!];
  }

  /** Restores state from a snapshot. Rejects all-zero state. */
  setState(s: ArrayLike<number>): void {
    if (s.length < 4) throw new Error("setState: expected 4 limbs");
    const a = s[0]! >>> 0;
    const b = s[1]! >>> 0;
    const c = s[2]! >>> 0;
    const d = s[3]! >>> 0;
    if ((a | b | c | d) === 0) {
      throw new Error("setState: all-zero state is forbidden");
    }
    this._s[0] = a;
    this._s[1] = b;
    this._s[2] = c;
    this._s[3] = d;
  }
}
