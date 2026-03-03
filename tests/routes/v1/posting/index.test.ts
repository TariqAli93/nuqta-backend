import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NotFoundError, PermissionDeniedError } from "@nuqta/core";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import {
  genericOperationResult,
  postingBatch,
} from "../../../helpers/fixtures.ts";
import { mockUseCase, resetMockCore } from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/posting", () => {
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
      title: "POST /period posts a batch",
      url: "/api/v1/posting/period",
      payload: {
        periodType: "month",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
      },
      setup: () => mockUseCase("PostPeriodUseCase", { execute: postingBatch }),
      assert: (data: typeof postingBatch) => {
        expect(data.status).toBe(postingBatch.status);
      },
    },
    {
      title: "POST /entries/:id/reverse reverses an entry",
      url: "/api/v1/posting/entries/81/reverse",
      setup: () =>
        mockUseCase("ReverseEntryUseCase", { execute: genericOperationResult }),
      assert: (data: typeof genericOperationResult) => {
        expect(data.updated).toBe(true);
      },
    },
    {
      title: "POST /entries/:id/post posts an entry",
      url: "/api/v1/posting/entries/81/post",
      setup: () =>
        mockUseCase("PostIndividualEntryUseCase", {
          execute: genericOperationResult,
        }),
      assert: (data: typeof genericOperationResult) => {
        expect(data.updated).toBe(true);
      },
    },
    {
      title: "POST /entries/:id/unpost unposts an entry",
      url: "/api/v1/posting/entries/81/unpost",
      setup: () =>
        mockUseCase("UnpostIndividualEntryUseCase", {
          execute: genericOperationResult,
        }),
      assert: (data: typeof genericOperationResult) => {
        expect(data.updated).toBe(true);
      },
    },
  ])("$title", async ({ url, payload, setup, assert }) => {
    setup();

    const response = await ctx.app.inject({
      method: "POST",
      url,
      payload,
      headers: ctx.authHeaders(),
    });

    const data = expectOk(response);
    assert(data as never);
  });

  test.each([
    {
      title:
        "POST /period returns 401 when request.user is missing (RBAC blocks unauthenticated requests)",
      url: "/api/v1/posting/period",
      payload: {
        periodType: "month",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
      },
    },
    {
      title:
        "POST /entries/:id/reverse returns 401 when request.user is missing (RBAC blocks unauthenticated requests)",
      url: "/api/v1/posting/entries/81/reverse",
    },
    {
      title:
        "POST /entries/:id/post returns 401 when request.user is missing (RBAC blocks unauthenticated requests)",
      url: "/api/v1/posting/entries/81/post",
    },
    {
      title:
        "POST /entries/:id/unpost returns 401 when request.user is missing (RBAC blocks unauthenticated requests)",
      url: "/api/v1/posting/entries/81/unpost",
    },
  ])("$title", async ({ url, payload }) => {
    const branchCtx = await buildApp({
      authenticate: async () => {},
    });

    try {
      const response = await branchCtx.app.inject({
        method: "POST",
        url,
        payload,
      });

      expectError(response, 401, "UNAUTHORIZED");
    } finally {
      await branchCtx.close();
    }
  });

  test.each([
    {
      url: "/api/v1/posting/period",
      payload: {
        periodType: "month",
      },
    },
    {
      url: "/api/v1/posting/entries/not-a-number/reverse",
    },
    {
      url: "/api/v1/posting/entries/not-a-number/post",
    },
    {
      url: "/api/v1/posting/entries/not-a-number/unpost",
    },
  ])("returns 400 for invalid POST %s", async ({ url, payload }) => {
    const response = await ctx.app.inject({
      method: "POST",
      url,
      payload,
      headers: ctx.authHeaders(),
    });

    expectError(response, 400, "VALIDATION_ERROR");
  });

  test("returns 401 when auth is missing", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/posting/period",
      payload: {
        periodType: "month",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
      },
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when posting an entry is forbidden", async () => {
    mockUseCase("PostIndividualEntryUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/posting/entries/81/post",
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when reversing a missing entry", async () => {
    mockUseCase("ReverseEntryUseCase", {
      execute: async () => {
        throw new NotFoundError("missing");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/posting/entries/999/reverse",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });

  // ── Negative-path: invalid token → 401 ──
  test("returns 401 when posting with an invalid token", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/posting/entries/81/reverse",
      headers: { authorization: "Bearer tampered.invalid.token" },
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  // ── Negative-path: POST /period with empty body → 400 ──
  test("returns 400 when POST /posting/period body is completely empty", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/posting/period",
      payload: {},
      headers: ctx.authHeaders(),
    });

    expectError(response, 400, "VALIDATION_ERROR");
  });
});
