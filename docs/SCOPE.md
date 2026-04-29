# aardvark-ts — scope and design

This document is the canonical specification of what `@aardworx/aardvark-ts`
ships in v0.1, with the naming, precision, storage, and array-view
contracts every implementer needs to honour. Read it before writing
or reviewing code in this repository.

## 1. Goals and constraints

### Hard constraints from JS / TS

1. **Only `number` exists.** Every JS number is IEEE 754 binary64.
   There is no native `int32`, `uint32`, `float32`, or `byte`.
2. **TypedArrays preserve element semantics.** `Float32Array[i] = 1.1`
   stores the f32 round of 1.1; reading back gives the f32 value. The
   same is true for `Int32Array` (truncate / sign-extend), `Uint32Array`
   (truncate / wrap modulo 2³²), `Uint8Array` / `Int8Array` /
   `Uint16Array` / `Int16Array`, and `Float64Array`.
3. **`Object.is` and `===` compare object identity, not value.** Any
   structural equality has to be implemented explicitly.
4. **No operator overloading at the language level.** Until the
   `@aardworx/aardvark-operators` plugin lands, callers write
   `a.add(b)`. After it lands, writers can use `a + b` and the build
   step rewrites to method calls. Either way, the IR / runtime
   semantics are the same.
5. **Allocation is the bottleneck.** Hot paths (vertex transforms,
   point-cloud filtering, raycasts) cannot afford a fresh `V3f` per
   iteration. The API has to expose alloc-free variants for every
   non-trivial operation.

### Design rules that fall out of those

- Every numeric primitive (`V*`, `M*`, `C*`, `Range1*`, `Box*`) is
  **backed by a `TypedArray`**. The TypedArray's element type matches
  the primitive's named element type (`V3f` ↔ `Float32Array(3)`,
  `V2i` ↔ `Int32Array(2)`, `M44d` ↔ `Float64Array(16)`,
  `C4b` ↔ `Uint8Array(4)`). This makes precision rules automatic
  rather than enforced manually with `| 0` masks.
- Standalone instances and array-view elements use the **same
  storage layout**. A `V3f` obtained from `V3fArray.get(i)` has bit-
  for-bit identical bytes to one constructed via `V3f(x, y, z)`.
- Every binary operation has at least three forms: pure (`a.add(b) →
  V3f`), in-place into a target (`V3f.add(a, b, target)` writing into
  `target`), and direct on the array view (`V3fArray.add(arr, i,
  rhs)`). The pure form is the default; the others are escape hatches
  for hot loops.
- Equality methods exist on every type and are compatible with
  `@aardworx/adaptive`'s `defaultHash` / `defaultEquals`. `V3f`
  equality is component-wise `===` over the f32 stored values
  (which is what people mean by "vector equality" 99% of the time).
  Tolerance comparisons live on a separate `approxEqual(a, b, eps)`.

## 2. Naming convention

Verbatim Aardvark.Base, with the following element-type suffixes:

| Suffix | Element       | Backing                     | Notes                                  |
| :----: | ------------- | --------------------------- | -------------------------------------- |
| `b`    | bool          | `Uint8Array` (0 / 1)        | Vector / matrix only                   |
| `b` (color only) | byte (u8)   | `Uint8Array` (0–255) | `C3b` / `C4b` only — disambiguated by family |
| `i`    | int32 signed  | `Int32Array`                |                                        |
| `ui`   | uint32        | `Uint32Array`               |                                        |
| `f`    | float32       | `Float32Array`              |                                        |
| `d`    | float64       | `Float64Array`              |                                        |

The `b` collision (bool in `V3b`, byte in `C3b`) follows Aardvark.Base
exactly. The family prefix (`V` vs `C`) disambiguates.

Out of v0.1: `l` (int64 / `BigInt64Array`), `ul` (uint64), `h` (f16),
`s` (int16), `us` (uint16). Documented as future work; not blocking
the rendering layer.

## 3. Type taxonomy

### 3.1 Vectors

```
V2b, V3b, V4b              — boolean vectors (2/3/4 components)
V2i, V3i, V4i              — int32 vectors
V2ui, V3ui, V4ui           — uint32 vectors
V2f, V3f, V4f              — float32 vectors
V2d, V3d, V4d              — float64 vectors
```

Every vector exposes:

- Component getters / setters: `x`, `y`, `z`, `w` (where applicable).
  Numeric-type vectors store via TypedArray indexing so writes
  truncate / round / wrap appropriately. Boolean vectors store via
  `Uint8Array` and treat any nonzero as true on read.
- Common static factories: `zero`, `one`, `unitX/Y/Z/W`, `axis(d)`.
- Conversions: `as*()` returns a fresh vector of the target element
  type. Numeric: each component is read as `number` and stored via
  the target's TypedArray (so `V3f.asV3i()` truncates toward zero
  per `Int32Array` semantics).
- Arithmetic — only on numeric (non-bool) vectors:
  - `add`, `sub`, `mul`, `div`, `mod` — vector-vector and vector-scalar
  - `neg`
  - `mulComp(other)` — Hadamard product (alias for `mul` of two vectors)
  - `dot`, `cross` (V3 only), `length`, `lengthSquared`
  - `normalize`, `normalizeSafe`
  - `lerp(a, b, t)`
  - `min`/`max` component-wise; `clamp(min, max)`
  - `abs`, `floor`, `ceil`, `round`, `fract`, `sign`
- Component-wise comparison — only on numeric vectors:
  - `lt`, `le`, `gt`, `ge`, `eq`, `neq` returning the matching `V*b`
- Reductions:
  - `any`, `all` (on `V*b`)
  - `minComp`, `maxComp`, `sumComp` (on numeric)
- Equality:
  - `equals(other)` — exact bit-equal on backing TypedArray
  - `approxEqual(other, eps)`
- Hashing:
  - `getHashCode()` — combines component hashes; matches the convention
    used by `@aardworx/adaptive`'s `HashMap`.
- Iteration:
  - `[Symbol.iterator]()` yields `x, y, z, w` in order so spread /
    `Array.from` / destructuring work.

### 3.2 Matrices

Square matrices in every numeric element type:

```
M22i, M22ui, M22f, M22d
M33i, M33ui, M33f, M33d
M44i, M44ui, M44f, M44d
```

Rectangular matrices in float types only:

```
M23f, M24f, M32f, M34f, M42f, M43f
M23d, M24d, M32d, M34d, M42d, M43d
```

Notation: `M{rows}{cols}{element}`. So `M44f` is 4×4 f32; `M23f` is
2 rows × 3 cols f32 (matches Aardvark.Base; opposite of GLSL's
`mat2x3` which is 2 *cols* × 3 *rows*).

**Storage is column-major** for compatibility with WebGL and WGSL
uniform layouts: `m.M00` lives at index 0, `m.M10` at index 1,
`m.M01` at index `rows`, …, `m.M(rows-1)(cols-1)` at index
`rows*cols-1`. (Aardvark.Base.M44d is also column-major in memory,
so this matches.)

API per matrix:

- Element accessors `M00`, `M01`, …, `M{r}{c}` (zero-based, row first
  in the *name*, column-major in storage). Plus `m.row(i)` / `m.col(j)`
  returning a vector of the correct length and element type.
- Static factories: `identity`, `zero`, `fromRows([...])`, `fromCols([...])`,
  `fromArray(flatColumnMajor)`, `diagonal(v)`.
- Construction helpers (where geometrically meaningful):
  - `M44f.translation(V3f)`
  - `M44f.scaling(V3f)` and `M44f.scalingUniform(s)`
  - `M44f.rotationX/Y/Z(rad)` (and `M44d.*`)
  - `M44d.lookAt(eye, target, up)`
  - `M44d.perspectiveProjection(fovY, aspect, near, far)`
  - `M44d.orthographicProjection(left, right, bottom, top, near, far)`
  - `M33f.fromRotationAxes(...)`, `M33f.fromQuaternion(Rot3f)`
- Arithmetic:
  - `add`, `sub`, `mul` (matrix-matrix), `mul(scalar)` (matrix-scalar),
  - `transpose`, `inverse`, `determinant`
  - `transform(v)` — vec×mat via the canonical convention (matrix
    times column vector). For `M{r}{c}` this is `v: V{c}{elem} →
    V{r}{elem}`. Convenience `transformPos` / `transformDir` on
    `M44d` for affine homogeneous transforms.
- Decompositions (square only): `lu()`, `qr()`, `svd()`, `eigenSym()`
  for symmetric. (See §6.)
- Equality / hashing as for vectors.

### 3.3 Colors

```
C3b, C4b                   — byte colors (0–255 per channel)
C3us, C4us                 — uint16 colors
C3f, C4f                   — float32 colors (linear, [0..1])
C3d, C4d                   — float64 colors (linear, [0..1])
```

Backed by the matching TypedArray. All conversions between byte and
float forms apply the standard 0–255 ↔ 0.0–1.0 mapping with rounding
to nearest. Channel order is `R, G, B, A` (alpha last; RGBA matches
WebGL packing). Linear-space throughout; sRGB conversions are
explicit `srgbToLinear` / `linearToSrgb` helpers, never automatic.

C-types live in their own family because:

- `C3b` is a byte color with [0, 255] semantics; `V3i` is an integer
  vector with [-2³¹, 2³¹) semantics. Different domains, different
  algebra (saturating-add for colors makes sense; for V3i it would be
  surprising). Keeping them in separate families avoids the
  ambiguity.
- The shape of the API differs: `C4f.lerp` is `mix`-style perceptual,
  whereas `V3f.lerp` is straight linear interpolation. The same
  spelling for both would mislead.

### 3.4 Quaternions and rotations

```
Rot2f, Rot2d               — 2D rotation (single angle scalar)
Rot3f, Rot3d               — 3D rotation as unit quaternion
```

`Rot3*` storage: `(W, X, Y, Z)` with `W` being the scalar part — this
matches `Aardvark.Base.Rot3d`. Backed by `Float32Array(4)` /
`Float64Array(4)`.

API:

- Static factories: `identity`, `fromAxisAngle(axis, rad)`,
  `fromEuler(roll, pitch, yaw, order)`, `fromMatrix(M33d)`,
  `fromTwoVectors(from, to)`, `fromYawPitchRoll(...)`.
- `mul(other)` — quaternion multiplication.
- `inverse`, `conjugate`, `length`, `normalize`.
- `transform(V3d)` — rotates the vector.
- `slerp(from, to, t)`, `nlerp`.
- Conversions: `toAxisAngle()`, `toMatrix(): M33d`,
  `toEuler(order): V3d`, `toMatrixHomogeneous(): M44d`.

`Rot2*`: stores a scalar `radians`. Operations are scalar; `transform`
applies the 2D rotation matrix.

### 3.5 Transformations

Every transformation is **double-precision**. Single-precision variants
of these are rarely useful in CAD/GIS scenarios and are not shipped in
v0.1.

```
Shift3d                    — V3d translation
Scale3d                    — V3d non-uniform scale (about the origin)
Rot3d                      — see §3.4 (cross-listed here)
Euclidean3d                — Rot3d + V3d (rigid body)
Similarity3d               — Euclidean3d + uniform scale (4 dof orient + scale)
Affine3d                   — M33d + V3d (general affine)
Trafo3d                    — full M44d forward + M44d backward, kept in sync
Shift2d, Scale2d, Rot2d,
  Euclidean2d, Similarity2d,
  Affine2d, Trafo2d        — 2D analogues
```

API per transformation:

- Identity factory and the obvious from-components constructors.
- `transform(V3d)` for points (extending homogeneous as needed),
  `transformDir(V3d)` for directions (no translation), and
  `transformPos(V3d)` as an alias for points where it aids
  readability.
- Composition via `mul` / `then`. `a.then(b)` reads as "do `a`, then
  `b`" — `b * a` in matrix-times-column-vector convention.
- `inverse()` — every transform has a closed-form inverse. `Trafo3d`
  caches the backward matrix, so `inverse` swaps refs.
- Conversions: `Euclidean3d.toMatrix(): M44d`, `Trafo3d.fromMatrix
  (M44d)` (computes the backward via `inverse`).
- Equality / hashing.

Trafo3d is the workhorse — the type a camera or scene-graph node
holds. Forward and backward matrices are stored explicitly so
inverse-transform calls don't recompute every frame.

### 3.6 Bounding boxes / ranges

```
Range1i, Range1f, Range1d  — 1D interval [Min, Max]
Box2i, Box3i, Box2f, Box3f, Box2d, Box3d
```

- Static factories: `empty` (Min = +∞, Max = −∞ — the F# convention
  so `extend` works), `unit`, `fromCenterRadius`, `fromMinMax`,
  `fromPoints`, `fromBoxes`.
- `isEmpty`, `isValid`, `size`, `center`, `extents`, `volume`
  (3D) / `area` (2D), `surfaceArea`.
- `extend(point | box)` — returns a new box (does not mutate).
- `contains(point | box)`, `intersects(box | sphere | ray)`,
  `intersection(other)`, `union(other)`.
- `transformed(Trafo3d)` — recomputes the AABB after applying the
  transform (8-corner enumeration; not the tightest-AABB-of-rotated-
  AABB, but matches Aardvark behaviour).

### 3.7 Geometry primitives

These are simple data types with companion operations. Heavier
algorithms live in a future `aardvark-geometry` package.

```
Plane3d                    — n·x = d
Ray2d, Ray3d               — origin + direction
Line2d, Line3d             — two endpoints
Triangle2d, Triangle3d     — three vertices
Polygon2d, Polygon3d       — array of points
Sphere3d                   — center + radius
Circle2d, Circle3d         — center + radius (3D form is oriented)
Quad2d, Quad3d             — four corners
```

Every primitive ships:

- Constructors / factories.
- `closestPoint(p)`, `distance(p)`, `signedDistance(p)` where
  meaningful.
- `intersects(other)` / `intersection(other)` for the primitive pairs
  that have closed-form intersections (`Ray3d ∩ Plane3d`, `Ray3d ∩
  Sphere3d`, `Box3d ∩ Plane3d`, `Box3d ∩ Triangle3d`, `Plane3d ∩
  Plane3d`, …). Documented in `Geometry.md` (next round of docs).
- `transformed(Trafo3d)`.

### 3.8 Cells

```
Cell                       — 3D octree cell (Vec3<i64> exp + Vec3<i64> origin)
Cell2d                     — 2D quadtree cell
```

Aardvark.Base.Cell uses `int64` for the exponent and origin
coordinates. We use `BigInt` for these specific fields (cells are
allocated rarely and are a small cost compared to the octree
operations they support). The rest of the package avoids `BigInt`
because of its perf cost.

API mirrors Aardvark.Base.Cell: `parent`, `children`, `contains
(point | cell)`, `boundingBox`, `intersects(box)`,
`commonRoot(other)`, etc.

## 4. Storage and array views

This section is the design backbone — the actual memory layout that
makes `V3fArray` cheap to send to WebGL and the in-place arithmetic
APIs possible. Concrete byte sizes and alignment rules go in
`docs/STORAGE.md`. Here, the architectural shape:

### 4.1 The standalone vs. view duality

Every numeric primitive class has two construction paths:

1. **Owned storage** — the primitive allocates its own `TypedArray`
   of the right length on construction. This is what `new V3f(x, y, z)`
   does.
2. **View into an external buffer** — the primitive references an
   existing `ArrayBuffer` at a given byte offset. Mutations write
   through to the buffer. This is what `V3fArray.viewAt(i)` returns.

Both forms share the same prototype and the same accessor logic.
The difference is who owns the underlying bytes.

```ts
class V3f {
  /** @internal */ readonly _data: Float32Array;     // length 3 view
  // owned ctor
  constructor(x = 0, y = 0, z = 0) {
    this._data = new Float32Array(3);
    this._data[0] = x; this._data[1] = y; this._data[2] = z;
  }
  // unsafe view ctor — used by V3fArray
  static viewOnto(buffer: ArrayBuffer, byteOffset: number): V3f { /* ... */ }
  get x(): number { return this._data[0]!; }
  set x(v: number) { this._data[0] = v; }
  // ...
}
```

This makes arithmetic uniform: `V3f.add(a, b, target)` writes into
`target._data`, and it doesn't matter whether `target` is owned or a
view onto an `ArrayBuffer`. Vertex transforms can write straight into
a VBO-shaped buffer without ever round-tripping through fresh objects.

### 4.2 Array views

Every primitive has a corresponding `*Array` companion:

```
V2bArray, V3bArray, V4bArray
V2iArray, V3iArray, V4iArray
V2uiArray, V3uiArray, V4uiArray
V2fArray, V3fArray, V4fArray
V2dArray, V3dArray, V4dArray
M22fArray, M33fArray, M44fArray, M22dArray, M33dArray, M44dArray, …
C3bArray, C4bArray, C3fArray, C4fArray
Rot3fArray, Rot3dArray
```

Each is a thin wrapper over an `ArrayBuffer` plus a typed view of
the matching element type. Layout is **packed AoS** — a `V3fArray`
of length N is a `Float32Array` of length 3·N, with element `i`'s
components at indices `[3i, 3i+1, 3i+2]`. This is the layout WebGL
expects for `gl.vertexAttribPointer(..., size=3, type=FLOAT,
stride=12, offset=0)`, so the buffer flows straight to the GPU
without re-pack.

```ts
class V3fArray {
  readonly buffer: ArrayBuffer;
  readonly length: number;
  /** @internal */ readonly _data: Float32Array;     // length 3*length

  constructor(length: number);                                 // allocates fresh
  static fromBuffer(buf: ArrayBuffer, length: number): V3fArray;  // wraps existing
  static fromIterable(values: Iterable<V3f>): V3fArray;

  /** Returns a fresh V3f with the i-th element's values copied out. */
  get(i: number): V3f;

  /** Writes the i-th element's components into `target`'s storage. Avoids allocation. */
  getInto(i: number, target: V3f): V3f;

  /** Returns a V3f that *aliases* the i-th element. Mutating it mutates this array. */
  viewAt(i: number): V3f;

  /** Sets the i-th element from a V3f. */
  set(i: number, value: V3f): void;

  /** Direct component access — fastest path, avoids any V3f. */
  x(i: number): number;
  y(i: number): number;
  z(i: number): number;
  setX(i: number, v: number): void;
  setY(i: number, v: number): void;
  setZ(i: number, v: number): void;

  /** Iteration — each yielded V3f is a fresh allocation. */
  [Symbol.iterator](): IterableIterator<V3f>;
  /** Iteration with a reusable scratch — preferred for hot loops. */
  forEachInto(scratch: V3f, fn: (v: V3f, i: number) => void): void;

  /** Bulk operations operating directly on the buffer. */
  fill(value: V3f): void;
  copyFrom(other: V3fArray): void;
  slice(start?: number, end?: number): V3fArray;
  subarray(start?: number, end?: number): V3fArray;     // view, shared buffer
  toArray(): V3f[];

  /** SIMD-friendly bulk math. */
  addInPlace(rhs: V3fArray | V3f): void;
  scaleInPlace(s: number): void;
  transformInPlace(m: M44f): void;        // applies an M44f to every element
}
```

Two access patterns matter:

- **Random / occasional access** — `arr.get(i)` returns a fresh
  copy. Safe to keep a reference; mutating it doesn't touch the
  array. This is the default.
- **Hot-loop access** — `arr.forEachInto(scratch, (v, i) => …)`.
  `scratch` is reused; the callback gets a `V3f` whose `_data` is
  a *view* over the i-th element, so reads and writes go straight
  into the buffer. Zero allocations per iteration.

Direct component accessors `arr.x(i)`/`arr.y(i)`/`arr.z(i)` skip the
V3f wrapper entirely and exist for the hottest loops.

### 4.3 Why every primitive is TypedArray-backed

A naive design would store `V3f` as `{ x: number; y: number; z:
number }` and only use TypedArrays for the array views. That has two
problems:

1. **Precision divergence.** `new V3f(1.1, 0, 0).x` would return
   1.1 (f64), but `V3fArray.fromIterable([new V3f(1.1, 0, 0)]).get(0).x`
   would return the f32 round of 1.1, ≈ 1.100000023841858. Two
   apparently-equal V3f instances disagree on their components. The
   bug surface from this is enormous and silent.
2. **Conversion fragmentation.** `V3fArray.set(i, new V3f(...))`
   would have to copy and round; `V3fArray.viewAt(i)` would have to
   return a *different* class to enforce f32 semantics. That bifurcates
   the API.

Backing every `V3f` by a `Float32Array(3)` makes precision identical
in both forms and lets the same prototype service standalone and view
instances. The heap cost is real (one extra `ArrayBuffer` allocation
per `V3f`) but uniform across the API, and V8's inline caches handle
the indexed read/write cleanly.

For the boolean variants (`V2b`/`V3b`/`V4b`), backing is `Uint8Array`
with `0` / `1` — `set x(v: boolean)` writes `v ? 1 : 0`,
`get x(): boolean` returns `data[0] !== 0`. Same uniformity as the
numeric types.

### 4.4 What we don't do

- **No SoA layouts.** AoS only for v0.1. SoA (e.g. `V3fArrayPlanar`
  with separate `xs`, `ys`, `zs` arrays) wins for SIMD-style bulk
  operations but loses for GPU upload. We can add a separate
  `aardvark-soa` package later.
- **No interleaved vertex layouts.** A vertex with `position: V3f` +
  `normal: V3f` + `uv: V2f` would be packed by an interleaved buffer
  in the rendering layer. That's not this package's job.
- **No alignment padding.** A `V3fArray` of length N is exactly
  `12·N` bytes. WGSL's std140 requires `vec3` to pad to `vec4` size
  in uniform buffers; that padding is the rendering layer's
  responsibility, not ours.
- **No detachable buffer support.** If you transfer the underlying
  `ArrayBuffer` away (e.g. to a Web Worker), the array becomes
  invalid. We don't try to reattach.

## 5. Uniform algebraic surface

To keep the per-type API surface manageable and discoverable, every
type implements as much of a small canonical interface as is
geometrically sensible:

```ts
interface AlgebraicLike<Self> {
  equals(other: Self): boolean;
  approxEqual(other: Self, eps: number): boolean;
  hashCode(): number;
  toString(): string;
}

interface AdditiveGroup<Self> extends AlgebraicLike<Self> {
  add(other: Self): Self;
  sub(other: Self): Self;
  neg(): Self;
}

interface VectorSpace<Self> extends AdditiveGroup<Self> {
  mul(scalar: number): Self;
  div(scalar: number): Self;
}
```

Vectors implement `VectorSpace`. Matrices implement `VectorSpace`
(with element-scalar mul) plus matrix multiplication as `mul(m)`.
Quaternions implement `mul(q)` and `inverse()`. Transformations
implement `mul(t)` (composition) and `inverse()`. Boxes implement
`extend` / `union`.

This is what the operator-rewriting plugin keys off of: it sees an
operand of type `T`, checks for the corresponding method on `T`, and
emits the call. Sticking to the canonical method names lets the
plugin be type-driven without per-type configuration.

## 6. Algorithms

### 6.1 Linear algebra

- **Matrix inverse** — closed-form for `M22*`/`M33*`/`M44*`. Falls
  back to LU for larger or rectangular cases (rectangular only for
  pseudo-inverse via SVD).
- **LU decomposition** with partial pivoting. Works on any square
  numeric matrix.
- **QR decomposition** via Householder. Works on rectangular
  matrices.
- **SVD** (Jacobi for ≤4×4, two-sided Jacobi for larger). Returns
  `{ u, s, v }` where `s` is a vector of singular values in
  descending order.
- **Symmetric eigen-decomposition** via Jacobi. Returns
  `{ eigenvalues: Vec, eigenvectors: Mat }` with eigenvalues in
  descending order.
- **Cholesky** for SPD matrices.
- **Linear solve** `Ax = b` and **least-squares solve** with
  rank-deficient handling.

All of these accept either a `M{N}d` or a `M{N}f` and return the
matching element type. They are the parts of the library where
operator overloading earns its keep — see `docs/OPERATORS.md` (later
round of docs) for code samples that justify the plugin.

### 6.2 Quaternion / rotation utilities

- `Rot3d.slerp(a, b, t)` and `nlerp`.
- Conversion between axis-angle, Euler (all six orders),
  rotation matrix, and quaternion.
- `lookRotation(forward, up)`.
- `relativeRotation(from, to)`.
- `swingTwistDecomposition(q, axis): { swing, twist }` — useful for
  IK rigs.

### 6.3 Geometry helpers

- Closest-point pairs: `closestPointOn{Plane, Line, Triangle, Sphere}`.
- Ray hit-tests against `Plane3d`, `Sphere3d`, `Box3d`, `Triangle3d`.
- Plane-from-three-points; plane intersection.
- Triangle area, normal, barycentric coordinates.
- Polygon area (signed, 2D), winding, point-in-polygon.

### 6.4 Random

- XoroShiro128+ generator with seedable state. Gives `nextFloat()` in
  `[0, 1)`, `nextInt(min, max)`, `nextV3f()` in unit cube,
  `nextDirectionV3f()` uniform on sphere, `nextRotation(): Rot3d`
  uniform on SO(3), `nextInBox(box): V3*`, `nextInSphere(s): V3*`.
- Halton / Sobol low-discrepancy sequences (deferred — not v0.1).

### 6.5 Constants and free functions

- Math constants: `PI`, `TAU` (`2π`), `HALF_PI`, `EPS_F`, `EPS_D`,
  `DEG_TO_RAD`, `RAD_TO_DEG`.
- Scalar helpers: `clamp`, `lerp`, `smoothstep`, `smootherstep`,
  `fract`, `wrap`, `step`, `sign0` (sign returning 0 for 0),
  `nearestPowerOfTwo`, `isPowerOfTwo`, `log2Floor`, `log2Ceil`.
- These live as free exports, not on a class.

## 7. Hashing and equality

Hashing must be compatible with `@aardworx/adaptive`'s
`defaultHash` so vector / matrix / box instances can sit as keys in
its `HashMap` / `HashSet`.

- Every primitive defines `getHashCode(): number` returning a 32-bit
  integer (matching the method name `@aardworx/adaptive`'s
  `defaultHash` looks for via the `CustomEquatable` interface).
- The hash combines component hashes via the FNV-style mix used in
  `@aardworx/adaptive`'s `equality.ts`. Component hashes for `number`
  go through the same `defaultHash(n)` so float quirks (NaN, ±0) are
  handled consistently across the stack.
- `equals(other)` is exact bit-equality on the backing `TypedArray`.
- `approxEqual(other, eps)` does component-wise `|a - b| ≤ eps`.

## 8. Package layout

```
aardvark-ts/
├─ package.json                # @aardworx/aardvark-ts
├─ tsconfig.json
├─ tsconfig.build.json
├─ vitest.config.ts
├─ src/
│  ├─ index.ts                 # public barrel: every type and free fn
│  ├─ scalar.ts                # constants + lerp/clamp/etc.
│  ├─ random/
│  │  └─ xoroshiro.ts
│  ├─ vector/
│  │  ├─ v2b.ts, v3b.ts, v4b.ts
│  │  ├─ v2i.ts, v3i.ts, v4i.ts
│  │  ├─ v2ui.ts, v3ui.ts, v4ui.ts
│  │  ├─ v2f.ts, v3f.ts, v4f.ts
│  │  ├─ v2d.ts, v3d.ts, v4d.ts
│  │  └─ array/
│  │     └─ v2fArray.ts, v3fArray.ts, …                # one file per ArrayView
│  ├─ matrix/
│  │  ├─ m22f.ts, m33f.ts, m44f.ts, m22d.ts, …
│  │  ├─ rectangular/m23f.ts, m24f.ts, …
│  │  └─ array/m44fArray.ts, m44dArray.ts, …
│  ├─ color/
│  │  ├─ c3b.ts, c4b.ts, c3f.ts, c4f.ts, c3d.ts, c4d.ts
│  │  └─ array/c4bArray.ts, …
│  ├─ rotation/
│  │  ├─ rot2f.ts, rot2d.ts
│  │  ├─ rot3f.ts, rot3d.ts
│  │  └─ array/rot3dArray.ts
│  ├─ trafo/
│  │  ├─ shift3d.ts, scale3d.ts, euclidean3d.ts,
│  │  ├─ similarity3d.ts, affine3d.ts, trafo3d.ts
│  │  ├─ shift2d.ts, scale2d.ts, euclidean2d.ts,
│  │  ├─ similarity2d.ts, affine2d.ts, trafo2d.ts
│  ├─ box/
│  │  ├─ range1i.ts, range1f.ts, range1d.ts
│  │  ├─ box2i.ts, box3i.ts, box2f.ts, box3f.ts, box2d.ts, box3d.ts
│  ├─ geometry/
│  │  ├─ plane3d.ts, ray2d.ts, ray3d.ts
│  │  ├─ line2d.ts, line3d.ts
│  │  ├─ triangle2d.ts, triangle3d.ts
│  │  ├─ polygon2d.ts, polygon3d.ts
│  │  ├─ sphere3d.ts, circle2d.ts, circle3d.ts
│  │  └─ quad2d.ts, quad3d.ts
│  ├─ cell/
│  │  ├─ cell.ts, cell2d.ts
│  ├─ linalg/
│  │  ├─ lu.ts, qr.ts, svd.ts, eigen.ts, cholesky.ts
│  │  └─ solve.ts
│  └─ internal/
│     ├─ hash.ts               # 32-bit FNV mix, compatible with @aardworx/adaptive
│     └─ format.ts             # toString helpers
├─ tests/
│  ├─ vector/, matrix/, color/, rotation/, trafo/, box/, geometry/,
│  │  linalg/, cell/, random/
│  └─ array/                   # ArrayView round-trip tests, hot-loop benchmarks
└─ docs/
   ├─ SCOPE.md                 # this file
   ├─ STORAGE.md               # per-type backing layout (next round)
   ├─ OPERATORS.md             # before/after with the operator plugin (next round)
   └─ GEOMETRY.md              # primitive intersections, closed-form table
```

## 9. Roadmap / phases

Estimates assume a single full-time author with the precedent of the
adaptive port (which took ~3 months for a comparable surface).

### Phase 0 — foundations (~1 week)

- Package skeleton, build pipeline (`tsc` only, no Vite),
  vitest config.
- `internal/hash.ts` matched against `@aardworx/adaptive`'s defaults.
- `scalar.ts` constants and helpers.
- One scalar primitive end-to-end as the canonical pattern: `V3f` +
  `V3fArray` + tests + benchmarks. Lock down the prototype shape,
  the array-view contract, the test layout, and the JSDoc style.

### Phase 1 — vectors, matrices, colors (~3 weeks)

- All vector / matrix / color primitives in their owned + array
  forms.
- Every primitive's tests cover precision, equality, hashing,
  iterator, conversions, and round-trip through `*Array`.
- One 32-bit hash benchmark to make sure the FNV mix isn't worse
  than `defaultHash`.

### Phase 2 — rotations, transformations (~2 weeks)

- `Rot2*` / `Rot3*`, with Euler/axis-angle/matrix conversions tested
  against ground-truth tables ported from `Aardvark.Base.Tests`.
- `Shift3d` → `Trafo3d` ladder (and 2D).
- Property tests: `inverse(t).then(t)` ≈ identity within `eps`.

### Phase 3 — bounding boxes, ranges, geometry primitives (~2 weeks)

- `Range1*`, `Box*`.
- `Plane3d`, `Ray3d`, `Line3d`, `Triangle3d`, `Sphere3d` with their
  intersection routines.
- Polygon area / winding / point-in-polygon (2D).

### Phase 4 — linear algebra (~3 weeks)

- LU, QR, Cholesky, symmetric Jacobi eigen, two-sided Jacobi SVD.
- Linear solve and least-squares.
- Property tests: `A = U·diag(S)·V^T` for SVD; eigenvectors orthonormal;
  pseudo-inverse round-trip.

### Phase 5 — cells, random, polish (~2 weeks)

- `Cell`/`Cell2d` with `BigInt` exponent / origin.
- XoroShiro128+ PRNG, random-vector helpers.
- Performance pass: benchmark hot loops (transform array of 1M
  V3fs by an M44f, build AABB from a cloud, etc.). Where allocation
  shows up in a flame graph, add `*InPlace` / `*Into` variants.
- Documentation: GEOMETRY.md, OPERATORS.md.

### Phase 6 — operator plugin (planned in `tshade`'s repo)

Once `aardvark-ts` is stable, the `@aardworx/aardvark-operators`
plugin gets built (see `tshade/README.md`). At that point we
re-publish `aardvark-ts` v0.2 with internals rewritten using
operators where it improves readability. The public `.d.ts` doesn't
change.

Total budget: ~13 weeks (3+ months) for v0.1 plus another 4–5 weeks
for the plugin and v0.2.

## 10. Conventions worth copying from Aardvark.Base

- **Method names** — `mul`, `add`, `sub`, `neg`, `transform`,
  `transformPos`, `transformDir`, `transpose`, `inverse`, `dot`,
  `cross`, `normalize`, `length`, `lengthSquared`, `distance`,
  `distanceSquared`. Don't invent new names.
- **Static factory naming** — `Trafo3d.translation(v)`, not
  `Trafo3d.fromTranslation(v)`. Aardvark uses the noun directly.
- **`*Squared` for the square-of-distance / length variants** — the
  fast path callers want.
- **Component accessors `M00`, `M01`, …** — not `m[0][0]`. Indexing
  via two-level array access would force allocations and obscure
  storage order.
- **`Min` / `Max` capitalised in tuple-style record types** for
  `Box` / `Range`. Aardvark uses these field names; copy them.
- **`Forward` and `Backward` matrices** in `Trafo3d` — not `M` /
  `MInv`.

## 11. Compatibility notes

- The hash format must match `@aardworx/adaptive` for cross-package
  use as `HashMap` keys.
- Array-view byte layouts must match WebGL's vertex buffer
  expectations: packed AoS, no padding, column-major matrices.
- Quaternion storage is `(W, X, Y, Z)` — the reverse of
  `gl-matrix`'s convention. We diverge from `gl-matrix` deliberately
  because we mirror Aardvark.
- All transforms are right-handed, column-major, `M·v` style. View
  matrices look down `-Z`. This matches the Aardvark.Rendering
  conventions and what `tshade` will assume.
