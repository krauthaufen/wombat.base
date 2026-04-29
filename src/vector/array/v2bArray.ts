// V2bArray — packed AoS array of V2b.
//
// Backed by a single `Uint8Array` of length `2 * count`. Each component
// stores 0 or 1.

import { V2b } from "../v2b.js";

const COMPONENT_COUNT = 2;
const BYTES_PER_COMPONENT = 1;

export class V2bArray implements Iterable<V2b> {
  /** Underlying buffer. Always exactly `length * 2` bytes. */
  readonly buffer: ArrayBuffer;

  readonly length: number;

  /** @internal */
  readonly _data: Uint8Array;

  constructor(length: number) {
    if (length < 0 || !Number.isInteger(length)) {
      throw new RangeError("[V2bArray] length must be a non-negative integer");
    }
    this.length = length;
    this.buffer = new ArrayBuffer(length * COMPONENT_COUNT * BYTES_PER_COMPONENT);
    this._data = new Uint8Array(this.buffer);
  }

  static fromBuffer(
    buffer: ArrayBufferLike,
    length: number,
    byteOffset: number = 0,
  ): V2bArray {
    if (byteOffset + length * COMPONENT_COUNT * BYTES_PER_COMPONENT > buffer.byteLength) {
      throw new RangeError("[V2bArray] buffer too small for requested length");
    }
    const arr = Object.create(V2bArray.prototype) as {
      buffer: ArrayBufferLike;
      length: number;
      _data: Uint8Array;
    };
    arr.buffer = buffer;
    arr.length = length;
    arr._data = new Uint8Array(buffer, byteOffset, length * COMPONENT_COUNT);
    return arr as V2bArray;
  }

  static fromIterable(values: Iterable<V2b>): V2bArray {
    const arr = Array.isArray(values) ? values : [...values];
    const out = new V2bArray(arr.length);
    for (let i = 0; i < arr.length; i++) out.set(i, arr[i]!);
    return out;
  }

  // ---------- element access ----------

  get(i: number): V2b {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    return new V2b(this._data[j] !== 0, this._data[j + 1] !== 0);
  }

  getInto(i: number, target: V2b): V2b {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    target._data[0] = this._data[j]!;
    target._data[1] = this._data[j + 1]!;
    return target;
  }

  viewAt(i: number): V2b {
    this._checkBounds(i);
    return V2b.viewOnto(this._data.buffer, this._data.byteOffset + i * COMPONENT_COUNT * BYTES_PER_COMPONENT);
  }

  set(i: number, value: V2b): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = value._data[0]!;
    this._data[j + 1] = value._data[1]!;
  }

  setComponents(i: number, x: boolean, y: boolean): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = x ? 1 : 0;
    this._data[j + 1] = y ? 1 : 0;
  }

  // ---------- direct scalar access ----------

  x(i: number): boolean {
    this._checkBounds(i);
    return this._data[i * COMPONENT_COUNT]! !== 0;
  }
  y(i: number): boolean {
    this._checkBounds(i);
    return this._data[i * COMPONENT_COUNT + 1]! !== 0;
  }
  setX(i: number, v: boolean): void {
    this._checkBounds(i);
    this._data[i * COMPONENT_COUNT] = v ? 1 : 0;
  }
  setY(i: number, v: boolean): void {
    this._checkBounds(i);
    this._data[i * COMPONENT_COUNT + 1] = v ? 1 : 0;
  }

  // ---------- iteration ----------

  *[Symbol.iterator](): Iterator<V2b> {
    for (let i = 0; i < this.length; i++) yield this.get(i);
  }

  forEachInto(scratch: V2b, fn: (v: V2b, i: number) => void): void {
    for (let i = 0; i < this.length; i++) {
      Object.defineProperty(scratch, "_data", {
        value: new Uint8Array(
          this._data.buffer,
          this._data.byteOffset + i * COMPONENT_COUNT * BYTES_PER_COMPONENT,
          COMPONENT_COUNT,
        ),
        configurable: true,
        writable: true,
      });
      fn(scratch, i);
    }
  }

  // ---------- bulk operations ----------

  fill(value: V2b): void {
    const x = value._data[0]!, y = value._data[1]!;
    for (let i = 0; i < this.length; i++) {
      const j = i * COMPONENT_COUNT;
      this._data[j] = x;
      this._data[j + 1] = y;
    }
  }

  /** Sets every component of every element to `true`. */
  setAllTrue(): void {
    this._data.fill(1);
  }

  /** Sets every component of every element to `false`. */
  setAllFalse(): void {
    this._data.fill(0);
  }

  copyFrom(other: V2bArray): void {
    if (other.length !== this.length) {
      throw new RangeError("[V2bArray] copyFrom requires equal lengths");
    }
    this._data.set(other._data);
  }

  slice(start: number = 0, end: number = this.length): V2bArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    const out = new V2bArray(n);
    out._data.set(
      this._data.subarray(lo * COMPONENT_COUNT, hi * COMPONENT_COUNT),
    );
    return out;
  }

  subarray(start: number = 0, end: number = this.length): V2bArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    return V2bArray.fromBuffer(
      this._data.buffer,
      n,
      this._data.byteOffset + lo * COMPONENT_COUNT * BYTES_PER_COMPONENT,
    );
  }

  toArray(): V2b[] {
    const out: V2b[] = new Array(this.length);
    for (let i = 0; i < this.length; i++) out[i] = this.get(i);
    return out;
  }

  /** @internal */
  private _checkBounds(i: number): void {
    if (i < 0 || i >= this.length || !Number.isInteger(i)) {
      throw new RangeError(`[V2bArray] index ${i} out of bounds [0, ${this.length})`);
    }
  }
}
