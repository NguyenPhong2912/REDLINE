import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "netlify/**/*.test.mjs"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
