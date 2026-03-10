import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NotFoundError, PermissionDeniedError } from "@nuqta/core";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import {
  companySettings,
  currencySettings,
  moduleSettings,
} from "../../../helpers/fixtures.ts";
import { mockUseCase, resetMockCore } from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/settings", () => {
  let ctx: BuiltApp;

  beforeEach(async () => {
    resetMockCore();
    resetMockData();
    ctx = await buildApp();
  });

  afterEach(async () => {
    if (ctx) {
      await ctx.close();
    }
  });

  test.each([
    {
      title: "GET /company returns company settings",
      method: "GET",
      url: "/api/v1/settings/company",
      setup: () =>
        mockUseCase("GetCompanySettingsUseCase", { execute: companySettings }),
      assert: (data: typeof companySettings) => {
        expect(data.name).toBe(companySettings.name);
      },
    },
    {
      title: "PUT /company updates company settings",
      method: "PUT",
      url: "/api/v1/settings/company",
      payload: companySettings,
      setup: () => {
        mockUseCase("SetCompanySettingsUseCase", { execute: null });
        mockUseCase("GetCompanySettingsUseCase", { execute: companySettings });
      },
      assert: (data: typeof companySettings) => {
        expect(data.currency).toBe(companySettings.currency);
      },
    },
    {
      title: "GET /currency returns currency settings",
      method: "GET",
      url: "/api/v1/settings/currency",
      setup: () =>
        mockUseCase("GetCurrencySettingsUseCase", {
          execute: currencySettings,
        }),
      assert: (data: typeof currencySettings) => {
        expect(data.currencyCode).toBe(currencySettings.currencyCode);
      },
    },
    {
      title: "GET /modules returns module settings",
      method: "GET",
      url: "/api/v1/settings/modules",
      setup: () =>
        mockUseCase("GetModuleSettingsUseCase", { execute: moduleSettings }),
      assert: (data: typeof moduleSettings) => {
        expect(data.accountingEnabled).toBe(true);
      },
    },
    {
      title: "POST /setup-wizard marks setup complete",
      method: "POST",
      url: "/api/v1/settings/setup-wizard",
      payload: {
        modules: { accountingEnabled: true },
      },
      setup: () => mockUseCase("CompleteSetupWizardUseCase", { execute: null }),
      assert: (data: { completed: boolean }) => {
        expect(data.completed).toBe(true);
      },
    },
    {
      title: "GET /:key returns one setting",
      method: "GET",
      url: "/api/v1/settings/theme",
      setup: () =>
        mockUseCase("GetSettingUseCase", { execute: { value: "light" } }),
      assert: (data: { value: string }) => {
        expect(data.value).toBe("light");
      },
    },
    {
      title: "PUT /:key updates one setting",
      method: "PUT",
      url: "/api/v1/settings/theme",
      payload: {
        value: "dark",
      },
      setup: () => mockUseCase("SetSettingUseCase", { execute: null }),
      assert: (data: null) => {
        expect(data).toBeNull();
      },
    },
  ])("$title", async ({ method, url, payload, setup, assert }) => {
    setup();

    const response = await ctx.app.inject({
      method,
      url,
      payload,
      headers: ctx.authHeaders(),
    });

    const data = expectOk(response);
    assert(data as never);
  });

  test.each([
    {
      method: "PUT",
      url: "/api/v1/settings/company",
      payload: { email: "not-an-email" },
    },
    {
      method: "POST",
      url: "/api/v1/settings/setup-wizard",
      payload: {
        invoice: { paperSize: "ledger" },
      },
    },
    {
      method: "PUT",
      url: "/api/v1/settings/theme",
      payload: {},
    },
  ])("returns 400 for invalid %s %s", async ({ method, url, payload }) => {
    const response = await ctx.app.inject({
      method,
      url,
      payload,
      headers: ctx.authHeaders(),
    });

    expectError(response, 400, "VALIDATION_ERROR");
  });

  test("returns 401 when auth is missing", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/settings/company",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when updating company settings is forbidden", async () => {
    mockUseCase("SetCompanySettingsUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "PUT",
      url: "/api/v1/settings/company",
      payload: companySettings,
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when a setting key does not exist", async () => {
    mockUseCase("GetSettingUseCase", {
      execute: async () => {
        throw new NotFoundError("missing");
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/settings/missing-key",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });
});
