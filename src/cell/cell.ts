// Cell — 3D octree cell identifier.
//
// A Cell represents a node in an infinite hierarchical grid of axis-
// aligned cubes. The cell at `(X, Y, Z, e)` covers
// `[X*2^e, (X+1)*2^e]` along each axis. A "centered" cell at the same
// integer origin covers `[X*2^e - 2^(e-1), X*2^e + 2^(e-1)]` — i.e.,
// the centered unit cell is `[-0.5, 0.5]^3`.
//
// `(X, Y, Z, e)` are stored as `bigint`. Cells are allocated rarely
// (one per octree node, not per point), so the `BigInt` cost is fine.

import { Box3d } from "../box/box3d.js";
import { V3d } from "../vector/v3d.js";
import { combineHash, hashNumber } from "../internal/hash.js";

const ZERO = 0n;
const ONE = 1n;
const TWO = 2n;

/** 2^e as a `number` (lossy for huge exponents). */
function pow2(exp: bigint): number {
  // Math.pow handles negative exponents (fractional sizes).
  return Math.pow(2, Number(exp));
}

/** Floor-divide integer `a` by `2^k` for non-negative `k`. */
function floorDivPow2(a: bigint, k: bigint): bigint {
  if (k <= ZERO) return a;
  // Arithmetic shift right; for negative bigints this is floor.
  return a >> k;
}

export class Cell {
  readonly x: bigint;
  readonly y: bigint;
  readonly z: bigint;
  readonly exp: bigint;
  readonly isCentered: boolean;

  constructor(x: bigint, y: bigint, z: bigint, exp: bigint, isCentered: boolean = false) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.exp = exp;
    this.isCentered = isCentered;
  }

  /** `(0, 0, 0, 0, false)` — the unit cube `[0, 1]^3`. */
  static readonly unit: Cell = new Cell(ZERO, ZERO, ZERO, ZERO, false);
  /** `(0, 0, 0, 0, true)` — the centered unit cube `[-0.5, 0.5]^3`. */
  static readonly centeredUnit: Cell = new Cell(ZERO, ZERO, ZERO, ZERO, true);

  /**
   * Smallest enclosing cell of `box`.
   *
   * Algorithm:
   * 1. Compute `size = max(box.extents)`.
   * 2. Pick `exp = ceil(log2(size))` — the smallest exponent whose
   *    cell side `2^exp` fits the box's longest extent.
   * 3. Compute origin `X = floor(min.x / 2^exp)`, etc.
   * 4. If `(X+1)*2^exp < max.x` (the box just barely overflows the
   *    cell on the high side because `min` was just below a grid
   *    line), bump `exp` by one and recompute. At most one bump
   *    suffices because the longest extent fits in `2^exp`.
   *
   * Edge cases:
   * - Empty box: returns `Cell.unit` (caller's choice; the empty box
   *   has no enclosing cell, but we don't throw).
   * - Zero-size box (a point): treated as size = 1 so we get the
   *   unit cell containing that point.
   */
  static fromBox(box: Box3d, isCentered: boolean = false): Cell {
    if (box.isEmpty()) return isCentered ? Cell.centeredUnit : Cell.unit;
    const ext = box.extents();
    let size = Math.max(ext.x, ext.y, ext.z);
    if (size === 0 || !isFinite(size)) {
      // Degenerate point box: pick the unit cell containing min.
      size = 1;
    }
    let exp = BigInt(Math.ceil(Math.log2(size)));
    const min = box.min;
    const max = box.max;
    const offset = isCentered ? 0.5 : 0;
    // For centered cells, the "cell origin coordinates" of a point p
    // come from floor((p / 2^e) + 0.5). For uncentered, just
    // floor(p / 2^e).
    let bumps = 0;
    while (bumps < 64) {
      const s = pow2(exp);
      const px = Math.floor(min.x / s + offset);
      const py = Math.floor(min.y / s + offset);
      const pz = Math.floor(min.z / s + offset);
      const lowX = (px - offset) * s;
      const lowY = (py - offset) * s;
      const lowZ = (pz - offset) * s;
      const hiX = lowX + s;
      const hiY = lowY + s;
      const hiZ = lowZ + s;
      if (hiX >= max.x && hiY >= max.y && hiZ >= max.z &&
          lowX <= min.x && lowY <= min.y && lowZ <= min.z) {
        return new Cell(BigInt(px), BigInt(py), BigInt(pz), exp, isCentered);
      }
      exp = exp + ONE;
      bumps++;
    }
    return isCentered ? Cell.centeredUnit : Cell.unit;
  }

  /** Cell whose centered bounding box has the given center and exponent. */
  static fromCenter(center: V3d, exp: bigint, isCentered: boolean = true): Cell {
    const s = pow2(exp);
    if (isCentered) {
      // Cell `(X, e, centered)` is centered at `X*2^e`.
      return new Cell(
        BigInt(Math.round(center.x / s)),
        BigInt(Math.round(center.y / s)),
        BigInt(Math.round(center.z / s)),
        exp,
        true,
      );
    }
    // Uncentered: cell `(X, e)` is centered at `(X + 0.5) * 2^e`.
    return new Cell(
      BigInt(Math.floor(center.x / s)),
      BigInt(Math.floor(center.y / s)),
      BigInt(Math.floor(center.z / s)),
      exp,
      false,
    );
  }

  /**
   * Smallest cell containing both `a` and `b`. Both cells must share
   * the same `isCentered` flag (the centered/uncentered grids are
   * different lattices and have no common ancestor in this scheme).
   */
  static commonRoot(a: Cell, b: Cell): Cell {
    if (a.isCentered !== b.isCentered) {
      throw new Error("Cell.commonRoot: cells must share the same isCentered flag");
    }
    let p = a, q = b;
    // Lift the lower-exponent cell up to match the higher one.
    while (p.exp < q.exp) p = p.parent();
    while (q.exp < p.exp) q = q.parent();
    while (p.x !== q.x || p.y !== q.y || p.z !== q.z) {
      p = p.parent();
      q = q.parent();
    }
    return p;
  }

  // ---------- spatial structure ----------

  /** `2^exp` as a `number`. Lossy for very large exponents. */
  size(): number {
    return pow2(this.exp);
  }

  /** Bounding box of this cell as a `Box3d`. */
  boundingBox(): Box3d {
    const s = pow2(this.exp);
    if (this.isCentered) {
      const half = s / 2;
      const cx = Number(this.x) * s;
      const cy = Number(this.y) * s;
      const cz = Number(this.z) * s;
      return new Box3d(cx - half, cy - half, cz - half, cx + half, cy + half, cz + half);
    }
    const lx = Number(this.x) * s;
    const ly = Number(this.y) * s;
    const lz = Number(this.z) * s;
    return new Box3d(lx, ly, lz, lx + s, ly + s, lz + s);
  }

  /** Cell at `exp + 1` containing this one. */
  parent(): Cell {
    return new Cell(
      floorDivPow2(this.x, ONE),
      floorDivPow2(this.y, ONE),
      floorDivPow2(this.z, ONE),
      this.exp + ONE,
      this.isCentered,
    );
  }

  /** Eight children at `exp - 1`, indexed by octant `0..7` (bit 0 = x, 1 = y, 2 = z). */
  children(): Cell[] {
    const out: Cell[] = new Array(8);
    for (let i = 0; i < 8; i++) out[i] = this.child(i);
    return out;
  }

  /** Single child at `exp - 1`. `octant` in `[0, 8)`; bit 0 = x, bit 1 = y, bit 2 = z. */
  child(octant: number): Cell {
    if ((octant | 0) !== octant || octant < 0 || octant >= 8) {
      throw new RangeError(`Cell.child: octant must be in [0, 8), got ${octant}`);
    }
    const cx = (this.x << ONE) | BigInt(octant & 1);
    const cy = (this.y << ONE) | BigInt((octant >> 1) & 1);
    const cz = (this.z << ONE) | BigInt((octant >> 2) & 1);
    return new Cell(cx, cy, cz, this.exp - ONE, this.isCentered);
  }

  /** True if `p` lies inside this cell's bounding box. */
  containsPoint(p: V3d): boolean {
    return this.boundingBox().contains(p);
  }

  /** Overload — point or another cell. */
  contains(other: V3d | Cell): boolean {
    if (other instanceof Cell) {
      if (other.isCentered !== this.isCentered) return false;
      // `other` is contained iff lifting it to this exponent yields
      // exactly this cell's origin.
      if (other.exp > this.exp) return false;
      const k = this.exp - other.exp;
      const ox = floorDivPow2(other.x, k);
      const oy = floorDivPow2(other.y, k);
      const oz = floorDivPow2(other.z, k);
      return ox === this.x && oy === this.y && oz === this.z;
    }
    return this.containsPoint(other);
  }

  /** True if this cell's bounding box intersects `box`. */
  intersects(box: Box3d): boolean {
    return this.boundingBox().intersects(box);
  }

  // ---------- identity ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Cell)) return false;
    return (
      this.x === other.x &&
      this.y === other.y &&
      this.z === other.z &&
      this.exp === other.exp &&
      this.isCentered === other.isCentered
    );
  }

  getHashCode(): number {
    let h = hashNumber(Number(BigInt.asIntN(32, this.x)));
    h = combineHash(h, hashNumber(Number(BigInt.asIntN(32, this.y))));
    h = combineHash(h, hashNumber(Number(BigInt.asIntN(32, this.z))));
    h = combineHash(h, hashNumber(Number(BigInt.asIntN(32, this.exp))));
    h = combineHash(h, this.isCentered ? 1 : 0);
    return h | 0;
  }

  toString(): string {
    const c = this.isCentered ? ";centered" : "";
    return `Cell(${this.x},${this.y},${this.z};e=${this.exp}${c})`;
  }

  *[Symbol.iterator](): Iterator<bigint | boolean> {
    yield this.x;
    yield this.y;
    yield this.z;
    yield this.exp;
    yield this.isCentered;
  }
}
