import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { FastifyPluginAsync } from "fastify";
import { NotFoundError, PermissionDeniedError } from "@nuqta/core";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import {
  customerLedger,
  genericOperationResult,
  paymentResult,
} from "../../../helpers/fixtures.ts";
import {
  getUseCaseMock,
  mockUseCase,
  resetMockCore,
} from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/customer-ledger", () => {
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
      title: "GET /:customerId returns the customer ledger",
      method: "GET",
      url: "/api/v1/customer-ledger/3?dateFrom=2026-03-01&dateTo=2026-03-02&limit=10&offset=0",
      setup: () =>
        mockUseCase("GetCustomerLedgerUseCase", { execute: customerLedger }),
      assert: (data: typeof customerLedger) => {
        expect(data.balance).toBe(customerLedger.balance);
      },
    },
    {
      title: "POST /:customerId/payments records a payment",
      method: "POST",
      url: "/api/v1/customer-ledger/3/payments",
      payload: {
        amount: 1000,
        paymentMethod: "cash",
      },
      setup: () =>
        mockUseCase("RecordCustomerPaymentUseCase", { execute: paymentResult }),
      assert: (data: typeof paymentResult) => {
        expect(data.amount).toBe(paymentResult.amount);
      },
    },
    {
      title: "POST /:customerId/adjustments records an adjustment",
      method: "POST",
      url: "/api/v1/customer-ledger/3/adjustments",
      payload: {
        amount: 1000,
        notes: "rounding",
      },
      setup: () =>
        mockUseCase("AddCustomerLedgerAdjustmentUseCase", {
          execute: genericOperationResult,
        }),
      assert: (data: typeof genericOperationResult) => {
        expect(data.updated).toBe(true);
      },
    },
    {
      title: "POST /reconcile returns reconcile data",
      method: "POST",
      url: "/api/v1/customer-ledger/reconcile",
      setup: () =>
        mockUseCase("ReconcileCustomerDebtUseCase", {
          execute: genericOperationResult,
        }),
      assert: (data: typeof genericOperationResult) => {
        expect(data.updated).toBe(true);
      },
    },
    {
      title: "POST /reconcile?repair=true uses the repair branch",
      method: "POST",
      url: "/api/v1/customer-ledger/reconcile?repair=true",
      setup: () => mockUseCase("ReconcileCustomerDebtUseCase", { repair: [3] }),
      assert: (data: { corrected: number[] }) => {
        expect(data.corrected).toEqual([3]);
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

  test("POST /:customerId/payments returns 401 when request.user is missing (RBAC blocks unauthenticated requests)", async () => {
    const branchCtx = await buildApp({
      authenticate: async () => {},
    });

    try {
      const response = await branchCtx.app.inject({
        method: "POST",
        url: "/api/v1/customer-ledger/3/payments",
        payload: {
          amount: 1000,
          paymentMethod: "cash",
        },
      });

      expectError(response, 401, "UNAUTHORIZED");
    } finally {
      await branchCtx.close();
    }
  });

  test("POST /:customerId/adjustments returns 401 when request.user is missing (RBAC blocks unauthenticated requests)", async () => {
    const branchCtx = await buildApp({
      authenticate: async () => {},
    });

    try {
      const response = await branchCtx.app.inject({
        method: "POST",
        url: "/api/v1/customer-ledger/3/adjustments",
        payload: {
          amount: 1000,
          notes: "rounding",
        },
      });

      expectError(response, 401, "UNAUTHORIZED");
    } finally {
      await branchCtx.close();
    }
  });

  test("POST /reconcile falls back to an empty query object when the parser returns undefined (covers src/routes/v1/customer-ledger/index.ts:90)", async () => {
    const unsetQueryPlugin: FastifyPluginAsync = async (app) => {
      app.addHook("preHandler", async (request) => {
        if (request.url === "/api/v1/customer-ledger/reconcile?repair=false") {
          Object.defineProperty(request, "query", {
            configurable: true,
            enumerable: true,
            get: () => undefined,
          });
        }
      });
    };
    mockUseCase("ReconcileCustomerDebtUseCase", {
      execute: genericOperationResult,
    });

    const branchCtx = await buildApp({
      plugins: [unsetQueryPlugin],
    });

    try {
      const response = await branchCtx.app.inject({
        method: "POST",
        url: "/api/v1/customer-ledger/reconcile?repair=false",
        headers: branchCtx.authHeaders(),
      });

      const data = expectOk(response);
      expect(data).toMatchObject({ updated: true });
      expect(
        getUseCaseMock("ReconcileCustomerDebtUseCase", "execute"),
      ).toHaveBeenCalledOnce();
    } finally {
      await branchCtx.close();
    }
  });

  test.each([
    {
      method: "GET",
      url: "/api/v1/customer-ledger/not-a-number",
    },
    {
      method: "POST",
      url: "/api/v1/customer-ledger/3/payments",
      payload: {
        paymentMethod: "cash",
      },
    },
    {
      method: "POST",
      url: "/api/v1/customer-ledger/3/adjustments",
      payload: {},
    },
    {
      method: "POST",
      url: "/api/v1/customer-ledger/reconcile?repair=maybe",
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
      url: "/api/v1/customer-ledger/3",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when recording a customer payment is forbidden", async () => {
    mockUseCase("RecordCustomerPaymentUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/customer-ledger/3/payments",
      payload: {
        amount: 1000,
        paymentMethod: "cash",
      },
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when the customer ledger is missing", async () => {
    mockUseCase("GetCustomerLedgerUseCase", {
      execute: async () => {
        throw new NotFoundError("missing");
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/customer-ledger/3",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });

  // ── Covers L35-36: limit/offset ternary fallback branches ──
  test("GET /customer-ledger/:id without optional query params hits default fallbacks", async () => {
    mockUseCase("GetCustomerLedgerUseCase", {
      execute: { entries: [], balance: 0 },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/customer-ledger/3",
      headers: ctx.authHeaders(),
    });

    expectOk(response);
  });
});
