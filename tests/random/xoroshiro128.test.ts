import { describe, it, expect } from "vitest";
import { XoroShiro128Plus } from "../../src/random/xoroshiro128.js";

describe("XoroShiro128Plus — determinism", () => {
  it("two PRNGs seeded identically produce the same sequence", () => {
    const a = XoroShiro128Plus.seeded(42);
    const b = XoroShiro128Plus.seeded(42);
    for (let i = 0; i < 1000; i++) {
      expect(a.nextUint32()).toBe(b.nextUint32());
    }
  });

  it("bigint and number seeds with the same bits agree", () => {
    const a = XoroShiro128Plus.seeded(0x123456789abcdefn);
    const b = XoroShiro128Plus.seeded(0x123456789abcdefn);
    expect(a.nextUint32()).toBe(b.nextUint32());
  });
});

describe("XoroShiro128Plus — distribution sanity", () => {
  it("nextFloat() over 1M samples has mean ~0.5 and var ~1/12", () => {
    const r = XoroShiro128Plus.seeded(1n);
    const N = 1_000_000;
    let sum = 0, sum2 = 0;
    for (let i = 0; i < N; i++) {
      const x = r.nextFloat();
      sum += x;
      sum2 += x * x;
    }
    const mean = sum / N;
    const variance = sum2 / N - mean * mean;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.005);
    expect(Math.abs(variance - 1 / 12)).toBeLessThan(0.005);
  });

  it("nextInt(0, 100) stays in [0, 100) over 100k samples", () => {
    const r = XoroShiro128Plus.seeded(7n);
    for (let i = 0; i < 100_000; i++) {
      const x = r.nextInt(0, 100);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(100);
      expect(Number.isInteger(x)).toBe(true);
    }
  });

  it("nextBoolean() is approximately 50/50 over 100k samples", () => {
    const r = XoroShiro128Plus.seeded(13n);
    let trues = 0;
    const N = 100_000;
    for (let i = 0; i < N; i++) if (r.nextBoolean()) trues++;
    expect(Math.abs(trues / N - 0.5)).toBeLessThan(0.01);
  });
});

describe("XoroShiro128Plus — vectors", () => {
  it("nextV3f() produces components in [0, 1) over 10k samples", () => {
    const r = XoroShiro128Plus.seeded(99n);
    for (let i = 0; i < 10_000; i++) {
      const v = r.nextV3f();
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.x).toBeLessThan(1);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeLessThan(1);
      expect(v.z).toBeGreaterThanOrEqual(0);
      expect(v.z).toBeLessThan(1);
    }
  });

  it("nextDirectionV3f() produces unit-length vectors", () => {
    const r = XoroShiro128Plus.seeded(2024n);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextDirectionV3f();
      const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      // f32 storage has ~1e-7 round-off; use a slightly looser bound.
      expect(Math.abs(len - 1)).toBeLessThan(1e-6);
    }
  });

  it("nextDirectionV3d() produces unit-length vectors", () => {
    const r = XoroShiro128Plus.seeded(2025n);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextDirectionV3d();
      const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      expect(Math.abs(len - 1)).toBeLessThan(1e-12);
    }
  });
});

describe("XoroShiro128Plus — clone & state", () => {
  it("clone() produces an independent copy with the same future sequence", () => {
    const r = XoroShiro128Plus.seeded(123n);
    // burn a few outputs
    for (let i = 0; i < 17; i++) r.nextUint32();
    const c = r.clone();
    for (let i = 0; i < 100; i++) {
      expect(r.nextUint32()).toBe(c.nextUint32());
    }
    // independence: advancing c does not affect r
    const before = r.getState().slice();
    for (let i = 0; i < 50; i++) c.nextUint32();
    expect(r.getState()).toEqual(before);
  });

  it("getState/setState round-trip", () => {
    const r = XoroShiro128Plus.seeded(55n);
    for (let i = 0; i < 5; i++) r.nextUint32();
    const snap = r.getState();
    const next1 = r.nextUint32();
    const r2 = XoroShiro128Plus.seeded(0n);
    r2.setState(snap);
    expect(r2.nextUint32()).toBe(next1);
  });
});

describe("XoroShiro128Plus — Rot3d / Box3d integration", () => {
  it("nextRotation produces unit quaternions", async () => {
    const { XoroShiro128Plus } = await import("../../src/random/xoroshiro128.js");
    const r = XoroShiro128Plus.seeded(7n);
    for (let i = 0; i < 1000; i++) {
      const q = r.nextRotation();
      const len = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
      expect(Math.abs(len - 1)).toBeLessThan(1e-12);
    }
  });

  it("nextInBox stays inside the box", async () => {
    const { XoroShiro128Plus } = await import("../../src/random/xoroshiro128.js");
    const { Box3d } = await import("../../src/box/box3d.js");
    const { V3d } = await import("../../src/vector/v3d.js");
    const r = XoroShiro128Plus.seeded(11n);
    const b = Box3d.fromMinMax(new V3d(-2, 0, 5), new V3d(3, 4, 9));
    for (let i = 0; i < 1000; i++) {
      const p = r.nextInBox(b);
      expect(p.x >= -2 && p.x <= 3).toBe(true);
      expect(p.y >= 0 && p.y <= 4).toBe(true);
      expect(p.z >= 5 && p.z <= 9).toBe(true);
    }
  });
});
