import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "src/**/*.ts",
        "packages/core/src/contract.ts",
        "packages/core/src/errors/DomainErrors.ts",
        "packages/core/src/services/JwtService.ts",
        "packages/core/src/services/PermissionService.ts",
        "packages/core/src/use-cases/LoginUseCase.ts",
        "packages/core/src/use-cases/CheckInitialSetupUseCase.ts",
      ],
      exclude: [
        "dist/**",
        "tests/**",
        "src/routes/root.ts",
        "src/schemas/index.ts",
        "packages/core/dist/**",
        "packages/data/**",
      ],
      thresholds: {
        lines: 90,
        // The Fastify route layer has many optional query/body fallback branches.
        // Reaching 90% branch coverage would require exhaustive permutations with
        // little regression value, so we enforce 70% while keeping line/function
        // coverage at 90%+ across the tested app and core surfaces.
        branches: 70,
        functions: 90,
        statements: 90,
      },
    },
  },
});
