// Cone3d — apex + axis (pointing from apex toward base) + half-angle.
//
// Mirrors the F# `Aardvark.Base.Cone3d` shape used by the dom intersectable.
// `direction` is **not** required to be unit-length; its length is the
// height of the (truncated) cone. `angle` is the half-angle between the
// axis and the slant surface.

import { V3d } from "../vector/v3d.js";
import { Circle3d } from "./circle3d.js";
import { combineHash, hashNumber } from "../internal/hash.js";

export class Cone3d {
  readonly origin: V3d;
  readonly direction: V3d;
  /** Half-angle (radians) between the axis and the slant surface. */
  readonly angle: number;

  constructor(origin: V3d, direction: V3d, angle: number) {
    this.origin = origin;
    this.direction = direction;
    this.angle = angle;
  }

  /** Radius of the cross-section at axial distance `h` from the apex. */
  getRadius(h: number): number {
    return h * Math.tan(this.angle);
  }

  /** Axis-aligned circle at axial distance `h` from the apex. */
  getCircle(h: number): Circle3d {
    const dl = this.direction.length();
    const n = dl === 0 ? V3d.unitZ : this.direction.mul(1 / dl);
    const center = this.origin.add(n.mul(h));
    return new Circle3d(center, this.getRadius(h), n);
  }

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof Cone3d)) return false;
    return this.origin.equals(other.origin) && this.direction.equals(other.direction) && this.angle === other.angle;
  }

  approxEqual(other: Cone3d, eps: number): boolean {
    return this.origin.approxEqual(other.origin, eps)
        && this.direction.approxEqual(other.direction, eps)
        && Math.abs(this.angle - other.angle) <= eps;
  }

  getHashCode(): number {
    return combineHash(combineHash(this.origin.getHashCode(), this.direction.getHashCode()), hashNumber(this.angle));
  }

  toString(): string {
    return `Cone3d(o=${this.origin.toString()}, d=${this.direction.toString()}, angle=${this.angle})`;
  }
}
