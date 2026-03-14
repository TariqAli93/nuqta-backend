import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { expectError, expectOk } from "../../../helpers/assertions.ts";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";
import { resetMockCore } from "../../../helpers/mockCore.ts";
import { resetMockData } from "../../../helpers/mockData.ts";

const receiptData = {
  saleId: 35,
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

describe("/api/v1/pos", () => {
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

  test("POST /after-pay returns structured receipt payload", async () => {
    ctx.repos.sale.getReceiptData = async () => receiptData;

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/pos/after-pay",
      payload: {
        saleId: 35,
      },
      headers: ctx.authHeaders({ permissions: ["sales:read"] }),
    });

    const data = expectOk<{
      saleId: number;
      receipt: typeof receiptData;
      printerName: string | null;
    }>(response);
    expect(data.saleId).toBe(35);
    expect(data.receipt.invoiceNumber).toBe(receiptData.invoiceNumber);
    expect(data.receipt.items[0].subtotal).toBe(10000);
    expect(data.printerName).toBeNull();
  });

  test("POST /after-pay returns 400 for invalid body", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/pos/after-pay",
      payload: {},
      headers: ctx.authHeaders({ permissions: ["sales:read"] }),
    });

    expectError(response, 400, "VALIDATION_ERROR");
  });
});
