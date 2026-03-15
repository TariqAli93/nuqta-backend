import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NotFoundError, PermissionDeniedError } from "../../../../src/domain/index.js";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import { user } from "../../../helpers/fixtures.ts";
import { mockUseCase, resetMockCore } from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/users", () => {
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
      title: "GET / returns the user list",
      method: "GET",
      url: "/api/v1/users",
      setup: () => {
        ctx.repos.user.findAll = vi.fn().mockResolvedValue([user]);
      },
      assert: (data: typeof user[]) => {
        expect(Array.isArray(data)).toBe(true);
        expect(data[0].username).toBe(user.username);
      },
    },
    {
      title: "GET /:id returns one user",
      method: "GET",
      url: "/api/v1/users/1",
      setup: () => {
        ctx.repos.user.findById = vi.fn().mockResolvedValue(user);
      },
      assert: (data: typeof user) => {
        expect(data.id).toBe(user.id);
      },
    },
    {
      title: "POST / creates a user",
      method: "POST",
      url: "/api/v1/users",
      payload: {
        username: "cashier",
        password: "secret",
        fullName: "Cashier User",
        role: "cashier",
        isActive: true,
      },
      setup: () =>
        mockUseCase("CreateUserUseCase", {
          execute: { ...user, id: 2, username: "cashier", role: "cashier" },
        }),
      assert: (data: typeof user) => {
        expect(data.username).toBe("cashier");
      },
    },
    {
      title: "PUT /:id updates a user",
      method: "PUT",
      url: "/api/v1/users/1",
      payload: { fullName: "Updated User" },
      setup: () =>
        mockUseCase("UpdateUserUseCase", {
          execute: { ...user, fullName: "Updated User" },
        }),
      assert: (data: typeof user) => {
        expect(data.fullName).toBe("Updated User");
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
      title: "invalid user id",
      method: "GET",
      url: "/api/v1/users/not-a-number",
    },
    {
      title: "invalid create body",
      method: "POST",
      url: "/api/v1/users",
      payload: { username: "cashier" },
    },
    {
      title: "invalid update body",
      method: "PUT",
      url: "/api/v1/users/1",
      payload: { isActive: "yes" },
    },
  ])("$title returns 400", async ({ method, url, payload }) => {
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
      url: "/api/v1/users",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when the update use case denies access", async () => {
    mockUseCase("UpdateUserUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("forbidden");
      },
    });

    const response = await ctx.app.inject({
      method: "PUT",
      url: "/api/v1/users/1",
      payload: { fullName: "Denied" },
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when a user does not exist", async () => {
    ctx.repos.user.findById = vi.fn().mockResolvedValue(null);

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/users/999",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });
});
