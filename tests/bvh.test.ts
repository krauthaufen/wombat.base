import { describe, it, expect } from "vitest";
import { V3d } from "../src/vector/v3d.js";
import { Box3d } from "../src/box/box3d.js";
import { Ray3d } from "../src/geometry/ray3d.js";
import { rayBoxSlab } from "../src/geometry/intersectable.js";
import type { IIntersectHit } from "../src/geometry/intersectable.js";
import { Bvh, type BvhItem } from "../src/geometry/bvh.js";

// Tiny xorshift32 — deterministic, no deps.
function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) / 0xFFFFFFFF);
  };
}

function randomBox(r: () => number): Box3d {
  const c = new V3d(r(), r(), r());
  const e = 0.005 + r() * 0.02;
  return Box3d.fromMinMax(
    new V3d(c.x - e, c.y - e, c.z - e),
    new V3d(c.x + e, c.y + e, c.z + e),
  );
}

// Slab-based ray/box hit promoted to an IIntersectHit, used as the
// narrow-phase test for the BVH in tests where the stored AABB *is*
// the intersectable.
function boxHit(box: Box3d, ray: Ray3d, tmin: number, tmax: number): IIntersectHit | undefined {
  const s = rayBoxSlab(ray, box, tmin, tmax);
  if (!s) return undefined;
  const t = s.tNear < tmin ? s.tFar : s.tNear;
  if (t < tmin || t > tmax) return undefined;
  return { t, point: ray.pointAt(t), normal: new V3d(-ray.direction.x, -ray.direction.y, -ray.direction.z) };
}

describe("Bvh", () => {
  it("empty BVH: count 0, no hits, empty bbox", () => {
    const tree = Bvh.empty<number, number>();
    expect(tree.count).toBe(0);
    expect(tree.boundingBox.isEmpty()).toBe(true);
    const ray = new Ray3d(V3d.zero, new V3d(1, 0, 0));
    const hit = tree.closestHit(ray, 0, 100, () => undefined);
    expect(hit).toBeUndefined();
  });

  it("single item builds and is hit", () => {
    const box = Box3d.fromMinMax(new V3d(1, -0.5, -0.5), new V3d(2, 0.5, 0.5));
    const tree = Bvh.build<string, string>([{ key: "a", box, value: "value-a" }]);
    expect(tree.count).toBe(1);
    const ray = new Ray3d(V3d.zero, new V3d(1, 0, 0));
    const hit = tree.closestHit(ray, 0, 100, (k, v) => {
      expect(k).toBe("a");
      expect(v).toBe("value-a");
      return boxHit(box, ray, 0, 100);
    });
    expect(hit).toBeDefined();
    expect(hit!.key).toBe("a");
    expect(hit!.t).toBeCloseTo(1, 9);
  });

  it("Build vs incremental Add: same ray-hit answers on 200 random boxes", () => {
    const r = rng(123);
    const items: BvhItem<number, Box3d>[] = [];
    for (let i = 0; i < 200; i++) items.push({ key: i, box: randomBox(r), value: randomBox(r) });
    // We re-use the box itself as `value` so closestHit can re-test it
    // via boxHit(value, ...) — this verifies the value is plumbed.
    const built: BvhItem<number, Box3d>[] = items.map(it => ({ key: it.key, box: it.box, value: it.box }));
    const buildTree = Bvh.build(built);
    let addTree = Bvh.empty<number, Box3d>();
    for (const it of built) addTree = addTree.add(it.key, it.box, it.value);

    expect(buildTree.count).toBe(200);
    expect(addTree.count).toBe(200);

    const r2 = rng(456);
    for (let k = 0; k < 50; k++) {
      const o = new V3d(-1 + r2() * 0.5, r2(), r2());
      const d = new V3d(1, (r2() - 0.5) * 0.4, (r2() - 0.5) * 0.4).normalize();
      const ray = new Ray3d(o, d);
      const f = (_k: number, v: Box3d) => boxHit(v, ray, 0, 100);
      const a = buildTree.closestHit(ray, 0, 100, f);
      const b = addTree.closestHit(ray, 0, 100, f);
      if (!a) {
        expect(b).toBeUndefined();
      } else {
        expect(b).toBeDefined();
        expect(b!.t).toBeCloseTo(a.t, 9);
        expect(b!.key).toBe(a.key);
      }
    }
  });

  it("closestHit matches brute force on 1000 random boxes × 100 rays", () => {
    const r = rng(7);
    const boxes: Box3d[] = [];
    for (let i = 0; i < 1000; i++) boxes.push(randomBox(r));
    const tree = Bvh.build<number, Box3d>(boxes.map((b, i) => ({ key: i, box: b, value: b })));

    const r2 = rng(99);
    let hits = 0, misses = 0;
    for (let k = 0; k < 100; k++) {
      const o = new V3d(-1 + r2() * 0.5, r2(), r2());
      const d = new V3d(1, (r2() - 0.5) * 0.4, (r2() - 0.5) * 0.4).normalize();
      const ray = new Ray3d(o, d);

      let bfBest: { t: number; idx: number } | undefined;
      for (let i = 0; i < boxes.length; i++) {
        const h = boxHit(boxes[i]!, ray, 0, 100);
        if (h && (!bfBest || h.t < bfBest.t)) bfBest = { t: h.t, idx: i };
      }
      const bv = tree.closestHit(ray, 0, 100, (_k, v) => boxHit(v, ray, 0, 100));
      if (!bfBest) {
        expect(bv).toBeUndefined();
        misses++;
      } else {
        expect(bv).toBeDefined();
        expect(bv!.t).toBeCloseTo(bfBest.t, 9);
        hits++;
      }
    }
    expect(hits + misses).toBe(100);
    expect(hits).toBeGreaterThan(0);
  });

  it("front-to-back pruning: closer cluster prunes farther cluster", () => {
    // Two well-separated clusters along x.
    const items: BvhItem<number, Box3d>[] = [];
    for (let i = 0; i < 4; i++) {
      const c = new V3d(1 + i * 0.01, 0, 0);
      items.push({ key: i, box: Box3d.fromCenterRadius(c, 0.05), value: Box3d.fromCenterRadius(c, 0.05) });
    }
    for (let i = 0; i < 4; i++) {
      const c = new V3d(10 + i * 0.01, 0, 0);
      items.push({ key: 100 + i, box: Box3d.fromCenterRadius(c, 0.05), value: Box3d.fromCenterRadius(c, 0.05) });
    }
    // splitLimit = 4 forces the build to actually split into two leaves.
    const tree = Bvh.build(items, 4);

    let calls = 0;
    const ray = new Ray3d(V3d.zero, new V3d(1, 0, 0));
    const hit = tree.closestHit(ray, 0, 100, (k, v) => {
      calls++;
      // Use the ID-encoded distance so the closer cluster wins by t.
      const t = k < 100 ? 1 + k * 0.01 : 10 + (k - 100) * 0.01;
      void v;
      return { t, point: ray.pointAt(t), normal: new V3d(-1, 0, 0) };
    });
    expect(hit).toBeDefined();
    expect(hit!.key).toBe(0);
    // Only the close cluster's 4 leaf entries should have been narrowed.
    expect(calls).toBe(4);
  });

  it("remove: removing 25 of 50 items leaves the same hits as a fresh build of survivors", () => {
    const r = rng(321);
    const items: BvhItem<number, Box3d>[] = [];
    for (let i = 0; i < 50; i++) {
      const b = randomBox(r);
      items.push({ key: i, box: b, value: b });
    }
    let removed = Bvh.build(items);
    const survivors: BvhItem<number, Box3d>[] = [];
    for (let i = 0; i < items.length; i++) {
      if (i % 2 === 0) removed = removed.remove(i);
      else survivors.push(items[i]!);
    }
    const fresh = Bvh.build(survivors);
    expect(removed.count).toBe(survivors.length);
    expect(fresh.count).toBe(survivors.length);

    const r2 = rng(654);
    for (let k = 0; k < 30; k++) {
      const o = new V3d(-1 + r2() * 0.5, r2(), r2());
      const d = new V3d(1, (r2() - 0.5) * 0.4, (r2() - 0.5) * 0.4).normalize();
      const ray = new Ray3d(o, d);
      const f = (_k: number, v: Box3d) => boxHit(v, ray, 0, 100);
      const a = removed.closestHit(ray, 0, 100, f);
      const b = fresh.closestHit(ray, 0, 100, f);
      if (!a) expect(b).toBeUndefined();
      else {
        expect(b).toBeDefined();
        expect(b!.t).toBeCloseTo(a.t, 9);
        expect(b!.key).toBe(a.key);
      }
    }
  });

  it("tryRemove returns undefined for missing keys", () => {
    const box = Box3d.fromMinMax(new V3d(0, 0, 0), new V3d(1, 1, 1));
    const tree = Bvh.build<number, string>([{ key: 1, box, value: "one" }]);
    expect(tree.tryRemove(2)).toBeUndefined();
    const r = tree.tryRemove(1);
    expect(r).toBeDefined();
    expect(r!.value).toBe("one");
    expect(r!.tree.count).toBe(0);
  });

  it("getIntersecting honours the filter predicate", () => {
    const items: BvhItem<number, number>[] = [];
    for (let i = 0; i < 30; i++) {
      const c = new V3d(i * 0.1, 0, 0);
      items.push({ key: i, box: Box3d.fromCenterRadius(c, 0.2), value: i });
    }
    const tree = Bvh.build(items);
    const q = Box3d.fromMinMax(new V3d(0.4, -1, -1), new V3d(0.8, 1, 1));
    const all = tree.getIntersecting(q);
    expect(all.length).toBeGreaterThan(0);
    const evens = tree.getIntersecting(q, (_k, _b, v) => v % 2 === 0);
    expect(evens.every(it => it.value % 2 === 0)).toBe(true);
    expect(evens.length).toBeLessThan(all.length);
  });

  it("union: empty.union(t) === t; later wins on duplicate keys", () => {
    const r = rng(11);
    const aItems: BvhItem<number, string>[] = [];
    for (let i = 0; i < 20; i++) aItems.push({ key: i, box: randomBox(r), value: `a${i}` });
    const a = Bvh.build(aItems);

    const eu = Bvh.empty<number, string>().union(a);
    expect(eu.count).toBe(a.count);
    // Same hits.
    const ray = new Ray3d(new V3d(-1, 0.5, 0.5), new V3d(1, 0, 0));
    const f = (_k: number, _v: string) => undefined;
    expect(eu.closestHit(ray, 0, 100, f)).toBeUndefined();
    expect(a.closestHit(ray, 0, 100, f)).toBeUndefined();

    const bItems: BvhItem<number, string>[] = [];
    // Half overlap with a's keys, half new.
    for (let i = 10; i < 30; i++) bItems.push({ key: i, box: randomBox(r), value: `b${i}` });
    const b = Bvh.build(bItems);

    const u = a.union(b);
    expect(u.count).toBe(30);
    // b wins on duplicates (10..19).
    const valuesByKey = new Map<number, string>();
    for (const it of u.items()) valuesByKey.set(it.key, it.value);
    for (let k = 0; k < 10; k++) expect(valuesByKey.get(k)).toBe(`a${k}`);
    for (let k = 10; k < 30; k++) expect(valuesByKey.get(k)).toBe(`b${k}`);
  });

  it("determinism: build(items) and build([...items]) give the same hit answers", () => {
    const r = rng(555);
    const items: BvhItem<number, Box3d>[] = [];
    for (let i = 0; i < 100; i++) {
      const b = randomBox(r);
      items.push({ key: i, box: b, value: b });
    }
    const a = Bvh.build(items);
    const b = Bvh.build([...items]);

    const r2 = rng(888);
    for (let k = 0; k < 30; k++) {
      const o = new V3d(-1 + r2() * 0.5, r2(), r2());
      const d = new V3d(1, (r2() - 0.5) * 0.4, (r2() - 0.5) * 0.4).normalize();
      const ray = new Ray3d(o, d);
      const f = (_k: number, v: Box3d) => boxHit(v, ray, 0, 100);
      const ha = a.closestHit(ray, 0, 100, f);
      const hb = b.closestHit(ray, 0, 100, f);
      if (!ha) expect(hb).toBeUndefined();
      else {
        expect(hb).toBeDefined();
        expect(hb!.t).toBeCloseTo(ha.t, 12);
        expect(hb!.key).toBe(ha.key);
      }
    }
  });
});
