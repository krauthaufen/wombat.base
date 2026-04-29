// Box2i — 2D axis-aligned bounding box, int32 components.
//
// Backed by an `Int32Array(4)` flat-storing
// `[min.x, min.y, max.x, max.y]`. The "empty" sentinel uses
// [INT32_MAX, INT32_MAX, INT32_MIN, INT32_MIN] (Int32Array can't
// hold +/-Inf), preserving the F# convention that
// `empty.extend(p)` yields the singleton box at p.
//
// Boxes do NOT carry the math operator brand: `box + box` has no
// useful meaning, so the operator-rewrite plugin should not touch
// them. Use `extend` / `union` / `intersection` explicitly.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2i } from "../vector/v2i.js";

const I32_BYTES = 4;
const COMPONENT_COUNT = 4;
const BYTES = COMPONENT_COUNT * I32_BYTES;

const I32_MAX = 2147483647;
const I32_MIN = -2147483648;

export class Box2i {
  /** @internal */
  readonly _data: Int32Array;

  constructor(minX: number = 0, minY: number = 0, maxX: number = 0, maxY: number = 0) {
    this._data = new Int32Array(4);
    this._data[0] = minX;
    this._data[1] = minY;
    this._data[2] = maxX;
    this._data[3] = maxY;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): Box2i {
    const b = Object.create(Box2i.prototype) as { _data: Int32Array };
    b._data = new Int32Array(buffer, byteOffset, COMPONENT_COUNT);
    return b as Box2i;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  static get empty(): Box2i {
    return new Box2i(I32_MAX, I32_MAX, I32_MIN, I32_MIN);
  }

  static fromMinMax(min: V2i, max: V2i): Box2i {
    return new Box2i(min.x, min.y, max.x, max.y);
  }

  static fromCenterRadius(center: V2i, radius: number): Box2i {
    return new Box2i(
      center.x - radius, center.y - radius,
      center.x + radius, center.y + radius,
    );
  }

  static fromPoints(points: Iterable<V2i>): Box2i {
    let mnx = I32_MAX, mny = I32_MAX, mxx = I32_MIN, mxy = I32_MIN;
    for (const p of points) {
      if (p.x < mnx) mnx = p.x;
      if (p.y < mny) mny = p.y;
      if (p.x > mxx) mxx = p.x;
      if (p.y > mxy) mxy = p.y;
    }
    return new Box2i(mnx, mny, mxx, mxy);
  }

  static fromBoxes(boxes: Iterable<Box2i>): Box2i {
    let mnx = I32_MAX, mny = I32_MAX, mxx = I32_MIN, mxy = I32_MIN;
    for (const b of boxes) {
      if (b._data[0]! < mnx) mnx = b._data[0]!;
      if (b._data[1]! < mny) mny = b._data[1]!;
      if (b._data[2]! > mxx) mxx = b._data[2]!;
      if (b._data[3]! > mxy) mxy = b._data[3]!;
    }
    return new Box2i(mnx, mny, mxx, mxy);
  }

  /** Fresh copy of the min corner. */
  get min(): V2i { return new V2i(this._data[0]!, this._data[1]!); }
  set min(v: V2i) { this._data[0] = v.x; this._data[1] = v.y; }
  /** Fresh copy of the max corner. */
  get max(): V2i { return new V2i(this._data[2]!, this._data[3]!); }
  set max(v: V2i) { this._data[2] = v.x; this._data[3] = v.y; }

  isEmpty(): boolean {
    return this._data[0]! > this._data[2]! || this._data[1]! > this._data[3]!;
  }
  isValid(): boolean { return !this.isEmpty(); }

  size(): V2i {
    return new V2i(this._data[2]! - this._data[0]!, this._data[3]! - this._data[1]!);
  }
  center(): V2i {
    return new V2i(
      (this._data[0]! + this._data[2]!) / 2 | 0,
      (this._data[1]! + this._data[3]!) / 2 | 0,
    );
  }
  extents(): V2i { return this.size(); }

  area(): number {
    const sx = this._data[2]! - this._data[0]!;
    const sy = this._data[3]! - this._data[1]!;
    return sx * sy;
  }

  contains(p: V2i | Box2i): boolean {
    if (p instanceof Box2i) {
      return (
        p._data[0]! >= this._data[0]! && p._data[1]! >= this._data[1]! &&
        p._data[2]! <= this._data[2]! && p._data[3]! <= this._data[3]!
      );
    }
    return (
      p.x >= this._data[0]! && p.x <= this._data[2]! &&
      p.y >= this._data[1]! && p.y <= this._data[3]!
    );
  }

  intersects(other: Box2i): boolean {
    return (
      this._data[0]! <= other._data[2]! && other._data[0]! <= this._data[2]! &&
      this._data[1]! <= other._data[3]! && other._data[1]! <= this._data[3]!
    );
  }

  extend(p: V2i | Box2i): Box2i {
    if (p instanceof Box2i) {
      return new Box2i(
        Math.min(this._data[0]!, p._data[0]!),
        Math.min(this._data[1]!, p._data[1]!),
        Math.max(this._data[2]!, p._data[2]!),
        Math.max(this._data[3]!, p._data[3]!),
      );
    }
    return new Box2i(
      Math.min(this._data[0]!, p.x),
      Math.min(this._data[1]!, p.y),
      Math.max(this._data[2]!, p.x),
      Math.max(this._data[3]!, p.y),
    );
  }

  intersection(other: Box2i): Box2i {
    return new Box2i(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
      Math.min(this._data[2]!, other._data[2]!),
      Math.min(this._data[3]!, other._data[3]!),
    );
  }

  union(other: Box2i): Box2i { return this.extend(other); }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Box2i)) return false;
    return (
      this._data[0] === other._data[0] && this._data[1] === other._data[1] &&
      this._data[2] === other._data[2] && this._data[3] === other._data[3]
    );
  }

  approxEqual(other: Box2i, eps: number): boolean {
    return (
      Math.abs(this._data[0]! - other._data[0]!) <= eps &&
      Math.abs(this._data[1]! - other._data[1]!) <= eps &&
      Math.abs(this._data[2]! - other._data[2]!) <= eps &&
      Math.abs(this._data[3]! - other._data[3]!) <= eps
    );
  }

  getHashCode(): number {
    let h = hashNumber(this._data[0]!);
    h = combineHash(h, hashNumber(this._data[1]!));
    h = combineHash(h, hashNumber(this._data[2]!));
    h = combineHash(h, hashNumber(this._data[3]!));
    return h;
  }

  toString(): string {
    return `Box2i([${this._data[0]}, ${this._data[1]}], [${this._data[2]}, ${this._data[3]}])`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
    yield this._data[2]!;
    yield this._data[3]!;
  }
}
