/**
 * Response-contract integration tests.
 *
 * Each test sends a request with realistic mock data through the full
 * Fastify serialization pipeline, then validates the JSON response body
 * against the route's declared 200-response schema using AJV.
 *
 * This catches mismatches between UseCase outputs and response schemas
 * that would otherwise surface only at runtime.
 */
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { Response as InjectResponse } from "light-my-request";
import { buildApp, type BuiltApp } from "../../helpers/buildApp.ts";
import {
  purchase,
  customerLedger,
  supplierLedger,
  dashboardStats,
  journalEntry,
  account,
  product,
  sale,
  inventoryMovement,
  postingBatch,
} from "../../helpers/fixtures.ts";
import { mockUseCase, resetMockCore } from "../../helpers/mockCore.ts";
import { resetMockData } from "../../helpers/mockData.ts";

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

// ── Schemas under test ─────────────────────────────────────────────
import { getPurchasesSchema } from "../../../src/routes/v1/purchases/index.ts";
import { getCustomerLedgerSchema } from "../../../src/routes/v1/customer-ledger/index.ts";
import { getSupplierLedgerSchema } from "../../../src/routes/v1/supplier-ledger/index.ts";
import { getJournalEntriesSchema } from "../../../src/routes/v1/accounting/index.ts";
import {
  getProductsSchema,
  getProductPurchaseHistorySchema,
  getProductSalesHistorySchema,
} from "../../../src/routes/v1/products/index.ts";
import {
  getSalesSchema,
  getSaleReceiptSchema,
} from "../../../src/routes/v1/sales/index.ts";
import { getInventoryMovementsSchema } from "../../../src/routes/v1/inventory/index.ts";
import { afterPaySchema } from "../../../src/routes/v1/pos/index.ts";
import { getPostingBatchesSchema } from "../../../src/routes/v1/posting/index.ts";

// Dashboard and auth schemas use additionalProperties: true or loose shapes,
// so we import them for a structural smoke-test only.
import { setupStatusSchema } from "../../../src/routes/v1/auth/index.ts";

// ── AJV setup ──────────────────────────────────────────────────────

function createValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function assertMatchesSchema(
  response: InjectResponse,
  responseSchema: Record<string, unknown>,
) {
  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  const ajv = createValidator();
  const valid = ajv.validate(responseSchema, body);
  if (!valid) {
    throw new Error(
      `Response does not match schema:\n${ajv.errorsText(ajv.errors, { separator: "\n" })}`,
    );
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe("Response contract validation", () => {
  let ctx: BuiltApp;

  beforeEach(async () => {
    resetMockCore();
    resetMockData();
    ctx = await buildApp();
  });

  afterEach(async () => {
    if (ctx) await ctx.close();
  });

  test("GET /purchases response matches getPurchasesSchema", async () => {
    ctx.repos.purchase.findAll = async () => ({ items: [purchase], total: 1 });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/purchases?limit=10&offset=0",
      headers: ctx.authHeaders(),
    });

    assertMatchesSchema(
      response,
      getPurchasesSchema.response[200] as Record<string, unknown>,
    );
  });

  test("GET /customer-ledger/:id response matches getCustomerLedgerSchema", async () => {
    ctx.repos.customerLedger.findAll = async () => customerLedger;

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/customer-ledger/3?limit=10&offset=0",
      headers: ctx.authHeaders(),
    });

    assertMatchesSchema(
      response,
      getCustomerLedgerSchema.response[200] as Record<string, unknown>,
    );
  });

  test("GET /supplier-ledger/:id response matches getSupplierLedgerSchema", async () => {
    ctx.repos.supplierLedger.findAll = async () => supplierLedger;

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/supplier-ledger/4?limit=10&offset=0",
      headers: ctx.authHeaders(),
    });

    assertMatchesSchema(
      response,
      getSupplierLedgerSchema.response[200] as Record<string, unknown>,
    );
  });

  test("GET /dashboard/stats response has correct structure", async () => {
    mockUseCase("GetDashboardStatsUseCase", { execute: dashboardStats });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/dashboard/stats",
      headers: ctx.authHeaders(),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("salesToday");
    expect(body.data).toHaveProperty("lowStockCount");
    expect(body.data).toHaveProperty("topProducts");
    expect(body.data.salesToday).toHaveProperty("revenue");
  });

  test("GET /auth/setup-status response matches setupStatusSchema", async () => {
    mockUseCase("CheckInitialSetupUseCase", {
      execute: {
        isInitialized: true,
        hasUsers: true,
        hasCompanyInfo: true,
        wizardCompleted: true,
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/auth/setup-status",
    });

    assertMatchesSchema(
      response,
      setupStatusSchema.response[200] as Record<string, unknown>,
    );
  });

  test("GET /accounting/journal-entries response matches getJournalEntriesSchema", async () => {
    ctx.repos.accounting.getJournalEntries = async () => ({ items: [journalEntry], total: 1 });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/accounting/journal-entries?limit=10&offset=0",
      headers: ctx.authHeaders(),
    });

    assertMatchesSchema(
      response,
      getJournalEntriesSchema.response[200] as Record<string, unknown>,
    );
  });

  test("GET /accounting/accounts response returns array envelope", async () => {
    ctx.repos.accounting.getAccounts = async () => [account];

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/accounting/accounts",
      headers: ctx.authHeaders(),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]).toHaveProperty("code");
  });

  test("GET /products response matches getProductsSchema", async () => {
    mockUseCase("GetProductsUseCase", {
      execute: { items: [product], total: 1 },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/products?page=1&limit=20",
      headers: ctx.authHeaders(),
    });

    assertMatchesSchema(
      response,
      getProductsSchema.response[200] as Record<string, unknown>,
    );
  });

  test("GET /sales response matches getSalesSchema", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/sales?page=1&limit=20",
      headers: ctx.authHeaders(),
    });

    assertMatchesSchema(
      response,
      getSalesSchema.response[200] as Record<string, unknown>,
    );
  });

  test("GET /sales/:id/receipt response matches getSaleReceiptSchema", async () => {
    ctx.repos.sale.getReceiptData = async () => receiptData;

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/sales/11/receipt",
      headers: ctx.authHeaders(),
    });

    assertMatchesSchema(
      response,
      getSaleReceiptSchema.response[200] as Record<string, unknown>,
    );
  });

  test("POST /pos/after-pay response matches afterPaySchema", async () => {
    ctx.repos.sale.getReceiptData = async () => receiptData;

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/pos/after-pay",
      payload: { saleId: 11 },
      headers: ctx.authHeaders({ permissions: ["sales:read"] }),
    });

    assertMatchesSchema(
      response,
      afterPaySchema.response[200] as Record<string, unknown>,
    );
  });

  test("GET /inventory/movements response matches getInventoryMovementsSchema", async () => {
    mockUseCase("GetInventoryMovementsUseCase", {
      execute: { items: [inventoryMovement], total: 1 },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/inventory/movements",
      headers: ctx.authHeaders(),
    });

    assertMatchesSchema(
      response,
      getInventoryMovementsSchema.response[200] as Record<string, unknown>,
    );
  });

  test("GET /posting/batches response matches getPostingBatchesSchema", async () => {
    ctx.repos.posting.getBatches = async () => ({ items: [postingBatch], total: 1 });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/posting/batches",
      headers: ctx.authHeaders(),
    });

    assertMatchesSchema(
      response,
      getPostingBatchesSchema.response[200] as Record<string, unknown>,
    );
  });

  test("GET /products/:id/purchase-history response matches getProductPurchaseHistorySchema", async () => {
    mockUseCase("GetProductPurchaseHistoryUseCase", {
      execute: {
        items: [
          {
            id: 1,
            purchaseId: 21,
            invoiceNumber: "PUR-001",
            quantity: 5,
            unitName: "bag",
            unitFactor: 1,
            quantityBase: 5,
            unitCost: 7000,
            lineSubtotal: 35000,
            batchId: null,
            expiryDate: null,
            createdAt: "2026-03-01T10:00:00.000Z",
            supplierName: "Nuqta Supplies",
          },
        ],
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/products/5/purchase-history",
      headers: ctx.authHeaders(),
    });

    assertMatchesSchema(
      response,
      getProductPurchaseHistorySchema.response[200] as Record<string, unknown>,
    );
  });

  test("GET /products/:id/sales-history response matches getProductSalesHistorySchema", async () => {
    mockUseCase("GetProductSalesHistoryUseCase", {
      execute: {
        items: [
          {
            id: 1,
            saleId: 11,
            invoiceNumber: "SAL-001",
            quantity: 2,
            unitName: "bag",
            unitFactor: 1,
            quantityBase: 2,
            unitPrice: 10000,
            subtotal: 20000,
            createdAt: "2026-03-01T10:00:00.000Z",
            customerName: "Layla Hassan",
          },
        ],
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/products/5/sales-history",
      headers: ctx.authHeaders(),
    });

    assertMatchesSchema(
      response,
      getProductSalesHistorySchema.response[200] as Record<string, unknown>,
    );
  });
});
