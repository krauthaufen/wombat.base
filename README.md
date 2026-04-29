# aardvark-ts

A TypeScript port of `Aardvark.Base.Math` and `Aardvark.Base.Geometry`
— the primitive math types every renderer / CAD pipeline / point-cloud
tool ends up needing. Published as `@aardworx/aardvark-ts`.

This is a foundation library: pure data types and pure functions. No
DOM, no WebGL, no adaptive, no JSX. Other packages (`tshade`,
`adaptive-ui` extensions, future `aardvark-rendering` ports) sit on
top.

## Why this exists

The TS port of the Aardvark stack progresses bottom-up:

1. [`@aardworx/adaptive`](https://github.com/krauthaufen/adaptive-ts) — incremental computations. ✓
2. [`@aardworx/adaptive-ui`](https://github.com/krauthaufen/adaptive-ui) — adaptive direct-DOM JSX runtime. ✓
3. **`@aardworx/aardvark-ts`** — math/geometry primitives. *(this repo)*
4. [`tshade`](https://github.com/krauthaufen/tshade) — F#-style shader DSL with composition + cross-stage I/O elimination.
5. (later) `aardvark-rendering`-equivalent — scene graph, pipelines.

`tshade` and any rendering pipeline both want operators on `V3f` /
`M44f` / etc. on the **CPU side** (for camera matrices, instance
transforms, point-cloud filtering — anything that runs in JS, not in
the shader). So this package has to land before either of those
becomes ergonomic.

## Scope

In scope:

- All vector / matrix / quaternion / rotation / Euclidean / similarity
  / affine / Trafo types in the dimensions and element types listed
  in [`docs/SCOPE.md`](docs/SCOPE.md), with the **Aardvark naming
  convention** (`V2f`, `V3i`, `M44d`, `Trafo3d`, `Rot3d`,
  `Euclidean3d`, …).
- Correct precision semantics under the constraint that TS only has
  `number` (IEEE 754 double): `V2i` truncates to int32, `V3ui`
  truncates to uint32, `V2f` rounds to f32, `V2d` is f64 directly,
  `V3b` is boolean. Every numeric type is backed by a `TypedArray`
  view so the arithmetic semantics match the named element type.
- **Array views**: `V2fArray`, `V3iArray`, `M44dArray`, `C4bArray`,
  etc. — packed `ArrayBuffer`-backed sequences, the JS analogue of
  `Float32Array` but element-typed. Indexing yields scalar
  components or vector / matrix instances; the buffer can be passed
  straight to WebGL/WebGPU as VBO data without re-packing. Same
  layout as `Aardvark.Base.V3fArray` etc.
- Standard linear algebra: matrix multiply, transpose, inverse,
  determinant; SVD, QR, LU; symmetric eigen-decomposition.
- Geometry primitives: `Box2*`/`Box3*`, `Range1*`, `Plane3d`,
  `Ray3d`, `Line3d`, `Triangle3d`, `Sphere3d`, `Polygon2d`/`3d`.
- Quaternion utilities, rotation conversions, spherical interpolation.
- Hashing + structural equality for use as `HashMap` keys (compatible
  with `@aardworx/adaptive`'s `defaultHash`/`defaultEquals`).
- Deterministic PRNGs and random-vector helpers (XoroShiro128+).

Out of scope, at least for v0.1:

- 64-bit integer vector / matrix types (`V2l`, `M44l`). JS `BigInt`
  is slow and the use cases on the Web are thin. Document as future
  work.
- 16-bit-half-precision types. WebGL / WebGPU expose them, but
  TypeScript cannot represent them outside a `Uint16Array` payload.
- Full computational geometry: convex hull algorithms, mesh
  decimation, polygon triangulation, BVH builders. These belong in a
  separate `aardvark-geometry` package later.
- Spatial indices (KD-tree, octree). Same reason.
- Color-space conversions beyond linear↔sRGB. Live in a future
  `aardvark-color` package.
- File I/O, serialization formats, scientific-notation parsers,
  string utilities. None of this is the math layer's job.

## Operator overloading

`@aardworx/aardvark-operators` is wired into the build (via `ts-patch`
+ `tspc`) and into vitest (via a small inline Vite plugin in
`vitest.config.ts`). Every numeric primitive declares a static
`__aardworxMathBrand` so the plugin recognises it. Source code can
use `+`/`-`/`*`/`/`/`%`/unary-`-`/comparisons/compound-assignment;
the build emits the corresponding method calls.

Method API works regardless — write `a.add(b)` if you prefer; the
plugin sugar is opt-in per consumer project.

### Using in WebStorm / VS Code

After `npm install`, the workspace's `tsconfig.json` declares the
language-service plugin:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "transform": "@aardworx/aardvark-operators" },
      { "name": "@aardworx/aardvark-operators/lang-service" }
    ]
  }
}
```

In **WebStorm**: `Settings → Languages & Frameworks → TypeScript`,
make sure the TypeScript service uses the project's bundled compiler
(`node_modules/typescript`). The language-service plugin loads
automatically; operator usage on math types stops being underlined.

In **VS Code**: open a `.ts` file in the workspace and run
`> TypeScript: Select TypeScript Version` → "Use Workspace Version".
Same outcome.

In **Neovim** (via `nvim-lspconfig` + `tsserver`): no extra config
needed — tsserver picks up the `plugins` from `tsconfig.json`
automatically.

### Limitations of editor support (current v0.1)

- Operator diagnostics are suppressed, but TS still infers the result
  of `a + b` as the inferred-error type (often `any` or the wider
  union). Hover-over may show the wrong type. The build is correct
  regardless because the transformer rewrites to method calls before
  type checking matters.
- Compound assignment (`+=`) on complex l-values (`arr[i++].field`)
  evaluates the LHS twice. Use plain `=` rebinding for those cases.

## What's documented where

- [`docs/SCOPE.md`](docs/SCOPE.md) — the full type taxonomy, naming
  convention, storage model, array-view design, algorithm list, and
  phased roadmap. Read this first before writing code.
- [`docs/STORAGE.md`](docs/STORAGE.md) — concrete storage layout for
  every primitive: which TypedArray backs each type, byte size,
  alignment, and the V8/SpiderMonkey performance notes that drove the
  choices.

(Both will land in subsequent commits.)

## License

MIT.
