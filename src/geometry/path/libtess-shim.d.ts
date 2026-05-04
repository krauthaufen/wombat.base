// Minimal ambient typing for libtess.js. The library is JS-only (no
// official @types) and we only need a small subset of the surface.

declare module "libtess" {
  export const windingRule: {
    readonly GLU_TESS_WINDING_ODD: number;
    readonly GLU_TESS_WINDING_NONZERO: number;
    readonly GLU_TESS_WINDING_POSITIVE: number;
    readonly GLU_TESS_WINDING_NEGATIVE: number;
    readonly GLU_TESS_WINDING_ABS_GEQ_TWO: number;
  };
  export const primitiveType: {
    readonly GL_LINE_LOOP: number;
    readonly GL_TRIANGLES: number;
    readonly GL_TRIANGLE_STRIP: number;
    readonly GL_TRIANGLE_FAN: number;
  };
  export const gluEnum: {
    readonly GLU_TESS_BEGIN: number;
    readonly GLU_TESS_VERTEX: number;
    readonly GLU_TESS_END: number;
    readonly GLU_TESS_ERROR: number;
    readonly GLU_TESS_EDGE_FLAG: number;
    readonly GLU_TESS_COMBINE: number;
    readonly GLU_TESS_BEGIN_DATA: number;
    readonly GLU_TESS_VERTEX_DATA: number;
    readonly GLU_TESS_END_DATA: number;
    readonly GLU_TESS_ERROR_DATA: number;
    readonly GLU_TESS_EDGE_FLAG_DATA: number;
    readonly GLU_TESS_COMBINE_DATA: number;
    readonly GLU_TESS_WINDING_RULE: number;
    readonly GLU_TESS_BOUNDARY_ONLY: number;
    readonly GLU_TESS_TOLERANCE: number;
  };

  export class GluTesselator {
    gluTessProperty(prop: number, value: number | boolean): void;
    gluTessNormal(x: number, y: number, z: number): void;
    gluTessCallback(which: number, fn: (...args: never[]) => unknown): void;
    gluTessBeginPolygon(polyData: unknown): void;
    gluTessEndPolygon(): void;
    gluTessBeginContour(): void;
    gluTessEndContour(): void;
    gluTessVertex(coords: ReadonlyArray<number>, data: unknown): void;
  }

  const _default: {
    readonly windingRule: typeof windingRule;
    readonly primitiveType: typeof primitiveType;
    readonly gluEnum: typeof gluEnum;
    readonly GluTesselator: typeof GluTesselator;
  };
  export default _default;
}
