import { describe, it, expect } from "vitest";
import { V4f } from "../../src/vector/v4f.js";
import { V4b } from "../../src/vector/v4b.js";

describe("V4f — smoke", () => {
  it("constructs and reads components", () => {
    expect(new V4f(1, 2, 3, 4).toArray()).toEqual([1, 2, 3, 4]);
  });

  it("rounds to f32 on assignment", () => {
    expect(new V4f(1.1, 0, 0, 0).x).toBe(Math.fround(1.1));
  });

  it("unitW", () => {
    expect(V4f.unitW.toArray()).toEqual([0, 0, 0, 1]);
  });

  it("add", () => {
    expect(new V4f(1, 2, 3, 4).add(V4f.one).toArray()).toEqual([2, 3, 4, 5]);
  });

  it("equals is structural", () => {
    expect(new V4f(1, 2, 3, 4).equals(new V4f(1, 2, 3, 4))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V4f(1, 2, 3, 4).getHashCode()).toBe(new V4f(1, 2, 3, 4).getHashCode());
  });

  it("iterator length 4", () => {
    expect([...new V4f(1, 2, 3, 4)]).toEqual([1, 2, 3, 4]);
  });

  it("ge returns V4b", () => {
    const r = new V4f(1, 2, 3, 4).ge(new V4f(2, 2, 2, 2));
    expect(r).toBeInstanceOf(V4b);
    expect(r.toArray()).toEqual([false, true, true, true]);
  });
});
