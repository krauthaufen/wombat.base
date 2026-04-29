import { describe, it, expect } from "vitest";
import { Cell } from "../../src/cell/cell.js";
import { Box3d } from "../../src/box/box3d.js";
import { V3d } from "../../src/vector/v3d.js";

describe("Cell — smoke", () => {
  it("unit cell's bounding box is [0,1]^3", () => {
    const bb = Cell.unit.boundingBox();
    expect(bb.min.toArray()).toEqual([0, 0, 0]);
    expect(bb.max.toArray()).toEqual([1, 1, 1]);
  });

  it("centered unit cell's bounding box is [-0.5, 0.5]^3", () => {
    const bb = Cell.centeredUnit.boundingBox();
    expect(bb.min.toArray()).toEqual([-0.5, -0.5, -0.5]);
    expect(bb.max.toArray()).toEqual([0.5, 0.5, 0.5]);
  });

  it("size is 2^exp", () => {
    expect(new Cell(0n, 0n, 0n, 0n).size()).toBe(1);
    expect(new Cell(0n, 0n, 0n, 3n).size()).toBe(8);
    expect(new Cell(0n, 0n, 0n, -2n).size()).toBe(0.25);
  });

  it("parent/child round-trip", () => {
    const c = new Cell(5n, -3n, 7n, 2n);
    const p = c.parent();
    // find which child of p equals c
    const kids = p.children();
    const idx = kids.findIndex(k => k.equals(c));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(p.child(idx).equals(c)).toBe(true);
  });

  it("commonRoot of two siblings is their parent", () => {
    const p = new Cell(2n, 1n, 0n, 4n);
    const a = p.child(0);
    const b = p.child(7);
    expect(Cell.commonRoot(a, b).equals(p)).toBe(true);
  });

  it("commonRoot of a cell with itself is itself", () => {
    const c = new Cell(3n, -1n, 0n, 2n);
    expect(Cell.commonRoot(c, c).equals(c)).toBe(true);
  });

  it("commonRoot rejects mismatched centered flags", () => {
    const a = new Cell(0n, 0n, 0n, 0n, false);
    const b = new Cell(0n, 0n, 0n, 0n, true);
    expect(() => Cell.commonRoot(a, b)).toThrow();
  });

  it("contains: child is inside parent; parent is not inside child", () => {
    const p = new Cell(1n, 2n, 3n, 5n);
    const c = p.child(3);
    expect(p.contains(c)).toBe(true);
    expect(c.contains(p)).toBe(false);
  });

  it("contains(point): point inside is true, outside is false", () => {
    const c = Cell.unit;
    expect(c.contains(new V3d(0.5, 0.5, 0.5))).toBe(true);
    expect(c.contains(new V3d(-1, 0.5, 0.5))).toBe(false);
  });

  it("intersects with box", () => {
    const c = Cell.unit;
    expect(c.intersects(Box3d.fromMinMax(new V3d(0.5, 0.5, 0.5), new V3d(2, 2, 2)))).toBe(true);
    expect(c.intersects(Box3d.fromMinMax(new V3d(2, 2, 2), new V3d(3, 3, 3)))).toBe(false);
  });

  it("equals / hashCode determinism", () => {
    const a = new Cell(1n, -2n, 3n, 4n, false);
    const b = new Cell(1n, -2n, 3n, 4n, false);
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
    const c = new Cell(1n, -2n, 3n, 4n, true);
    expect(a.equals(c)).toBe(false);
  });

  it("fromBox produces a cell containing the box", () => {
    const box = Box3d.fromMinMax(new V3d(0.3, 0.7, 1.1), new V3d(1.4, 2.2, 1.9));
    const c = Cell.fromBox(box);
    expect(c.boundingBox().contains(box)).toBe(true);
  });

  it("fromBox of unit cube returns unit cell (or its parent)", () => {
    const box = Box3d.fromMinMax(new V3d(0, 0, 0), new V3d(1, 1, 1));
    const c = Cell.fromBox(box);
    expect(c.boundingBox().contains(box)).toBe(true);
  });

  it("fromBox of degenerate point box does not throw", () => {
    const box = Box3d.fromMinMax(new V3d(0.5, 0.5, 0.5), new V3d(0.5, 0.5, 0.5));
    const c = Cell.fromBox(box);
    expect(c.boundingBox().contains(new V3d(0.5, 0.5, 0.5))).toBe(true);
  });

  it("toString / iterator", () => {
    const c = new Cell(1n, 2n, 3n, 4n, true);
    expect(c.toString()).toContain("Cell(");
    const arr = [...c];
    expect(arr.length).toBe(5);
  });
});
