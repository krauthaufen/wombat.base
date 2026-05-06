// Bootstrap that installs swizzle accessors on V2f / V3f / V4f
// AFTER all three classes are defined. Doing the install inside
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
import { installSwizzles } from "./swizzle.js";

const ctors = {
  V2: V2f as unknown as new (x: number, y: number) => unknown,
  V3: V3f as unknown as new (x: number, y: number, z: number) => unknown,
  V4: V4f as unknown as new (x: number, y: number, z: number, w: number) => unknown,
};

installSwizzles(V2f.prototype, 2, ctors);
installSwizzles(V3f.prototype, 3, ctors);
installSwizzles(V4f.prototype, 4, ctors);
