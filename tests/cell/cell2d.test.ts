import { describe, it, expect } from "vitest";
import { Cell2d } from "../../src/cell/cell2d.js";
import { Box2d } from "../../src/box/box2d.js";
import { V2d } from "../../src/vector/v2d.js";

describe("Cell2d — smoke", () => {
  it("unit cell's bounding box is [0,1]^2", () => {
    const bb = Cell2d.unit.boundingBox();
    expect(bb.min.toArray()).toEqual([0, 0]);
    expect(bb.max.toArray()).toEqual([1, 1]);
  });

  it("centered unit cell's bounding box is [-0.5, 0.5]^2", () => {
    const bb = Cell2d.centeredUnit.boundingBox();
    expect(bb.min.toArray()).toEqual([-0.5, -0.5]);
    expect(bb.max.toArray()).toEqual([0.5, 0.5]);
  });

  it("parent/child round-trip", () => {
    const c = new Cell2d(5n, -3n, 2n);
    const p = c.parent();
    const kids = p.children();
    const idx = kids.findIndex(k => k.equals(c));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(p.child(idx).equals(c)).toBe(true);
  });

  it("commonRoot of two siblings is their parent", () => {
    const p = new Cell2d(2n, 1n, 4n);
    const a = p.child(0);
    const b = p.child(3);
    expect(Cell2d.commonRoot(a, b).equals(p)).toBe(true);
  });

  it("contains: child inside parent; parent not inside child", () => {
    const p = new Cell2d(1n, 2n, 5n);
    const c = p.child(2);
    expect(p.contains(c)).toBe(true);
    expect(c.contains(p)).toBe(false);
  });

  it("contains(point)", () => {
    expect(Cell2d.unit.contains(new V2d(0.5, 0.5))).toBe(true);
    expect(Cell2d.unit.contains(new V2d(-0.1, 0.5))).toBe(false);
  });

  it("intersects with box", () => {
    const c = Cell2d.unit;
    expect(c.intersects(Box2d.fromMinMax(new V2d(0.5, 0.5), new V2d(2, 2)))).toBe(true);
    expect(c.intersects(Box2d.fromMinMax(new V2d(2, 2), new V2d(3, 3)))).toBe(false);
  });

  it("equals / hashCode determinism", () => {
    const a = new Cell2d(1n, -2n, 4n, false);
    const b = new Cell2d(1n, -2n, 4n, false);
    expect(a.equals(b)).toBe(true);
    expect(a.getHashCode()).toBe(b.getHashCode());
  });

  it("fromBox encloses the box", () => {
    const box = Box2d.fromMinMax(new V2d(0.3, 0.7), new V2d(1.4, 2.2));
    const c = Cell2d.fromBox(box);
    expect(c.boundingBox().contains(box)).toBe(true);
  });

  it("size is 2^exp", () => {
    expect(new Cell2d(0n, 0n, 3n).size()).toBe(8);
    expect(new Cell2d(0n, 0n, -2n).size()).toBe(0.25);
  });
});
