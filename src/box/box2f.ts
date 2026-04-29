// Box2f — 2D axis-aligned bounding box, float32 components.
//
// Backed by a `Float32Array(4)` flat-storing
// `[min.x, min.y, max.x, max.y]`. Empty sentinel: `[+Inf, +Inf,
// -Inf, -Inf]` (F# convention).
//
// Boxes do NOT carry the math operator brand.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V2f } from "../vector/v2f.js";

const F32_BYTES = 4;
const COMPONENT_COUNT = 4;
const BYTES = COMPONENT_COUNT * F32_BYTES;

export class Box2f {
  /** @internal */
  readonly _data: Float32Array;

  constructor(minX: number = 0, minY: number = 0, maxX: number = 0, maxY: number = 0) {
    this._data = new Float32Array(4);
    this._data[0] = minX;
    this._data[1] = minY;
    this._data[2] = maxX;
    this._data[3] = maxY;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): Box2f {
    const b = Object.create(Box2f.prototype) as { _data: Float32Array };
    b._data = new Float32Array(buffer, byteOffset, COMPONENT_COUNT);
    return b as Box2f;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  static get empty(): Box2f {
    return new Box2f(Infinity, Infinity, -Infinity, -Infinity);
  }

  static fromMinMax(min: V2f, max: V2f): Box2f {
    return new Box2f(min.x, min.y, max.x, max.y);
  }

  static fromCenterRadius(center: V2f, radius: number): Box2f {
    return new Box2f(
      center.x - radius, center.y - radius,
      center.x + radius, center.y + radius,
    );
  }

  static fromPoints(points: Iterable<V2f>): Box2f {
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (const p of points) {
      if (p.x < mnx) mnx = p.x;
      if (p.y < mny) mny = p.y;
      if (p.x > mxx) mxx = p.x;
      if (p.y > mxy) mxy = p.y;
    }
    return new Box2f(mnx, mny, mxx, mxy);
  }

  static fromBoxes(boxes: Iterable<Box2f>): Box2f {
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (const b of boxes) {
      if (b._data[0]! < mnx) mnx = b._data[0]!;
      if (b._data[1]! < mny) mny = b._data[1]!;
      if (b._data[2]! > mxx) mxx = b._data[2]!;
      if (b._data[3]! > mxy) mxy = b._data[3]!;
    }
    return new Box2f(mnx, mny, mxx, mxy);
  }

  get min(): V2f { return new V2f(this._data[0]!, this._data[1]!); }
  set min(v: V2f) { this._data[0] = v.x; this._data[1] = v.y; }
  get max(): V2f { return new V2f(this._data[2]!, this._data[3]!); }
  set max(v: V2f) { this._data[2] = v.x; this._data[3] = v.y; }

  isEmpty(): boolean {
    return this._data[0]! > this._data[2]! || this._data[1]! > this._data[3]!;
  }
  isValid(): boolean { return !this.isEmpty(); }

  size(): V2f {
    return new V2f(this._data[2]! - this._data[0]!, this._data[3]! - this._data[1]!);
  }
  center(): V2f {
    return new V2f(
      (this._data[0]! + this._data[2]!) / 2,
      (this._data[1]! + this._data[3]!) / 2,
    );
  }
  extents(): V2f { return this.size(); }

  area(): number {
    const sx = this._data[2]! - this._data[0]!;
    const sy = this._data[3]! - this._data[1]!;
    return sx * sy;
  }

  contains(p: V2f | Box2f): boolean {
    if (p instanceof Box2f) {
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

  intersects(other: Box2f): boolean {
    return (
      this._data[0]! <= other._data[2]! && other._data[0]! <= this._data[2]! &&
      this._data[1]! <= other._data[3]! && other._data[1]! <= this._data[3]!
    );
  }

  extend(p: V2f | Box2f): Box2f {
    if (p instanceof Box2f) {
      return new Box2f(
        Math.min(this._data[0]!, p._data[0]!),
        Math.min(this._data[1]!, p._data[1]!),
        Math.max(this._data[2]!, p._data[2]!),
        Math.max(this._data[3]!, p._data[3]!),
      );
    }
    return new Box2f(
      Math.min(this._data[0]!, p.x),
      Math.min(this._data[1]!, p.y),
      Math.max(this._data[2]!, p.x),
      Math.max(this._data[3]!, p.y),
    );
  }

  intersection(other: Box2f): Box2f {
    return new Box2f(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
      Math.min(this._data[2]!, other._data[2]!),
      Math.min(this._data[3]!, other._data[3]!),
    );
  }

  union(other: Box2f): Box2f { return this.extend(other); }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Box2f)) return false;
    return (
      this._data[0] === other._data[0] && this._data[1] === other._data[1] &&
      this._data[2] === other._data[2] && this._data[3] === other._data[3]
    );
  }

  approxEqual(other: Box2f, eps: number): boolean {
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
    return `Box2f([${this._data[0]}, ${this._data[1]}], [${this._data[2]}, ${this._data[3]}])`;
  }

  *[Symbol.iterator](): Iterator<number> {
    yield this._data[0]!;
    yield this._data[1]!;
    yield this._data[2]!;
    yield this._data[3]!;
  }
}
