import { defineConfig } from "vitest/config";

// Two projects (CL-14): the core, scripts and contract tests stay in plain Node; component tests
// (`*.dom.test.tsx` under src) run in jsdom with the setup file that Fluent UI v9 and React need.
export default defineConfig({
  test: {
    // Stryker's dry run instruments the code and measures per-test coverage on a shared runner,
    // which made the pure-JS SHA-256 Bloom tests of CL-04 exceed the 5 s default (CL-04C).
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**"],
      thresholds: { lines: 90 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "packages/*/test/**/*.test.ts",
            "src/**/*.test.{ts,tsx}",
            "scripts/**/*.test.mjs",
          ],
          exclude: ["src/**/*.dom.test.tsx", "node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.dom.test.tsx"],
          setupFiles: ["src/test-setup/dom.ts"],
        },
      },
    ],
  },
});
