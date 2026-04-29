// Project typecheck driver: applies the @aardworx/aardvark-operators
// transformer to every source file BEFORE running the type checker,
// so that `a + b` on math types is seen as `a.add(b)` and the
// checker doesn't cascade error types through the rest of the
// expression.
//
// Without this step, plain `tsc --noEmit` would (correctly, by its
// own rules) reject operator usage on math types — the language-
// service plugin we ship for editors doesn't run in the CLI.

import ts from "typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TSCONFIG = path.join(ROOT, "tsconfig.json");
const require_ = createRequire(import.meta.url);
const { createTransformer } = require_("@aardworx/aardvark-operators");

const configText = ts.sys.readFile(TSCONFIG);
const parsed = ts.parseConfigFileTextToJson(TSCONFIG, configText);
const cfg = ts.parseJsonConfigFileContent(parsed.config, ts.sys, ROOT);

// First program — used purely to give the transformer a type checker
// so it can detect math operands.
const initialProgram = ts.createProgram(cfg.fileNames, {
  ...cfg.options,
  noEmit: true,
});

const transformer = createTransformer(initialProgram, {});
const printer = ts.createPrinter({ removeComments: false, newLine: ts.NewLineKind.LineFeed });

const transformedSources = new Map();
for (const sourceFile of initialProgram.getSourceFiles()) {
  if (sourceFile.isDeclarationFile) continue;
  if (!cfg.fileNames.includes(sourceFile.fileName)) continue;
  const result = ts.transform(sourceFile, [transformer]);
  const out = result.transformed[0];
  if (!out) continue;
  transformedSources.set(sourceFile.fileName, printer.printFile(out));
  result.dispose();
}

// Second program — built over a host that returns the transformed
// source for every project file. The type checker now sees
// method calls instead of operators, so V3f arithmetic typechecks.
const defaultHost = ts.createCompilerHost(cfg.options);
const transformingHost = Object.create(defaultHost);
transformingHost.getSourceFile = (fileName, langVersion, onError, shouldCreate) => {
  const transformed = transformedSources.get(fileName);
  if (transformed !== undefined) {
    return ts.createSourceFile(fileName, transformed, langVersion, true);
  }
  return defaultHost.getSourceFile(fileName, langVersion, onError, shouldCreate);
};
transformingHost.readFile = (fileName) => {
  const transformed = transformedSources.get(fileName);
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
