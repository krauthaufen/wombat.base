import { defineConfig } from "vitest/config";
import { boperators } from "@boperators/plugin-vite";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  plugins: [boperators()],
});
