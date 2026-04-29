// V4bArray — packed AoS array of V4b.
//
// Backed by a single `Uint8Array` of length `4 * count`. Each component
// stores 0 or 1.

import { V4b } from "../v4b.js";

const COMPONENT_COUNT = 4;
const BYTES_PER_COMPONENT = 1;

export class V4bArray implements Iterable<V4b> {
  /** Underlying buffer. Always exactly `length * 4` bytes. */
  readonly buffer: ArrayBuffer;

  readonly length: number;

  /** @internal */
  readonly _data: Uint8Array;

  constructor(length: number) {
    if (length < 0 || !Number.isInteger(length)) {
      throw new RangeError("[V4bArray] length must be a non-negative integer");
    }
    this.length = length;
    this.buffer = new ArrayBuffer(length * COMPONENT_COUNT * BYTES_PER_COMPONENT);
    this._data = new Uint8Array(this.buffer);
  }

  static fromBuffer(
    buffer: ArrayBufferLike,
    length: number,
    byteOffset: number = 0,
  ): V4bArray {
    if (byteOffset + length * COMPONENT_COUNT * BYTES_PER_COMPONENT > buffer.byteLength) {
      throw new RangeError("[V4bArray] buffer too small for requested length");
    }
    const arr = Object.create(V4bArray.prototype) as {
      buffer: ArrayBufferLike;
      length: number;
      _data: Uint8Array;
    };
    arr.buffer = buffer;
    arr.length = length;
    arr._data = new Uint8Array(buffer, byteOffset, length * COMPONENT_COUNT);
    return arr as V4bArray;
  }

  static fromIterable(values: Iterable<V4b>): V4bArray {
    const arr = Array.isArray(values) ? values : [...values];
    const out = new V4bArray(arr.length);
    for (let i = 0; i < arr.length; i++) out.set(i, arr[i]!);
    return out;
  }

  get(i: number): V4b {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    return new V4b(
      this._data[j] !== 0,
      this._data[j + 1] !== 0,
      this._data[j + 2] !== 0,
      this._data[j + 3] !== 0,
    );
  }

  getInto(i: number, target: V4b): V4b {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    target._data[0] = this._data[j]!;
    target._data[1] = this._data[j + 1]!;
    target._data[2] = this._data[j + 2]!;
    target._data[3] = this._data[j + 3]!;
    return target;
  }

  viewAt(i: number): V4b {
    this._checkBounds(i);
    return V4b.viewOnto(this._data.buffer, this._data.byteOffset + i * COMPONENT_COUNT * BYTES_PER_COMPONENT);
  }

  set(i: number, value: V4b): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = value._data[0]!;
    this._data[j + 1] = value._data[1]!;
    this._data[j + 2] = value._data[2]!;
    this._data[j + 3] = value._data[3]!;
  }

  setComponents(i: number, x: boolean, y: boolean, z: boolean, w: boolean): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = x ? 1 : 0;
    this._data[j + 1] = y ? 1 : 0;
    this._data[j + 2] = z ? 1 : 0;
    this._data[j + 3] = w ? 1 : 0;
  }

  x(i: number): boolean { this._checkBounds(i); return this._data[i * COMPONENT_COUNT]! !== 0; }
  y(i: number): boolean { this._checkBounds(i); return this._data[i * COMPONENT_COUNT + 1]! !== 0; }
  z(i: number): boolean { this._checkBounds(i); return this._data[i * COMPONENT_COUNT + 2]! !== 0; }
  w(i: number): boolean { this._checkBounds(i); return this._data[i * COMPONENT_COUNT + 3]! !== 0; }
  setX(i: number, v: boolean): void { this._checkBounds(i); this._data[i * COMPONENT_COUNT] = v ? 1 : 0; }
  setY(i: number, v: boolean): void { this._checkBounds(i); this._data[i * COMPONENT_COUNT + 1] = v ? 1 : 0; }
  setZ(i: number, v: boolean): void { this._checkBounds(i); this._data[i * COMPONENT_COUNT + 2] = v ? 1 : 0; }
  setW(i: number, v: boolean): void { this._checkBounds(i); this._data[i * COMPONENT_COUNT + 3] = v ? 1 : 0; }

  *[Symbol.iterator](): Iterator<V4b> {
    for (let i = 0; i < this.length; i++) yield this.get(i);
  }

  forEachInto(scratch: V4b, fn: (v: V4b, i: number) => void): void {
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

  fill(value: V4b): void {
    const x = value._data[0]!, y = value._data[1]!, z = value._data[2]!, w = value._data[3]!;
    for (let i = 0; i < this.length; i++) {
      const j = i * COMPONENT_COUNT;
      this._data[j] = x;
      this._data[j + 1] = y;
      this._data[j + 2] = z;
      this._data[j + 3] = w;
    }
  }

  setAllTrue(): void { this._data.fill(1); }
  setAllFalse(): void { this._data.fill(0); }

  copyFrom(other: V4bArray): void {
    if (other.length !== this.length) {
      throw new RangeError("[V4bArray] copyFrom requires equal lengths");
    }
    this._data.set(other._data);
  }

  slice(start: number = 0, end: number = this.length): V4bArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    const out = new V4bArray(n);
    out._data.set(this._data.subarray(lo * COMPONENT_COUNT, hi * COMPONENT_COUNT));
    return out;
  }

  subarray(start: number = 0, end: number = this.length): V4bArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    return V4bArray.fromBuffer(
      this._data.buffer,
      n,
      this._data.byteOffset + lo * COMPONENT_COUNT * BYTES_PER_COMPONENT,
    );
  }

  toArray(): V4b[] {
    const out: V4b[] = new Array(this.length);
    for (let i = 0; i < this.length; i++) out[i] = this.get(i);
    return out;
  }

  /** @internal */
  private _checkBounds(i: number): void {
    if (i < 0 || i >= this.length || !Number.isInteger(i)) {
      throw new RangeError(`[V4bArray] index ${i} out of bounds [0, ${this.length})`);
    }
  }
}
