import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NotFoundError, PermissionDeniedError } from "../../../../src/domain/index.js";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import { employee, payrollRun } from "../../../helpers/fixtures.ts";
import {
  getUseCaseMock,
  mockUseCase,
  resetMockCore,
} from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

describe("/api/v1/hr", () => {
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
      title: "GET /employees returns employees",
      method: "GET",
      url: "/api/v1/hr/employees?department=Finance&isActive=true&limit=10&offset=0",
      setup: () => {
        ctx.repos.employee.findAll = async () => ({ items: [employee], total: 1 });
      },
      assert: (data: { items: (typeof employee)[]; total: number }) => {
        expect(data.items[0].name).toBe(employee.name);
        expect(data.total).toBe(1);
      },
    },
    {
      title: "GET /employees/:id returns one employee",
      method: "GET",
      url: "/api/v1/hr/employees/13",
      setup: () =>
        mockUseCase("GetEmployeeByIdUseCase", { execute: employee }),
      assert: (data: typeof employee) => {
        expect(data.id).toBe(employee.id);
      },
    },
    {
      title: "POST /employees creates an employee",
      method: "POST",
      url: "/api/v1/hr/employees",
      payload: {
        name: employee.name,
        salary: employee.salary,
        position: employee.position,
        department: employee.department,
        isActive: true,
      },
      setup: () => mockUseCase("CreateEmployeeUseCase", { execute: employee }),
      assert: (data: typeof employee) => {
        expect(data.salary).toBe(employee.salary);
      },
    },
    {
      title: "PUT /employees/:id updates an employee",
      method: "PUT",
      url: "/api/v1/hr/employees/13",
      payload: { salary: 1600000 },
      setup: () =>
        mockUseCase("UpdateEmployeeUseCase", {
          execute: { ...employee, salary: 1600000 },
        }),
      assert: (data: typeof employee) => {
        expect(data.salary).toBe(1600000);
      },
    },
    {
      title: "GET /payroll-runs returns payroll runs",
      method: "GET",
      url: "/api/v1/hr/payroll-runs?status=draft&periodYear=2026&periodMonth=3",
      setup: () => {
        ctx.repos.payroll.findAll = async () => ({ items: [payrollRun], total: 1 });
      },
      assert: (data: { items: (typeof payrollRun)[]; total: number }) => {
        expect(data.items[0].totalNetPay).toBe(payrollRun.totalNetPay);
      },
    },
    {
      title: "GET /payroll-runs/:id returns one payroll run",
      method: "GET",
      url: "/api/v1/hr/payroll-runs/101",
      setup: () =>
        mockUseCase("GetPayrollRunByIdUseCase", { execute: payrollRun }),
      assert: (data: typeof payrollRun) => {
        expect(data.id).toBe(payrollRun.id);
      },
    },
    {
      title: "POST /payroll-runs creates a draft payroll run",
      method: "POST",
      url: "/api/v1/hr/payroll-runs",
      payload: {
        periodYear: 2026,
        periodMonth: 3,
        paymentDate: "2026-03-31",
        items: [
          {
            employeeId: employee.id,
            deductions: 50000,
            bonuses: 100000,
            notes: "Overtime",
          },
        ],
      },
      setup: () =>
        mockUseCase("CreatePayrollRunUseCase", { execute: payrollRun }),
      assert: (data: typeof payrollRun) => {
        expect(data.status).toBe("draft");
      },
    },
    {
      title: "POST /payroll-runs/:id/approve approves a payroll run",
      method: "POST",
      url: "/api/v1/hr/payroll-runs/101/approve",
      setup: () =>
        mockUseCase("ApprovePayrollRunUseCase", {
          execute: {
            ...payrollRun,
            status: "approved",
            journalEntryId: 81,
          },
        }),
      assert: (data: typeof payrollRun) => {
        expect(data.status).toBe("approved");
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

  test("POST /payroll-runs passes the authenticated user id into the use case", async () => {
    mockUseCase("CreatePayrollRunUseCase", { execute: payrollRun });

    const payload = {
      periodYear: 2026,
      periodMonth: 3,
      items: [{ employeeId: employee.id }],
    };

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/hr/payroll-runs",
      payload,
      headers: ctx.authHeaders({ sub: 77 }),
    });

    expectOk(response);
    expect(getUseCaseMock("CreatePayrollRunUseCase", "execute")).toHaveBeenCalledWith(
      {
        ...payload,
        items: [{ employeeId: employee.id, deductions: 0, bonuses: 0 }],
      },
      "77",
    );
  });

  test.each([
    {
      method: "GET",
      url: "/api/v1/hr/employees?isActive=maybe",
    },
    {
      method: "GET",
      url: "/api/v1/hr/payroll-runs?periodMonth=13",
    },
    {
      method: "POST",
      url: "/api/v1/hr/employees",
      payload: { name: "Sara" },
    },
    {
      method: "POST",
      url: "/api/v1/hr/payroll-runs",
      payload: { periodYear: 2026, periodMonth: 3, items: [] },
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
      url: "/api/v1/hr/employees",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when payroll approval is forbidden", async () => {
    mockUseCase("ApprovePayrollRunUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/hr/payroll-runs/101/approve",
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when an employee is missing", async () => {
    mockUseCase("GetEmployeeByIdUseCase", {
      execute: async () => {
        throw new NotFoundError("missing");
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/hr/employees/999",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });
});
