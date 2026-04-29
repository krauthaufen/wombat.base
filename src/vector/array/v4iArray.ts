// V4iArray — packed AoS array of V4i.
//
// Backed by a single `Int32Array` of length `4 * count`. Components
// are truncated toward zero on assignment (Int32Array semantics).

import { V4i } from "../v4i.js";

const COMPONENT_COUNT = 4;
const I32_BYTES = 4;

export class V4iArray implements Iterable<V4i> {
  /** Underlying buffer. Always exactly `length * 16` bytes. */
  readonly buffer: ArrayBuffer;

  readonly length: number;

  /** @internal */
  readonly _data: Int32Array;

  constructor(length: number) {
    if (length < 0 || !Number.isInteger(length)) {
      throw new RangeError("[V4iArray] length must be a non-negative integer");
    }
    this.length = length;
    this.buffer = new ArrayBuffer(length * COMPONENT_COUNT * I32_BYTES);
    this._data = new Int32Array(this.buffer);
  }

  static fromBuffer(
    buffer: ArrayBufferLike,
    length: number,
    byteOffset: number = 0,
  ): V4iArray {
    if (byteOffset + length * COMPONENT_COUNT * I32_BYTES > buffer.byteLength) {
      throw new RangeError("[V4iArray] buffer too small for requested length");
    }
    const arr = Object.create(V4iArray.prototype) as {
      buffer: ArrayBufferLike;
      length: number;
      _data: Int32Array;
    };
    arr.buffer = buffer;
    arr.length = length;
    arr._data = new Int32Array(buffer, byteOffset, length * COMPONENT_COUNT);
    return arr as V4iArray;
  }

  static fromIterable(values: Iterable<V4i>): V4iArray {
    const arr = Array.isArray(values) ? values : [...values];
    const out = new V4iArray(arr.length);
    for (let i = 0; i < arr.length; i++) out.set(i, arr[i]!);
    return out;
  }

  get(i: number): V4i {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    return new V4i(this._data[j]!, this._data[j + 1]!, this._data[j + 2]!, this._data[j + 3]!);
  }

  getInto(i: number, target: V4i): V4i {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    target._data[0] = this._data[j]!;
    target._data[1] = this._data[j + 1]!;
    target._data[2] = this._data[j + 2]!;
    target._data[3] = this._data[j + 3]!;
    return target;
  }

  viewAt(i: number): V4i {
    this._checkBounds(i);
    return V4i.viewOnto(this._data.buffer, this._data.byteOffset + i * COMPONENT_COUNT * I32_BYTES);
  }

  set(i: number, value: V4i): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = value._data[0]!;
    this._data[j + 1] = value._data[1]!;
    this._data[j + 2] = value._data[2]!;
    this._data[j + 3] = value._data[3]!;
  }

  setComponents(i: number, x: number, y: number, z: number, w: number): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = x;
    this._data[j + 1] = y;
    this._data[j + 2] = z;
    this._data[j + 3] = w;
  }

  x(i: number): number { this._checkBounds(i); return this._data[i * COMPONENT_COUNT]!; }
  y(i: number): number { this._checkBounds(i); return this._data[i * COMPONENT_COUNT + 1]!; }
  z(i: number): number { this._checkBounds(i); return this._data[i * COMPONENT_COUNT + 2]!; }
  w(i: number): number { this._checkBounds(i); return this._data[i * COMPONENT_COUNT + 3]!; }
  setX(i: number, v: number): void { this._checkBounds(i); this._data[i * COMPONENT_COUNT] = v; }
  setY(i: number, v: number): void { this._checkBounds(i); this._data[i * COMPONENT_COUNT + 1] = v; }
  setZ(i: number, v: number): void { this._checkBounds(i); this._data[i * COMPONENT_COUNT + 2] = v; }
  setW(i: number, v: number): void { this._checkBounds(i); this._data[i * COMPONENT_COUNT + 3] = v; }

  *[Symbol.iterator](): Iterator<V4i> {
    for (let i = 0; i < this.length; i++) yield this.get(i);
  }

  forEachInto(scratch: V4i, fn: (v: V4i, i: number) => void): void {
    for (let i = 0; i < this.length; i++) {
      Object.defineProperty(scratch, "_data", {
        value: new Int32Array(
          this._data.buffer,
          this._data.byteOffset + i * COMPONENT_COUNT * I32_BYTES,
          COMPONENT_COUNT,
        ),
        configurable: true,
        writable: true,
      });
      fn(scratch, i);
    }
  }

  fill(value: V4i): void {
    const x = value._data[0]!, y = value._data[1]!, z = value._data[2]!, w = value._data[3]!;
    for (let i = 0; i < this.length; i++) {
      const j = i * COMPONENT_COUNT;
      this._data[j] = x;
      this._data[j + 1] = y;
      this._data[j + 2] = z;
      this._data[j + 3] = w;
    }
  }

  copyFrom(other: V4iArray): void {
    if (other.length !== this.length) {
      throw new RangeError("[V4iArray] copyFrom requires equal lengths");
    }
    this._data.set(other._data);
  }

  slice(start: number = 0, end: number = this.length): V4iArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    const out = new V4iArray(n);
    out._data.set(this._data.subarray(lo * COMPONENT_COUNT, hi * COMPONENT_COUNT));
    return out;
  }

  subarray(start: number = 0, end: number = this.length): V4iArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    return V4iArray.fromBuffer(
      this._data.buffer,
      n,
      this._data.byteOffset + lo * COMPONENT_COUNT * I32_BYTES,
    );
  }

  toArray(): V4i[] {
    const out: V4i[] = new Array(this.length);
    for (let i = 0; i < this.length; i++) out[i] = this.get(i);
    return out;
  }

  addInPlace(rhs: V4i | V4iArray | number): void {
    if (typeof rhs === "number") {
      for (let k = 0; k < this._data.length; k++) {
        this._data[k] = this._data[k]! + rhs;
      }
    } else if (rhs instanceof V4i) {
      const x = rhs._data[0]!, y = rhs._data[1]!, z = rhs._data[2]!, w = rhs._data[3]!;
      for (let i = 0; i < this.length; i++) {
        const j = i * COMPONENT_COUNT;
        this._data[j] = this._data[j]! + x;
        this._data[j + 1] = this._data[j + 1]! + y;
        this._data[j + 2] = this._data[j + 2]! + z;
        this._data[j + 3] = this._data[j + 3]! + w;
      }
    } else {
      if (rhs.length !== this.length) {
        throw new RangeError("[V4iArray] addInPlace requires equal lengths");
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
      throw new RangeError(`[V4iArray] index ${i} out of bounds [0, ${this.length})`);
    }
  }
}
