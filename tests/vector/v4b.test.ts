import { describe, it, expect } from "vitest";
import { V4b } from "../../src/vector/v4b.js";

describe("V4b — smoke", () => {
  it("constructs and reads components", () => {
    expect(new V4b(true, false, true, false).toArray()).toEqual([true, false, true, false]);
  });

  it("splat / true_ / false_", () => {
    expect(V4b.true_.toArray()).toEqual([true, true, true, true]);
    expect(V4b.false_.toArray()).toEqual([false, false, false, false]);
  });

  it("and / or / xor / not", () => {
    const a = new V4b(true, false, true, false);
    const b = new V4b(true, true, false, false);
    expect(a.and(b).toArray()).toEqual([true, false, false, false]);
    expect(a.or(b).toArray()).toEqual([true, true, true, false]);
    expect(a.xor(b).toArray()).toEqual([false, true, true, false]);
    expect(a.not().toArray()).toEqual([false, true, false, true]);
  });

  it("any / all / countTrue", () => {
    expect(new V4b(true, false, false, false).any()).toBe(true);
    expect(new V4b(true, true, true, true).all()).toBe(true);
    expect(new V4b(true, true, false, true).countTrue()).toBe(3);
  });

  it("equals is structural", () => {
    expect(new V4b(true, false, true, false).equals(new V4b(true, false, true, false))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V4b(true, false, true, false).getHashCode())
      .toBe(new V4b(true, false, true, false).getHashCode());
  });

  it("iterator yields booleans", () => {
    expect([...new V4b(true, false, true, false)]).toEqual([true, false, true, false]);
  });
});
