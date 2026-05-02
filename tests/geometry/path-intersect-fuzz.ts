// Subdivision+Newton ground-truth intersection solver, used by the
// fuzz tests in path-intersect.test.ts to cross-check the analytic
// solvers on randomized inputs.
//
// Algorithm:
//   1. Recursively split both segments at t=0.5 while their tight
//      bounding boxes overlap.
//   2. When both halves are below `boxTol` in size, emit the midpoint
//      parameter as a coarse intersection seed.
//   3. Newton-refine each seed by minimising |a(ta) - b(tb)|² over the
//      pair (ta, tb) until step size drops below `posTol`.
//   4. Cluster duplicates within `posTol` in parameter space.

import type { PathSegment } from "../../src/geometry/path/segment.js";

interface Hit { ta: number; tb: number; }

function bboxOverlap(a: PathSegment, b: PathSegment, slack: number): boolean {
  const ba = a.bounds(), bb = b.bounds();
  return !(ba.max.x + slack < bb.min.x
        || bb.max.x + slack < ba.min.x
        || ba.max.y + slack < bb.min.y
        || bb.max.y + slack < ba.min.y);
}

export function intersectionsRef(
  a: PathSegment, b: PathSegment,
  posTol: number = 1e-10,
  maxDepth: number = 30,
): Array<[number, number]> {
  const seeds: Hit[] = [];
  function recurse(
    aa: PathSegment, ta0: number, ta1: number,
    bb: PathSegment, tb0: number, tb1: number,
    depth: number,
  ): void {
    if (!bboxOverlap(aa, bb, 1e-12)) return;
    const aSize = Math.max(aa.bounds().size().x, aa.bounds().size().y);
    const bSize = Math.max(bb.bounds().size().x, bb.bounds().size().y);
    if (depth >= maxDepth || (aSize < 1e-7 && bSize < 1e-7)) {
      seeds.push({ ta: (ta0 + ta1) * 0.5, tb: (tb0 + tb1) * 0.5 });
      return;
    }
    const [aL, aR] = aa.split(0.5);
    const [bL, bR] = bb.split(0.5);
    const taM = (ta0 + ta1) * 0.5, tbM = (tb0 + tb1) * 0.5;
    recurse(aL, ta0, taM, bL, tb0, tbM, depth + 1);
    recurse(aL, ta0, taM, bR, tbM, tb1, depth + 1);
    recurse(aR, taM, ta1, bL, tb0, tbM, depth + 1);
    recurse(aR, taM, ta1, bR, tbM, tb1, depth + 1);
  }
  recurse(a, 0, 1, b, 0, 1, 0);

  // Newton refinement on F(ta, tb) = a(ta) - b(tb).
  // Jacobian columns: [∂F/∂ta, ∂F/∂tb] = [a'(ta), -b'(tb)]
  // Solve J · δ = -F by Cramer; step ta += δ.ta, tb += δ.tb.
  const refined: Hit[] = [];
  for (const s of seeds) {
    let ta = s.ta, tb = s.tb;
    let converged = false;
    for (let iter = 0; iter < 40; iter++) {
      const pa = a.eval(ta), pb = b.eval(tb);
      const fx = pa.x - pb.x, fy = pa.y - pb.y;
      if (fx * fx + fy * fy < posTol * posTol) { converged = true; break; }
      const da = a.derivative(ta), db = b.derivative(tb);
      // det(J) = a'.x · (-b'.y) − (-b'.x) · a'.y = b'.x · a'.y − a'.x · b'.y
      const det = db.x * da.y - da.x * db.y;
      if (Math.abs(det) < 1e-20) break;
      // δ.ta = (−F.x · (−b'.y) − (−b'.x) · (−F.y)) / det = (b'.y · F.x − b'.x · F.y) / det
      // δ.tb = (a'.x · (−F.y) − (−F.x) · a'.y) / det = (a'.y · F.x − a'.x · F.y) / det
      const dTa = (db.y * fx - db.x * fy) / det;
      const dTb = (da.y * fx - da.x * fy) / det;
      ta += dTa;
      tb += dTb;
      if (ta < -0.01 || ta > 1.01 || tb < -0.01 || tb > 1.01) break;
    }
    if (!converged) continue;
    if (ta < -1e-6 || ta > 1 + 1e-6 || tb < -1e-6 || tb > 1 + 1e-6) continue;
    ta = Math.max(0, Math.min(1, ta));
    tb = Math.max(0, Math.min(1, tb));
    let dup = false;
    for (const r of refined) {
      if (Math.abs(r.ta - ta) < 1e-6 && Math.abs(r.tb - tb) < 1e-6) { dup = true; break; }
    }
    if (!dup) refined.push({ ta, tb });
  }
  refined.sort((x, y) => x.ta - y.ta);
  return refined.map(h => [h.ta, h.tb] as [number, number]);
}
