// Box3i — 3D axis-aligned bounding box, int32 components.
//
// Backed by an `Int32Array(6)` flat-storing
// `[min.x, min.y, min.z, max.x, max.y, max.z]`. Empty sentinel uses
// [INT32_MAX]*3 + [INT32_MIN]*3 since Int32Array can't hold +/-Inf.
//
// Boxes do NOT carry the math operator brand.

import { combineHash, hashNumber } from "../internal/hash.js";
import { V3i } from "../vector/v3i.js";

const I32_BYTES = 4;
const COMPONENT_COUNT = 6;
const BYTES = COMPONENT_COUNT * I32_BYTES;

const I32_MAX = 2147483647;
const I32_MIN = -2147483648;

export class Box3i {
  /** @internal */
  readonly _data: Int32Array;

  constructor(
    minX: number = 0, minY: number = 0, minZ: number = 0,
    maxX: number = 0, maxY: number = 0, maxZ: number = 0,
  ) {
    this._data = new Int32Array(6);
    this._data[0] = minX;
    this._data[1] = minY;
    this._data[2] = minZ;
    this._data[3] = maxX;
    this._data[4] = maxY;
    this._data[5] = maxZ;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): Box3i {
    const b = Object.create(Box3i.prototype) as { _data: Int32Array };
    b._data = new Int32Array(buffer, byteOffset, COMPONENT_COUNT);
    return b as Box3i;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  static get empty(): Box3i {
    return new Box3i(I32_MAX, I32_MAX, I32_MAX, I32_MIN, I32_MIN, I32_MIN);
  }

  static fromMinMax(min: V3i, max: V3i): Box3i {
    return new Box3i(min.x, min.y, min.z, max.x, max.y, max.z);
  }

  static fromCenterRadius(center: V3i, radius: number): Box3i {
    return new Box3i(
      center.x - radius, center.y - radius, center.z - radius,
      center.x + radius, center.y + radius, center.z + radius,
    );
  }

  static fromPoints(points: Iterable<V3i>): Box3i {
    let mnx = I32_MAX, mny = I32_MAX, mnz = I32_MAX;
    let mxx = I32_MIN, mxy = I32_MIN, mxz = I32_MIN;
    for (const p of points) {
      if (p.x < mnx) mnx = p.x;
      if (p.y < mny) mny = p.y;
      if (p.z < mnz) mnz = p.z;
      if (p.x > mxx) mxx = p.x;
      if (p.y > mxy) mxy = p.y;
      if (p.z > mxz) mxz = p.z;
    }
    return new Box3i(mnx, mny, mnz, mxx, mxy, mxz);
  }

  static fromBoxes(boxes: Iterable<Box3i>): Box3i {
    let mnx = I32_MAX, mny = I32_MAX, mnz = I32_MAX;
    let mxx = I32_MIN, mxy = I32_MIN, mxz = I32_MIN;
    for (const b of boxes) {
      if (b._data[0]! < mnx) mnx = b._data[0]!;
      if (b._data[1]! < mny) mny = b._data[1]!;
      if (b._data[2]! < mnz) mnz = b._data[2]!;
      if (b._data[3]! > mxx) mxx = b._data[3]!;
      if (b._data[4]! > mxy) mxy = b._data[4]!;
      if (b._data[5]! > mxz) mxz = b._data[5]!;
    }
    return new Box3i(mnx, mny, mnz, mxx, mxy, mxz);
  }

  get min(): V3i { return new V3i(this._data[0]!, this._data[1]!, this._data[2]!); }
  set min(v: V3i) { this._data[0] = v.x; this._data[1] = v.y; this._data[2] = v.z; }
  get max(): V3i { return new V3i(this._data[3]!, this._data[4]!, this._data[5]!); }
  set max(v: V3i) { this._data[3] = v.x; this._data[4] = v.y; this._data[5] = v.z; }

  isEmpty(): boolean {
    return (
      this._data[0]! > this._data[3]! ||
      this._data[1]! > this._data[4]! ||
      this._data[2]! > this._data[5]!
    );
  }
  isValid(): boolean { return !this.isEmpty(); }

  size(): V3i {
    return new V3i(
      this._data[3]! - this._data[0]!,
      this._data[4]! - this._data[1]!,
      this._data[5]! - this._data[2]!,
    );
  }
  center(): V3i {
    return new V3i(
      (this._data[0]! + this._data[3]!) / 2 | 0,
      (this._data[1]! + this._data[4]!) / 2 | 0,
      (this._data[2]! + this._data[5]!) / 2 | 0,
    );
  }
  extents(): V3i { return this.size(); }

  volume(): number {
    const sx = this._data[3]! - this._data[0]!;
    const sy = this._data[4]! - this._data[1]!;
    const sz = this._data[5]! - this._data[2]!;
    return sx * sy * sz;
  }

  surfaceArea(): number {
    const sx = this._data[3]! - this._data[0]!;
    const sy = this._data[4]! - this._data[1]!;
    const sz = this._data[5]! - this._data[2]!;
    return 2 * (sx * sy + sy * sz + sz * sx);
  }

  contains(p: V3i | Box3i): boolean {
    if (p instanceof Box3i) {
      return (
        p._data[0]! >= this._data[0]! && p._data[1]! >= this._data[1]! && p._data[2]! >= this._data[2]! &&
        p._data[3]! <= this._data[3]! && p._data[4]! <= this._data[4]! && p._data[5]! <= this._data[5]!
      );
    }
    return (
      p.x >= this._data[0]! && p.x <= this._data[3]! &&
      p.y >= this._data[1]! && p.y <= this._data[4]! &&
      p.z >= this._data[2]! && p.z <= this._data[5]!
    );
  }

  intersects(other: Box3i): boolean {
    return (
      this._data[0]! <= other._data[3]! && other._data[0]! <= this._data[3]! &&
      this._data[1]! <= other._data[4]! && other._data[1]! <= this._data[4]! &&
      this._data[2]! <= other._data[5]! && other._data[2]! <= this._data[5]!
    );
  }

  extend(p: V3i | Box3i): Box3i {
    if (p instanceof Box3i) {
      return new Box3i(
        Math.min(this._data[0]!, p._data[0]!),
        Math.min(this._data[1]!, p._data[1]!),
        Math.min(this._data[2]!, p._data[2]!),
        Math.max(this._data[3]!, p._data[3]!),
        Math.max(this._data[4]!, p._data[4]!),
        Math.max(this._data[5]!, p._data[5]!),
      );
    }
    return new Box3i(
      Math.min(this._data[0]!, p.x),
      Math.min(this._data[1]!, p.y),
      Math.min(this._data[2]!, p.z),
      Math.max(this._data[3]!, p.x),
      Math.max(this._data[4]!, p.y),
      Math.max(this._data[5]!, p.z),
    );
  }

  intersection(other: Box3i): Box3i {
    return new Box3i(
      Math.max(this._data[0]!, other._data[0]!),
      Math.max(this._data[1]!, other._data[1]!),
      Math.max(this._data[2]!, other._data[2]!),
      Math.min(this._data[3]!, other._data[3]!),
      Math.min(this._data[4]!, other._data[4]!),
      Math.min(this._data[5]!, other._data[5]!),
    );
  }

  union(other: Box3i): Box3i { return this.extend(other); }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Box3i)) return false;
    for (let i = 0; i < 6; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  approxEqual(other: Box3i, eps: number): boolean {
    for (let i = 0; i < 6; i++) {
      if (Math.abs(this._data[i]! - other._data[i]!) > eps) return false;
    }
    return true;
  }

  getHashCode(): number {
    let h = hashNumber(this._data[0]!);
    for (let i = 1; i < 6; i++) {
      h = combineHash(h, hashNumber(this._data[i]!));
    }
    return h;
  }

  toString(): string {
    return `Box3i([${this._data[0]}, ${this._data[1]}, ${this._data[2]}], [${this._data[3]}, ${this._data[4]}, ${this._data[5]}])`;
  }

  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < 6; i++) yield this._data[i]!;
  }
}
