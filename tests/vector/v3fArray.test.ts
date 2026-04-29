import { describe, it, expect } from "vitest";
import { V3f } from "../../src/vector/v3f.js";
import { V3fArray } from "../../src/vector/array/v3fArray.js";

describe("V3fArray — construction and layout", () => {
  it("default-constructed array is zero-filled", () => {
    const arr = new V3fArray(3);
    expect(arr.length).toBe(3);
    expect(arr.buffer.byteLength).toBe(36);
    for (let i = 0; i < 3; i++) {
      expect(arr.get(i).toArray()).toEqual([0, 0, 0]);
    }
  });

  it("packed AoS layout — V3f i lives at floats [3i, 3i+1, 3i+2]", () => {
    const arr = new V3fArray(2);
    arr.set(0, new V3f(1, 2, 3));
    arr.set(1, new V3f(4, 5, 6));
    const f32 = new Float32Array(arr.buffer);
    expect(Array.from(f32)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("fromIterable copies the input vectors", () => {
    const a = new V3f(1, 2, 3);
    const arr = V3fArray.fromIterable([a, new V3f(4, 5, 6)]);
    expect(arr.length).toBe(2);
    expect(arr.get(0).equals(a)).toBe(true);
    a.x = 99;
    expect(arr.get(0).x).toBe(1);     // copy, not alias
  });

  it("fromBuffer wraps an existing buffer without copying", () => {
    const buf = new ArrayBuffer(24);
    new Float32Array(buf).set([1, 2, 3, 4, 5, 6]);
    const arr = V3fArray.fromBuffer(buf, 2);
    expect(arr.get(0).toArray()).toEqual([1, 2, 3]);
    arr.set(0, new V3f(10, 20, 30));
    expect(new Float32Array(buf, 0, 3)).toEqual(new Float32Array([10, 20, 30]));
  });
});

describe("V3fArray — element access", () => {
  it("get returns a fresh copy", () => {
    const arr = V3fArray.fromIterable([new V3f(1, 2, 3)]);
    const a = arr.get(0);
    const b = arr.get(0);
    expect(a.equals(b)).toBe(true);
    expect(a).not.toBe(b);
    a.x = 99;
    expect(arr.x(0)).toBe(1);
  });

  it("getInto writes into the target", () => {
    const arr = V3fArray.fromIterable([new V3f(1, 2, 3)]);
    const target = new V3f();
    const r = arr.getInto(0, target);
    expect(r).toBe(target);
    expect(target.toArray()).toEqual([1, 2, 3]);
  });

  it("viewAt aliases the buffer", () => {
    const arr = V3fArray.fromIterable([new V3f(1, 2, 3)]);
    const view = arr.viewAt(0);
    view.x = 99;
    expect(arr.x(0)).toBe(99);
  });

  it("direct scalar accessors avoid V3f wrapping", () => {
    const arr = V3fArray.fromIterable([new V3f(1, 2, 3)]);
    expect(arr.x(0)).toBe(1);
    expect(arr.y(0)).toBe(2);
    expect(arr.z(0)).toBe(3);
    arr.setX(0, 9);
    expect(arr.x(0)).toBe(9);
  });

  it("setComponents writes raw scalars", () => {
    const arr = new V3fArray(1);
    arr.setComponents(0, 7, 8, 9);
    expect(arr.get(0).toArray()).toEqual([7, 8, 9]);
  });

  it("out-of-bounds throws", () => {
    const arr = new V3fArray(2);
    expect(() => arr.get(-1)).toThrow();
    expect(() => arr.get(2)).toThrow();
    expect(() => arr.set(2, V3f.zero)).toThrow();
  });
});

describe("V3fArray — iteration", () => {
  it("Symbol.iterator yields fresh copies", () => {
    const arr = V3fArray.fromIterable([
      new V3f(1, 0, 0),
      new V3f(0, 1, 0),
      new V3f(0, 0, 1),
    ]);
    expect([...arr].map((v) => v.toArray())).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it("forEachInto reuses scratch", () => {
    const arr = V3fArray.fromIterable([
      new V3f(1, 0, 0),
      new V3f(0, 1, 0),
      new V3f(0, 0, 1),
    ]);
    const seen: number[][] = [];
    const scratch = new V3f();
    arr.forEachInto(scratch, (v, i) => {
      seen.push([v.x, v.y, v.z, i]);
    });
    expect(seen).toEqual([
      [1, 0, 0, 0],
      [0, 1, 0, 1],
      [0, 0, 1, 2],
    ]);
  });

  it("forEachInto allows in-place mutation through the scratch", () => {
    const arr = V3fArray.fromIterable([new V3f(1, 0, 0), new V3f(0, 1, 0)]);
    const scratch = new V3f();
    arr.forEachInto(scratch, (v) => {
      v.x = v.x + 100;
    });
    expect(arr.get(0).toArray()).toEqual([101, 0, 0]);
    expect(arr.get(1).toArray()).toEqual([100, 1, 0]);
  });
});

describe("V3fArray — bulk ops", () => {
  it("fill sets every element", () => {
    const arr = new V3fArray(3);
    arr.fill(new V3f(7, 8, 9));
    expect(arr.toArray().every((v) => v.equals(new V3f(7, 8, 9)))).toBe(true);
  });

  it("copyFrom copies bytes between same-length arrays", () => {
    const a = V3fArray.fromIterable([new V3f(1, 2, 3), new V3f(4, 5, 6)]);
    const b = new V3fArray(2);
    b.copyFrom(a);
    expect(b.get(1).toArray()).toEqual([4, 5, 6]);
  });

  it("copyFrom errors on mismatched length", () => {
    const a = new V3fArray(2);
    const b = new V3fArray(3);
    expect(() => b.copyFrom(a)).toThrow();
  });

  it("slice copies a sub-range to a fresh buffer", () => {
    const a = V3fArray.fromIterable([
      new V3f(1, 0, 0),
      new V3f(2, 0, 0),
      new V3f(3, 0, 0),
    ]);
    const s = a.slice(1, 3);
    expect(s.length).toBe(2);
    expect(s.buffer).not.toBe(a.buffer);
    expect(s.get(0).x).toBe(2);
  });

  it("subarray returns a view sharing the buffer", () => {
    const a = V3fArray.fromIterable([
      new V3f(1, 0, 0),
      new V3f(2, 0, 0),
      new V3f(3, 0, 0),
    ]);
    const v = a.subarray(1, 3);
    expect(v.length).toBe(2);
    expect(v.buffer).toBe(a.buffer);
    v.set(0, new V3f(99, 0, 0));
    expect(a.x(1)).toBe(99);
  });

  it("addInPlace with V3f", () => {
    const a = V3fArray.fromIterable([new V3f(1, 1, 1), new V3f(2, 2, 2)]);
    a.addInPlace(new V3f(10, 0, 0));
    expect(a.get(0).toArray()).toEqual([11, 1, 1]);
    expect(a.get(1).toArray()).toEqual([12, 2, 2]);
  });

  it("addInPlace with V3fArray", () => {
    const a = V3fArray.fromIterable([new V3f(1, 1, 1), new V3f(2, 2, 2)]);
    const b = V3fArray.fromIterable([new V3f(10, 20, 30), new V3f(40, 50, 60)]);
    a.addInPlace(b);
    expect(a.get(0).toArray()).toEqual([11, 21, 31]);
    expect(a.get(1).toArray()).toEqual([42, 52, 62]);
  });

  it("scaleInPlace", () => {
    const a = V3fArray.fromIterable([new V3f(1, 2, 3)]);
    a.scaleInPlace(10);
    expect(a.get(0).toArray()).toEqual([10, 20, 30]);
  });
});

describe("V3fArray — precision parity with standalone V3f", () => {
  it("standalone and array-stored V3fs round to the same f32 value", () => {
    const x = 1.123456789;
    const standalone = new V3f(x, 0, 0);
    const arr = V3fArray.fromIterable([standalone]);
    const inside = arr.get(0);
    expect(inside.x).toBe(standalone.x);
    expect(inside.x).toBe(Math.fround(x));
  });
});
