import Fastify from "fastify";
import { afterEach, describe, expect, test, vi } from "vitest";
import { JwtService } from "@nuqta/core";
import dbPlugin from "../../src/plugins/db.ts";

function createRepos() {
  return {
    category: {},
    customer: {},
    supplier: {},
    product: {},
    sale: {},
    purchase: {},
    payment: {},
    inventory: {},
    settings: {},
    user: {},
    audit: {},
    barcode: {},
    accounting: {},
    customerLedger: {},
    supplierLedger: {},
    posting: {},
    productWorkspace: {},
    backup: {},
  };
}

describe("db plugin", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()?.close();
    }
  });

  test("registers db, repos, and jwt decorations from overrides", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    const db = { name: "db" };
    const repos = createRepos();
    const jwt = new JwtService("plugin-secret", 3600);

    await app.register(dbPlugin, {
      testOverrides: {
        db,
        repos,
        jwt,
      },
    });

    expect(app.db).toBe(db);
    expect(app.repos).toBe(repos);
    expect(app.jwt).toBe(jwt);
    expect(
      app.jwt.verify(
        app.jwt.sign({ sub: 1, role: "admin", permissions: ["users:read"] }),
      )?.sub,
    ).toBe(1);
  });

  // ── Covers L51-53: dynamic import fallback when no overrides ──
  test("falls back to dynamic import of @nuqta/data when overrides are absent", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    // Mock @nuqta/data to avoid a real DB connection
    const mockDb = { mock: true };
    class MockRepo {}
    vi.doMock("@nuqta/data", () => ({
      db: mockDb,
      CategoryRepository: MockRepo,
      CustomerRepository: MockRepo,
      SupplierRepository: MockRepo,
      ProductRepository: MockRepo,
      SaleRepository: MockRepo,
      PurchaseRepository: MockRepo,
      PaymentRepository: MockRepo,
      InventoryRepository: MockRepo,
      SettingsRepository: MockRepo,
      UserRepository: MockRepo,
      AuditRepository: MockRepo,
      BarcodeRepository: MockRepo,
      AccountingRepository: MockRepo,
      CustomerLedgerRepository: MockRepo,
      SupplierLedgerRepository: MockRepo,
      PostingRepository: MockRepo,
      ProductWorkspaceRepository: MockRepo,
      BackupRepository: MockRepo,
    }));

    await app.register(dbPlugin, { testOverrides: undefined } as any);

    expect(app.db).toBe(mockDb);
    expect(app.repos).toBeDefined();
    expect(app.jwt).toBeDefined();

    vi.doUnmock("@nuqta/data");
  });
});
