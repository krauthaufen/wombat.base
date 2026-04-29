// V4b — 4-component boolean vector.
//
// Backed by a `Uint8Array` of length 4. Each component stores 0 or 1.
// Bool vectors do not participate in operator rewriting (the plugin's
// binary map has no `&`/`|`/`==`); use the methods directly.

import { combineHash, hashNumber } from "../internal/hash.js";

const COMPONENT_COUNT = 4;
const BYTES = COMPONENT_COUNT;

export class V4b {
  static readonly __aardworxMathBrand: "V4b" = "V4b";

  /** @internal */
  readonly _data: Uint8Array;

  constructor(x: boolean = false, y: boolean = false, z: boolean = false, w: boolean = false) {
    this._data = new Uint8Array(4);
    this._data[0] = x ? 1 : 0;
    this._data[1] = y ? 1 : 0;
    this._data[2] = z ? 1 : 0;
    this._data[3] = w ? 1 : 0;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V4b {
    const v = Object.create(V4b.prototype) as { _data: Uint8Array };
    v._data = new Uint8Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V4b;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  static readonly false_: V4b = new V4b(false, false, false, false);
  static readonly true_: V4b = new V4b(true, true, true, true);

  static splat(s: boolean): V4b { return new V4b(s, s, s, s); }

  static copy(other: V4b): V4b {
    return new V4b(other._data[0] !== 0, other._data[1] !== 0,
                   other._data[2] !== 0, other._data[3] !== 0);
  }

  get x(): boolean { return this._data[0] !== 0; }
  set x(v: boolean) { this._data[0] = v ? 1 : 0; }
  get y(): boolean { return this._data[1] !== 0; }
  set y(v: boolean) { this._data[1] = v ? 1 : 0; }
  get z(): boolean { return this._data[2] !== 0; }
  set z(v: boolean) { this._data[2] = v ? 1 : 0; }
  get w(): boolean { return this._data[3] !== 0; }
  set w(v: boolean) { this._data[3] = v ? 1 : 0; }

  and(other: V4b): V4b {
    return new V4b(this._data[0] !== 0 && other._data[0] !== 0,
                   this._data[1] !== 0 && other._data[1] !== 0,
                   this._data[2] !== 0 && other._data[2] !== 0,
                   this._data[3] !== 0 && other._data[3] !== 0);
  }

  or(other: V4b): V4b {
    return new V4b(this._data[0] !== 0 || other._data[0] !== 0,
                   this._data[1] !== 0 || other._data[1] !== 0,
                   this._data[2] !== 0 || other._data[2] !== 0,
                   this._data[3] !== 0 || other._data[3] !== 0);
  }

  xor(other: V4b): V4b {
    return new V4b((this._data[0] !== 0) !== (other._data[0] !== 0),
                   (this._data[1] !== 0) !== (other._data[1] !== 0),
                   (this._data[2] !== 0) !== (other._data[2] !== 0),
                   (this._data[3] !== 0) !== (other._data[3] !== 0));
  }

  not(): V4b {
    return new V4b(this._data[0] === 0, this._data[1] === 0,
                   this._data[2] === 0, this._data[3] === 0);
  }

  eq(other: V4b): V4b {
    return new V4b(this._data[0] === other._data[0],
                   this._data[1] === other._data[1],
                   this._data[2] === other._data[2],
                   this._data[3] === other._data[3]);
  }

  neq(other: V4b): V4b {
    return new V4b(this._data[0] !== other._data[0],
                   this._data[1] !== other._data[1],
                   this._data[2] !== other._data[2],
                   this._data[3] !== other._data[3]);
  }

  any(): boolean {
    return this._data[0] !== 0 || this._data[1] !== 0 ||
           this._data[2] !== 0 || this._data[3] !== 0;
  }
  all(): boolean {
    return this._data[0] !== 0 && this._data[1] !== 0 &&
           this._data[2] !== 0 && this._data[3] !== 0;
  }
  countTrue(): number {
    return (this._data[0] !== 0 ? 1 : 0) +
           (this._data[1] !== 0 ? 1 : 0) +
           (this._data[2] !== 0 ? 1 : 0) +
           (this._data[3] !== 0 ? 1 : 0);
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V4b)) return false;
    return this._data[0] === other._data[0] &&
           this._data[1] === other._data[1] &&
           this._data[2] === other._data[2] &&
           this._data[3] === other._data[3];
  }

  getHashCode(): number {
    let h = hashNumber(this._data[0]!);
    h = combineHash(h, hashNumber(this._data[1]!));
    h = combineHash(h, hashNumber(this._data[2]!));
    h = combineHash(h, hashNumber(this._data[3]!));
    return h;
  }

  toString(): string {
    return `V4b(${this._data[0] !== 0}, ${this._data[1] !== 0}, ${this._data[2] !== 0}, ${this._data[3] !== 0})`;
  }

  *[Symbol.iterator](): Iterator<boolean> {
    yield this._data[0] !== 0;
    yield this._data[1] !== 0;
    yield this._data[2] !== 0;
    yield this._data[3] !== 0;
  }

  toArray(): [boolean, boolean, boolean, boolean] {
    return [this._data[0] !== 0, this._data[1] !== 0, this._data[2] !== 0, this._data[3] !== 0];
  }

  static andInto(a: V4b, b: V4b, target: V4b): V4b {
    target._data[0] = (a._data[0] !== 0 && b._data[0] !== 0) ? 1 : 0;
    target._data[1] = (a._data[1] !== 0 && b._data[1] !== 0) ? 1 : 0;
    target._data[2] = (a._data[2] !== 0 && b._data[2] !== 0) ? 1 : 0;
    target._data[3] = (a._data[3] !== 0 && b._data[3] !== 0) ? 1 : 0;
    return target;
  }

  static orInto(a: V4b, b: V4b, target: V4b): V4b {
    target._data[0] = (a._data[0] !== 0 || b._data[0] !== 0) ? 1 : 0;
    target._data[1] = (a._data[1] !== 0 || b._data[1] !== 0) ? 1 : 0;
    target._data[2] = (a._data[2] !== 0 || b._data[2] !== 0) ? 1 : 0;
    target._data[3] = (a._data[3] !== 0 || b._data[3] !== 0) ? 1 : 0;
    return target;
  }

  static xorInto(a: V4b, b: V4b, target: V4b): V4b {
    target._data[0] = ((a._data[0] !== 0) !== (b._data[0] !== 0)) ? 1 : 0;
    target._data[1] = ((a._data[1] !== 0) !== (b._data[1] !== 0)) ? 1 : 0;
    target._data[2] = ((a._data[2] !== 0) !== (b._data[2] !== 0)) ? 1 : 0;
    target._data[3] = ((a._data[3] !== 0) !== (b._data[3] !== 0)) ? 1 : 0;
    return target;
  }

  static copyInto(from: V4b, target: V4b): V4b {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    target._data[2] = from._data[2]!;
    target._data[3] = from._data[3]!;
    return target;
  }
}
