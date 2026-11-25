// Bootstrap that installs swizzle accessors on V2f / V3f / V4f, and on
// the double, int and uint families (each swizzle gives a vector of its
// own family), AFTER all the classes are defined. Doing the install inside
// each per-class module would cycle: v3f imports v4f to install
// `xyzw → V4f`, v4f imports v3f to install `xyzw → V3f`, and the
// constructor references in `installSwizzles` would resolve to
// `undefined` for whichever class loaded second.
//
// Importing this module from the package's barrel (`src/index.ts`)
// runs once at module load, after vector classes have all hit
// their final initialization.

import { V2f } from "./v2f.js";
import { V3f } from "./v3f.js";
import { V4f } from "./v4f.js";
import { V2d } from "./v2d.js";
import { V3d } from "./v3d.js";
import { V4d } from "./v4d.js";
import { V2i } from "./v2i.js";
import { V3i } from "./v3i.js";
import { V4i } from "./v4i.js";
import { V2ui } from "./v2ui.js";
import { V3ui } from "./v3ui.js";
import { V4ui } from "./v4ui.js";
import { installSwizzles, type SwizzleCtors } from "./swizzle.js";

const ctors = {
  V2: V2f as unknown as new (x: number, y: number) => unknown,
  V3: V3f as unknown as new (x: number, y: number, z: number) => unknown,
  V4: V4f as unknown as new (x: number, y: number, z: number, w: number) => unknown,
};

installSwizzles(V2f.prototype, 2, ctors);
installSwizzles(V3f.prototype, 3, ctors);
installSwizzles(V4f.prototype, 4, ctors);

// The other families: `new V3d(1, 2, 3).xy` is a V2d, as Aardvark.Base's
// `V3d.XY` is. Code written against Aardvark.Base (compiled by Fable)
// reads these.
const family = (v2: unknown, v3: unknown, v4: unknown): SwizzleCtors => ({
  V2: v2 as SwizzleCtors["V2"], V3: v3 as SwizzleCtors["V3"], V4: v4 as SwizzleCtors["V4"],
});
for (const [v2, v3, v4] of [[V2d, V3d, V4d], [V2i, V3i, V4i], [V2ui, V3ui, V4ui]] as const) {
  const ctorsOf = family(v2, v3, v4);
  installSwizzles(v2.prototype, 2, ctorsOf);
  installSwizzles(v3.prototype, 3, ctorsOf);
  installSwizzles(v4.prototype, 4, ctorsOf);
}
