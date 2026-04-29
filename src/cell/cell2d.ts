// Cell2d — 2D quadtree cell identifier.
//
// 2D analogue of `Cell`. The cell at `(X, Y, e)` covers
// `[X*2^e, (X+1)*2^e]` along each axis. A "centered" cell at the
// same integer origin covers `[X*2^e - 2^(e-1), X*2^e + 2^(e-1)]`.

import { Box2d } from "../box/box2d.js";
import { V2d } from "../vector/v2d.js";
import { combineHash, hashNumber } from "../internal/hash.js";

const ZERO = 0n;
const ONE = 1n;

function pow2(exp: bigint): number {
  return Math.pow(2, Number(exp));
}

function floorDivPow2(a: bigint, k: bigint): bigint {
  if (k <= ZERO) return a;
  return a >> k;
}

export class Cell2d {
  readonly x: bigint;
  readonly y: bigint;
  readonly exp: bigint;
  readonly isCentered: boolean;

  constructor(x: bigint, y: bigint, exp: bigint, isCentered: boolean = false) {
    this.x = x;
    this.y = y;
    this.exp = exp;
    this.isCentered = isCentered;
  }

  /** `(0, 0, 0, false)` — the unit square `[0, 1]^2`. */
  static readonly unit: Cell2d = new Cell2d(ZERO, ZERO, ZERO, false);
  /** `(0, 0, 0, true)` — the centered unit square `[-0.5, 0.5]^2`. */
  static readonly centeredUnit: Cell2d = new Cell2d(ZERO, ZERO, ZERO, true);

  /** Smallest enclosing cell of `box`. See `Cell.fromBox` for algorithm. */
  static fromBox(box: Box2d, isCentered: boolean = false): Cell2d {
    if (box.isEmpty()) return isCentered ? Cell2d.centeredUnit : Cell2d.unit;
    const ext = box.extents();
    let size = Math.max(ext.x, ext.y);
    if (size === 0 || !isFinite(size)) size = 1;
    let exp = BigInt(Math.ceil(Math.log2(size)));
    const min = box.min;
    const max = box.max;
    const offset = isCentered ? 0.5 : 0;
    let bumps = 0;
    while (bumps < 64) {
      const s = pow2(exp);
      const px = Math.floor(min.x / s + offset);
      const py = Math.floor(min.y / s + offset);
      const lowX = (px - offset) * s;
      const lowY = (py - offset) * s;
      const hiX = lowX + s;
      const hiY = lowY + s;
      if (hiX >= max.x && hiY >= max.y && lowX <= min.x && lowY <= min.y) {
        return new Cell2d(BigInt(px), BigInt(py), exp, isCentered);
      }
      exp = exp + ONE;
      bumps++;
    }
    return isCentered ? Cell2d.centeredUnit : Cell2d.unit;
  }

  static fromCenter(center: V2d, exp: bigint, isCentered: boolean = true): Cell2d {
    const s = pow2(exp);
    if (isCentered) {
      return new Cell2d(
        BigInt(Math.round(center.x / s)),
        BigInt(Math.round(center.y / s)),
        exp,
        true,
      );
    }
    return new Cell2d(
      BigInt(Math.floor(center.x / s)),
      BigInt(Math.floor(center.y / s)),
      exp,
      false,
    );
  }

  static commonRoot(a: Cell2d, b: Cell2d): Cell2d {
    if (a.isCentered !== b.isCentered) {
      throw new Error("Cell2d.commonRoot: cells must share the same isCentered flag");
    }
    let p = a, q = b;
    while (p.exp < q.exp) p = p.parent();
    while (q.exp < p.exp) q = q.parent();
    while (p.x !== q.x || p.y !== q.y) {
      p = p.parent();
      q = q.parent();
    }
    return p;
  }

  size(): number {
    return pow2(this.exp);
  }

  boundingBox(): Box2d {
    const s = pow2(this.exp);
    if (this.isCentered) {
      const half = s / 2;
      const cx = Number(this.x) * s;
      const cy = Number(this.y) * s;
      return new Box2d(cx - half, cy - half, cx + half, cy + half);
    }
    const lx = Number(this.x) * s;
    const ly = Number(this.y) * s;
    return new Box2d(lx, ly, lx + s, ly + s);
  }

  parent(): Cell2d {
    return new Cell2d(
      floorDivPow2(this.x, ONE),
      floorDivPow2(this.y, ONE),
      this.exp + ONE,
      this.isCentered,
    );
  }

  /** Four children at `exp - 1`, indexed by quadrant `0..3` (bit 0 = x, bit 1 = y). */
  children(): Cell2d[] {
    return [this.child(0), this.child(1), this.child(2), this.child(3)];
  }

  child(quadrant: number): Cell2d {
    if ((quadrant | 0) !== quadrant || quadrant < 0 || quadrant >= 4) {
      throw new RangeError(`Cell2d.child: quadrant must be in [0, 4), got ${quadrant}`);
    }
    const cx = (this.x << ONE) | BigInt(quadrant & 1);
    const cy = (this.y << ONE) | BigInt((quadrant >> 1) & 1);
    return new Cell2d(cx, cy, this.exp - ONE, this.isCentered);
  }

  containsPoint(p: V2d): boolean {
    return this.boundingBox().contains(p);
  }

  contains(other: V2d | Cell2d): boolean {
    if (other instanceof Cell2d) {
      if (other.isCentered !== this.isCentered) return false;
      if (other.exp > this.exp) return false;
      const k = this.exp - other.exp;
      const ox = floorDivPow2(other.x, k);
      const oy = floorDivPow2(other.y, k);
      return ox === this.x && oy === this.y;
    }
    return this.containsPoint(other);
  }

  intersects(box: Box2d): boolean {
    return this.boundingBox().intersects(box);
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Cell2d)) return false;
    return (
      this.x === other.x &&
      this.y === other.y &&
      this.exp === other.exp &&
      this.isCentered === other.isCentered
    );
  }

  getHashCode(): number {
    let h = hashNumber(Number(BigInt.asIntN(32, this.x)));
    h = combineHash(h, hashNumber(Number(BigInt.asIntN(32, this.y))));
    h = combineHash(h, hashNumber(Number(BigInt.asIntN(32, this.exp))));
    h = combineHash(h, this.isCentered ? 1 : 0);
    return h | 0;
  }

  toString(): string {
    const c = this.isCentered ? ";centered" : "";
    return `Cell2d(${this.x},${this.y};e=${this.exp}${c})`;
  }

  *[Symbol.iterator](): Iterator<bigint | boolean> {
    yield this.x;
    yield this.y;
    yield this.exp;
    yield this.isCentered;
  }
}
