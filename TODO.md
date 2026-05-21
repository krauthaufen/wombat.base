# wombat.base — TODO

Status: 🔄 active (0.4.4). Math + geometry primitives (V*/M*/Trafo/Rot/Box +
geometry), TypedArray-backed (VBO-ready), operator-overload plugin, linear
algebra (LU/QR/Cholesky/SVD/eigen), intersections, structural equality/hashing.
Shipped and in heavy use; docs + a few numeric types are the open work.

Design/scope doc kept at `docs/SCOPE.md`. Architectural items (64-bit /
half-precision numeric types) live in `~/claude/wombat-todo.md`.

## Open

- **Finish docs** — `docs/STORAGE.md` (per-type backing layout) and
  `docs/GEOMETRY.md` (intersection table) were marked "next round" and never
  landed.
- **Free-function math helpers** — `src/scalar.ts` already exports a few scalar
  free functions (`clamp`, `lerp`, `smoothstep`, `smootherstep`, `fract`,
  `sign0`, `step`, `wrap`, `approxEqual`). Still missing: the rest of the scalar
  set (`abs`, `sqrt`, `inverseSqrt`, `pow`, trig, `min`/`max`/`mix`), and ALL
  vector free functions (`length`/`distance`/`dot`/`cross`/`normalize`/`reflect`/
  `refract` exist only as methods on V2f/V3f/V4f) plus a `/math` subpath export.
  Pure ergonomics — pairs with shader bodies; shader-vite already recognises the
  names. Shader-only ops (`dFdx`, `texture*`, atomics) stay in wombat.shader.

## Future (deferred, no concrete need yet)

- 64-bit (`V2l`/`M44l`) + half-precision numeric types (see central TODO #10).
- Computational geometry: convex hull, mesh decimation, triangulation.
- Spatial indices: KD-tree, octree (a BVH already exists).
- Color-space conversions beyond linear↔sRGB.
- File I/O / serialization.
