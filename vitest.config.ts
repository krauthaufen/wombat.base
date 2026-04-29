import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as ts from "typescript";
import { createTransformer } from "@aardworx/aardvark-operators";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// Build a long-lived TS Program over the project's tsconfig so the
// operator transformer has full type info for every .ts file vitest
// asks us to transform.
function loadProgram(): ts.Program {
  const configPath = path.join(ROOT, "tsconfig.json");
  const configText = ts.sys.readFile(configPath);
  if (!configText) throw new Error("[operators-vite] tsconfig.json not found");
  const parsed = ts.parseConfigFileTextToJson(configPath, configText);
  if (parsed.error) throw new Error("[operators-vite] tsconfig parse error");
  const cfg = ts.parseJsonConfigFileContent(parsed.config, ts.sys, ROOT);
  return ts.createProgram(cfg.fileNames, {
    ...cfg.options,
    noEmit: false,
    plugins: undefined, // we apply the transformer manually below
  });
}

let program: ts.Program | undefined;
const printer = ts.createPrinter({ removeComments: false });

function transformWithOperators(code: string, id: string): { code: string } | null {
  if (!id.endsWith(".ts") && !id.endsWith(".tsx")) return null;
  if (!program) program = loadProgram();
  const normalized = path.resolve(id);
  let sourceFile = program.getSourceFile(normalized);
  if (!sourceFile) {
    // File not in the program (e.g. test-only file outside tsconfig
    // includes). Reload the program once with this file added.
    program = ts.createProgram(
      [...program.getRootFileNames(), normalized],
      program.getCompilerOptions(),
    );
    sourceFile = program.getSourceFile(normalized);
  }
  if (!sourceFile) return null;

  const transformer = createTransformer(program, {});
  const result = ts.transform(sourceFile, [transformer]);
  const transformed = result.transformed[0];
  if (!transformed) return null;
  const out = printer.printFile(transformed as ts.SourceFile);
  result.dispose();
  return { code: out };
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  plugins: [
    {
      name: "aardvark-operators",
      enforce: "pre",
      transform(code, id) {
        return transformWithOperators(code, id);
      },
    },
  ],
});
