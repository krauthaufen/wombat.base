// Project typecheck driver: applies boperators to every source file BEFORE
// running the type checker, so `a + b` on math types is seen as
// `Vec3["+"](a, b)` and the checker doesn't cascade error types.
//
// Without this step, plain `tsc --noEmit` would (correctly, by its own rules)
// reject operator usage on math types — the language-service plugin we ship
// for editors doesn't run in the CLI.

import ts from "typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TSCONFIG = path.join(ROOT, "tsconfig.json");
const require_ = createRequire(import.meta.url);
const { Project, OverloadStore, OverloadInjector, ErrorManager, loadConfig } = require_("boperators");

const configText = ts.sys.readFile(TSCONFIG);
const parsed = ts.parseConfigFileTextToJson(TSCONFIG, configText);
const cfg = ts.parseJsonConfigFileContent(parsed.config, ts.sys, ROOT);

// Build a ts-morph project tied to the same tsconfig, register all overloads,
// then transform every project file in-memory.
const bopConfig = loadConfig({ searchDir: ROOT });
const tsMorphProject = new Project({ tsConfigFilePath: TSCONFIG });
const errorManager = new ErrorManager(bopConfig);
const overloadStore = new OverloadStore(tsMorphProject, errorManager, bopConfig.logger);
const overloadInjector = new OverloadInjector(tsMorphProject, overloadStore, bopConfig.logger);

for (const file of tsMorphProject.getSourceFiles()) {
  overloadStore.addOverloadsFromFile(file);
}
errorManager.throwIfErrorsElseLogWarnings();

const transformedSources = new Map();
for (const file of tsMorphProject.getSourceFiles()) {
  const fp = path.normalize(file.getFilePath());
  const result = overloadInjector.overloadFile(file);
  transformedSources.set(fp, result.text);
}

// Build a tsc program over a host that returns the transformed source for
// every project file. The type checker now sees method calls instead of
// operators.
const defaultHost = ts.createCompilerHost(cfg.options);
const transformingHost = Object.create(defaultHost);
transformingHost.getSourceFile = (fileName, langVersion, onError, shouldCreate) => {
  const transformed = transformedSources.get(path.normalize(fileName));
  if (transformed !== undefined) {
    return ts.createSourceFile(fileName, transformed, langVersion, true);
  }
  return defaultHost.getSourceFile(fileName, langVersion, onError, shouldCreate);
};
transformingHost.readFile = (fileName) => {
  const transformed = transformedSources.get(path.normalize(fileName));
  if (transformed !== undefined) return transformed;
  return defaultHost.readFile(fileName);
};

const program = ts.createProgram({
  rootNames: cfg.fileNames,
  options: { ...cfg.options, noEmit: true },
  host: transformingHost,
});

const diagnostics = ts.getPreEmitDiagnostics(program);

const formatHost = {
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: (f) => f,
  getNewLine: () => "\n",
};

if (diagnostics.length > 0) {
  process.stderr.write(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost),
  );
  process.exitCode = 1;
} else {
  console.log("typecheck: clean");
}
