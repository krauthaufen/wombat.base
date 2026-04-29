// Public barrel for `@aardworx/aardvark-ts`.

export * from "./scalar.js";

// Vectors
export { V2b } from "./vector/v2b.js";
export { V3b } from "./vector/v3b.js";
export { V4b } from "./vector/v4b.js";
export { V2i } from "./vector/v2i.js";
export { V3i } from "./vector/v3i.js";
export { V4i } from "./vector/v4i.js";
export { V2ui } from "./vector/v2ui.js";
export { V3ui } from "./vector/v3ui.js";
export { V4ui } from "./vector/v4ui.js";
export { V2f, V2fOf } from "./vector/v2f.js";
export { V3f, V3fOf } from "./vector/v3f.js";
export { V4f, V4fOf } from "./vector/v4f.js";
export { V2d } from "./vector/v2d.js";
export { V3d } from "./vector/v3d.js";
export { V4d } from "./vector/v4d.js";

// Square matrices
export { M22f } from "./matrix/m22f.js";
export { M33f } from "./matrix/m33f.js";
export { M44f } from "./matrix/m44f.js";
export { M22d } from "./matrix/m22d.js";
export { M33d } from "./matrix/m33d.js";
export { M44d } from "./matrix/m44d.js";

// Rectangular matrices
export { M23f } from "./matrix/m23f.js";
export { M24f } from "./matrix/m24f.js";
export { M32f } from "./matrix/m32f.js";
export { M34f } from "./matrix/m34f.js";
export { M42f } from "./matrix/m42f.js";
export { M43f } from "./matrix/m43f.js";
export { M23d } from "./matrix/m23d.js";
export { M24d } from "./matrix/m24d.js";
export { M32d } from "./matrix/m32d.js";
export { M34d } from "./matrix/m34d.js";
export { M42d } from "./matrix/m42d.js";
export { M43d } from "./matrix/m43d.js";

// Array views (for now, just the float ones — others can wait)
export { V2fArray } from "./vector/array/v2fArray.js";
export { V3fArray } from "./vector/array/v3fArray.js";
export { V4fArray } from "./vector/array/v4fArray.js";
export { V2dArray } from "./vector/array/v2dArray.js";
export { V3dArray } from "./vector/array/v3dArray.js";
export { V4dArray } from "./vector/array/v4dArray.js";
