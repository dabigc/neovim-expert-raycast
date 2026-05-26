import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
  },
  resolve: {
    alias: {
      "@raycast/api": path.resolve(__dirname, "__mocks__/@raycast/api.ts"),
    },
  },
});
