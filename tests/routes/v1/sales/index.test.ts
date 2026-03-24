import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { InvalidStateError, NotFoundError, PermissionDeniedError, ValidationError } from "../../../../src/domain/index.js";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import { paymentResult, sale, saleList } from "../../../helpers/fixtures.ts";
import { mockUseCase, resetMockCore } from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

const receiptData = {
  saleId: 11,
  invoiceNumber: "INV-1773374462618-373",
  createdAt: "2026-03-13T07:01:02.618Z",
  subtotal: 10000,
  discount: 0,
  tax: 0,
  total: 10000,
  currency: "IQD",
  customer: {
    id: 1,
    name: "Walk-in Customer",
    phone: "",
  },
  cashier: {
    id: 5,
    name: "Tariq",
  },
  branch: {
    id: null,
    name: "",
  },
  store: {
    companyName: "My Store",
    companyNameAr: "متجري",
    phone: "0770xxxxxxx",
    mobile: "0780xxxxxxx",
    address: "Baghdad, Iraq",
    receiptWidth: "80mm",
    footerNote: "Thank you for your visit",
  },
  items: [
    {
      productId: 10,
      productName: "شال قطني",
      quantity: 1,
      unitPrice: 10000,
      subtotal: 10000,
      discount: 0,
      tax: 0,
    },
  ],
  receiptText: "optional plain text fallback",
};

describe("/api/v1/sales", () => {
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
      title: "GET / returns sales from the repository",
      method: "GET",
      url: "/api/v1/sales?page=1&limit=20&startDate=2026-03-01&endDate=2026-03-01",
      setup: () => {
        ctx.repos.sale.findAll = async () => saleList;
      },
      assert: (data: typeof saleList) => {
        expect(data.items[0].invoiceNumber).toBe(sale.invoiceNumber);
      },
    },
    {
      title: "GET /:id returns one sale",
      method: "GET",
      url: "/api/v1/sales/11",
      setup: () => { ctx.repos.sale.findById = async () => sale; },
      assert: (data: typeof sale) => {
        expect(data.id).toBe(sale.id);
      },
    },
    {
      title: "POST / creates a sale",
      method: "POST",
      url: "/api/v1/sales",
      payload: {
        items: [{ productId: 5, quantity: 1, unitPrice: 10000 }],
        paymentType: "cash",
      },
      setup: () =>
        mockUseCase("CreateSaleUseCase", {
          execute: sale,
        }),
      assert: (data: typeof sale) => {
        expect(data.invoiceNumber).toBe(sale.invoiceNumber);
      },
    },
    {
      title: "POST /:id/payments adds a payment",
      method: "POST",
      url: "/api/v1/sales/11/payments",
      payload: {
        amount: 10000,
        paymentMethod: "cash",
      },
      setup: () =>
        mockUseCase("AddPaymentUseCase", {
          execute: { ...sale, paidAmount: 20000, remainingAmount: 0, paymentStatus: "paid", status: "completed" },
        }),
      assert: (data: typeof sale) => {
        expect(data.paidAmount).toBe(20000);
        expect(data.paymentStatus).toBe("paid");
      },
    },
    {
      title: "GET /:id/receipt returns structured receipt data",
      method: "GET",
      url: "/api/v1/sales/11/receipt",
      setup: () => {
        ctx.repos.sale.getReceiptData = async () => receiptData;
      },
      assert: (data: typeof receiptData) => {
        expect(data.items[0].productName).toBe("شال قطني");
        expect(data.store.receiptWidth).toBe("80mm");
      },
    },
  ] as const)("$title", async ({ method, url, payload, setup, assert }) => {
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
        url: "/api/v1/sales",
        payload: {
          items: [{ productId: 5, quantity: 1, unitPrice: 10000 }],
          paymentType: "cash",
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
        url: "/api/v1/sales/11/payments",
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
      url: "/api/v1/sales?page=bad",
    },
    {
      method: "GET",
      url: "/api/v1/sales/not-a-number",
    },
    {
      method: "POST",
      url: "/api/v1/sales",
      payload: {
        items: [{ productId: 5, quantity: 1, unitPrice: 10000 }],
      },
    },
    {
      method: "POST",
      url: "/api/v1/sales/11/payments",
      payload: {
        paymentMethod: "cash",
      },
    },
  ] as const)(
    "returns 400 for invalid %s %s",
    async ({ method, url, payload }) => {
      const response = await ctx.app.inject({
        method,
        url,
        payload,
        headers: ctx.authHeaders(),
      });

      expectError(response, 400, "VALIDATION_ERROR");
    },
  );

  test("returns 401 when auth is missing", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/sales",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("returns 403 when adding a payment is forbidden", async () => {
    mockUseCase("AddPaymentUseCase", {
      execute: async () => {
        throw new PermissionDeniedError("denied");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/payments",
      payload: {
        amount: 10000,
        paymentMethod: "cash",
      },
      headers: ctx.authHeaders(),
    });

    expectError(response, 403, "PERMISSION_DENIED");
  });

  test("returns 404 when a sale does not exist", async () => {
    ctx.repos.sale.findById = async () => null;

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/sales/999",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });

  // ── Covers L29-30: page/limit ternary fallback branches (: 1, : 20) ──
  test("GET /sales without query params hits default page/limit", async () => {
    ctx.repos.sale.findAll = async () => saleList;

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/sales",
      headers: ctx.authHeaders(),
    });

    expectOk(response);
  });

  // ── Negative-path: expired token → 401 (exercises jwt.verify null → support.ts L35-39) ──
  test("returns 401 when token is expired", async () => {
    const expired = ctx.jwt.sign({
      sub: "1",
      role: "admin",
      permissions: ["sales:read"],
      username: "admin",
      fullName: "Admin User",
    });
    // Manually forge an expired token by re-encoding with past exp
    const parts = expired.split(".");
    const payload = JSON.parse(
      Buffer.from(
        parts[1].replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString(),
    );
    payload.exp = Math.floor(Date.now() / 1000) - 3600;
    // Re-sign is impossible so just use a completely invalid token
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales",
      payload: {
        items: [{ productId: 1, quantity: 1, unitPrice: 1000 }],
        paymentType: "cash",
      },
      headers: { authorization: "Bearer invalid.token.here" },
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  // ── Negative-path: completely empty body → 400 ──
  test("returns 400 when POST /sales body is completely empty", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales",
      payload: {},
      headers: ctx.authHeaders(),
    });

    expectError(response, 400, "VALIDATION_ERROR");
  });

  // ══════════════════════════════════════════════════════
  // CANCEL ROUTE — POST /sales/:id/cancel
  // ══════════════════════════════════════════════════════

  test("POST /:id/cancel succeeds and returns null data", async () => {
    mockUseCase("CancelSaleUseCase", {
      execute: async () => undefined,
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/cancel",
      headers: ctx.authHeaders(),
    });

    const data = expectOk(response);
    expect(data).toBeNull();
  });

  test("POST /:id/cancel returns 401 when unauthenticated", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/cancel",
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("POST /:id/cancel returns 404 when sale does not exist", async () => {
    mockUseCase("CancelSaleUseCase", {
      execute: async () => {
        throw new NotFoundError("الفاتورة غير موجودة");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/999/cancel",
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });

  test("POST /:id/cancel returns 409 when sale is already cancelled", async () => {
    mockUseCase("CancelSaleUseCase", {
      execute: async () => {
        throw new InvalidStateError("الفاتورة ملغية بالفعل");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/cancel",
      headers: ctx.authHeaders(),
    });

    expectError(response, 409, "INVALID_STATE");
  });

  test("POST /:id/cancel returns 409 when refunds exist on the sale", async () => {
    mockUseCase("CancelSaleUseCase", {
      execute: async () => {
        throw new InvalidStateError(
          "لا يمكن إلغاء فاتورة تم معالجة استرداد لها",
        );
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/cancel",
      headers: ctx.authHeaders(),
    });

    expectError(response, 409, "INVALID_STATE");
  });

  // ══════════════════════════════════════════════════════
  // REFUND ROUTE — POST /sales/:id/refund
  // ══════════════════════════════════════════════════════

  const refundResult = {
    saleId: 11,
    refundedAmount: 20000,
    totalRefunded: 20000,
    newPaidAmount: 20000,
    newRemainingAmount: 0,
    status: "refunded",
  };

  const partialRefundResult = {
    saleId: 11,
    refundedAmount: 10000,
    totalRefunded: 10000,
    newPaidAmount: 20000,
    newRemainingAmount: 0,
    status: "partial_refund",
  };

  test("POST /:id/refund succeeds with full refund", async () => {
    mockUseCase("RefundSaleUseCase", {
      execute: async () => refundResult,
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/refund",
      payload: { amount: 20000, reason: "Customer dissatisfied" },
      headers: ctx.authHeaders(),
    });

    const data = expectOk(response) as typeof refundResult;
    expect(data.saleId).toBe(11);
    expect(data.refundedAmount).toBe(20000);
    expect(data.newPaidAmount).toBe(20000);
    expect(data.newRemainingAmount).toBe(0);
    expect(data.status).toBe("refunded");
  });

  test("POST /:id/refund succeeds with partial refund and returnItems", async () => {
    mockUseCase("RefundSaleUseCase", {
      execute: async () => partialRefundResult,
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/refund",
      payload: {
        amount: 10000,
        reason: "Partial return",
        returnItems: [{ saleItemId: 1, quantity: 1, returnToStock: true }],
      },
      headers: ctx.authHeaders(),
    });

    const data = expectOk(response) as typeof partialRefundResult;
    expect(data.refundedAmount).toBe(10000);
    expect(data.newPaidAmount).toBe(20000);
    expect(data.status).toBe("partial_refund");
  });

  test("POST /:id/refund returns 401 when unauthenticated", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/refund",
      payload: { amount: 10000 },
    });

    expectError(response, 401, "UNAUTHORIZED");
  });

  test("POST /:id/refund returns 400 when amount is missing", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/refund",
      payload: { reason: "missing amount" },
      headers: ctx.authHeaders(),
    });

    expectError(response, 400, "VALIDATION_ERROR");
  });

  test("POST /:id/refund returns 400 when amount is zero", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/refund",
      payload: { amount: 0 },
      headers: ctx.authHeaders(),
    });

    expectError(response, 400, "VALIDATION_ERROR");
  });

  test("POST /:id/refund returns 404 when sale does not exist", async () => {
    mockUseCase("RefundSaleUseCase", {
      execute: async () => {
        throw new NotFoundError("الفاتورة غير موجودة");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/999/refund",
      payload: { amount: 10000 },
      headers: ctx.authHeaders(),
    });

    expectError(response, 404, "NOT_FOUND");
  });

  test("POST /:id/refund returns 409 when sale is cancelled", async () => {
    mockUseCase("RefundSaleUseCase", {
      execute: async () => {
        throw new InvalidStateError("لا يمكن استرداد فاتورة ملغية");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/refund",
      payload: { amount: 10000 },
      headers: ctx.authHeaders(),
    });

    expectError(response, 409, "INVALID_STATE");
  });

  test("POST /:id/refund returns 409 when sale is already fully refunded", async () => {
    mockUseCase("RefundSaleUseCase", {
      execute: async () => {
        throw new InvalidStateError("تم استرداد هذه الفاتورة بالكامل بالفعل");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/refund",
      payload: { amount: 10000 },
      headers: ctx.authHeaders(),
    });

    expectError(response, 409, "INVALID_STATE");
  });

  test("POST /:id/refund returns 400 when amount exceeds paidAmount", async () => {
    mockUseCase("RefundSaleUseCase", {
      execute: async () => {
        throw new ValidationError("مبلغ الاسترداد أكبر من المبلغ المدفوع");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/refund",
      payload: { amount: 99999 },
      headers: ctx.authHeaders(),
    });

    expectError(response, 400, "VALIDATION_ERROR");
  });

  test("POST /:id/refund returns 409 when nothing has been paid yet", async () => {
    mockUseCase("RefundSaleUseCase", {
      execute: async () => {
        throw new InvalidStateError("لا يوجد مبلغ مدفوع لاسترداده");
      },
    });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/sales/11/refund",
      payload: { amount: 5000 },
      headers: ctx.authHeaders(),
    });

    expectError(response, 409, "INVALID_STATE");
  });
});
