import { describe, it, expect } from "vitest";
import { V3b } from "../../src/vector/v3b.js";

describe("V3b — smoke", () => {
  it("constructs and reads components", () => {
    expect(new V3b(true, false, true).toArray()).toEqual([true, false, true]);
  });

  it("splat / true_ / false_", () => {
    expect(V3b.true_.toArray()).toEqual([true, true, true]);
    expect(V3b.false_.toArray()).toEqual([false, false, false]);
  });

  it("and / or / xor / not", () => {
    const a = new V3b(true, false, true);
    const b = new V3b(true, true, false);
    expect(a.and(b).toArray()).toEqual([true, false, false]);
    expect(a.or(b).toArray()).toEqual([true, true, true]);
    expect(a.xor(b).toArray()).toEqual([false, true, true]);
    expect(a.not().toArray()).toEqual([false, true, false]);
  });

  it("any / all / countTrue", () => {
    expect(new V3b(true, false, false).any()).toBe(true);
    expect(new V3b(true, false, false).all()).toBe(false);
    expect(new V3b(true, true, true).countTrue()).toBe(3);
  });

  it("equals is structural", () => {
    expect(new V3b(true, false, true).equals(new V3b(true, false, true))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V3b(true, false, true).getHashCode()).toBe(new V3b(true, false, true).getHashCode());
  });

  it("iterator yields booleans", () => {
    expect([...new V3b(true, false, true)]).toEqual([true, false, true]);
  });
});
