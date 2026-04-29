// V3dArray — packed AoS array of V3d.
//
// Backed by a single `Float64Array` of length `3 * count`. The
// underlying `ArrayBuffer` can be uploaded to the GPU verbatim
// (matches `gl.vertexAttribPointer(loc, 3, DOUBLE, false, 24, 0)`).
//
// Three element-access patterns:
//   * `arr.get(i)` — fresh V3d copy (safe to keep around).
//   * `arr.viewAt(i)` — V3d *aliasing* the buffer (advanced; mutating
//     the returned V3d mutates the array).
//   * `arr.forEachInto(scratch, fn)` — reuses one V3d viewing each
//     slot in turn; zero allocations per iteration.
//
// Plus direct scalar accessors (`arr.x(i)`, `arr.setX(i, v)`) for
// the absolute hottest loops where even a wrapper is too much.

import { V3d } from "../v3d.js";

const COMPONENT_COUNT = 3;
const F64_BYTES = 8;

export class V3dArray implements Iterable<V3d> {
  /** Underlying buffer. Always exactly `length * 24` bytes. */
  readonly buffer: ArrayBuffer;

  /** Number of V3d elements. */
  readonly length: number;

  /** Float32 view over the buffer. Length is `3 * length`. @internal */
  readonly _data: Float64Array;

  constructor(length: number) {
    if (length < 0 || !Number.isInteger(length)) {
      throw new RangeError("[V3dArray] length must be a non-negative integer");
    }
    this.length = length;
    this.buffer = new ArrayBuffer(length * COMPONENT_COUNT * F64_BYTES);
    this._data = new Float64Array(this.buffer);
  }

  /**
   * Wraps an existing buffer of exactly `length * 24` bytes starting
   * at `byteOffset`. The buffer is *not* copied; mutations through
   * this V3dArray propagate to the original buffer.
   */
  static fromBuffer(
    buffer: ArrayBufferLike,
    length: number,
    byteOffset: number = 0,
  ): V3dArray {
    if (byteOffset + length * COMPONENT_COUNT * F64_BYTES > buffer.byteLength) {
      throw new RangeError("[V3dArray] buffer too small for requested length");
    }
    const arr = Object.create(V3dArray.prototype) as {
      buffer: ArrayBufferLike;
      length: number;
      _data: Float64Array;
    };
    arr.buffer = buffer;
    arr.length = length;
    arr._data = new Float64Array(buffer, byteOffset, length * COMPONENT_COUNT);
    return arr as V3dArray;
  }

  /** Builds an array from an iterable of V3ds. Allocates a fresh buffer. */
  static fromIterable(values: Iterable<V3d>): V3dArray {
    const arr = Array.isArray(values) ? values : [...values];
    const out = new V3dArray(arr.length);
    for (let i = 0; i < arr.length; i++) out.set(i, arr[i]!);
    return out;
  }

  // ---------- element access ----------

  /** Returns a fresh V3d with the i-th element's components copied. */
  get(i: number): V3d {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    return new V3d(this._data[j]!, this._data[j + 1]!, this._data[j + 2]!);
  }

  /** Writes the i-th element's components into `target`. Returns `target`. */
  getInto(i: number, target: V3d): V3d {
    this._checkBounds(i);
    const j = i * COMPONENT_COUNT;
    target._data[0] = this._data[j]!;
    target._data[1] = this._data[j + 1]!;
    target._data[2] = this._data[j + 2]!;
    return target;
  }

  /**
   * Returns a V3d that aliases the i-th element. Reads and writes go
   * straight to this array's buffer. Use only when you understand
   * the aliasing — `viewAt(0)` and `viewAt(1)` are independent, but
   * caching `viewAt(0)` and then calling it again gives you a *new*
   * V3d instance pointing at the same slot.
   */
  viewAt(i: number): V3d {
    this._checkBounds(i);
    return V3d.viewOnto(this._data.buffer, this._data.byteOffset + i * COMPONENT_COUNT * F64_BYTES);
  }

  /** Sets the i-th element from a V3d's components. */
  set(i: number, value: V3d): void {
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

  *[Symbol.iterator](): Iterator<V3d> {
    for (let i = 0; i < this.length; i++) yield this.get(i);
  }

  /**
   * Iterates with a reusable scratch V3d. The scratch's `_data`
   * is rebound to view each slot in turn — read/write through it
   * goes directly to this array's buffer. Allocates only the scratch
   * (caller-supplied) and the index integer.
   */
  forEachInto(scratch: V3d, fn: (v: V3d, i: number) => void): void {
    for (let i = 0; i < this.length; i++) {
      // Rebind scratch's _data to view the i-th slot. We mutate
      // the readonly field via Object.defineProperty so the V3d
      // continues to behave like a normal instance to the callback.
      Object.defineProperty(scratch, "_data", {
        value: new Float64Array(
          this._data.buffer,
          this._data.byteOffset + i * COMPONENT_COUNT * F64_BYTES,
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
  fill(value: V3d): void {
    const x = value._data[0]!, y = value._data[1]!, z = value._data[2]!;
    for (let i = 0; i < this.length; i++) {
      const j = i * COMPONENT_COUNT;
      this._data[j] = x;
      this._data[j + 1] = y;
      this._data[j + 2] = z;
    }
  }

  /** Copies all components from `other` into this array. Same length required. */
  copyFrom(other: V3dArray): void {
    if (other.length !== this.length) {
      throw new RangeError("[V3dArray] copyFrom requires equal lengths");
    }
    this._data.set(other._data);
  }

  /** Returns a new V3dArray with elements `[start, end)`. Owns a fresh buffer. */
  slice(start: number = 0, end: number = this.length): V3dArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    const out = new V3dArray(n);
    out._data.set(
      this._data.subarray(lo * COMPONENT_COUNT, hi * COMPONENT_COUNT),
    );
    return out;
  }

  /** Returns a V3dArray viewing a sub-range of this array's buffer (no copy). */
  subarray(start: number = 0, end: number = this.length): V3dArray {
    const lo = Math.max(0, start);
    const hi = Math.min(this.length, end);
    const n = Math.max(0, hi - lo);
    return V3dArray.fromBuffer(
      this._data.buffer,
      n,
      this._data.byteOffset + lo * COMPONENT_COUNT * F64_BYTES,
    );
  }

  /** Materializes as a fresh array of V3ds. Allocates `length` V3ds. */
  toArray(): V3d[] {
    const out: V3d[] = new Array(this.length);
    for (let i = 0; i < this.length; i++) out[i] = this.get(i);
    return out;
  }

  /** Adds `rhs` to every element in place. `rhs` may be a V3d or another V3dArray. */
  addInPlace(rhs: V3d | V3dArray): void {
    if (rhs instanceof V3d) {
      const x = rhs._data[0]!, y = rhs._data[1]!, z = rhs._data[2]!;
      for (let i = 0; i < this.length; i++) {
        const j = i * COMPONENT_COUNT;
        this._data[j] = this._data[j]! + x;
        this._data[j + 1] = this._data[j + 1]! + y;
        this._data[j + 2] = this._data[j + 2]! + z;
      }
    } else {
      if (rhs.length !== this.length) {
        throw new RangeError("[V3dArray] addInPlace requires equal lengths");
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
      throw new RangeError(`[V3dArray] index ${i} out of bounds [0, ${this.length})`);
    }
  }
}
