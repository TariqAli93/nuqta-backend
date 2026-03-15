import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NotFoundError, PermissionDeniedError } from "../../../../src/domain/index.js";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import { category } from "../../../helpers/fixtures.ts";
import { mockUseCase, resetMockCore } from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/categories", () => {
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
      title: "GET / returns categories",
      method: "GET",
      url: "/api/v1/categories",
      setup: () => {
        ctx.repos.category.findAll = vi.fn().mockResolvedValue([category]);
      },
      assert: (data: typeof category[]) => {
        expect(data[0].name).toBe(category.name);
      },
    },
    {
      title: "POST / creates a category",
      method: "POST",
      url: "/api/v1/categories",
      payload: { name: "Tea", description: "Leaf products", isActive: true },
      setup: () =>
        mockUseCase("CreateCategoryUseCase", {
          execute: { ...category, id: 9, name: "Tea" },
        }),
      assert: (data: typeof category) => {
        expect(data.name).toBe("Tea");
      },
    },
    {
      title: "PUT /:id updates a category",
      method: "PUT",
      url: "/api/v1/categories/2",
      payload: { description: "Updated" },
      setup: () =>
        mockUseCase("UpdateCategoryUseCase", {
          execute: { ...category, description: "Updated" },
        }),
      assert: (data: typeof category) => {
        expect(data.description).toBe("Updated");
      },
    },
    {
      title: "DELETE /:id returns a null payload",
      method: "DELETE",
      url: "/api/v1/categories/2",
      setup: () => {
        ctx.repos.category.delete = vi.fn().mockResolvedValue(undefined);
      },
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
      method: "POST",
      url: "/api/v1/categories",
      payload: {},
    },
    {
      method: "PUT",
      url: "/api/v1/categories/not-a-number",
      payload: { name: "Bad" },
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
      url: "/api/v1/categories",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when updating is forbidden", async () => {
    mockUseCase("UpdateCategoryUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "PUT",
      url: "/api/v1/categories/2",
      payload: { name: "Denied" },
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when deleting a missing category", async () => {
    ctx.repos.category.delete = vi.fn().mockRejectedValue(new NotFoundError("missing"));

    const response = await ctx.app.inject({
      method: "DELETE",
      url: "/api/v1/categories/999",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });
});
