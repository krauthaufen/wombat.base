import { describe, it, expect } from "vitest";
import { V2b } from "../../src/vector/v2b.js";

describe("V2b — smoke", () => {
  it("constructs and reads components", () => {
    expect(new V2b(true, false).toArray()).toEqual([true, false]);
  });

  it("splat / true_ / false_", () => {
    expect(V2b.true_.toArray()).toEqual([true, true]);
    expect(V2b.false_.toArray()).toEqual([false, false]);
    expect(V2b.splat(true).toArray()).toEqual([true, true]);
  });

  it("and / or / xor / not", () => {
    const a = new V2b(true, false);
    const b = new V2b(true, true);
    expect(a.and(b).toArray()).toEqual([true, false]);
    expect(a.or(b).toArray()).toEqual([true, true]);
    expect(a.xor(b).toArray()).toEqual([false, true]);
    expect(a.not().toArray()).toEqual([false, true]);
  });

  it("any / all / countTrue", () => {
    expect(new V2b(true, false).any()).toBe(true);
    expect(new V2b(true, false).all()).toBe(false);
    expect(new V2b(true, true).countTrue()).toBe(2);
  });

  it("equals is structural", () => {
    expect(new V2b(true, false).equals(new V2b(true, false))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V2b(true, false).getHashCode()).toBe(new V2b(true, false).getHashCode());
  });

  it("iterator yields booleans", () => {
    expect([...new V2b(true, false)]).toEqual([true, false]);
  });
});
