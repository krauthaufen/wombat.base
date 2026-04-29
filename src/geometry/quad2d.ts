// Quad2d — four corners P0..P3 (in order, typically CCW).

import { V2d } from "../vector/v2d.js";
import { Triangle2d } from "./triangle2d.js";
import { Trafo2d } from "../trafo/trafo2d.js";
import { combineHash } from "../internal/hash.js";

export class Quad2d {
  readonly p0: V2d;
  readonly p1: V2d;
  readonly p2: V2d;
  readonly p3: V2d;

  constructor(p0: V2d, p1: V2d, p2: V2d, p3: V2d) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
  }

  /** Splits along the P0–P2 diagonal: (P0,P1,P2) and (P0,P2,P3). */
  triangulate(): Triangle2d[] {
    return [
      new Triangle2d(this.p0, this.p1, this.p2),
      new Triangle2d(this.p0, this.p2, this.p3),
    ];
  }

  area(): number {
    const [a, b] = this.triangulate();
    return a!.area() + b!.area();
  }

  transformed(t: Trafo2d): Quad2d {
    return new Quad2d(t.transformPos(this.p0), t.transformPos(this.p1), t.transformPos(this.p2), t.transformPos(this.p3));
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Quad2d)) return false;
    return this.p0.equals(other.p0) && this.p1.equals(other.p1)
        && this.p2.equals(other.p2) && this.p3.equals(other.p3);
  }

  approxEqual(other: Quad2d, eps: number): boolean {
    return this.p0.approxEqual(other.p0, eps) && this.p1.approxEqual(other.p1, eps)
        && this.p2.approxEqual(other.p2, eps) && this.p3.approxEqual(other.p3, eps);
  }

  getHashCode(): number {
    let h = this.p0.getHashCode();
    h = combineHash(h, this.p1.getHashCode());
    h = combineHash(h, this.p2.getHashCode());
    h = combineHash(h, this.p3.getHashCode());
    return h;
  }

  toString(): string {
    return `Quad2d(${this.p0.toString()}, ${this.p1.toString()}, ${this.p2.toString()}, ${this.p3.toString()})`;
  }
}
