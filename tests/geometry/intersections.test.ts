import { describe, it, expect } from "vitest";
import { V2d } from "../../src/vector/v2d.js";
import { V3d } from "../../src/vector/v3d.js";
import { Box2d } from "../../src/box/box2d.js";
import { Box3d } from "../../src/box/box3d.js";
import { Sphere3d } from "../../src/geometry/sphere3d.js";
import { Plane3d } from "../../src/geometry/plane3d.js";
import { Triangle3d } from "../../src/geometry/triangle3d.js";
import { Triangle2d } from "../../src/geometry/triangle2d.js";
import { Line3d } from "../../src/geometry/line3d.js";
import { Line2d } from "../../src/geometry/line2d.js";
import { Circle2d } from "../../src/geometry/circle2d.js";
import { Circle3d } from "../../src/geometry/circle3d.js";
import { Ray3d } from "../../src/geometry/ray3d.js";
import { Ray2d } from "../../src/geometry/ray2d.js";
import { Quad3d } from "../../src/geometry/quad3d.js";
import { Quad2d } from "../../src/geometry/quad2d.js";
import { Polygon3d } from "../../src/geometry/polygon3d.js";
import { Polygon2d } from "../../src/geometry/polygon2d.js";

const EPS = 1e-9;

describe("Sphere3d × Sphere3d", () => {
  it("intersecting → circle on midplane", () => {
    const a = new Sphere3d(V3d.zero, 1);
    const b = new Sphere3d(new V3d(1, 0, 0), 1);
    expect(a.intersects(b)).toBe(true);
    const r = a.intersection(b);
    expect(r).toBeDefined();
    expect(r!.kind).toBe("circle");
    if (r!.kind === "circle") {
      expect(r!.circle.center.approxEqual(new V3d(0.5, 0, 0), EPS)).toBe(true);
      expect(Math.abs(r!.circle.radius - Math.sqrt(0.75))).toBeLessThan(EPS);
    }
  });
  it("disjoint", () => {
    const a = new Sphere3d(V3d.zero, 1);
    const b = new Sphere3d(new V3d(5, 0, 0), 1);
    expect(a.intersects(b)).toBe(false);
    expect(a.intersection(b)).toBeUndefined();
  });
  it("tangent → point", () => {
    const a = new Sphere3d(V3d.zero, 1);
    const b = new Sphere3d(new V3d(2, 0, 0), 1);
    const r = a.intersection(b);
    expect(r?.kind).toBe("point");
    if (r?.kind === "point") expect(r.point.approxEqual(new V3d(1, 0, 0), EPS)).toBe(true);
  });
});

describe("Sphere3d × Plane3d", () => {
  it("intersection circle has projected center", () => {
    const s = new Sphere3d(new V3d(0, 0, 2), 3);
    const p = Plane3d.fromPointAndNormal(V3d.zero, new V3d(0, 0, 1));
    expect(s.intersects(p)).toBe(true);
    const r = s.intersection(p);
    expect(r).toBeInstanceOf(Circle3d);
    if (r instanceof Circle3d) {
      expect(r.center.approxEqual(new V3d(0, 0, 0), EPS)).toBe(true);
      expect(Math.abs(r.radius - Math.sqrt(9 - 4))).toBeLessThan(EPS);
    }
  });
  it("disjoint", () => {
    const s = new Sphere3d(new V3d(0, 0, 10), 1);
    const p = Plane3d.fromPointAndNormal(V3d.zero, new V3d(0, 0, 1));
    expect(s.intersects(p)).toBe(false);
    expect(s.intersection(p)).toBeUndefined();
  });
  it("tangent", () => {
    const s = new Sphere3d(new V3d(0, 0, 1), 1);
    const p = Plane3d.fromPointAndNormal(V3d.zero, new V3d(0, 0, 1));
    const r = s.intersection(p);
    expect(r && !(r instanceof Circle3d) && r.kind === "tangent").toBe(true);
    if (r && !(r instanceof Circle3d)) expect(r.point.approxEqual(V3d.zero, EPS)).toBe(true);
  });
});

describe("Plane3d × Triangle3d", () => {
  it("straddling triangle → segment", () => {
    const plane = Plane3d.fromPointAndNormal(V3d.zero, new V3d(0, 0, 1));
    const tri = new Triangle3d(new V3d(-1, 0, -1), new V3d(1, 0, -1), new V3d(0, 0, 2));
    expect(plane.intersects(tri)).toBe(true);
    const r = plane.intersection(tri);
    expect(r).toBeInstanceOf(Line3d);
  });
  it("disjoint", () => {
    const plane = Plane3d.fromPointAndNormal(V3d.zero, new V3d(0, 0, 1));
    const tri = new Triangle3d(new V3d(0, 0, 1), new V3d(1, 0, 1), new V3d(0, 1, 1));
    expect(plane.intersects(tri)).toBe(false);
    expect(plane.intersection(tri)).toBeUndefined();
  });
  it("vertex touches plane → point", () => {
    const plane = Plane3d.fromPointAndNormal(V3d.zero, new V3d(0, 0, 1));
    const tri = new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 1), new V3d(0, 1, 1));
    const r = plane.intersection(tri);
    expect(r && !(r instanceof Line3d) && r.kind === "point").toBe(true);
  });
});

describe("Plane3d × Box3d (classify)", () => {
  const plane = Plane3d.fromPointAndNormal(V3d.zero, new V3d(0, 0, 1));
  it("above", () => {
    const b = Box3d.fromMinMax(new V3d(0, 0, 1), new V3d(1, 1, 2));
    expect(plane.classify(b)).toBe("above");
    expect(plane.intersects(b)).toBe(false);
  });
  it("below", () => {
    const b = Box3d.fromMinMax(new V3d(0, 0, -2), new V3d(1, 1, -1));
    expect(plane.classify(b)).toBe("below");
  });
  it("intersecting", () => {
    const b = Box3d.fromMinMax(new V3d(-1, -1, -1), new V3d(1, 1, 1));
    expect(plane.classify(b)).toBe("intersecting");
    expect(plane.intersects(b)).toBe(true);
  });
});

describe("Triangle3d × Box3d (SAT)", () => {
  const box = Box3d.fromMinMax(new V3d(-1, -1, -1), new V3d(1, 1, 1));
  it("crossing", () => {
    const t = new Triangle3d(new V3d(-2, 0, 0), new V3d(2, 0, 0), new V3d(0, 2, 0));
    expect(t.intersectsBox(box)).toBe(true);
  });
  it("disjoint", () => {
    const t = new Triangle3d(new V3d(5, 5, 5), new V3d(6, 5, 5), new V3d(5, 6, 5));
    expect(t.intersectsBox(box)).toBe(false);
  });
  it("triangle plane misses but bbox overlaps (true separating axis)", () => {
    const t = new Triangle3d(new V3d(2, 2, 2), new V3d(2, 2, 3), new V3d(3, 2, 2));
    expect(t.intersectsBox(box)).toBe(false);
  });
});

describe("Triangle3d × Triangle3d (Möller)", () => {
  it("crossing → segment", () => {
    const a = new Triangle3d(new V3d(-1, 0, 0), new V3d(1, 0, 0), new V3d(0, 0, 2));
    const b = new Triangle3d(new V3d(0, -1, 1), new V3d(0, 1, 1), new V3d(0, 0, -1));
    expect(a.intersects(b)).toBe(true);
    expect(a.intersection(b)).toBeInstanceOf(Line3d);
  });
  it("disjoint", () => {
    const a = new Triangle3d(new V3d(0, 0, 0), new V3d(1, 0, 0), new V3d(0, 1, 0));
    const b = new Triangle3d(new V3d(0, 0, 5), new V3d(1, 0, 5), new V3d(0, 1, 5));
    expect(a.intersects(b)).toBe(false);
    expect(a.intersection(b)).toBeUndefined();
  });
  it("coplanar overlap", () => {
    const t1 = new Triangle3d(new V3d(0, 0, 0), new V3d(2, 0, 0), new V3d(0, 2, 0));
    const t2 = new Triangle3d(new V3d(1, 1, 0), new V3d(3, 1, 0), new V3d(1, 3, 0));
    expect(t1.intersects(t2)).toBe(true);
  });
});

describe("Line3d × Plane3d", () => {
  const plane = Plane3d.fromPointAndNormal(V3d.zero, new V3d(0, 0, 1));
  it("crossing segment", () => {
    const l = new Line3d(new V3d(0, 0, -1), new V3d(0, 0, 1));
    const r = l.intersection(plane);
    expect(typeof r).toBe("object");
    if (typeof r === "object") {
      expect(r.t).toBeCloseTo(0.5, 12);
      expect(r.point.approxEqual(V3d.zero, EPS)).toBe(true);
    }
  });
  it("parallel", () => {
    const l = new Line3d(new V3d(0, 0, 5), new V3d(1, 0, 5));
    expect(l.intersection(plane)).toBe("parallel");
  });
  it("in-plane", () => {
    const l = new Line3d(new V3d(0, 0, 0), new V3d(1, 0, 0));
    expect(l.intersection(plane)).toBe("in-plane");
  });
});

describe("Line3d × Line3d closest points", () => {
  it("skew lines: known minimal distance", () => {
    const a = new Line3d(V3d.zero, new V3d(1, 0, 0));
    const b = new Line3d(new V3d(0, 0, 1), new V3d(0, 1, 1));
    const r = a.closestPoints(b);
    expect(r.distance).toBeCloseTo(1, 12);
    expect(r.p1.approxEqual(V3d.zero, EPS)).toBe(true);
    expect(r.p2.approxEqual(new V3d(0, 0, 1), EPS)).toBe(true);
    expect(a.intersects(b)).toBe(false);
  });
  it("crossing lines", () => {
    const a = new Line3d(new V3d(-1, 0, 0), new V3d(1, 0, 0));
    const b = new Line3d(new V3d(0, -1, 0), new V3d(0, 1, 0));
    const r = a.closestPoints(b);
    expect(r.distance).toBeLessThan(EPS);
    expect(a.intersects(b)).toBe(true);
  });
  it("parallel lines fallback", () => {
    const a = new Line3d(V3d.zero, new V3d(1, 0, 0));
    const b = new Line3d(new V3d(0, 1, 0), new V3d(1, 1, 0));
    const r = a.closestPoints(b);
    expect(r.distance).toBeCloseTo(1, 12);
  });
});

describe("Box2d × Box2d", () => {
  it("intersection", () => {
    const a = Box2d.fromMinMax(new V2d(0, 0), new V2d(2, 2));
    const b = Box2d.fromMinMax(new V2d(1, 1), new V2d(3, 3));
    expect(a.intersects(b)).toBe(true);
    const i = a.intersection(b);
    expect(i.min.approxEqual(new V2d(1, 1), EPS)).toBe(true);
    expect(i.max.approxEqual(new V2d(2, 2), EPS)).toBe(true);
  });
  it("disjoint → empty intersection", () => {
    const a = Box2d.fromMinMax(new V2d(0, 0), new V2d(1, 1));
    const b = Box2d.fromMinMax(new V2d(2, 2), new V2d(3, 3));
    expect(a.intersects(b)).toBe(false);
    expect(a.intersection(b).isEmpty()).toBe(true);
  });
});

describe("Circle2d × Circle2d", () => {
  it("two intersection points", () => {
    const a = new Circle2d(V2d.zero, 1);
    const b = new Circle2d(new V2d(1, 0), 1);
    expect(a.intersects(b)).toBe(true);
    const r = a.intersection(b);
    expect(Array.isArray(r)).toBe(true);
    if (Array.isArray(r)) {
      expect(Math.abs(r[0].x - 0.5)).toBeLessThan(EPS);
      expect(Math.abs(Math.abs(r[0].y) - Math.sqrt(0.75))).toBeLessThan(EPS);
    }
  });
  it("disjoint", () => {
    const a = new Circle2d(V2d.zero, 1);
    const b = new Circle2d(new V2d(5, 0), 1);
    expect(a.intersects(b)).toBe(false);
    expect(a.intersection(b)).toBeUndefined();
  });
  it("tangent → single point", () => {
    const a = new Circle2d(V2d.zero, 1);
    const b = new Circle2d(new V2d(2, 0), 1);
    const r = a.intersection(b);
    expect(r).toBeInstanceOf(V2d);
    if (r instanceof V2d) expect(r.approxEqual(new V2d(1, 0), EPS)).toBe(true);
  });
});

describe("Circle2d × Box2d", () => {
  it("center-inside box", () => {
    const c = new Circle2d(new V2d(0.5, 0.5), 0.1);
    const b = Box2d.fromMinMax(V2d.zero, new V2d(1, 1));
    expect(c.intersects(b)).toBe(true);
  });
  it("nearby but outside", () => {
    const c = new Circle2d(new V2d(2, 2), 0.5);
    const b = Box2d.fromMinMax(V2d.zero, new V2d(1, 1));
    expect(c.intersects(b)).toBe(false);
  });
  it("circle straddles a corner", () => {
    const c = new Circle2d(new V2d(1.1, 1.1), 0.2);
    const b = Box2d.fromMinMax(V2d.zero, new V2d(1, 1));
    expect(c.intersects(b)).toBe(true);
  });
});

describe("Line2d × Line2d", () => {
  it("crossing inside both segments", () => {
    const a = new Line2d(new V2d(-1, 0), new V2d(1, 0));
    const b = new Line2d(new V2d(0, -1), new V2d(0, 1));
    const r = a.intersection(b);
    expect(typeof r === "object" && r !== null).toBe(true);
    if (typeof r === "object" && r !== null) {
      expect(r.point.approxEqual(V2d.zero, EPS)).toBe(true);
      expect(r.t1).toBeCloseTo(0.5, 12);
      expect(r.t2).toBeCloseTo(0.5, 12);
    }
    expect(a.intersects(b)).toBe(true);
  });
  it("parallel", () => {
    const a = new Line2d(new V2d(0, 0), new V2d(1, 0));
    const b = new Line2d(new V2d(0, 1), new V2d(1, 1));
    expect(a.intersection(b)).toBe("parallel");
    expect(a.intersects(b)).toBe(false);
  });
  it("collinear overlap", () => {
    const a = new Line2d(new V2d(0, 0), new V2d(2, 0));
    const b = new Line2d(new V2d(1, 0), new V2d(3, 0));
    expect(a.intersection(b)).toBe("coincident");
  });
  it("lines cross outside segments", () => {
    const a = new Line2d(new V2d(0, 0), new V2d(1, 0));
    const b = new Line2d(new V2d(2, -1), new V2d(2, 1));
    expect(a.intersection(b)).toBeUndefined();
  });
});

describe("Triangle2d × Triangle2d (SAT)", () => {
  it("overlapping", () => {
    const a = new Triangle2d(new V2d(0, 0), new V2d(2, 0), new V2d(0, 2));
    const b = new Triangle2d(new V2d(1, 1), new V2d(3, 1), new V2d(1, 3));
    expect(a.intersects(b)).toBe(true);
  });
  it("disjoint", () => {
    const a = new Triangle2d(new V2d(0, 0), new V2d(1, 0), new V2d(0, 1));
    const b = new Triangle2d(new V2d(5, 5), new V2d(6, 5), new V2d(5, 6));
    expect(a.intersects(b)).toBe(false);
  });
  it("one inside the other", () => {
    const a = new Triangle2d(new V2d(0, 0), new V2d(10, 0), new V2d(0, 10));
    const b = new Triangle2d(new V2d(1, 1), new V2d(2, 1), new V2d(1, 2));
    expect(a.intersects(b)).toBe(true);
  });
});
