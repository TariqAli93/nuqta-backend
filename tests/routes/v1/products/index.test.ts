import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NotFoundError, PermissionDeniedError } from "@nuqta/core";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import {
  genericOperationResult,
  product,
  productList,
} from "../../../helpers/fixtures.ts";
import {
  getUseCaseMock,
  mockUseCase,
  resetMockCore,
} from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/products", () => {
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
      title: "GET / returns the paginated product list",
      method: "GET",
      url: "/api/v1/products?search=Coffee&page=1&limit=20&status=available",
      setup: () => mockUseCase("GetProductsUseCase", { execute: productList }),
      assert: (data: typeof productList) => {
        expect(data.total).toBe(1);
        expect(data.items[0].name).toBe(product.name);
      },
    },
    {
      title: "POST / creates a product",
      method: "POST",
      url: "/api/v1/products",
      payload: {
        name: "Tea",
        costPrice: 3000,
        sellingPrice: 5000,
      },
      setup: () =>
        mockUseCase("CreateProductUseCase", {
          execute: {
            ...product,
            id: 6,
            name: "Tea",
            costPrice: 3000,
            sellingPrice: 5000,
          },
        }),
      assert: (data: typeof product) => {
        expect(data.name).toBe("Tea");
      },
    },
    {
      title: "PUT /:id updates a product",
      method: "PUT",
      url: "/api/v1/products/5",
      payload: {
        sellingPrice: 12000,
      },
      setup: () =>
        mockUseCase("UpdateProductUseCase", {
          execute: { ...product, sellingPrice: 12000 },
        }),
      assert: (data: typeof product) => {
        expect(data.sellingPrice).toBe(12000);
      },
    },
    {
      title: "DELETE /:id deletes a product",
      method: "DELETE",
      url: "/api/v1/products/5",
      setup: () => mockUseCase("DeleteProductUseCase", { execute: null }),
      assert: (data: null) => {
        expect(data).toBeNull();
      },
    },
    {
      title: "POST /:id/adjust-stock adjusts stock",
      method: "POST",
      url: "/api/v1/products/5/adjust-stock",
      payload: {
        quantityChange: 2,
        reason: "manual",
        notes: "restock",
      },
      setup: () =>
        mockUseCase("AdjustProductStockUseCase", {
          execute: genericOperationResult,
        }),
      assert: (data: typeof genericOperationResult) => {
        expect(data.updated).toBe(true);
      },
    },
    {
      title: "POST /:id/reconcile reconciles stock",
      method: "POST",
      url: "/api/v1/products/5/reconcile",
      setup: () =>
        mockUseCase("ReconcileStockUseCase", {
          execute: genericOperationResult,
        }),
      assert: (data: typeof genericOperationResult) => {
        expect(data.updated).toBe(true);
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

  test("GET / with categoryId and supplierId parses optional filters (covers src/routes/v1/products/index.ts:39-40)", async () => {
    mockUseCase("GetProductsUseCase", { execute: productList });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/products?page=1&limit=20&categoryId=2&supplierId=4",
      headers: ctx.authHeaders(),
    });

    const data = expectOk(response);
    expect(data).toMatchObject({
      total: 1,
      items: [{ id: product.id, name: product.name }],
    });
    expect(
      getUseCaseMock("GetProductsUseCase", "execute"),
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        categoryId: 2,
        supplierId: 4,
      }),
    );
  });

  test("POST /:id/adjust-stock returns 401 when request.user is missing (RBAC blocks unauthenticated requests)", async () => {
    const branchCtx = await buildApp({
      authenticate: async () => {},
    });

    try {
      const response = await branchCtx.app.inject({
        method: "POST",
        url: "/api/v1/products/5/adjust-stock",
        payload: {
          quantityChange: 2,
          reason: "manual",
          notes: "restock",
        },
      });

      expectError(response, 401, "UNAUTHORIZED");
    } finally {
      await branchCtx.close();
    }
  });

  test.each([
    {
      method: "GET",
      url: "/api/v1/products?page=bad",
    },
    {
      method: "POST",
      url: "/api/v1/products",
      payload: { name: "Tea" },
    },
    {
      method: "PUT",
      url: "/api/v1/products/not-a-number",
      payload: { sellingPrice: 1000 },
    },
    {
      method: "POST",
      url: "/api/v1/products/5/adjust-stock",
      payload: { reason: "manual" },
    },
    {
      method: "POST",
      url: "/api/v1/products/not-a-number/reconcile",
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
      url: "/api/v1/products",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when stock adjustment is forbidden", async () => {
    mockUseCase("AdjustProductStockUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/products/5/adjust-stock",
      payload: { quantityChange: 1, reason: "manual" },
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when deleting a missing product", async () => {
    mockUseCase("DeleteProductUseCase", {
      execute: async () => {
        throw new NotFoundError("missing");
      },
    });

    const response = await ctx.app.inject({
      method: "DELETE",
      url: "/api/v1/products/999",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });

  // ── Covers L37-42: page/limit/categoryId/supplierId ternary fallback branches ──
  test("GET /products without optional query params hits all fallbacks", async () => {
    mockUseCase("GetProductsUseCase", { execute: productList });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/products",
      headers: ctx.authHeaders(),
    });

    expectOk(response);
  });

  // ── Negative-path: DELETE with no auth → 401 ──
  test("returns 401 when deleting without auth", async () => {
    const response = await ctx.app.inject({
      method: "DELETE",
      url: "/api/v1/products/5",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  // ── Negative-path: POST with completely empty body → 400 ──
  test("returns 400 when POST /products body is completely empty", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/products",
      payload: {},
      headers: ctx.authHeaders(),
    });

    expectError(response, 400, "VALIDATION_ERROR");
  });
});
