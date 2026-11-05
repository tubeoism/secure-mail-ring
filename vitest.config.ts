import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Stryker's dry run instruments the code and measures per-test coverage on a shared runner,
    // which made the pure-JS SHA-256 Bloom tests of CL-04 exceed the 5 s default (CL-04C).
    testTimeout: 30_000,
    include: ["packages/*/test/**/*.test.ts", "src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**"],
      thresholds: { lines: 90 },
    },
  },
});
