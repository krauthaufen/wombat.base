// V2fArray — packed AoS array of V2f.
//
// Backed by a single `Float32Array` of length `2 * count`. The
// underlying `ArrayBuffer` can be uploaded to the GPU verbatim
// (matches `gl.vertexAttribPointer(loc, 2, FLOAT, false, 8, 0)`).

import { V2f } from "../v2f.js";

const COMPONENT_COUNT = 2;
const F32_BYTES = 4;

export class V2fArray implements Iterable<V2f> {
  /** Underlying buffer. Always exactly `length * 8` bytes. */
  readonly buffer: ArrayBuffer;

  readonly length: number;

  /** @internal */
  readonly _data: Float32Array;

  constructor(length: number) {
    if (length < 0 || !Number.isInteger(length)) {
      throw new RangeError("[V2fArray] length must be a non-negative integer");
    }
    this.length = length;
    this.buffer = new ArrayBuffer(length * COMPONENT_COUNT * F32_BYTES);
    this._data = new Float32Array(this.buffer);
  }

  static fromBuffer(
    buffer: ArrayBufferLike,
    length: number,
    byteOffset: number = 0,
  ): V2fArray {
    if (byteOffset + length * COMPONENT_COUNT * F32_BYTES > buffer.byteLength) {
      throw new RangeError("[V2fArray] buffer too small for requested length");
    }
    const arr = Object.create(V2fArray.prototype) as {
      buffer: ArrayBufferLike;
      length: number;
      _data: Float32Array;
    };
    arr.buffer = buffer;
    arr.length = length;
    arr._data = new Float32Array(buffer, byteOffset, length * COMPONENT_COUNT);
    return arr as V2fArray;
  }

  static fromIterable(values: Iterable<V2f>): V2fArray {
    const arr = Array.isArray(values) ? values : [...values];
    const out = new V2fArray(arr.length);
    for (let i = 0; i < arr.length; i++) out.set(i, arr[i]!);
    return out;
  }

  // ---------- element access ----------

  get(i: number): V2f {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    return new V2f(this._data[j]!, this._data[j + 1]!);
  }

  getInto(i: number, target: V2f): V2f {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    target._data[0] = this._data[j]!;
    target._data[1] = this._data[j + 1]!;
    return target;
  }

  viewAt(i: number): V2f {
    this._checkBounds(i);
    return V2f.viewOnto(this._data.buffer, this._data.byteOffset + i * COMPONENT_COUNT * F32_BYTES);
  }

  set(i: number, value: V2f): void {
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

  // ---------- direct scalar access ----------

  x(i: number): number {
    this._checkBounds(i);
    return this._data[i * COMPONENT_COUNT]!;
  }
  y(i: number): number {
    this._checkBounds(i);
    return this._data[i * COMPONENT_COUNT + 1]!;
  }
  setX(i: number, v: number): void {
    this._checkBounds(i);
    this._data[i * COMPONENT_COUNT] = v;
  }
  setY(i: number, v: number): void {
    this._checkBounds(i);
    this._data[i * COMPONENT_COUNT + 1] = v;
  }

  // ---------- iteration ----------

  *[Symbol.iterator](): Iterator<V2f> {
    for (let i = 0; i < this.length; i++) yield this.get(i);
  }

  forEachInto(scratch: V2f, fn: (v: V2f, i: number) => void): void {
    for (let i = 0; i < this.length; i++) {
      Object.defineProperty(scratch, "_data", {
        value: new Float32Array(
          this._data.buffer,
          this._data.byteOffset + i * COMPONENT_COUNT * F32_BYTES,
          COMPONENT_COUNT,
        ),
        configurable: true,
        writable: true,
      });
      fn(scratch, i);
    }
  }

  // ---------- bulk operations ----------

  fill(value: V2f): void {
    const x = value._data[0]!, y = value._data[1]!;
    for (let i = 0; i < this.length; i++) {
      const j = i * COMPONENT_COUNT;
      this._data[j] = x;
      this._data[j + 1] = y;
    }
  }

  copyFrom(other: V2fArray): void {
    if (other.length !== this.length) {
      throw new RangeError("[V2fArray] copyFrom requires equal lengths");
    }
    this._data.set(other._data);
  }

  slice(start: number = 0, end: number = this.length): V2fArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    const out = new V2fArray(n);
    out._data.set(
      this._data.subarray(lo * COMPONENT_COUNT, hi * COMPONENT_COUNT),
    );
    return out;
  }

  subarray(start: number = 0, end: number = this.length): V2fArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    return V2fArray.fromBuffer(
      this._data.buffer,
      n,
      this._data.byteOffset + lo * COMPONENT_COUNT * F32_BYTES,
    );
  }

  toArray(): V2f[] {
    const out: V2f[] = new Array(this.length);
    for (let i = 0; i < this.length; i++) out[i] = this.get(i);
    return out;
  }

  addInPlace(rhs: V2f | V2fArray): void {
    if (rhs instanceof V2f) {
      const x = rhs._data[0]!, y = rhs._data[1]!;
      for (let i = 0; i < this.length; i++) {
        const j = i * COMPONENT_COUNT;
        this._data[j] = this._data[j]! + x;
        this._data[j + 1] = this._data[j + 1]! + y;
      }
    } else {
      if (rhs.length !== this.length) {
        throw new RangeError("[V2fArray] addInPlace requires equal lengths");
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
      throw new RangeError(`[V2fArray] index ${i} out of bounds [0, ${this.length})`);
    }
  }
}
