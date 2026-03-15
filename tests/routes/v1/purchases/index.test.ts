import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PermissionDeniedError } from "@nuqta/core";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import { paymentResult, purchase } from "../../../helpers/fixtures.ts";
import { mockUseCase, resetMockCore } from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/purchases", () => {
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
      title: "GET / returns purchases",
      method: "GET",
      url: "/api/v1/purchases?search=PUR&status=received&limit=10&offset=0",
      setup: () => {
        ctx.repos.purchase.findAll = async () => ({ items: [purchase], total: 1 });
      },
      assert: (data: { items: (typeof purchase)[]; total: number }) => {
        expect(data.items[0].invoiceNumber).toBe(purchase.invoiceNumber);
      },
    },
    {
      title: "GET /:id returns one purchase",
      method: "GET",
      url: "/api/v1/purchases/21",
      setup: () => { ctx.repos.purchase.findById = async () => purchase; },
      assert: (data: typeof purchase) => {
        expect(data.id).toBe(purchase.id);
      },
    },
    {
      title: "POST / creates a purchase",
      method: "POST",
      url: "/api/v1/purchases",
      payload: {
        invoiceNumber: "PUR-002",
        supplierId: 4,
        items: [{ productId: 5, quantity: 1, unitCost: 7000 }],
      },
      setup: () =>
        mockUseCase("CreatePurchaseUseCase", {
          execute: { ...purchase, id: 22, invoiceNumber: "PUR-002" },
        }),
      assert: (data: typeof purchase) => {
        expect(data.invoiceNumber).toBe("PUR-002");
      },
    },
    {
      title: "POST /:id/payments adds a payment",
      method: "POST",
      url: "/api/v1/purchases/21/payments",
      payload: {
        amount: 10000,
        paymentMethod: "cash",
      },
      setup: () =>
        mockUseCase("AddPurchasePaymentUseCase", {
          execute: paymentResult,
        }),
      assert: (data: typeof paymentResult) => {
        expect(data.amount).toBe(paymentResult.amount);
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

  test("POST / returns 401 when request.user is missing (RBAC blocks unauthenticated requests)", async () => {
    const branchCtx = await buildApp({
      authenticate: async () => {},
    });

    try {
      const response = await branchCtx.app.inject({
        method: "POST",
        url: "/api/v1/purchases",
        payload: {
          invoiceNumber: "PUR-002",
          supplierId: 4,
          items: [{ productId: 5, quantity: 1, unitCost: 7000 }],
        },
      });

      expectError(response, 401, "UNAUTHORIZED");
    } finally {
      await branchCtx.close();
    }
  });

  test("POST /:id/payments returns 401 when request.user is missing (RBAC blocks unauthenticated requests)", async () => {
    const branchCtx = await buildApp({
      authenticate: async () => {},
    });

    try {
      const response = await branchCtx.app.inject({
        method: "POST",
        url: "/api/v1/purchases/21/payments",
        payload: {
          amount: 10000,
          paymentMethod: "cash",
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
      url: "/api/v1/purchases?limit=bad",
    },
    {
      method: "GET",
      url: "/api/v1/purchases/not-a-number",
    },
    {
      method: "POST",
      url: "/api/v1/purchases",
      payload: {
        supplierId: 4,
        items: [{ productId: 5, quantity: 1, unitCost: 7000 }],
      },
    },
    {
      method: "POST",
      url: "/api/v1/purchases/21/payments",
      payload: {
        paymentMethod: "cash",
      },
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
      url: "/api/v1/purchases",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when adding a purchase payment is forbidden", async () => {
    mockUseCase("AddPurchasePaymentUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/purchases/21/payments",
      payload: {
        amount: 10000,
        paymentMethod: "cash",
      },
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when a purchase does not exist", async () => {
    ctx.repos.purchase.findById = async () => null;

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/purchases/999",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });

  // ── Covers L32-33: limit/offset ternary fallback branches ──
  test("GET /purchases without optional query params hits default fallbacks", async () => {
    ctx.repos.purchase.findAll = async () => ({ items: [], total: 0 });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/purchases",
      headers: ctx.authHeaders(),
    });

    expectOk(response);
  });
});
