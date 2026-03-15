import { describe, expect, test, vi } from "vitest";
import { CheckInitialSetupUseCase } from "../../../src/domain/use-cases/auth/CheckInitialSetupUseCase.ts";

describe("CheckInitialSetupUseCase", () => {
  test("prefers the explicit wizard flag when it exists", async () => {
    const userRepo = {
      count: vi.fn().mockResolvedValue(1),
    };
    const settingsRepo = {
      get: vi
        .fn()
        .mockImplementation(async (key: string) => {
          const values: Record<string, string | null> = {
            app_initialized: "true",
            "setup.wizardCompleted": "false",
            "setup.wizard_completed": null,
            company_name: "Nuqta",
            company_city: null,
            company_area: null,
            company_street: null,
          };
          return values[key] ?? null;
        }),
    };

    const useCase = new CheckInitialSetupUseCase(
      userRepo as never,
      settingsRepo as never,
    );

    await expect(useCase.execute()).resolves.toEqual({
      isInitialized: true,
      hasUsers: true,
      hasCompanyInfo: true,
      wizardCompleted: false,
    });
  });

  test("falls back to app initialization when wizard flags are absent", async () => {
    const userRepo = {
      count: vi.fn().mockResolvedValue(0),
    };
    const settingsRepo = {
      get: vi
        .fn()
        .mockImplementation(async (key: string) => {
          const values: Record<string, string | null> = {
            app_initialized: "true",
            "setup.wizardCompleted": null,
            "setup.wizard_completed": null,
            company_name: null,
            company_city: null,
            company_area: null,
            company_street: null,
          };
          return values[key] ?? null;
        }),
    };

    const useCase = new CheckInitialSetupUseCase(
      userRepo as never,
      settingsRepo as never,
    );

    await expect(useCase.execute()).resolves.toEqual({
      isInitialized: true,
      hasUsers: false,
      hasCompanyInfo: false,
      wizardCompleted: true,
    });
  });
});
