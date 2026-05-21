// Runtime scalar operator-methods (monkey-patch on `Number.prototype`).
//
// Pairs with the global `Number` interface declaration in
// `@aardworx/wombat.shader` (types/scalars.ts) so that method-style scalar
// math — `x.mul(y)`, `a.add(b)`, `t.neg()`, … — both TYPE-CHECKS (the
// declaration) and RUNS (this patch). That lets scalars share the exact
// same method vocabulary as V*/M* (which have real class methods) and the
// wombat.shader frontend's lowering, so shaders and CPU code use ONE
// method-based style with NO build plugin required.
//
// (boperators / the `__aardworxMathBrand` statics remain on the math types
// purely so operator *glyphs* — `a + b` — stay available as an opt-in for
// projects that wire that plugin. Nothing here depends on it.)
//
// Patched names: mul / add / sub / div / neg. Defined idempotently and
// non-enumerable so they don't disturb `for..in`, JSON, or other code that
// reflects over numbers. Imported for its side effect from the package
// entry (see package.json `sideEffects`), so the methods exist as soon as
// wombat.base is loaded.
//
// `+this` unboxes the (possibly boxed) receiver to a primitive number.

type NumFn = (this: number, ...args: number[]) => number;

function def(name: string, fn: NumFn): void {
  const proto = Number.prototype as unknown as Record<string, unknown>;
  if (typeof proto[name] === "function") return; // idempotent
  Object.defineProperty(Number.prototype, name, {
    value: fn,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}

def("mul", function (o: number) { return +this * o; });
def("add", function (o: number) { return +this + o; });
def("sub", function (o: number) { return +this - o; });
def("div", function (o: number) { return +this / o; });
def("neg", function () { return -+this; });

export {};
