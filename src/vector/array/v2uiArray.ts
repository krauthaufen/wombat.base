// V2uiArray — packed AoS array of V2ui.
//
// Backed by a single `Uint32Array` of length `2 * count`. Negative
// inputs wrap modulo 2^32 (Uint32Array semantics).

import { V2ui } from "../v2ui.js";

const COMPONENT_COUNT = 2;
const U32_BYTES = 4;

export class V2uiArray implements Iterable<V2ui> {
  /** Underlying buffer. Always exactly `length * 8` bytes. */
  readonly buffer: ArrayBuffer;

  readonly length: number;

  /** @internal */
  readonly _data: Uint32Array;

  constructor(length: number) {
    if (length < 0 || !Number.isInteger(length)) {
      throw new RangeError("[V2uiArray] length must be a non-negative integer");
    }
    this.length = length;
    this.buffer = new ArrayBuffer(length * COMPONENT_COUNT * U32_BYTES);
    this._data = new Uint32Array(this.buffer);
  }

  static fromBuffer(
    buffer: ArrayBufferLike,
    length: number,
    byteOffset: number = 0,
  ): V2uiArray {
    if (byteOffset + length * COMPONENT_COUNT * U32_BYTES > buffer.byteLength) {
      throw new RangeError("[V2uiArray] buffer too small for requested length");
    }
    const arr = Object.create(V2uiArray.prototype) as {
      buffer: ArrayBufferLike;
      length: number;
      _data: Uint32Array;
    };
    arr.buffer = buffer;
    arr.length = length;
    arr._data = new Uint32Array(buffer, byteOffset, length * COMPONENT_COUNT);
    return arr as V2uiArray;
  }

  static fromIterable(values: Iterable<V2ui>): V2uiArray {
    const arr = Array.isArray(values) ? values : [...values];
    const out = new V2uiArray(arr.length);
    for (let i = 0; i < arr.length; i++) out.set(i, arr[i]!);
    return out;
  }

  get(i: number): V2ui {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    return new V2ui(this._data[j]!, this._data[j + 1]!);
  }

  getInto(i: number, target: V2ui): V2ui {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    target._data[0] = this._data[j]!;
    target._data[1] = this._data[j + 1]!;
    return target;
  }

  viewAt(i: number): V2ui {
    this._checkBounds(i);
    return V2ui.viewOnto(this._data.buffer, this._data.byteOffset + i * COMPONENT_COUNT * U32_BYTES);
  }

  set(i: number, value: V2ui): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = value._data[0]!;
    this._data[j + 1] = value._data[1]!;
  }

  setComponents(i: number, x: number, y: number): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = x;
    this._data[j + 1] = y;
  }

  x(i: number): number { this._checkBounds(i); return this._data[i * COMPONENT_COUNT]!; }
  y(i: number): number { this._checkBounds(i); return this._data[i * COMPONENT_COUNT + 1]!; }
  setX(i: number, v: number): void { this._checkBounds(i); this._data[i * COMPONENT_COUNT] = v; }
  setY(i: number, v: number): void { this._checkBounds(i); this._data[i * COMPONENT_COUNT + 1] = v; }

  *[Symbol.iterator](): Iterator<V2ui> {
    for (let i = 0; i < this.length; i++) yield this.get(i);
  }

  forEachInto(scratch: V2ui, fn: (v: V2ui, i: number) => void): void {
    for (let i = 0; i < this.length; i++) {
      Object.defineProperty(scratch, "_data", {
        value: new Uint32Array(
          this._data.buffer,
          this._data.byteOffset + i * COMPONENT_COUNT * U32_BYTES,
          COMPONENT_COUNT,
        ),
        configurable: true,
        writable: true,
      });
      fn(scratch, i);
    }
  }

  fill(value: V2ui): void {
    const x = value._data[0]!, y = value._data[1]!;
    for (let i = 0; i < this.length; i++) {
      const j = i * COMPONENT_COUNT;
      this._data[j] = x;
      this._data[j + 1] = y;
    }
  }

  copyFrom(other: V2uiArray): void {
    if (other.length !== this.length) {
      throw new RangeError("[V2uiArray] copyFrom requires equal lengths");
    }
    this._data.set(other._data);
  }

  slice(start: number = 0, end: number = this.length): V2uiArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    const out = new V2uiArray(n);
    out._data.set(this._data.subarray(lo * COMPONENT_COUNT, hi * COMPONENT_COUNT));
    return out;
  }

  subarray(start: number = 0, end: number = this.length): V2uiArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    return V2uiArray.fromBuffer(
      this._data.buffer,
      n,
      this._data.byteOffset + lo * COMPONENT_COUNT * U32_BYTES,
    );
  }

  toArray(): V2ui[] {
    const out: V2ui[] = new Array(this.length);
    for (let i = 0; i < this.length; i++) out[i] = this.get(i);
    return out;
  }

  addInPlace(rhs: V2ui | V2uiArray | number): void {
    if (typeof rhs === "number") {
      for (let k = 0; k < this._data.length; k++) {
        this._data[k] = this._data[k]! + rhs;
      }
    } else if (rhs instanceof V2ui) {
      const x = rhs._data[0]!, y = rhs._data[1]!;
      for (let i = 0; i < this.length; i++) {
        const j = i * COMPONENT_COUNT;
        this._data[j] = this._data[j]! + x;
        this._data[j + 1] = this._data[j + 1]! + y;
      }
    } else {
      if (rhs.length !== this.length) {
        throw new RangeError("[V2uiArray] addInPlace requires equal lengths");
      }
      for (let k = 0; k < this._data.length; k++) {
        this._data[k] = this._data[k]! + rhs._data[k]!;
      }
    }
  }

  scaleInPlace(s: number): void {
    for (let k = 0; k < this._data.length; k++) {
      this._data[k] = this._data[k]! * s;
    }
  }

  /** @internal */
  private _checkBounds(i: number): void {
    if (i < 0 || i >= this.length || !Number.isInteger(i)) {
      throw new RangeError(`[V2uiArray] index ${i} out of bounds [0, ${this.length})`);
    }
  }
}
