// V2b — 2-component boolean vector.
//
// Backed by a `Uint8Array` of length 2. Each component stores 0 or 1.
// Bool vectors do not participate in operator rewriting (the plugin's
// binary map has no `&`/`|`/`==`); use the methods directly.

import { combineHash, hashNumber } from "../internal/hash.js";

const COMPONENT_COUNT = 2;
const BYTES = COMPONENT_COUNT;

export class V2b {
  /** Brand: marks this class as an aardvark math type for the operator plugin. */
  static readonly __aardworxMathBrand: "V2b" = "V2b";

  /** @internal */
  readonly _data: Uint8Array;

  constructor(x: boolean = false, y: boolean = false) {
    this._data = new Uint8Array(2);
    this._data[0] = x ? 1 : 0;
    this._data[1] = y ? 1 : 0;
  }

  static viewOnto(buffer: ArrayBufferLike, byteOffset: number): V2b {
    const v = Object.create(V2b.prototype) as { _data: Uint8Array };
    v._data = new Uint8Array(buffer, byteOffset, COMPONENT_COUNT);
    return v as V2b;
  }

  static readonly componentCount = COMPONENT_COUNT;
  static readonly byteSize = BYTES;

  // ---------- factories ----------

  static readonly false_: V2b = new V2b(false, false);
  static readonly true_: V2b = new V2b(true, true);

  static splat(s: boolean): V2b {
    return new V2b(s, s);
  }

  static copy(other: V2b): V2b {
    return new V2b(other._data[0] !== 0, other._data[1] !== 0);
  }

  // ---------- component access ----------

  get x(): boolean { return this._data[0] !== 0; }
  set x(v: boolean) { this._data[0] = v ? 1 : 0; }
  get y(): boolean { return this._data[1] !== 0; }
  set y(v: boolean) { this._data[1] = v ? 1 : 0; }

  // ---------- logical ops ----------

  and(other: V2b): V2b {
    return new V2b(this._data[0] !== 0 && other._data[0] !== 0,
                   this._data[1] !== 0 && other._data[1] !== 0);
  }

  or(other: V2b): V2b {
    return new V2b(this._data[0] !== 0 || other._data[0] !== 0,
                   this._data[1] !== 0 || other._data[1] !== 0);
  }

  xor(other: V2b): V2b {
    return new V2b((this._data[0] !== 0) !== (other._data[0] !== 0),
                   (this._data[1] !== 0) !== (other._data[1] !== 0));
  }

  not(): V2b {
    return new V2b(this._data[0] === 0, this._data[1] === 0);
  }

  // ---------- component-wise comparison ----------

  eq(other: V2b): V2b {
    return new V2b(this._data[0] === other._data[0],
                   this._data[1] === other._data[1]);
  }

  neq(other: V2b): V2b {
    return new V2b(this._data[0] !== other._data[0],
                   this._data[1] !== other._data[1]);
  }

  // ---------- reductions ----------

  any(): boolean { return this._data[0] !== 0 || this._data[1] !== 0; }
  all(): boolean { return this._data[0] !== 0 && this._data[1] !== 0; }
  countTrue(): number {
    return (this._data[0] !== 0 ? 1 : 0) + (this._data[1] !== 0 ? 1 : 0);
  }

  // ---------- equality / hash / iter ----------

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof V2b)) return false;
    return this._data[0] === other._data[0] && this._data[1] === other._data[1];
  }

  getHashCode(): number {
    let h = hashNumber(this._data[0]!);
    h = combineHash(h, hashNumber(this._data[1]!));
    return h;
  }

  toString(): string {
    return `V2b(${this._data[0] !== 0}, ${this._data[1] !== 0})`;
  }

  *[Symbol.iterator](): Iterator<boolean> {
    yield this._data[0] !== 0;
    yield this._data[1] !== 0;
  }

  toArray(): [boolean, boolean] {
    return [this._data[0] !== 0, this._data[1] !== 0];
  }

  // ---------- in-place / static-target variants (alloc-free) ----------

  static andInto(a: V2b, b: V2b, target: V2b): V2b {
    target._data[0] = (a._data[0] !== 0 && b._data[0] !== 0) ? 1 : 0;
    target._data[1] = (a._data[1] !== 0 && b._data[1] !== 0) ? 1 : 0;
    return target;
  }

  static orInto(a: V2b, b: V2b, target: V2b): V2b {
    target._data[0] = (a._data[0] !== 0 || b._data[0] !== 0) ? 1 : 0;
    target._data[1] = (a._data[1] !== 0 || b._data[1] !== 0) ? 1 : 0;
    return target;
  }

  static xorInto(a: V2b, b: V2b, target: V2b): V2b {
    target._data[0] = ((a._data[0] !== 0) !== (b._data[0] !== 0)) ? 1 : 0;
    target._data[1] = ((a._data[1] !== 0) !== (b._data[1] !== 0)) ? 1 : 0;
    return target;
  }

  static copyInto(from: V2b, target: V2b): V2b {
    target._data[0] = from._data[0]!;
    target._data[1] = from._data[1]!;
    return target;
  }
}
