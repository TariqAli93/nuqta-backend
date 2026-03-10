import { afterEach, describe, expect, test, vi } from "vitest";
import { expectError, expectOk } from "./helpers/assertions.ts";
import { buildApp } from "./helpers/buildApp.ts";
import { mockUseCase, resetMockCore } from "./helpers/mockCore.ts";
import { resetMockData } from "./helpers/mockData.ts";

const autoloadMock = vi.fn();

vi.mock("@fastify/autoload", () => ({
  default: autoloadMock,
}));

describe("app bootstrap", () => {
  afterEach(() => {
    autoloadMock.mockReset();
  });

  test("registers autoload for plugins and versioned routes", async () => {
    const { default: appPlugin } = await import("../src/app.ts");
    const register = vi.fn();

    await appPlugin({ register } as never, { exposeHeadRoutes: false });

    expect(register).toHaveBeenCalledTimes(2);

    const pluginCall = register.mock.calls[0];
    const routeCall = register.mock.calls[1];

    expect(pluginCall[0]).toBe(autoloadMock);
    expect(String(pluginCall[1].dir).replace(/\\/g, "/")).toMatch(
      /src\/plugins$/,
    );
    expect(routeCall[0]).toBe(autoloadMock);
    expect(String(routeCall[1].dir).replace(/\\/g, "/")).toMatch(
      /src\/routes\/v1$/,
    );
    expect(routeCall[1].options.prefix).toBe("/api/v1");
  });

  // ── Covers L34: testOverrides.plugins ?? [] fallback (routes without plugins) ──
  test("enters testOverrides branch with only routes (plugins ?? [] fallback)", async () => {
    const { default: appPlugin } = await import("../src/app.ts");
    const register = vi.fn();
    const fakeRoute = vi.fn();

    await appPlugin(
      { register } as never,
      {
        testOverrides: {
          routes: [{ prefix: "/test", plugin: fakeRoute }],
        },
      } as any,
    );

    // Should register the route with /api/v1 prefix
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0][1]).toMatchObject({
      prefix: "/api/v1/test",
    });
  });

  // ── Covers L38: testOverrides.routes ?? [] fallback (plugins without routes) ──
  test("enters testOverrides branch with only plugins (routes ?? [] fallback)", async () => {
    const { default: appPlugin } = await import("../src/app.ts");
    const register = vi.fn();
    const fakePlugin = vi.fn();

    await appPlugin(
      { register } as never,
      {
        testOverrides: {
          plugins: [fakePlugin],
        },
      } as any,
    );

    // Should register only the plugin
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0][0]).toBe(fakePlugin);
  });

  test("serves versioned routes under /api/v1 and returns envelope 404 for unknown paths", async () => {
    resetMockCore();
    resetMockData();
    mockUseCase("CheckInitialSetupUseCase", {
      execute: {
        hasUsers: true,
        isSetupComplete: false,
      },
    });

    const ctx = await buildApp();

    try {
      const okResponse = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/auth/setup-status",
      });
      const notPrefixedResponse = await ctx.app.inject({
        method: "GET",
        url: "/auth/setup-status",
      });
      const unknownResponse = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/unknown",
      });

      expectOk(okResponse);
      expectError(notPrefixedResponse, 404, "NOT_FOUND");
      expectError(unknownResponse, 404, "NOT_FOUND");
    } finally {
      await ctx.close();
    }
  });

  test("exposes documented versioned paths in the OpenAPI spec", async () => {
    resetMockCore();
    resetMockData();

    const ctx = await buildApp();

    try {
      const docsResponse = await ctx.app.inject({
        method: "GET",
        url: "/docs/json",
      });
      const spec = JSON.parse(docsResponse.body) as {
        paths: Record<string, unknown>;
      };
      const paths = Object.keys(spec.paths);

      expect(docsResponse.statusCode).toBe(200);
      expect(paths).toEqual(
        expect.arrayContaining([
          "/api/v1/auth/login",
          "/api/v1/users/",
          "/api/v1/products/{id}/adjust-stock",
          "/api/v1/accounting/status",
          "/api/v1/hr/employees",
        ]),
      );
    } finally {
      await ctx.close();
    }
  });
});
