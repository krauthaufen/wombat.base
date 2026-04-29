// Quad3d — four corners P0..P3 in 3D (in order).

import { V3d } from "../vector/v3d.js";
import { Triangle3d } from "./triangle3d.js";
import { Trafo3d } from "../trafo/trafo3d.js";
import { combineHash } from "../internal/hash.js";

export class Quad3d {
  readonly p0: V3d;
  readonly p1: V3d;
  readonly p2: V3d;
  readonly p3: V3d;

  constructor(p0: V3d, p1: V3d, p2: V3d, p3: V3d) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
  }

  /** Splits along the P0–P2 diagonal: (P0,P1,P2) and (P0,P2,P3). */
  triangulate(): Triangle3d[] {
    return [
      new Triangle3d(this.p0, this.p1, this.p2),
      new Triangle3d(this.p0, this.p2, this.p3),
    ];
  }

  area(): number {
    const [a, b] = this.triangulate();
    return a!.area() + b!.area();
  }

  transformed(t: Trafo3d): Quad3d {
    return new Quad3d(
      t.forward.transformPos(this.p0),
      t.forward.transformPos(this.p1),
      t.forward.transformPos(this.p2),
      t.forward.transformPos(this.p3),
    );
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Quad3d)) return false;
    return this.p0.equals(other.p0) && this.p1.equals(other.p1)
        && this.p2.equals(other.p2) && this.p3.equals(other.p3);
  }

  approxEqual(other: Quad3d, eps: number): boolean {
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
    return `Quad3d(${this.p0.toString()}, ${this.p1.toString()}, ${this.p2.toString()}, ${this.p3.toString()})`;
  }
}
