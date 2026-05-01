import { describe, it, expect } from "vitest";
import { V3d } from "../src/vector/v3d.js";
import { Box3d } from "../src/box/box3d.js";
import { Sphere3d } from "../src/geometry/sphere3d.js";
import { Triangle3d } from "../src/geometry/triangle3d.js";
import { Quad3d } from "../src/geometry/quad3d.js";
import { Ray3d } from "../src/geometry/ray3d.js";
import { Trafo3d } from "../src/trafo/trafo3d.js";
import { Intersectable } from "../src/geometry/intersectable.js";

const EPS = 1e-9;

function vClose(a: V3d, b: V3d, eps = EPS) {
  expect(a.x).toBeCloseTo(b.x, -Math.log10(eps));
  expect(a.y).toBeCloseTo(b.y, -Math.log10(eps));
  expect(a.z).toBeCloseTo(b.z, -Math.log10(eps));
}

describe("Intersectable.box", () => {
  const box = Box3d.fromMinMax(new V3d(-1, -1, -1), new V3d(1, 1, 1));
  const obj = Intersectable.box(box);

  it("has expected boundingBox", () => {
    expect(obj.boundingBox.min.equals(box.min)).toBe(true);
    expect(obj.boundingBox.max.equals(box.max)).toBe(true);
  });

  it("hits +x face with -x normal", () => {
    const r = new Ray3d(new V3d(5, 0, 0), new V3d(-1, 0, 0));
    const h = obj.intersects(r, 0, 100)!;
    expect(h).toBeDefined();
    expect(h.t).toBeCloseTo(4, 12);
    vClose(h.point, new V3d(1, 0, 0));
    vClose(h.normal, new V3d(1, 0, 0));
  });

  it("hits -x face", () => {
    const r = new Ray3d(new V3d(-5, 0, 0), new V3d(1, 0, 0));
    const h = obj.intersects(r, 0, 100)!;
    vClose(h.normal, new V3d(-1, 0, 0));
    expect(h.t).toBeCloseTo(4, 12);
  });

  it("hits +y / -y / +z / -z faces with correct normals", () => {
    let h = obj.intersects(new Ray3d(new V3d(0, 5, 0), new V3d(0, -1, 0)), 0, 100)!;
    vClose(h.normal, new V3d(0, 1, 0));
    h = obj.intersects(new Ray3d(new V3d(0, -5, 0), new V3d(0, 1, 0)), 0, 100)!;
    vClose(h.normal, new V3d(0, -1, 0));
    h = obj.intersects(new Ray3d(new V3d(0, 0, 5), new V3d(0, 0, -1)), 0, 100)!;
    vClose(h.normal, new V3d(0, 0, 1));
    h = obj.intersects(new Ray3d(new V3d(0, 0, -5), new V3d(0, 0, 1)), 0, 100)!;
    vClose(h.normal, new V3d(0, 0, -1));
  });

  it("ray inside reports exit hit on the far face", () => {
    const r = new Ray3d(new V3d(0, 0, 0), new V3d(1, 0, 0));
    const h = obj.intersects(r, -10, 100)!;
    expect(h.t).toBeCloseTo(1, 12);
    vClose(h.point, new V3d(1, 0, 0));
    // Exit face on +x; outward normal is +x.
    vClose(h.normal, new V3d(1, 0, 0));
  });

  it("miss returns undefined", () => {
    const r = new Ray3d(new V3d(0, 5, 0), new V3d(1, 0, 0));
    expect(obj.intersects(r, 0, 100)).toBeUndefined();
  });

  it("respects tmin/tmax clipping", () => {
    const r = new Ray3d(new V3d(5, 0, 0), new V3d(-1, 0, 0));
    expect(obj.intersects(r, 0, 3)).toBeUndefined();
    expect(obj.intersects(r, 5, 100)).toBeUndefined();
  });
});

describe("Intersectable.sphere", () => {
  const s = new Sphere3d(V3d.zero, 1);
  const obj = Intersectable.sphere(s);

  it("hits sphere from outside, smallest t", () => {
    const r = new Ray3d(new V3d(0, 0, -5), new V3d(0, 0, 1));
    const h = obj.intersects(r, 0, 100)!;
    expect(h.t).toBeCloseTo(4, 12);
    vClose(h.normal, new V3d(0, 0, -1));
    vClose(h.point, new V3d(0, 0, -1));
  });

  it("origin inside reports exit", () => {
    const r = new Ray3d(V3d.zero, new V3d(1, 0, 0));
    const h = obj.intersects(r, -10, 100)!;
    expect(h.t).toBeCloseTo(1, 12);
    vClose(h.normal, new V3d(1, 0, 0));
  });

  it("miss returns undefined", () => {
    const r = new Ray3d(new V3d(5, 5, 0), new V3d(0, 0, 1));
    expect(obj.intersects(r, 0, 100)).toBeUndefined();
  });
});

describe("Intersectable.triangle", () => {
  const tri = new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(0, 1, 0));
  const obj = Intersectable.triangle(tri);

  it("hits inside triangle", () => {
    const r = new Ray3d(new V3d(0.25, 0.25, 5), new V3d(0, 0, -1));
    const h = obj.intersects(r, 0, 100)!;
    expect(h.t).toBeCloseTo(5, 12);
    vClose(h.point, new V3d(0.25, 0.25, 0));
    // Geometric normal is +z (right-hand from p1-p0,p2-p0). Ray dir is -z so normal stays +z (faces ray).
    vClose(h.normal, new V3d(0, 0, 1));
  });

  it("misses outside triangle", () => {
    const r = new Ray3d(new V3d(2, 2, 5), new V3d(0, 0, -1));
    expect(obj.intersects(r, 0, 100)).toBeUndefined();
  });

  it("coplanar miss", () => {
    const r = new Ray3d(new V3d(-1, 0, 0), new V3d(1, 0, 0));
    expect(obj.intersects(r, 0, 100)).toBeUndefined();
  });

  it("backface flips normal to face the ray", () => {
    const r = new Ray3d(new V3d(0.25, 0.25, -5), new V3d(0, 0, 1));
    const h = obj.intersects(r, 0, 100)!;
    expect(h.t).toBeCloseTo(5, 12);
    // Geometric +z; ray dir is +z; flipped to -z to face the ray.
    vClose(h.normal, new V3d(0, 0, -1));
  });
});

describe("Intersectable.quad", () => {
  const q = new Quad3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(1, 1, 0), new V3d(0, 1, 0));
  const obj = Intersectable.quad(q);

  it("hits in first triangle", () => {
    const r = new Ray3d(new V3d(0.2, 0.2, 5), new V3d(0, 0, -1));
    const h = obj.intersects(r, 0, 100)!;
    vClose(h.point, new V3d(0.2, 0.2, 0));
  });

  it("hits in second triangle", () => {
    const r = new Ray3d(new V3d(0.8, 0.8, 5), new V3d(0, 0, -1));
    const h = obj.intersects(r, 0, 100)!;
    vClose(h.point, new V3d(0.8, 0.8, 0));
  });

  it("misses outside quad", () => {
    const r = new Ray3d(new V3d(2, 2, 5), new V3d(0, 0, -1));
    expect(obj.intersects(r, 0, 100)).toBeUndefined();
  });
});

describe("Intersectable.triangles", () => {
  const tris = [
    new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(0, 1, 0)),
    new Triangle3d(new V3d(0, 0, 1), new V3d(1, 0, 1), new V3d(0, 1, 1)),
    new Triangle3d(new V3d(0, 0, 2), new V3d(1, 0, 2), new V3d(0, 1, 2)),
  ];
  const obj = Intersectable.triangles(tris);

  it("returns the closest of multiple triangle hits", () => {
    const r = new Ray3d(new V3d(0.25, 0.25, 5), new V3d(0, 0, -1));
    const h = obj.intersects(r, 0, 100)!;
    // Closest is z=2 plane, t=3.
    expect(h.t).toBeCloseTo(3, 12);
  });

  it("matches a brute-force test per triangle", () => {
    const r = new Ray3d(new V3d(0.25, 0.25, 5), new V3d(0, 0, -1));
    const ts: number[] = [];
    for (const t of tris) {
      const h = Intersectable.triangle(t).intersects(r, 0, 100);
      if (h) ts.push(h.t);
    }
    ts.sort((a, b) => a - b);
    const h = obj.intersects(r, 0, 100)!;
    expect(h.t).toBeCloseTo(ts[0]!, 12);
  });

  it("union bounding box covers all input tris", () => {
    expect(obj.boundingBox.contains(new V3d(0, 0, 0))).toBe(true);
    expect(obj.boundingBox.contains(new V3d(1, 1, 2))).toBe(true);
  });
});

describe("Intersectable.transformed", () => {
  it("rotation+scale produces same hit count and consistent point/normal", () => {
    const sphere = new Sphere3d(V3d.zero, 1);
    const inner = Intersectable.sphere(sphere);
    // Scale by 2 in x then rotate 90deg around z.
    const trafo = Trafo3d.scaling(new V3d(2, 1, 1)).mul(Trafo3d.rotation(new V3d(0, 0, 1), Math.PI / 4));
    const wrapped = Intersectable.transformed(inner, trafo);
    // The wrapped surface is an ellipse in world; pick a ray we know hits it.
    const r = new Ray3d(new V3d(0, 0, 5), new V3d(0, 0, -1));
    const h = wrapped.intersects(r, 0, 100);
    expect(h).toBeDefined();
    expect(h!.t).toBeGreaterThan(0);
    // The hit point z should be on the unit sphere's image at (0,0,±1) → world (0,0,±1)
    expect(Math.abs(h!.point.z)).toBeCloseTo(1, 8);
    // Normal at world (0,0,1) on the transformed unit sphere remains parallel to z (rot is around z).
    expect(Math.abs(h!.normal.z)).toBeCloseTo(1, 8);
  });

  it("transformed bounding box contains all transformed inner corners", () => {
    const inner = Intersectable.box(Box3d.fromMinMax(new V3d(-1, -1, -1), new V3d(1, 1, 1)));
    const trafo = Trafo3d.translation(new V3d(10, 0, 0));
    const w = Intersectable.transformed(inner, trafo);
    const b = w.boundingBox;
    expect(b.contains(new V3d(9, -1, -1))).toBe(true);
    expect(b.contains(new V3d(11, 1, 1))).toBe(true);
  });
});
