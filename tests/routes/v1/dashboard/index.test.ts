import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NotFoundError, PermissionDeniedError } from "../../../../src/domain/index.js";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import { dashboardStats } from "../../../helpers/fixtures.ts";
import { mockUseCase, resetMockCore } from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/dashboard", () => {
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

  test("GET /stats returns dashboard metrics", async () => {
    mockUseCase("GetDashboardStatsUseCase", { execute: dashboardStats });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/dashboard/stats",
      headers: ctx.authHeaders(),
    });

    const data = expectOk<typeof dashboardStats>(response);
    expect(data.lowStockCount).toBe(dashboardStats.lowStockCount);
  });

  test("returns 401 when auth is missing", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/dashboard/stats",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when dashboard access is forbidden", async () => {
    mockUseCase("GetDashboardStatsUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/dashboard/stats",
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when the dashboard use case reports missing data", async () => {
    mockUseCase("GetDashboardStatsUseCase", {
      execute: async () => {
        throw new NotFoundError("missing");
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/dashboard/stats",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });
});
