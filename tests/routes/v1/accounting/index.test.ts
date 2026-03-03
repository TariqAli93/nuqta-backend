import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { FastifyPluginAsync } from "fastify";
import { NotFoundError, PermissionDeniedError } from "@nuqta/core";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import {
  account,
  accountingStatus,
  genericOperationResult,
  journalEntry,
  trialBalanceRow,
} from "../../../helpers/fixtures.ts";
import {
  getUseCaseMock,
  mockUseCase,
  resetMockCore,
} from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/accounting", () => {
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
      title: "GET /accounts returns chart of accounts",
      method: "GET",
      url: "/api/v1/accounting/accounts",
      setup: () => mockUseCase("GetAccountsUseCase", { execute: [account] }),
      assert: (data: (typeof account)[]) => {
        expect(data[0].code).toBe(account.code);
      },
    },
    {
      title: "GET /journal-entries returns entries",
      method: "GET",
      url: "/api/v1/accounting/journal-entries?sourceType=sale&dateFrom=2026-03-01&dateTo=2026-03-02&isPosted=true&limit=10&offset=0",
      setup: () =>
        mockUseCase("GetJournalEntriesUseCase", { execute: [journalEntry] }),
      assert: (data: (typeof journalEntry)[]) => {
        expect(data[0].entryNumber).toBe(journalEntry.entryNumber);
      },
    },
    {
      title: "GET /journal-entries/:id returns one entry",
      method: "GET",
      url: "/api/v1/accounting/journal-entries/81",
      setup: () =>
        mockUseCase("GetEntryByIdUseCase", { execute: journalEntry }),
      assert: (data: typeof journalEntry) => {
        expect(data.id).toBe(journalEntry.id);
      },
    },
    {
      title: "GET /trial-balance returns rows",
      method: "GET",
      url: "/api/v1/accounting/trial-balance?dateFrom=2026-03-01&dateTo=2026-03-02",
      setup: () =>
        mockUseCase("GetTrialBalanceUseCase", { execute: [trialBalanceRow] }),
      assert: (data: (typeof trialBalanceRow)[]) => {
        expect(data[0].accountCode).toBe(trialBalanceRow.accountCode);
      },
    },
    {
      title: "GET /profit-loss returns a report",
      method: "GET",
      url: "/api/v1/accounting/profit-loss?dateFrom=2026-03-01&dateTo=2026-03-02",
      setup: () =>
        mockUseCase("GetProfitLossUseCase", { execute: { netProfit: 5000 } }),
      assert: (data: { netProfit: number }) => {
        expect(data.netProfit).toBe(5000);
      },
    },
    {
      title: "GET /balance-sheet returns a report",
      method: "GET",
      url: "/api/v1/accounting/balance-sheet?fromDate=2026-03-01&toDate=2026-03-02",
      setup: () =>
        mockUseCase("GetBalanceSheetUseCase", {
          execute: { assets: 5000, liabilities: 1000 },
        }),
      assert: (data: { assets: number }) => {
        expect(data.assets).toBe(5000);
      },
    },
    {
      title: "POST /initialize initializes accounting",
      method: "POST",
      url: "/api/v1/accounting/initialize",
      payload: { seedDefaults: true },
      setup: () =>
        mockUseCase("InitializeAccountingUseCase", {
          execute: genericOperationResult,
        }),
      assert: (data: typeof genericOperationResult) => {
        expect(data.updated).toBe(true);
      },
    },
    {
      title: "GET /status returns initialization status",
      method: "GET",
      url: "/api/v1/accounting/status",
      setup: () =>
        mockUseCase("InitializeAccountingUseCase", {
          getStatus: accountingStatus,
        }),
      assert: (data: typeof accountingStatus) => {
        expect(data.isInitialized).toBe(true);
      },
    },
  ])("$title", async ({ method, url, payload, setup, assert }) => {
    setup();

    const response = await ctx.app.inject({
      method: method as import("fastify").HTTPMethods,
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
      url: "/api/v1/accounting/journal-entries?isPosted=maybe",
    },
    {
      method: "GET",
      url: "/api/v1/accounting/journal-entries/not-a-number",
    },
    {
      method: "GET",
      url: "/api/v1/accounting/trial-balance?dateFrom=bad",
    },
    {
      method: "GET",
      url: "/api/v1/accounting/profit-loss?dateTo=bad",
    },
    {
      method: "GET",
      url: "/api/v1/accounting/balance-sheet?fromDate=bad",
    },
  ])("returns 400 for invalid %s %s", async ({ method, url }) => {
    const response = await ctx.app.inject({
      method,
      url,
      headers: ctx.authHeaders(),
    });

    expectError(response, 400, "VALIDATION_ERROR");
  });

  test("returns 401 when auth is missing", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/accounting/accounts",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when initialization is forbidden", async () => {
    mockUseCase("InitializeAccountingUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/accounting/initialize",
      payload: { seedDefaults: true },
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when an entry is missing", async () => {
    mockUseCase("GetEntryByIdUseCase", {
      execute: async () => {
        throw new NotFoundError("missing");
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/accounting/journal-entries/999",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });

  // ── Covers L51-53: isPosted/limit/offset ternary fallback branches ──
  test("GET /journal-entries without optional query params hits default fallbacks", async () => {
    mockUseCase("GetJournalEntriesUseCase", { execute: [] });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/accounting/journal-entries",
      headers: ctx.authHeaders(),
    });

    expectOk(response);
  });

  test(
    "POST /initialize without a body falls back to an empty object (covers src/routes/v1/accounting/index.ts:126)",
    async () => {
      const unsetBodyPlugin: FastifyPluginAsync = async (app) => {
        app.addHook("preHandler", async (request) => {
          if (request.url === "/api/v1/accounting/initialize") {
            Object.defineProperty(request, "body", {
              configurable: true,
              enumerable: true,
              get: () => undefined,
            });
          }
        });
      };
      mockUseCase("InitializeAccountingUseCase", {
        execute: genericOperationResult,
      });

      const branchCtx = await buildApp({
        plugins: [unsetBodyPlugin],
      });

      try {
        const response = await branchCtx.app.inject({
          method: "POST",
          url: "/api/v1/accounting/initialize",
          payload: {},
          headers: branchCtx.authHeaders(),
        });

        const data = expectOk(response);
        expect(data).toMatchObject({ updated: true });
        expect(
          getUseCaseMock("InitializeAccountingUseCase", "execute"),
        ).toHaveBeenCalledWith({});
      } finally {
        await branchCtx.close();
      }
    },
  );
});
