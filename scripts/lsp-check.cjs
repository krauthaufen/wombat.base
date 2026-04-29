// Simulates what tsserver does: creates a real LanguageService over a
// tiny fixture using V3f, runs our LSP plugin's `create(info)`, and
// asks for semantic diagnostics. Expected: the operator-mismatch
// diagnostics on `a + b` are filtered out.

const ts = require("typescript/lib/tsserverlibrary");
const path = require("path");
const init = require("@aardworx/aardvark-operators/lang-service");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE = path.join(ROOT, "tests/vector/v3f.operators.test.ts");

const COMPILER_OPTIONS = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: true,
  noEmit: true,
};

const host = {
  getScriptFileNames: () => [FIXTURE],
  getScriptVersion: () => "1",
  getScriptSnapshot: (fileName) => {
    if (!ts.sys.fileExists(fileName)) return undefined;
    return ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName) || "");
  },
  getCurrentDirectory: () => ROOT,
  getCompilationSettings: () => COMPILER_OPTIONS,
  getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
};

const ls = ts.createLanguageService(host, ts.createDocumentRegistry());

console.log("BEFORE plugin: ls keys length =", Object.keys(ls).length);
const beforeDiags = ls.getSemanticDiagnostics(FIXTURE);
console.log("BEFORE plugin: diagnostics =", beforeDiags.length);
const opCount = beforeDiags.filter((d) => [2362, 2363, 2365, 2367, 2469].includes(d.code)).length;
console.log("BEFORE plugin: operator-related diagnostics =", opCount);

// Apply our plugin
const pluginFactory = init({ typescript: ts });
const proxy = pluginFactory.create({
  languageService: ls,
  config: {},
  project: {
    projectService: {},
    getProjectName: () => "wombat.base",
    getCompilerOptions: () => COMPILER_OPTIONS,
  },
  serverHost: ts.sys,
});

console.log("AFTER plugin: proxy keys length =", Object.keys(proxy).length);
console.log("AFTER plugin: typeof proxy.getSemanticDiagnostics =", typeof proxy.getSemanticDiagnostics);
const afterDiags = proxy.getSemanticDiagnostics(FIXTURE);
console.log("AFTER plugin: diagnostics =", afterDiags.length);
const opAfter = afterDiags.filter((d) => [2362, 2363, 2365, 2367, 2469].includes(d.code)).length;
console.log("AFTER plugin: operator-related diagnostics =", opAfter);

if (opCount > 0 && opAfter === 0) {
  console.log("\nOK — plugin suppresses all operator diagnostics.");
} else if (opAfter > 0) {
  console.log("\nFAIL — plugin failed to suppress", opAfter, "operator diagnostics.");
  for (const d of afterDiags.slice(0, 5)) {
    console.log("  TS" + d.code + ":", typeof d.messageText === "string" ? d.messageText : d.messageText.messageText);
  }
} else {
  console.log("\nNo operator diagnostics in fixture — try a different fixture.");
}
