// Vector swizzle accessors — `.xyz`, `.xy`, `.zw`, `.rgba`, etc. —
// installed on V2f/V3f/V4f prototypes at module load.
//
// Why bother on the runtime side at all when the wombat.shader
// frontend already recognises swizzles syntactically? Because the
// SAME source files that get plugin-transformed for shader bodies
// also run as plain TypeScript at module-init / aval-getter time.
// `new V4f(positions.xyz, 1)` must type-check AND evaluate at
// runtime, since the shader plugin only transforms the inside of
// `vertex(...)` / `fragment(...)` markers, not the surrounding
// closure. So we need real getters.
//
// Implementation: one `installSwizzles` call per class fills the
// prototype with every valid 2/3/4-component combination of the
// xyzw / rgba / stpq aliases. Each getter reads the indices from
// `_data` and constructs a fresh V2f/V3f/V4f. TS gets the right
// return types via template-literal-typed declaration merging
// (see the `.d.ts`-style augmentation in each vector module).

const XYZW: readonly string[] = ["x", "y", "z", "w"];
const RGBA: readonly string[] = ["r", "g", "b", "a"];
const STPQ: readonly string[] = ["s", "t", "p", "q"];

const ALIAS_INDEX: Record<string, number> = {
  x: 0, y: 1, z: 2, w: 3,
  r: 0, g: 1, b: 2, a: 3,
  s: 0, t: 1, p: 2, q: 3,
};

export interface SwizzleCtors {
  V2: new (x: number, y: number) => unknown;
  V3: new (x: number, y: number, z: number) => unknown;
  V4: new (x: number, y: number, z: number, w: number) => unknown;
}

/**
 * Install every multi-component swizzle on `proto`. `dim` is the
 * source vector's component count (2 for V2f, 3 for V3f, 4 for
 * V4f). All three xyzw / rgba / stpq alias families are
 * registered, so `v.xyz`, `v.rgb`, `v.stp` all work.
 *
 * Single-component access (`.x` → number) stays in each class's
 * own definition — the existing get/set property accessors on
 * V*f need to remain so the alias families can compose with them.
 */
export function installSwizzles(
  proto: object,
  dim: 2 | 3 | 4,
  ctors: SwizzleCtors,
): void {
  for (const family of [XYZW, RGBA, STPQ] as const) {
    installFamily(proto, dim, family, ctors);
  }
}

function installFamily(
  proto: object,
  dim: 2 | 3 | 4,
  family: readonly string[],
  ctors: SwizzleCtors,
): void {
  // Component letters available given the source's dim.
  const available = family.slice(0, dim);
  // Generate combinations up to the source's own dim — V2 → 2,
  // V3 → 3, V4 → 4. GLSL/WGSL technically allow producing more
  // components than the source has via repeat (`v3.xxxx → vec4`),
  // but in practice it's never the readable form (`new V4f(v3, w)`
  // is). Skipping it removes ~80 unused property descriptors from
  // V3f's prototype and ~24 from V2f's.
  const maxLen = dim;
  for (let len = 2; len <= maxLen; len++) {
    for (const combo of permutationsWithRepeats(available, len)) {
      const name = combo.join("");
      const indices = combo.map((c) => ALIAS_INDEX[c]!);
      const getter = makeGetter(indices, ctors);
      // Skip if a property already exists on the proto (the
      // same letter sequence in another alias family would
      // conflict on length-1 — but length-1 is `.x`/`.r`/`.s`
      // which are managed per-class). We only register length
      // >= 2 here, so collisions across families are fine
      // (they'd compute the same value anyway).
      if (Object.prototype.hasOwnProperty.call(proto, name)) continue;
      Object.defineProperty(proto, name, {
        get: getter,
        enumerable: false,
        configurable: false,
      });
    }
  }
}

function makeGetter(
  indices: readonly number[],
  ctors: SwizzleCtors,
): (this: { _data: Float32Array | number[] }) => unknown {
  // One getter per length-1/2/3/4 — picked from a tiny lookup
  // so V8 can inline the fast path. `indices` is captured.
  if (indices.length === 2) {
    const [i, j] = indices as [number, number];
    return function () { const a = this._data; return new ctors.V2(a[i]!, a[j]!); };
  }
  if (indices.length === 3) {
    const [i, j, k] = indices as [number, number, number];
    return function () { const a = this._data; return new ctors.V3(a[i]!, a[j]!, a[k]!); };
  }
  if (indices.length === 4) {
    const [i, j, k, l] = indices as [number, number, number, number];
    return function () { const a = this._data; return new ctors.V4(a[i]!, a[j]!, a[k]!, a[l]!); };
  }
  throw new Error(`installSwizzles: unsupported swizzle length ${indices.length}`);
}

/** All length-`n` sequences over `xs`, with repetitions. */
function* permutationsWithRepeats<T>(xs: readonly T[], n: number): IterableIterator<T[]> {
  if (n === 0) { yield []; return; }
  for (const x of xs) {
    for (const tail of permutationsWithRepeats(xs, n - 1)) {
      yield [x, ...tail];
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Type-level helpers: template-literal swizzle name generation.
//
// Each vector module merges these into its own class declaration
// via `interface V*f extends ...` so callers see the right return
// type for every swizzle access (`v3f.xyz: V3f`, `v3f.xy: V2f`,
// `v4f.rgba: V4f`, …).
// ─────────────────────────────────────────────────────────────────────

// At the type level we expose only the `xyzw` swizzle alphabet — the
// rgba / stpq aliases collide with existing method names on V*f
// (`abs`, `gt`, `lt`, `le`, etc. happen to be valid letter sequences
// in those families) and TS can't tell from the template that
// `gt` was meant as `g+t` rather than the comparison method.
// Runtime still installs the rgba / stpq accessors via
// `installSwizzles` for users who don't go through the typed API
// (e.g. dynamic `v["rgb"]` access).
export type Letter2 = "x" | "y";
export type Letter3 = Letter2 | "z";
export type Letter4 = Letter3 | "w";

// Two/three/four-component sequences, by source dim.
// Two-component swizzles per source dim. V2 only has `x,y`; V3
// adds `z`; V4 adds `w`. Length always tracks the source dim — we
// don't produce more components than the source has.
export type Sw2x2 = `${Letter2}${Letter2}`;

export type Sw3x2 = `${Letter3}${Letter3}`;
export type Sw3x3 = `${Letter3}${Letter3}${Letter3}`;

export type Sw4x2 = `${Letter4}${Letter4}`;
export type Sw4x3 = `${Letter4}${Letter4}${Letter4}`;
export type Sw4x4 = `${Letter4}${Letter4}${Letter4}${Letter4}`;
