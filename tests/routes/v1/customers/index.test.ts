import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NotFoundError, PermissionDeniedError } from "../../../../src/domain/index.js";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import { customer } from "../../../helpers/fixtures.ts";
import {
  mockUseCase,
  resetMockCore,
} from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/customers", () => {
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
      title: "GET / returns the customer list",
      method: "GET",
      url: "/api/v1/customers?search=Layla&page=1&limit=10",
      setup: () => {
        ctx.repos.customer.findAll = async () => ({ items: [customer], total: 1 });
      },
      assert: (data: { items: (typeof customer)[]; total: number }) => {
        expect(data.items[0].name).toBe(customer.name);
      },
    },
    {
      title: "POST / creates a customer",
      method: "POST",
      url: "/api/v1/customers",
      payload: { name: "Samir", phone: "7701231234", isActive: true },
      setup: () =>
        mockUseCase("CreateCustomerUseCase", {
          execute: { ...customer, id: 8, name: "Samir" },
        }),
      assert: (data: typeof customer) => {
        expect(data.name).toBe("Samir");
      },
    },
    {
      title: "PUT /:id updates a customer",
      method: "PUT",
      url: "/api/v1/customers/3",
      payload: { city: "Basra" },
      setup: () =>
        mockUseCase("UpdateCustomerUseCase", {
          execute: { ...customer, city: "Basra" },
        }),
      assert: (data: typeof customer) => {
        expect(data.city).toBe("Basra");
      },
    },
    {
      title: "DELETE /:id removes a customer",
      method: "DELETE",
      url: "/api/v1/customers/3",
      setup: () => { ctx.repos.customer.delete = async () => null; },
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
      url: "/api/v1/customers?page=bad",
    },
    {
      method: "POST",
      url: "/api/v1/customers",
      payload: { phone: "7700000000" },
    },
    {
      method: "PUT",
      url: "/api/v1/customers/3",
      payload: { isActive: "nope" },
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
      url: "/api/v1/customers",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when update is forbidden", async () => {
    mockUseCase("UpdateCustomerUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "PUT",
      url: "/api/v1/customers/3",
      payload: { city: "Denied" },
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when deleting a missing customer", async () => {
    ctx.repos.customer.delete = async () => {
      throw new NotFoundError("missing");
    };

    const response = await ctx.app.inject({
      method: "DELETE",
      url: "/api/v1/customers/999",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });

  // ── Customer totalDebt ledger consistency ──────────────────────────────────
  // totalDebt in list and detail must come from the customer ledger, not the
  // stale customers.total_debt column.

  describe("totalDebt is derived from customer ledger", () => {
    test("GET /customers list: totalDebt reflects ledger balance (not stale column)", async () => {
      // Simulate a customer whose stale column value would differ from the ledger
      const staleCustomer = { ...customer, totalDebt: 9999 };
      const ledgerBalance = 20000;

      ctx.repos.customer.findAll = async () => ({
        items: [{ ...staleCustomer, totalDebt: ledgerBalance }],
        total: 1,
      });

      const response = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/customers",
        headers: ctx.authHeaders(),
      });

      const data = expectOk<{ items: typeof customer[]; total: number }>(response);
      expect(data.items[0].totalDebt).toBe(ledgerBalance);
    });

    test("GET /customers/:id detail: totalDebt reflects ledger balance (not stale column)", async () => {
      const ledgerBalance = 35000;

      ctx.repos.customer.findById = async () => ({ ...customer, totalDebt: ledgerBalance });

      const response = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/customers/${customer.id}`,
        headers: ctx.authHeaders(),
      });

      const data = expectOk<typeof customer>(response);
      expect(data.totalDebt).toBe(ledgerBalance);
    });

    test("GET /customers list: totalDebt is 0 when no ledger entries exist", async () => {
      ctx.repos.customer.findAll = async () => ({
        items: [{ ...customer, totalDebt: 0 }],
        total: 1,
      });

      const response = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/customers",
        headers: ctx.authHeaders(),
      });

      const data = expectOk<{ items: typeof customer[]; total: number }>(response);
      expect(data.items[0].totalDebt).toBe(0);
    });
  });

  test("GET /customers without optional query params hits default fallbacks", async () => {
    ctx.repos.customer.findAll = async () => ({ items: [], total: 0 });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/customers",
      headers: ctx.authHeaders(),
    });

    expectOk(response);
  });

  test("GET /customers with page but no limit uses the default page-size offset (covers src/routes/v1/customers/index.ts:32)", async () => {
    const spy = vi.fn().mockResolvedValue({ items: [customer], total: 1 });
    ctx.repos.customer.findAll = spy;

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/customers?page=2",
      headers: ctx.authHeaders(),
    });

    const data = expectOk<{ items: (typeof customer)[]; total: number }>(
      response,
    );
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items[0]).toMatchObject({
      id: customer.id,
      name: customer.name,
    });
    expect(spy).toHaveBeenCalledWith({
      search: undefined,
      limit: undefined,
      offset: 20,
    });
  });
});
