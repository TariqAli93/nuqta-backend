import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { JwtService } from "@nuqta/core";
import "./mockCore.ts";
import "./mockData.ts";
import type { AppOptions } from "../../src/app.ts";

type RepoMap = Record<string, Record<string, unknown>>;

export interface BuildAppOptions {
  app?: Omit<AppOptions, "testOverrides">;
  repos?: Partial<RepoMap>;
  db?: Record<string, unknown>;
  jwt?: JwtService;
  plugins?: FastifyPluginAsync[];
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
    payload?: Partial<{ sub: number; role: string; permissions: string[] }>,
  ): string;
  authHeaders(
    payload?: Partial<{ sub: number; role: string; permissions: string[] }>,
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

async function loadTestModules() {
  const [
    aaSwagger,
    abCaching,
    abCors,
    abHelmet,
    abRateLimit,
    dbPlugin,
    errorHandler,
    sensible,
    support,
    accounting,
    auth,
    categories,
    customerLedger,
    customers,
    dashboard,
    hr,
    inventory,
    posting,
    products,
    purchases,
    sales,
    settings,
    supplierLedger,
    suppliers,
    users,
  ] = await Promise.all([
    import("../../src/plugins/aa-swagger.ts"),
    import("../../src/plugins/ab-caching.ts"),
    import("../../src/plugins/ab-cors.ts"),
    import("../../src/plugins/ab-helmet.ts"),
    import("../../src/plugins/ab-rate-limit.ts"),
    import("../../src/plugins/db.ts"),
    import("../../src/plugins/error-handler.ts"),
    import("../../src/plugins/sensible.ts"),
    import("../../src/plugins/support.ts"),
    import("../../src/routes/v1/accounting/index.ts"),
    import("../../src/routes/v1/auth/index.ts"),
    import("../../src/routes/v1/categories/index.ts"),
    import("../../src/routes/v1/customer-ledger/index.ts"),
    import("../../src/routes/v1/customers/index.ts"),
    import("../../src/routes/v1/dashboard/index.ts"),
    import("../../src/routes/v1/hr/index.ts"),
    import("../../src/routes/v1/inventory/index.ts"),
    import("../../src/routes/v1/posting/index.ts"),
    import("../../src/routes/v1/products/index.ts"),
    import("../../src/routes/v1/purchases/index.ts"),
    import("../../src/routes/v1/sales/index.ts"),
    import("../../src/routes/v1/settings/index.ts"),
    import("../../src/routes/v1/supplier-ledger/index.ts"),
    import("../../src/routes/v1/suppliers/index.ts"),
    import("../../src/routes/v1/users/index.ts"),
  ]);

  return {
    plugins: [
      aaSwagger.default,
      abCaching.default,
      abCors.default,
      abHelmet.default,
      abRateLimit.default,
      dbPlugin.default,
      errorHandler.default,
      sensible.default,
      support.default,
    ],
    routes: [
      { prefix: "/accounting", plugin: accounting.default },
      { prefix: "/auth", plugin: auth.default },
      { prefix: "/categories", plugin: categories.default },
      { prefix: "/customer-ledger", plugin: customerLedger.default },
      { prefix: "/customers", plugin: customers.default },
      { prefix: "/dashboard", plugin: dashboard.default },
      { prefix: "/hr", plugin: hr.default },
      { prefix: "/inventory", plugin: inventory.default },
      { prefix: "/posting", plugin: posting.default },
      { prefix: "/products", plugin: products.default },
      { prefix: "/purchases", plugin: purchases.default },
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
    payload: Partial<{ sub: number; role: string; permissions: string[] }> = {},
  ) =>
    jwt.sign({
      sub: payload.sub ?? 1,
      role: payload.role ?? "admin",
      permissions: payload.permissions ?? ["users:read"],
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
