// V3b — 3-component boolean vector.
//
// Backed by a `Uint8Array` of length 3. Each component stores 0 or 1.
// Bool vectors do not participate in operator rewriting (the plugin's
// binary map has no `&`/`|`/`==`); use the methods directly.

import { combineHash, hashNumber } from "../internal/hash.js";

const COMPONENT_COUNT = 3;
const BYTES = COMPONENT_COUNT;

export class V3b {
  static readonly __aardworxMathBrand: "V3b" = "V3b";

  /** @internal */
  readonly _data: Uint8Array;

  constructor(x: boolean = false, y: boolean = false, z: boolean = false) {
    this._data = new Uint8Array(3);
    this._data[0] = x ? 1 : 0;
    this._data[1] = y ? 1 : 0;
    this._data[2] = z ? 1 : 0;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V3b {
    const v = Object.create(V3b.prototype) as { _data: Uint8Array };
    v._data = new Uint8Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V3b;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  static readonly false_: V3b = new V3b(false, false, false);
  static readonly true_: V3b = new V3b(true, true, true);

  static splat(s: boolean): V3b { return new V3b(s, s, s); }

  static copy(other: V3b): V3b {
    return new V3b(other._data[0] !== 0, other._data[1] !== 0, other._data[2] !== 0);
  }

  get x(): boolean { return this._data[0] !== 0; }
  set x(v: boolean) { this._data[0] = v ? 1 : 0; }
  get y(): boolean { return this._data[1] !== 0; }
  set y(v: boolean) { this._data[1] = v ? 1 : 0; }
  get z(): boolean { return this._data[2] !== 0; }
  set z(v: boolean) { this._data[2] = v ? 1 : 0; }

  and(other: V3b): V3b {
    return new V3b(this._data[0] !== 0 && other._data[0] !== 0,
                   this._data[1] !== 0 && other._data[1] !== 0,
                   this._data[2] !== 0 && other._data[2] !== 0);
  }

  or(other: V3b): V3b {
    return new V3b(this._data[0] !== 0 || other._data[0] !== 0,
                   this._data[1] !== 0 || other._data[1] !== 0,
                   this._data[2] !== 0 || other._data[2] !== 0);
  }

  xor(other: V3b): V3b {
    return new V3b((this._data[0] !== 0) !== (other._data[0] !== 0),
                   (this._data[1] !== 0) !== (other._data[1] !== 0),
                   (this._data[2] !== 0) !== (other._data[2] !== 0));
  }

  not(): V3b {
    return new V3b(this._data[0] === 0, this._data[1] === 0, this._data[2] === 0);
  }

  eq(other: V3b): V3b {
    return new V3b(this._data[0] === other._data[0],
                   this._data[1] === other._data[1],
                   this._data[2] === other._data[2]);
  }

  neq(other: V3b): V3b {
    return new V3b(this._data[0] !== other._data[0],
                   this._data[1] !== other._data[1],
                   this._data[2] !== other._data[2]);
  }

  any(): boolean {
    return this._data[0] !== 0 || this._data[1] !== 0 || this._data[2] !== 0;
  }
  all(): boolean {
    return this._data[0] !== 0 && this._data[1] !== 0 && this._data[2] !== 0;
  }
  countTrue(): number {
    return (this._data[0] !== 0 ? 1 : 0) +
           (this._data[1] !== 0 ? 1 : 0) +
           (this._data[2] !== 0 ? 1 : 0);
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V3b)) return false;
    return this._data[0] === other._data[0] &&
           this._data[1] === other._data[1] &&
           this._data[2] === other._data[2];
  }

  getHashCode(): number {
    let h = hashNumber(this._data[0]!);
    h = combineHash(h, hashNumber(this._data[1]!));
    h = combineHash(h, hashNumber(this._data[2]!));
    return h;
  }

  toString(): string {
    return `V3b(${this._data[0] !== 0}, ${this._data[1] !== 0}, ${this._data[2] !== 0})`;
  }

  *[Symbol.iterator](): Iterator<boolean> {
    yield this._data[0] !== 0;
    yield this._data[1] !== 0;
    yield this._data[2] !== 0;
  }

  toArray(): [boolean, boolean, boolean] {
    return [this._data[0] !== 0, this._data[1] !== 0, this._data[2] !== 0];
  }

  static andInto(a: V3b, b: V3b, target: V3b): V3b {
    target._data[0] = (a._data[0] !== 0 && b._data[0] !== 0) ? 1 : 0;
    target._data[1] = (a._data[1] !== 0 && b._data[1] !== 0) ? 1 : 0;
    target._data[2] = (a._data[2] !== 0 && b._data[2] !== 0) ? 1 : 0;
    return target;
  }

  static orInto(a: V3b, b: V3b, target: V3b): V3b {
    target._data[0] = (a._data[0] !== 0 || b._data[0] !== 0) ? 1 : 0;
    target._data[1] = (a._data[1] !== 0 || b._data[1] !== 0) ? 1 : 0;
    target._data[2] = (a._data[2] !== 0 || b._data[2] !== 0) ? 1 : 0;
    return target;
  }

  static xorInto(a: V3b, b: V3b, target: V3b): V3b {
    target._data[0] = ((a._data[0] !== 0) !== (b._data[0] !== 0)) ? 1 : 0;
    target._data[1] = ((a._data[1] !== 0) !== (b._data[1] !== 0)) ? 1 : 0;
    target._data[2] = ((a._data[2] !== 0) !== (b._data[2] !== 0)) ? 1 : 0;
    return target;
  }

  static copyInto(from: V3b, target: V3b): V3b {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    target._data[2] = from._data[2]!;
    return target;
  }
}
