// Fill-rule abstraction.
//
// A fill rule is just a predicate `(winding: number) => boolean`
// applied to each face's winding number to decide whether the face
// belongs to the filled region. Decoupling the rule from the winding
// computation lets callers swap policies without re-running any of
// the geometric work.
//
// Standard rules cover SVG / TrueType / PostScript / PDF semantics:
//
//   nonZero     — `w !== 0`            (SVG default, TrueType)
//   evenOdd     — `(w & 1) === 1`      (SVG `fill-rule: evenodd`)
//   positive    — `w > 0`              ("inside CCW only")
//   negative    — `w < 0`              ("inside CW only")
//   absGreater(k) — `Math.abs(w) > k`  (positive-or-negative ≥ k)
//   exactly(k)  — `w === k`            (a specific winding shell)
//
// User-defined rules are arbitrary `(w) => boolean` functions, e.g.
// `(w) => w >= 2 && w !== 5`.

export type FillRule = (winding: number) => boolean;

export const FillRules = {
  nonZero:  ((w: number) => w !== 0) as FillRule,
  evenOdd:  ((w: number) => (Math.trunc(w) & 1) === 1) as FillRule,
  positive: ((w: number) => w > 0) as FillRule,
  negative: ((w: number) => w < 0) as FillRule,
  absGreater: (k: number): FillRule => (w) => Math.abs(w) > k,
  exactly: (k: number): FillRule => (w) => w === k,
} as const;
