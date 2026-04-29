// V3bArray — packed AoS array of V3b.
//
// Backed by a single `Uint8Array` of length `3 * count`. Each component
// stores 0 or 1.

import { V3b } from "../v3b.js";

const COMPONENT_COUNT = 3;
const BYTES_PER_COMPONENT = 1;

export class V3bArray implements Iterable<V3b> {
  /** Underlying buffer. Always exactly `length * 3` bytes. */
  readonly buffer: ArrayBuffer;

  readonly length: number;

  /** @internal */
  readonly _data: Uint8Array;

  constructor(length: number) {
    if (length < 0 || !Number.isInteger(length)) {
      throw new RangeError("[V3bArray] length must be a non-negative integer");
    }
    this.length = length;
    this.buffer = new ArrayBuffer(length * COMPONENT_COUNT * BYTES_PER_COMPONENT);
    this._data = new Uint8Array(this.buffer);
  }

  static fromBuffer(
    buffer: ArrayBufferLike,
    length: number,
    byteOffset: number = 0,
  ): V3bArray {
    if (byteOffset + length * COMPONENT_COUNT * BYTES_PER_COMPONENT > buffer.byteLength) {
      throw new RangeError("[V3bArray] buffer too small for requested length");
    }
    const arr = Object.create(V3bArray.prototype) as {
      buffer: ArrayBufferLike;
      length: number;
      _data: Uint8Array;
    };
    arr.buffer = buffer;
    arr.length = length;
    arr._data = new Uint8Array(buffer, byteOffset, length * COMPONENT_COUNT);
    return arr as V3bArray;
  }

  static fromIterable(values: Iterable<V3b>): V3bArray {
    const arr = Array.isArray(values) ? values : [...values];
    const out = new V3bArray(arr.length);
    for (let i = 0; i < arr.length; i++) out.set(i, arr[i]!);
    return out;
  }

  get(i: number): V3b {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    return new V3b(this._data[j] !== 0, this._data[j + 1] !== 0, this._data[j + 2] !== 0);
  }

  getInto(i: number, target: V3b): V3b {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    target._data[0] = this._data[j]!;
    target._data[1] = this._data[j + 1]!;
    target._data[2] = this._data[j + 2]!;
    return target;
  }

  viewAt(i: number): V3b {
    this._checkBounds(i);
    return V3b.viewOnto(this._data.buffer, this._data.byteOffset + i * COMPONENT_COUNT * BYTES_PER_COMPONENT);
  }

  set(i: number, value: V3b): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = value._data[0]!;
    this._data[j + 1] = value._data[1]!;
    this._data[j + 2] = value._data[2]!;
  }

  setComponents(i: number, x: boolean, y: boolean, z: boolean): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = x ? 1 : 0;
    this._data[j + 1] = y ? 1 : 0;
    this._data[j + 2] = z ? 1 : 0;
  }

  x(i: number): boolean {
    this._checkBounds(i);
    return this._data[i * COMPONENT_COUNT]! !== 0;
  }
  y(i: number): boolean {
    this._checkBounds(i);
    return this._data[i * COMPONENT_COUNT + 1]! !== 0;
  }
  z(i: number): boolean {
    this._checkBounds(i);
    return this._data[i * COMPONENT_COUNT + 2]! !== 0;
  }
  setX(i: number, v: boolean): void {
    this._checkBounds(i);
    this._data[i * COMPONENT_COUNT] = v ? 1 : 0;
  }
  setY(i: number, v: boolean): void {
    this._checkBounds(i);
    this._data[i * COMPONENT_COUNT + 1] = v ? 1 : 0;
  }
  setZ(i: number, v: boolean): void {
    this._checkBounds(i);
    this._data[i * COMPONENT_COUNT + 2] = v ? 1 : 0;
  }

  *[Symbol.iterator](): Iterator<V3b> {
    for (let i = 0; i < this.length; i++) yield this.get(i);
  }

  forEachInto(scratch: V3b, fn: (v: V3b, i: number) => void): void {
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

  fill(value: V3b): void {
    const x = value._data[0]!, y = value._data[1]!, z = value._data[2]!;
    for (let i = 0; i < this.length; i++) {
      const j = i * COMPONENT_COUNT;
      this._data[j] = x;
      this._data[j + 1] = y;
      this._data[j + 2] = z;
    }
  }

  setAllTrue(): void { this._data.fill(1); }
  setAllFalse(): void { this._data.fill(0); }

  copyFrom(other: V3bArray): void {
    if (other.length !== this.length) {
      throw new RangeError("[V3bArray] copyFrom requires equal lengths");
    }
    this._data.set(other._data);
  }

  slice(start: number = 0, end: number = this.length): V3bArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    const out = new V3bArray(n);
    out._data.set(
      this._data.subarray(lo * COMPONENT_COUNT, hi * COMPONENT_COUNT),
    );
    return out;
  }

  subarray(start: number = 0, end: number = this.length): V3bArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    return V3bArray.fromBuffer(
      this._data.buffer,
      n,
      this._data.byteOffset + lo * COMPONENT_COUNT * BYTES_PER_COMPONENT,
    );
  }

  toArray(): V3b[] {
    const out: V3b[] = new Array(this.length);
    for (let i = 0; i < this.length; i++) out[i] = this.get(i);
    return out;
  }

  /** @internal */
  private _checkBounds(i: number): void {
    if (i < 0 || i >= this.length || !Number.isInteger(i)) {
      throw new RangeError(`[V3bArray] index ${i} out of bounds [0, ${this.length})`);
    }
  }
}
