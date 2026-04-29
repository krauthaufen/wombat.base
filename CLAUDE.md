# wombat.base

TypeScript port of `Aardvark.Base` — math and geometry primitives. Vectors,
matrices, quaternions, transformations, ranges/boxes/cells, and packed
TypedArray-backed array views.

## Tooling

- `npm test` — vitest, ~660 tests across vectors, matrices, rotations, trafos,
  geometry. Add `*.operators.test.ts` next to the type for operator coverage.
- `npm run typecheck` — runs `scripts/typecheck.mjs`, which applies the
  boperators ts-morph transform manually before invoking tsc. Plain `tsc`
  rejects operator overloads on math types.
- `npm run build` — `tspc` (ts-patch wrapper) builds with the boperators
  transform plugin enabled. Emits `dist/` with `.d.ts`, `.js`, source maps.

## Operator overloading

The package depends on [`boperators`](https://github.com/DiefBell/boperators).
Math classes declare `static "+"`, `static "*"`, etc., plus instance compound
forms (`"+="`, `"*="`). The transform rewrites `a + b` to `Class["+"](a, b)`
at build time and via the language-server plugin in editors.

- **Brand**: classes carry `static readonly __aardworxMathBrand`. Old plugin
  used it; current plugin (boperators) uses class identity instead — the
  brand is dead but harmless and documents intent. Don't rely on it.
- **Compound assignment is mutating.** `r += w` rewrites to `r["+="](w)`,
  which mutates `this` in place. The previous plugin rewrote it as
  `r = r.add(w)` (rebinding); behaviour observable to aliased references
  is different. Vectors/matrices have settable `_data` so this is fine.
- **Mixed-type operators** (e.g. `Affine3d * Euclidean3d`, `Rot3d * Shift3d`)
  are declared on a class that's one of the operand types. boperators
  rejects overloads where neither LHS nor RHS matches the host class.
  See `affine3d.ts`, `scale3d.ts`, `shift3d.ts` for the cross-types we ship.

## Composition conventions

- **Standard math (`a.mul(b)` = "do b first, then a"):** Rot3d, Euclidean3d,
  Affine3d, Similarity3d, Scale3d, Shift3d, M22..M44.
- **Trafo3d / Trafo2d are inverted (`a.mul(b)` = "do a first, then b"):**
  matches `Aardvark.Base.Trafo3d` in F# so chains like `model * view * proj`
  read left-to-right. The class header comment in `trafo3d.ts` has the
  rationale; do not "fix" it.

## Storage conventions

- **Matrices are row-major.** `m._data[r * cols + c]`. `M44d.translation(v)`
  puts `v` in the last column (indices 3, 7, 11). Don't flip without
  updating every matrix file consistently.
- **Quaternions are (W, X, Y, Z).** `Rot3d._data[0]` is W (scalar part).
- **TypedArray-backed.** `_data` is `Float32Array`/`Float64Array`. Hashing
  is FNV-compatible with `@aardworx/wombat.adaptive`.
- **`viewOnto(buffer, offset)`** constructs an instance aliasing existing
  storage. Used by packed array types (`V3fArray`, etc.) so per-element
  access doesn't allocate.

## Module load order / cycles

The trafo family has cyclic imports (Affine3d ↔ Euclidean3d ↔ Similarity3d
through operator overloads). Top-level evaluation must not depend on
mid-loaded classes. Specifically:

- `Similarity3d.identity` is a **lazy getter** (`_identity ??= ...`) because
  its eager form `new Similarity3d(Euclidean3d.identity, 1)` fails when
  Scale3d→Similarity3d→Euclidean3d cycles in.
- Don't add `static readonly identity = new X(OtherClass.something)` if
  `OtherClass` participates in any cross-import. Use the lazy-getter pattern.

## Editor integration

- VS Code: `.vscode/settings.json` sets `typescript.tsdk` to the workspace
  TypeScript so the boperators tsserver plugin loads. First open prompts
  "Use Workspace Version" — accept it.
- WebStorm: `.idea/typescript-compiler.xml` points at workspace TS too.
- Both use `@boperators/plugin-ts-language-server` declared in
  `tsconfig.json` plugins. If hovers go wrong, check that tsserver is
  using the workspace TS (`Show TS Server Log` in VS Code).

## Don'ts

- Don't add new `__aardworxMathBrand` fields — boperators ignores them.
- Don't rewrite the Trafo3d composition convention — it's intentional
  (left-to-right reading), and changing it silently breaks every port from
  the F# stack.
- Don't introduce non-square matrix-matrix products (`M23 * M32 = M22`
  shape-changing) without per-pair explicit static "*" — the transformer
  needs each result type spelled out.
- Don't `npm run build` and ship `dist/` from a dirty branch. CI runs
  `prepublishOnly` (typecheck + test + build) before any publish.
