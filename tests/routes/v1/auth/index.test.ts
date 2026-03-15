import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { UnauthorizedError } from "../../../../src/domain/index.js";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import { authPayload, user } from "../../../helpers/fixtures.ts";
import { mockUseCase, resetMockCore } from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/auth", () => {
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

  test("POST /login returns a signed token", async () => {
    mockUseCase("LoginUseCase", {
      execute: {
        user,
        permissions: authPayload.permissions,
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: "admin",
        password: "secret",
      },
    });

    const data = expectOk<{
      token: string;
      user: typeof user;
      permissions: string[];
    }>(response);
    expect(typeof data.token).toBe("string");
    expect(data.user.username).toBe(user.username);
    expect(data.permissions).toEqual(authPayload.permissions);
  });

  test("POST /register returns the first user", async () => {
    mockUseCase("RegisterFirstUserUseCase", {
      execute: user,
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        username: "admin",
        password: "secret",
        fullName: "Admin User",
        phone: "7700000000",
      },
    });

    const data = expectOk<typeof user>(response);
    expect(data.id).toBe(user.id);
    expect(data.fullName).toBe(user.fullName);
  });

  test("GET /setup-status returns the setup status payload", async () => {
    mockUseCase("CheckInitialSetupUseCase", {
      execute: {
        isInitialized: false,
        hasUsers: true,
        hasCompanyInfo: false,
        wizardCompleted: false,
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/auth/setup-status",
    });

    const data = expectOk<{
      isInitialized: boolean;
      hasUsers: boolean;
      hasCompanyInfo: boolean;
      wizardCompleted: boolean;
    }>(response);
    expect(data.hasUsers).toBe(true);
    expect(data.isInitialized).toBe(false);
  });

  test.each([
    {
      title: "login body",
      url: "/api/v1/auth/login",
      payload: { username: "admin" },
    },
    {
      title: "register body",
      url: "/api/v1/auth/register",
      payload: { username: "admin", password: "secret" },
    },
  ])("returns 400 for invalid %s", async ({ url, payload }) => {
    const response = await ctx.app.inject({
      method: "POST",
      url,
      payload,
    });

    const error = expectError(response, 400, "VALIDATION_ERROR");
    expect(Array.isArray(error.details)).toBe(true);
  });

  test("POST /login returns 401 when credentials are rejected", async () => {
    mockUseCase("LoginUseCase", {
      execute: async () => {
        throw new UnauthorizedError("Invalid credentials");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: "admin",
        password: "wrong",
      },
    });

    expectError(response, 401, "UNAUTHORIZED");
  });
});
