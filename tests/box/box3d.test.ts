import { describe, it, expect } from "vitest";
import { Box3d } from "../../src/box/box3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Box3d — smoke", () => {
  it("empty + extend yields singleton", () => {
    const b = Box3d.empty.extend(new V3d(1.5, 2.5, 3.5));
    expect(b.min.toArray()).toEqual([1.5, 2.5, 3.5]);
    expect(b.max.toArray()).toEqual([1.5, 2.5, 3.5]);
  });

  it("size / center / volume / surfaceArea", () => {
    const b = Box3d.fromMinMax(new V3d(0, 0, 0), new V3d(1, 2, 4));
    expect(b.size().toArray()).toEqual([1, 2, 4]);
    expect(b.center().toArray()).toEqual([0.5, 1, 2]);
    expect(b.volume()).toBe(8);
    expect(b.surfaceArea()).toBe(2 * (2 + 8 + 4));
  });

  it("contains / intersects", () => {
    const b = Box3d.fromMinMax(new V3d(0, 0, 0), new V3d(10, 10, 10));
    expect(b.contains(new V3d(5, 5, 5))).toBe(true);
    expect(b.contains(new V3d(11, 0, 0))).toBe(false);
    expect(b.intersects(Box3d.fromMinMax(new V3d(5, 5, 5), new V3d(15, 15, 15)))).toBe(true);
    expect(b.intersects(Box3d.fromMinMax(new V3d(11, 11, 11), new V3d(15, 15, 15)))).toBe(false);
  });

  it("extend a point already inside leaves box unchanged", () => {
    const b = Box3d.fromMinMax(new V3d(0, 0, 0), new V3d(10, 10, 10));
    expect(b.extend(new V3d(5, 5, 5)).equals(b)).toBe(true);
  });

  it("equals / hashCode determinism", () => {
    const a = Box3d.fromMinMax(new V3d(1.1, 2.2, 3.3), new V3d(4.4, 5.5, 6.6));
    const b = Box3d.fromMinMax(new V3d(1.1, 2.2, 3.3), new V3d(4.4, 5.5, 6.6));
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });
});
