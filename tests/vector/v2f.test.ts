import { describe, it, expect } from "vitest";
import { V2f } from "../../src/vector/v2f.js";
import { V2b } from "../../src/vector/v2b.js";

describe("V2f — smoke", () => {
  it("constructs and reads components", () => {
    const v = new V2f(1, 2);
    expect(v.toArray()).toEqual([1, 2]);
  });

  it("rounds to f32 on assignment", () => {
    expect(new V2f(1.1, 0).x).toBe(Math.fround(1.1));
  });

  it("add", () => {
    expect(new V2f(1, 2).add(new V2f(10, 20)).toArray()).toEqual([11, 22]);
  });

  it("crossZ is the perp-dot", () => {
    expect(new V2f(1, 0).crossZ(new V2f(0, 1))).toBe(1);
  });

  it("equals is structural", () => {
    expect(new V2f(1, 2).equals(new V2f(1, 2))).toBe(true);
  });

  it("hash is deterministic", () => {
    expect(new V2f(3, 4).getHashCode()).toBe(new V2f(3, 4).getHashCode());
  });

  it("iterator yields x, y", () => {
    expect([...new V2f(7, 8)]).toEqual([7, 8]);
  });

  it("lt returns V2b", () => {
    const r = new V2f(1, 5).lt(new V2f(3, 3));
    expect(r).toBeInstanceOf(V2b);
    expect(r.toArray()).toEqual([true, false]);
  });
});
