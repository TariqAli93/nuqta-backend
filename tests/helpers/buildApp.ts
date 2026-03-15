import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyPluginCallback,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { JwtService } from "../../src/domain/index.js";
import "./mockCore.ts";
import "./mockData.ts";
import type { AppOptions } from "../../src/app.ts";

type RepoMap = Record<string, Record<string, unknown>>;

type TestPlugin = FastifyPluginAsync | FastifyPluginCallback;

export interface BuildAppOptions {
  app?: Omit<AppOptions, "testOverrides">;
  repos?: Partial<RepoMap>;
  db?: Record<string, unknown>;
  jwt?: JwtService;
  plugins?: TestPlugin[];
  authenticate?: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<void> | void;
}

export interface BuiltApp {
  app: FastifyInstance;
  repos: RepoMap;
  db: Record<string, unknown>;
  jwt: JwtService;
  tokenFor(
    payload?: Partial<{
      sub: string;
      role: string;
      permissions: string[];
      username: string;
      fullName: string;
      phone: string;
    }>,
  ): string;
  authHeaders(
    payload?: Partial<{
      sub: string;
      role: string;
      permissions: string[];
      username: string;
      fullName: string;
      phone: string;
    }>,
  ): Record<string, string>;
  close(): Promise<void>;
}

function createMockRepos(): RepoMap {
  return {
    category: {},
    customer: {},
    supplier: {},
    employee: {},
    product: {},
    sale: {
      findAll: async () => ({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
    },
    purchase: {},
    payment: {},
    inventory: {},
    settings: {},
    systemSettings: {},
    accountingSettings: {},
    posSettings: {},
    barcodeSettings: {},
    user: {},
    audit: {},
    barcode: {},
    accounting: {},
    customerLedger: {},
    supplierLedger: {},
    posting: {},
    payroll: {},
    productWorkspace: {},
    backup: {},
  };
}

function mergeRepos(base: RepoMap, overrides?: Partial<RepoMap>) {
  if (!overrides) {
    return base;
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      base[key] = {
        ...(base[key] ?? {}),
        ...value,
      };
      continue;
    }

    base[key] = value as Record<string, unknown>;
  }

  return base;
}

const testLifecyclePlugin: FastifyPluginAsync = async (fastify) => {
  if (!fastify.hasDecorator("trackSseConnection")) {
    fastify.decorate("trackSseConnection", () => undefined);
  }
};

async function loadTestModules() {
  const [
    aaSwagger,
    abBodyLimit,
    abCaching,
    abCompression,
    abCors,
    abHelmet,
    abRateLimit,
    acRequestContext,
    dbPlugin,
    errorHandler,
    eventBus,
    sensible,
    support,
    accounting,
    auth,
    backup,
    categories,
    customerLedger,
    customers,
    dashboard,
    events,
    health,
    hr,
    inventory,
    pos,
    posting,
    products,
    purchases,
    reports,
    sales,
    settings,
    supplierLedger,
    suppliers,
    users,
  ] = await Promise.all([
    import("../../src/plugins/aa-swagger.ts"),
    import("../../src/plugins/ab-body-limit.ts"),
    import("../../src/plugins/cache-headers.ts"),
    import("../../src/plugins/ab-compression.ts"),
    import("../../src/plugins/ab-cors.ts"),
    import("../../src/plugins/ab-helmet.ts"),
    import("../../src/plugins/ab-rate-limit.ts"),
    import("../../src/plugins/ac-request-context.ts"),
    import("../../src/plugins/db.ts"),
    import("../../src/plugins/error-handler.ts"),
    import("../../src/plugins/event-bus.ts"),
    import("../../src/plugins/sensible.ts"),
    import("../../src/plugins/support.ts"),
    import("../../src/routes/v1/accounting/index.ts"),
    import("../../src/routes/v1/auth/index.ts"),
    import("../../src/routes/v1/backup/index.ts"),
    import("../../src/routes/v1/categories/index.ts"),
    import("../../src/routes/v1/customer-ledger/index.ts"),
    import("../../src/routes/v1/customers/index.ts"),
    import("../../src/routes/v1/dashboard/index.ts"),
    import("../../src/routes/v1/events/index.ts"),
    import("../../src/routes/v1/health/index.ts"),
    import("../../src/routes/v1/hr/index.ts"),
    import("../../src/routes/v1/inventory/index.ts"),
    import("../../src/routes/v1/pos/index.ts"),
    import("../../src/routes/v1/posting/index.ts"),
    import("../../src/routes/v1/products/index.ts"),
    import("../../src/routes/v1/purchases/index.ts"),
    import("../../src/routes/v1/reports/index.ts"),
    import("../../src/routes/v1/sales/index.ts"),
    import("../../src/routes/v1/settings/index.ts"),
    import("../../src/routes/v1/supplier-ledger/index.ts"),
    import("../../src/routes/v1/suppliers/index.ts"),
    import("../../src/routes/v1/users/index.ts"),
  ]);

  return {
    plugins: [
      aaSwagger.default,
      abBodyLimit.default,
      abCaching.default,
      abCompression.default,
      abCors.default,
      abHelmet.default,
      abRateLimit.default,
      acRequestContext.default,
      dbPlugin.default,
      errorHandler.default,
      eventBus.default,
      sensible.default,
      support.default,
      testLifecyclePlugin,
    ],
    routes: [
      { prefix: "/accounting", plugin: accounting.default },
      { prefix: "/auth", plugin: auth.default },
      { prefix: "/backup", plugin: backup.default },
      { prefix: "/categories", plugin: categories.default },
      { prefix: "/customer-ledger", plugin: customerLedger.default },
      { prefix: "/customers", plugin: customers.default },
      { prefix: "/dashboard", plugin: dashboard.default },
      { prefix: "/events", plugin: events.default },
      { prefix: "/health", plugin: health.default },
      { prefix: "/hr", plugin: hr.default },
      { prefix: "/inventory", plugin: inventory.default },
      { prefix: "/pos", plugin: pos.default },
      { prefix: "/posting", plugin: posting.default },
      { prefix: "/products", plugin: products.default },
      { prefix: "/purchases", plugin: purchases.default },
      { prefix: "/reports", plugin: reports.default },
      { prefix: "/sales", plugin: sales.default },
      { prefix: "/settings", plugin: settings.default },
      { prefix: "/supplier-ledger", plugin: supplierLedger.default },
      { prefix: "/suppliers", plugin: suppliers.default },
      { prefix: "/users", plugin: users.default },
    ],
  };
}

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<BuiltApp> {
  const repos = mergeRepos(createMockRepos(), options.repos);
  const db = options.db ?? { name: "test-db" };
  const jwt = options.jwt ?? new JwtService("test-secret", 3600);
  const app = Fastify({
    logger: false,
    ...options.app,
  });

  const { default: appPlugin } = await import("../../src/app.ts");
  const modules = await loadTestModules();

  await app.register(appPlugin, {
    ...options.app,
    testOverrides: {
      db,
      repos,
      jwt,
      plugins: [...modules.plugins, ...(options.plugins ?? [])],
      routes: modules.routes,
      authenticate: options.authenticate,
    },
  });

  await app.ready();

  const tokenFor = (
    payload: Partial<{
      sub: string;
      role: string;
      permissions: string[];
      username: string;
      fullName: string;
      phone: string;
    }> = {},
  ) =>
    jwt.sign({
      sub: payload.sub ?? "1",
      role: payload.role ?? "admin",
      permissions: payload.permissions ?? ["users:read"],
      username: payload.username ?? "admin",
      fullName: payload.fullName ?? "Admin User",
      phone: payload.phone,
    });

  return {
    app,
    repos,
    db,
    jwt,
    tokenFor,
    authHeaders(payload) {
      return { authorization: `Bearer ${tokenFor(payload)}` };
    },
    async close() {
      await app.close();
    },
  };
}
