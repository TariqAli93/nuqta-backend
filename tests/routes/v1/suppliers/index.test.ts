import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NotFoundError, PermissionDeniedError } from "@nuqta/core";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import { supplier } from "../../../helpers/fixtures.ts";
import { mockUseCase, resetMockCore } from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/suppliers", () => {
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
      title: "GET / returns suppliers",
      method: "GET",
      url: "/api/v1/suppliers?search=Nuqta&limit=10&offset=0",
      setup: () =>
        mockUseCase("GetSuppliersUseCase", {
          execute: { items: [supplier], total: 1 },
        }),
      assert: (data: { items: (typeof supplier)[]; total: number }) => {
        expect(data.items[0].name).toBe(supplier.name);
      },
    },
    {
      title: "GET /:id returns one supplier",
      method: "GET",
      url: "/api/v1/suppliers/4",
      setup: () => mockUseCase("GetSupplierByIdUseCase", { execute: supplier }),
      assert: (data: typeof supplier) => {
        expect(data.id).toBe(supplier.id);
      },
    },
    {
      title: "POST / creates a supplier",
      method: "POST",
      url: "/api/v1/suppliers",
      payload: { name: "Second Supplier", openingBalance: 0, isActive: true },
      setup: () =>
        mockUseCase("CreateSupplierUseCase", {
          execute: { ...supplier, id: 10, name: "Second Supplier" },
        }),
      assert: (data: typeof supplier) => {
        expect(data.name).toBe("Second Supplier");
      },
    },
    {
      title: "PUT /:id updates a supplier",
      method: "PUT",
      url: "/api/v1/suppliers/4",
      payload: { city: "Mosul" },
      setup: () =>
        mockUseCase("UpdateSupplierUseCase", {
          execute: { ...supplier, city: "Mosul" },
        }),
      assert: (data: typeof supplier) => {
        expect(data.city).toBe("Mosul");
      },
    },
    {
      title: "DELETE /:id deletes a supplier",
      method: "DELETE",
      url: "/api/v1/suppliers/4",
      setup: () => mockUseCase("DeleteSupplierUseCase", { execute: null }),
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
      method: "GET",
      url: "/api/v1/suppliers?limit=bad",
    },
    {
      method: "GET",
      url: "/api/v1/suppliers/abc",
    },
    {
      method: "POST",
      url: "/api/v1/suppliers",
      payload: { openingBalance: "bad" },
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
      url: "/api/v1/suppliers",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when update is forbidden", async () => {
    mockUseCase("UpdateSupplierUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "PUT",
      url: "/api/v1/suppliers/4",
      payload: { city: "Denied" },
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when a supplier is missing", async () => {
    mockUseCase("GetSupplierByIdUseCase", {
      execute: async () => {
        throw new NotFoundError("missing");
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/suppliers/999",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });

  // ── Covers L31-32: limit/offset ternary fallback branches ──
  test("GET /suppliers without optional query params hits default fallbacks", async () => {
    mockUseCase("GetSuppliersUseCase", { execute: [] });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/suppliers",
      headers: ctx.authHeaders(),
    });

    expectOk(response);
  });
});
