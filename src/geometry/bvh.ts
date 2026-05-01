// Bvh<K, V> — immutable, keyed bounding-volume hierarchy.
//
// TypeScript port of Aardvark.Geometry.BvhTree3d (F#). The tree stores
// (key, box, value) triples and supports persistent add/remove plus
// front-to-back ray traversal. The split metric is the overlap-penalty
// cost from Aardvark's Bvh.fs (NOT classic SAH).

import { V3d } from "../vector/v3d.js";
import { Box3d } from "../box/box3d.js";
import { Ray3d } from "./ray3d.js";
import type { IIntersectHit } from "./intersectable.js";
import { rayBoxSlab } from "./intersectable.js";

export interface BvhItem<K, V> {
  readonly key: K;
  readonly box: Box3d;
  readonly value: V;
}

export interface BvhHit<K, V> {
  readonly t: number;
  readonly point: V3d;
  readonly normal: V3d;
  readonly key: K;
  readonly value: V;
}

/** Default split limit (matches Aardvark `BvhTree3d.splitLimit`). */
export const BVH_SPLIT_LIMIT = 24;

// --------------------------------------------------------------------
// Internal node representation
// --------------------------------------------------------------------

interface LeafEntry<V> {
  readonly box: Box3d;
  readonly value: V;
}

interface Leaf<K, V> {
  readonly kind: "leaf";
  /** elements.size when no profitable split existed (the "split-failed"
   *  fallback), 0 otherwise. The Add path uses this to detect "the leaf
   *  has roughly doubled in size since we last failed to split it" and
   *  triggers a rebuild. */
  readonly overflowCount: number;
  readonly bounds: Box3d;
  readonly entries: Map<K, LeafEntry<V>>;
}

interface Inner<K, V> {
  readonly kind: "inner";
  readonly bestCost: number;
  readonly count: number;
  readonly bounds: Box3d;
  readonly left: Node<K, V>;
  readonly right: Node<K, V>;
}

type Node<K, V> = Leaf<K, V> | Inner<K, V>;

function nodeBounds<K, V>(n: Node<K, V>): Box3d {
  return n.bounds;
}

function nodeCount<K, V>(n: Node<K, V>): number {
  return n.kind === "leaf" ? n.entries.size : n.count;
}

function* nodeEntries<K, V>(n: Node<K, V>): IterableIterator<[K, Box3d, V]> {
  if (n.kind === "leaf") {
    for (const [k, e] of n.entries) yield [k, e.box, e.value];
  } else {
    yield* nodeEntries(n.left);
    yield* nodeEntries(n.right);
  }
}

function boundsOf<V>(entries: Iterable<LeafEntry<V>>): Box3d {
  let bb = Box3d.empty;
  for (const e of entries) bb = bb.union(e.box);
  return bb;
}

// --------------------------------------------------------------------
// Cost / split — direct port of BvhNode3d.cost / BvhNode3d.split
// --------------------------------------------------------------------

function cost(invVolume: number, lBox: Box3d, lCnt: number, rBox: Box3d, rCnt: number): number {
  const i = lBox.intersection(rBox);
  const iVol = i.isValid() ? i.volume() * invVolume : 0;
  const lVol = lBox.volume() * invVolume;
  const rVol = rBox.volume() * invVolume;
  const cnt = lCnt + rCnt;
  const l = lCnt / cnt;
  const r = rCnt / cnt;
  return (1 / cnt + l * lVol + r * rVol + iVol) / 2;
}

interface SplitResult<K, V> {
  bestCost: number;
  lBox: Box3d;
  lEntries: Array<[K, LeafEntry<V>]>;
  rBox: Box3d;
  rEntries: Array<[K, LeafEntry<V>]>;
}

function trySplit<K, V>(
  invVolume: number, elements: Map<K, LeafEntry<V>>,
): SplitResult<K, V> | undefined {
  if (elements.size <= 1) return undefined;
  const arr: Array<[K, LeafEntry<V>]> = Array.from(elements);
  const n = arr.length;
  // Centers cached once per dimension for the sort key.
  const centers: V3d[] = arr.map(([, e]) => e.box.center());

  let bestCost = Infinity;
  let bestPerm: number[] | undefined;
  let bestSplit = -1;
  let bestlBox = Box3d.empty;
  let bestrBox = Box3d.empty;

  for (let dim = 0; dim < 3; dim++) {
    const getter = dim === 0
      ? (v: V3d) => v.x
      : dim === 1 ? (v: V3d) => v.y : (v: V3d) => v.z;
    // Stable ascending permutation by box-center on this axis. Ties
    // resolved by original index — gives deterministic builds.
    const perm: number[] = new Array(n);
    for (let i = 0; i < n; i++) perm[i] = i;
    perm.sort((a, b) => {
      const ca = getter(centers[a]!);
      const cb = getter(centers[b]!);
      if (ca < cb) return -1;
      if (ca > cb) return 1;
      return a - b;
    });

    const lBoxes: Box3d[] = new Array(n);
    const rBoxes: Box3d[] = new Array(n);

    let last = arr[perm[0]!]![1].box;
    lBoxes[0] = last;
    for (let i = 1; i < n; i++) {
      last = arr[perm[i]!]![1].box.union(last);
      lBoxes[i] = last;
    }
    last = Box3d.empty;
    for (let i = n - 1; i >= 0; i--) {
      last = arr[perm[i]!]![1].box.union(last);
      rBoxes[i] = last;
    }

    for (let lCnt = 1; lCnt < n; lCnt++) {
      const rCnt = n - lCnt;
      const lBox = lBoxes[lCnt - 1]!;
      const rBox = rBoxes[lCnt]!;
      const c = cost(invVolume, lBox, lCnt, rBox, rCnt);
      if (c < bestCost) {
        bestCost = c;
        bestPerm = perm;
        bestSplit = lCnt;
        bestlBox = lBox;
        bestrBox = rBox;
      }
    }
  }

  // No profitable split — fall back to the overflow leaf path.
  if (!(bestCost < 1.0) || !bestPerm) return undefined;

  const lCnt = bestSplit;
  const rCnt = n - lCnt;
  const lEntries: Array<[K, LeafEntry<V>]> = new Array(lCnt);
  const rEntries: Array<[K, LeafEntry<V>]> = new Array(rCnt);
  for (let i = 0; i < lCnt; i++) lEntries[i] = arr[bestPerm[i]!]!;
  for (let i = 0; i < rCnt; i++) rEntries[i] = arr[bestPerm[lCnt + i]!]!;
  return { bestCost, lBox: bestlBox, lEntries, rBox: bestrBox, rEntries };
}

function buildNode<K, V>(limit: number, bounds: Box3d, entries: Map<K, LeafEntry<V>>): Node<K, V> {
  if (entries.size === 0) throw new Error("buildNode: empty");
  if (entries.size <= limit) {
    return { kind: "leaf", overflowCount: 0, bounds, entries };
  }
  const invVol = 1 / bounds.volume();
  const split = trySplit(invVol, entries);
  if (split) {
    const lMap = new Map(split.lEntries);
    const rMap = new Map(split.rEntries);
    const l = buildNode(limit, split.lBox, lMap);
    const r = buildNode(limit, split.rBox, rMap);
    return { kind: "inner", bestCost: split.bestCost, count: entries.size, bounds, left: l, right: r };
  }
  // Split failed — overflow leaf. overflowCount = elements.Count.
  return { kind: "leaf", overflowCount: entries.size, bounds, entries };
}

function rebuildAll<K, V>(limit: number, bounds: Box3d, node: Node<K, V>, addKey: K, addBox: Box3d, addValue: V): Node<K, V> {
  const map = new Map<K, LeafEntry<V>>();
  for (const [k, b, v] of nodeEntries(node)) map.set(k, { box: b, value: v });
  map.set(addKey, { box: addBox, value: addValue });
  return buildNode(limit, bounds, map);
}

function addToNode<K, V>(limit: number, key: K, bounds: Box3d, value: V, node: Node<K, V>): Node<K, V> {
  if (node.kind === "leaf") {
    const existing = node.entries.get(key);
    if (existing !== undefined) {
      const newEntries = new Map(node.entries);
      newEntries.set(key, { box: bounds, value });
      // If new box already lies within the old box for this key, the
      // leaf bounds cannot have shrunk; otherwise we must recompute.
      let newBounds: Box3d;
      if (bounds.contains(existing.box)) {
        newBounds = node.bounds;
      } else {
        let bb = bounds;
        for (const [, e] of newEntries) bb = bb.union(e.box);
        newBounds = bb;
      }
      return { kind: "leaf", overflowCount: node.overflowCount, bounds: newBounds, entries: newEntries };
    }
    const newBounds = node.bounds.union(bounds);
    const newEntries = new Map(node.entries);
    newEntries.set(key, { box: bounds, value });
    if (newEntries.size >= 2 * node.overflowCount && newEntries.size > limit) {
      return buildNode(limit, newBounds, newEntries);
    }
    return { kind: "leaf", overflowCount: node.overflowCount, bounds: newBounds, entries: newEntries };
  }

  // Inner: pick the cheaper child to insert into.
  const nb = node.bounds.union(bounds);
  const lb = nodeBounds(node.left);
  const rb = nodeBounds(node.right);
  const lc = nodeCount(node.left);
  const rc = nodeCount(node.right);
  const invVol = 1 / nb.volume();
  const lCost = cost(invVol, lb.union(bounds), 1 + lc, rb, rc);
  const rCost = cost(invVol, lb, lc, rb.union(bounds), 1 + rc);

  if (lCost < rCost) {
    if (lCost > 2.0 * node.bestCost) {
      return rebuildAll(limit, nb, node, key, bounds, value);
    }
    const l = addToNode(limit, key, bounds, value, node.left);
    const lb2 = nodeBounds(l);
    const lc2 = nodeCount(l);
    const cc = cost(invVol, lb2, lc2, rb, rc);
    const nb2 = lb2.union(rb);
    return {
      kind: "inner", bestCost: Math.min(node.bestCost, cc),
      count: lc2 + rc, bounds: nb2, left: l, right: node.right,
    };
  } else {
    if (rCost > 2.0 * node.bestCost) {
      return rebuildAll(limit, nb, node, key, bounds, value);
    }
    const r = addToNode(limit, key, bounds, value, node.right);
    const rb2 = nodeBounds(r);
    const rc2 = nodeCount(r);
    const cc = cost(invVol, lb, lc, rb2, rc2);
    const nb2 = lb.union(rb2);
    return {
      kind: "inner", bestCost: Math.min(node.bestCost, cc),
      count: lc + rc2, bounds: nb2, left: node.left, right: r,
    };
  }
}

interface RemoveResult<K, V> { value: V; node: Node<K, V> | undefined; }

function tryRemoveFromNode<K, V>(
  limit: number, key: K, bounds: Box3d, node: Node<K, V>,
): RemoveResult<K, V> | undefined {
  if (!node.bounds.intersects(bounds)) return undefined;

  if (node.kind === "leaf") {
    const e = node.entries.get(key);
    if (e === undefined) return undefined;
    const newEntries = new Map(node.entries);
    newEntries.delete(key);
    if (newEntries.size > 0) {
      const bb = boundsOf(newEntries.values());
      return {
        value: e.value,
        node: {
          kind: "leaf",
          overflowCount: Math.max(0, node.overflowCount - 1),
          bounds: bb,
          entries: newEntries,
        },
      };
    }
    return { value: e.value, node: undefined };
  }

  // Inner: try left first, then right.
  const fromLeft = tryRemoveFromNode(limit, key, bounds, node.left);
  if (fromLeft) {
    return { value: fromLeft.value, node: combineAfterRemove(limit, fromLeft.node, node.right, node.bestCost) };
  }
  const fromRight = tryRemoveFromNode(limit, key, bounds, node.right);
  if (fromRight) {
    return { value: fromRight.value, node: combineAfterRemove(limit, node.left, fromRight.node, node.bestCost) };
  }
  return undefined;
}

function combineAfterRemove<K, V>(
  limit: number, l: Node<K, V> | undefined, r: Node<K, V> | undefined, bestCost: number,
): Node<K, V> | undefined {
  if (!l) return r;
  if (!r) return l;
  const lc = nodeCount(l), rc = nodeCount(r);
  const lb = nodeBounds(l), rb = nodeBounds(r);
  const o = lb.union(rb);
  const cnt = lc + rc;
  if (cnt <= limit) {
    const merged = new Map<K, LeafEntry<V>>();
    for (const [k, b, v] of nodeEntries(l)) merged.set(k, { box: b, value: v });
    for (const [k, b, v] of nodeEntries(r)) merged.set(k, { box: b, value: v });
    return { kind: "leaf", overflowCount: 0, bounds: o, entries: merged };
  }
  const c = cost(1 / o.volume(), lb, lc, rb, rc);
  return { kind: "inner", bestCost: Math.min(c, bestCost), count: cnt, bounds: o, left: l, right: r };
}

// --------------------------------------------------------------------
// Traversal
// --------------------------------------------------------------------

function getIntersectingNode<K, V>(
  query: Box3d, node: Node<K, V>, out: Array<BvhItem<K, V>>,
  filter?: (key: K, box: Box3d, value: V) => boolean,
): void {
  if (!node.bounds.intersects(query)) return;
  if (node.kind === "leaf") {
    for (const [k, e] of node.entries) {
      if (!e.box.intersects(query)) continue;
      if (filter && !filter(k, e.box, e.value)) continue;
      out.push({ key: k, box: e.box, value: e.value });
    }
  } else {
    getIntersectingNode(query, node.left, out, filter);
    getIntersectingNode(query, node.right, out, filter);
  }
}

interface ClosestState<K, V> {
  bestT: number;
  bestHit: IIntersectHit | undefined;
  bestKey: K | undefined;
  bestValue: V | undefined;
}

function closestHitNode<K, V>(
  ray: Ray3d, tmin: number, node: Node<K, V>,
  tryIntersect: (key: K, value: V) => IIntersectHit | undefined,
  state: ClosestState<K, V>,
): void {
  // Box prefilter against the current shrinking tmax.
  const slab = rayBoxSlab(ray, node.bounds, tmin, state.bestT);
  if (!slab) return;

  if (node.kind === "leaf") {
    for (const [k, e] of node.entries) {
      const sb = rayBoxSlab(ray, e.box, tmin, state.bestT);
      if (!sb) continue;
      const h = tryIntersect(k, e.value);
      if (h && h.t >= tmin && h.t < state.bestT) {
        state.bestT = h.t;
        state.bestHit = h;
        state.bestKey = k;
        state.bestValue = e.value;
      }
    }
    return;
  }

  // Inner: descend front-to-back.
  const sl = rayBoxSlab(ray, node.left.bounds, tmin, state.bestT);
  const sr = rayBoxSlab(ray, node.right.bounds, tmin, state.bestT);
  if (sl && sr) {
    if (sl.tNear <= sr.tNear) {
      closestHitNode(ray, tmin, node.left, tryIntersect, state);
      if (sr.tNear < state.bestT) {
        closestHitNode(ray, tmin, node.right, tryIntersect, state);
      }
    } else {
      closestHitNode(ray, tmin, node.right, tryIntersect, state);
      if (sl.tNear < state.bestT) {
        closestHitNode(ray, tmin, node.left, tryIntersect, state);
      }
    }
  } else if (sl) {
    closestHitNode(ray, tmin, node.left, tryIntersect, state);
  } else if (sr) {
    closestHitNode(ray, tmin, node.right, tryIntersect, state);
  }
}

// --------------------------------------------------------------------
// Public class
// --------------------------------------------------------------------

export class Bvh<K, V> {
  private readonly limit: number;
  private readonly root: Node<K, V> | undefined;
  private readonly keyBounds: Map<K, Box3d>;

  private constructor(limit: number, root: Node<K, V> | undefined, keyBounds: Map<K, Box3d>) {
    this.limit = limit;
    this.root = root;
    this.keyBounds = keyBounds;
  }

  static empty<K, V>(splitLimit: number = BVH_SPLIT_LIMIT): Bvh<K, V> {
    return new Bvh<K, V>(splitLimit, undefined, new Map());
  }

  static build<K, V>(items: Iterable<BvhItem<K, V>>, splitLimit: number = BVH_SPLIT_LIMIT): Bvh<K, V> {
    let bb = Box3d.empty;
    const all = new Map<K, LeafEntry<V>>();
    const keyBounds = new Map<K, Box3d>();
    for (const it of items) {
      if (!it.box.isValid()) continue;
      bb = bb.union(it.box);
      all.set(it.key, { box: it.box, value: it.value });
      keyBounds.set(it.key, it.box);
    }
    if (all.size === 0) return new Bvh<K, V>(splitLimit, undefined, new Map());
    const root = buildNode(splitLimit, bb, all);
    return new Bvh<K, V>(splitLimit, root, keyBounds);
  }

  get count(): number {
    return this.root ? nodeCount(this.root) : 0;
  }

  get boundingBox(): Box3d {
    return this.root ? this.root.bounds : Box3d.empty;
  }

  add(key: K, box: Box3d, value: V): Bvh<K, V> {
    if (!box.isValid()) return this;
    const newKeyBounds = new Map(this.keyBounds);
    newKeyBounds.set(key, box);
    let newRoot: Node<K, V>;
    if (this.root) {
      newRoot = addToNode(this.limit, key, box, value, this.root);
    } else {
      const m = new Map<K, LeafEntry<V>>();
      m.set(key, { box, value });
      newRoot = { kind: "leaf", overflowCount: 0, bounds: box, entries: m };
    }
    return new Bvh<K, V>(this.limit, newRoot, newKeyBounds);
  }

  remove(key: K): Bvh<K, V> {
    const r = this.tryRemove(key);
    return r ? r.tree : this;
  }

  tryRemove(key: K): { value: V; tree: Bvh<K, V> } | undefined {
    const kb = this.keyBounds.get(key);
    if (kb === undefined || !this.root) return undefined;
    const res = tryRemoveFromNode(this.limit, key, kb, this.root);
    if (!res) return undefined;
    const newKeyBounds = new Map(this.keyBounds);
    newKeyBounds.delete(key);
    return { value: res.value, tree: new Bvh<K, V>(this.limit, res.node, newKeyBounds) };
  }

  closestHit(
    ray: Ray3d, tmin: number, tmax: number,
    tryIntersect: (key: K, value: V) => IIntersectHit | undefined,
  ): BvhHit<K, V> | undefined {
    if (!this.root) return undefined;
    const state: ClosestState<K, V> = {
      bestT: tmax, bestHit: undefined, bestKey: undefined, bestValue: undefined,
    };
    closestHitNode(ray, tmin, this.root, tryIntersect, state);
    if (!state.bestHit || state.bestKey === undefined || state.bestValue === undefined) return undefined;
    return {
      t: state.bestHit.t, point: state.bestHit.point, normal: state.bestHit.normal,
      key: state.bestKey, value: state.bestValue,
    };
  }

  getIntersecting(query: Box3d): Array<BvhItem<K, V>>;
  getIntersecting(query: Box3d, filter: (key: K, box: Box3d, value: V) => boolean): Array<BvhItem<K, V>>;
  getIntersecting(
    query: Box3d, filter?: (key: K, box: Box3d, value: V) => boolean,
  ): Array<BvhItem<K, V>> {
    const out: Array<BvhItem<K, V>> = [];
    if (this.root) getIntersectingNode(query, this.root, out, filter);
    return out;
  }

  *items(): IterableIterator<BvhItem<K, V>> {
    if (!this.root) return;
    for (const [k, b, v] of nodeEntries(this.root)) yield { key: k, box: b, value: v };
  }

  /** Union with another BVH — semantically a fold of `add` over `other`'s items. */
  union(other: Bvh<K, V>): Bvh<K, V> {
    let cur: Bvh<K, V> = this;
    for (const it of other.items()) cur = cur.add(it.key, it.box, it.value);
    return cur;
  }
}
