import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NotFoundError, PermissionDeniedError } from "@nuqta/core";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import {
  expiryAlert,
  inventoryDashboard,
  inventoryMovement,
} from "../../../helpers/fixtures.ts";
import { mockUseCase, resetMockCore } from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/inventory", () => {
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
      title: "GET /movements returns inventory movements",
      url: "/api/v1/inventory/movements?productId=5&movementType=in&limit=10&offset=0",
      setup: () =>
        mockUseCase("GetInventoryMovementsUseCase", {
          execute: [inventoryMovement],
        }),
      assert: (data: (typeof inventoryMovement)[]) => {
        expect(data[0].movementType).toBe("in");
      },
    },
    {
      title: "GET /dashboard returns dashboard data",
      url: "/api/v1/inventory/dashboard",
      setup: () =>
        mockUseCase("GetInventoryDashboardUseCase", {
          execute: inventoryDashboard,
        }),
      assert: (data: typeof inventoryDashboard) => {
        expect(data.lowStock).toBe(inventoryDashboard.lowStock);
      },
    },
    {
      title: "GET /expiry-alerts returns alerts",
      url: "/api/v1/inventory/expiry-alerts",
      setup: () =>
        mockUseCase("GetExpiryAlertsUseCase", { execute: [expiryAlert] }),
      assert: (data: (typeof expiryAlert)[]) => {
        expect(data[0].productId).toBe(expiryAlert.productId);
      },
    },
  ])("$title", async ({ url, setup, assert }) => {
    setup();

    const response = await ctx.app.inject({
      method: "GET",
      url,
      headers: ctx.authHeaders(),
    });

    const data = expectOk(response);
    assert(data as never);
  });

  test("returns 400 for invalid movements filters", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/inventory/movements?productId=bad",
      headers: ctx.authHeaders(),
    });

    expectError(response, 400, "VALIDATION_ERROR");
  });

  test("returns 401 when auth is missing", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/inventory/dashboard",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when inventory access is forbidden", async () => {
    mockUseCase("GetInventoryDashboardUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/inventory/dashboard",
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when movements are requested for a missing product", async () => {
    mockUseCase("GetInventoryMovementsUseCase", {
      execute: async () => {
        throw new NotFoundError("missing");
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/inventory/movements?productId=5",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });

  // ── Covers L29: productId/limit/offset ternary fallback branches ──
  test("GET /inventory/movements without optional query params hits default fallbacks", async () => {
    mockUseCase("GetInventoryMovementsUseCase", { execute: [] });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/inventory/movements",
      headers: ctx.authHeaders(),
    });

    expectOk(response);
  });
});
