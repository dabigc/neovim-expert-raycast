import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
  resolve: {
    alias: {
      "@raycast/api": path.resolve(__dirname, "__mocks__/@raycast/api.ts"),
    },
  },
});
