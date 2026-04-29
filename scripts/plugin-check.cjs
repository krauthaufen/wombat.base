const ts = require("typescript/lib/tsserverlibrary");
let init;
try {
  init = require("@aardworx/aardvark-operators/lang-service");
} catch (e) {
  console.log("FAIL: require failed:", e.message);
  process.exit(1);
}
console.log("require ok, type =", typeof init);
const result = init({ typescript: ts });
console.log("init() returned:", result === undefined ? "undefined" : Object.keys(result));
console.log("has .create:", typeof result?.create);
