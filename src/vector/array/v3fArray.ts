// V3fArray — packed AoS array of V3f.
//
// Backed by a single `Float32Array` of length `3 * count`. The
// underlying `ArrayBuffer` can be uploaded to the GPU verbatim
// (matches `gl.vertexAttribPointer(loc, 3, FLOAT, false, 12, 0)`).
//
// Three element-access patterns:
//   * `arr.get(i)` — fresh V3f copy (safe to keep around).
//   * `arr.viewAt(i)` — V3f *aliasing* the buffer (advanced; mutating
//     the returned V3f mutates the array).
//   * `arr.forEachInto(scratch, fn)` — reuses one V3f viewing each
//     slot in turn; zero allocations per iteration.
//
// Plus direct scalar accessors (`arr.x(i)`, `arr.setX(i, v)`) for
// the absolute hottest loops where even a wrapper is too much.

import { V3f } from "../v3f.js";

const COMPONENT_COUNT = 3;
const F32_BYTES = 4;

export class V3fArray implements Iterable<V3f> {
  /** Underlying buffer. Always exactly `length * 12` bytes. */
  readonly buffer: ArrayBuffer;

  /** Number of V3f elements. */
  readonly length: number;

  /** Float32 view over the buffer. Length is `3 * length`. @internal */
  readonly _data: Float32Array;

  constructor(length: number) {
    if (length < 0 || !Number.isInteger(length)) {
      throw new RangeError("[V3fArray] length must be a non-negative integer");
    }
    this.length = length;
    this.buffer = new ArrayBuffer(length * COMPONENT_COUNT * F32_BYTES);
    this._data = new Float32Array(this.buffer);
  }

  /**
   * Wraps an existing buffer of exactly `length * 12` bytes starting
   * at `byteOffset`. The buffer is *not* copied; mutations through
   * this V3fArray propagate to the original buffer.
   */
  static fromBuffer(
    buffer: ArrayBufferLike,
    length: number,
    byteOffset: number = 0,
  ): V3fArray {
    if (byteOffset + length * COMPONENT_COUNT * F32_BYTES > buffer.byteLength) {
      throw new RangeError("[V3fArray] buffer too small for requested length");
    }
    const arr = Object.create(V3fArray.prototype) as {
      buffer: ArrayBufferLike;
      length: number;
      _data: Float32Array;
    };
    arr.buffer = buffer;
    arr.length = length;
    arr._data = new Float32Array(buffer, byteOffset, length * COMPONENT_COUNT);
    return arr as V3fArray;
  }

  /** Builds an array from an iterable of V3fs. Allocates a fresh buffer. */
  static fromIterable(values: Iterable<V3f>): V3fArray {
    const arr = Array.isArray(values) ? values : [...values];
    const out = new V3fArray(arr.length);
    for (let i = 0; i < arr.length; i++) out.set(i, arr[i]!);
    return out;
  }

  // ---------- element access ----------

  /** Returns a fresh V3f with the i-th element's components copied. */
  get(i: number): V3f {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    return new V3f(this._data[j]!, this._data[j + 1]!, this._data[j + 2]!);
  }

  /** Writes the i-th element's components into `target`. Returns `target`. */
  getInto(i: number, target: V3f): V3f {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    target._data[0] = this._data[j]!;
    target._data[1] = this._data[j + 1]!;
    target._data[2] = this._data[j + 2]!;
    return target;
  }

  /**
   * Returns a V3f that aliases the i-th element. Reads and writes go
   * straight to this array's buffer. Use only when you understand
   * the aliasing — `viewAt(0)` and `viewAt(1)` are independent, but
   * caching `viewAt(0)` and then calling it again gives you a *new*
   * V3f instance pointing at the same slot.
   */
  viewAt(i: number): V3f {
    this._checkBounds(i);
    return V3f.viewOnto(this._data.buffer, this._data.byteOffset + i * COMPONENT_COUNT * F32_BYTES);
  }

  /** Sets the i-th element from a V3f's components. */
  set(i: number, value: V3f): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = value._data[0]!;
    this._data[j + 1] = value._data[1]!;
    this._data[j + 2] = value._data[2]!;
  }

  /** Sets the i-th element from raw components. */
  setComponents(i: number, x: number, y: number, z: number): void {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    this._data[j] = x;
    this._data[j + 1] = y;
    this._data[j + 2] = z;
  }

  // ---------- direct scalar access (hottest path) ----------

  x(i: number): number {
    this._checkBounds(i);
    return this._data[i * COMPONENT_COUNT]!;
  }
  y(i: number): number {
    this._checkBounds(i);
    return this._data[i * COMPONENT_COUNT + 1]!;
  }
  z(i: number): number {
    this._checkBounds(i);
    return this._data[i * COMPONENT_COUNT + 2]!;
  }
  setX(i: number, v: number): void {
    this._checkBounds(i);
    this._data[i * COMPONENT_COUNT] = v;
  }
  setY(i: number, v: number): void {
    this._checkBounds(i);
    this._data[i * COMPONENT_COUNT + 1] = v;
  }
  setZ(i: number, v: number): void {
    this._checkBounds(i);
    this._data[i * COMPONENT_COUNT + 2] = v;
  }

  // ---------- iteration ----------

  *[Symbol.iterator](): Iterator<V3f> {
    for (let i = 0; i < this.length; i++) yield this.get(i);
  }

  /**
   * Iterates with a reusable scratch V3f. The scratch's `_data`
   * is rebound to view each slot in turn — read/write through it
   * goes directly to this array's buffer. Allocates only the scratch
   * (caller-supplied) and the index integer.
   */
  forEachInto(scratch: V3f, fn: (v: V3f, i: number) => void): void {
    for (let i = 0; i < this.length; i++) {
      // Rebind scratch's _data to view the i-th slot. We mutate
      // the readonly field via Object.defineProperty so the V3f
      // continues to behave like a normal instance to the callback.
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

  /** Sets every element to the same value. */
  fill(value: V3f): void {
    const x = value._data[0]!, y = value._data[1]!, z = value._data[2]!;
    for (let i = 0; i < this.length; i++) {
      const j = i * COMPONENT_COUNT;
      this._data[j] = x;
      this._data[j + 1] = y;
      this._data[j + 2] = z;
    }
  }

  /** Copies all components from `other` into this array. Same length required. */
  copyFrom(other: V3fArray): void {
    if (other.length !== this.length) {
      throw new RangeError("[V3fArray] copyFrom requires equal lengths");
    }
    this._data.set(other._data);
  }

  /** Returns a new V3fArray with elements `[start, end)`. Owns a fresh buffer. */
  slice(start: number = 0, end: number = this.length): V3fArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    const out = new V3fArray(n);
    out._data.set(
      this._data.subarray(lo * COMPONENT_COUNT, hi * COMPONENT_COUNT),
    );
    return out;
  }

  /** Returns a V3fArray viewing a sub-range of this array's buffer (no copy). */
  subarray(start: number = 0, end: number = this.length): V3fArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    return V3fArray.fromBuffer(
      this._data.buffer,
      n,
      this._data.byteOffset + lo * COMPONENT_COUNT * F32_BYTES,
    );
  }

  /** Materializes as a fresh array of V3fs. Allocates `length` V3fs. */
  toArray(): V3f[] {
    const out: V3f[] = new Array(this.length);
    for (let i = 0; i < this.length; i++) out[i] = this.get(i);
    return out;
  }

  /** Adds `rhs` to every element in place. `rhs` may be a V3f or another V3fArray. */
  addInPlace(rhs: V3f | V3fArray): void {
    if (rhs instanceof V3f) {
      const x = rhs._data[0]!, y = rhs._data[1]!, z = rhs._data[2]!;
      for (let i = 0; i < this.length; i++) {
        const j = i * COMPONENT_COUNT;
        this._data[j] = this._data[j]! + x;
        this._data[j + 1] = this._data[j + 1]! + y;
        this._data[j + 2] = this._data[j + 2]! + z;
      }
    } else {
      if (rhs.length !== this.length) {
        throw new RangeError("[V3fArray] addInPlace requires equal lengths");
      }
      for (let k = 0; k < this._data.length; k++) {
        this._data[k] = this._data[k]! + rhs._data[k]!;
      }
    }
  }

  /** Multiplies every component by a scalar in place. */
  scaleInPlace(s: number): void {
    for (let k = 0; k < this._data.length; k++) {
      this._data[k] = this._data[k]! * s;
    }
  }

  // ---------- internal ----------

  /** @internal */
  private _checkBounds(i: number): void {
    if (i < 0 || i >= this.length || !Number.isInteger(i)) {
      throw new RangeError(`[V3fArray] index ${i} out of bounds [0, ${this.length})`);
    }
  }
}
