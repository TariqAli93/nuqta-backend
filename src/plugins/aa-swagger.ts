import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { commonSchemas } from "../schemas/common.js";

/**
 * Swagger / OpenAPI 3.x plugin.
 *
 * Registered as a Fastify plugin (via fastify-plugin → no encapsulation)
 * so that every route across all autoloaded files inherits the spec.
 *
 * Registration order is guaranteed because @fastify/autoload loads plugins
 * alphabetically — this file is prefixed with "aa-" to ensure it runs
 * before any routes are registered.
 *
 * Environment toggling:
 *   - Swagger UI is always available in development.
 *   - In production, set ENABLE_DOCS=true to expose /docs.
 */
export default fp(async (fastify) => {
  const isDev = process.env.NODE_ENV !== "production";
  const docsEnabled = isDev || process.env.ENABLE_DOCS === "true";

  // ── 1. Register shared $ref schemas ───────────────────────────────
  for (const schema of commonSchemas) {
    fastify.addSchema(schema);
  }

  // ── 2. @fastify/swagger — generates OpenAPI spec ──────────────────
  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Nuqta API",
        description:
          "Nuqta POS & Inventory Management backend — OpenAPI 3.0 documentation.\n\n" +
          "All monetary values are in minor units (e.g. Iraqi Dinars with no sub-unit).",
        version: "1.0.0",
        contact: { name: "Nuqta Team" },
      },
      servers: [],
      tags: [
        { name: "Auth", description: "Authentication & registration" },
        { name: "Users", description: "User management" },
        { name: "Categories", description: "Product categories" },
        { name: "Products", description: "Product catalog & stock" },
        { name: "Sales", description: "Point-of-sale transactions" },
        { name: "Purchases", description: "Purchase orders & receiving" },
        { name: "Customers", description: "Customer records" },
        { name: "Suppliers", description: "Supplier records" },
        { name: "Customer Ledger", description: "Customer debt tracking" },
        { name: "Supplier Ledger", description: "Supplier balance tracking" },
        { name: "Inventory", description: "Stock movements & alerts" },
        {
          name: "Accounting",
          description: "Chart of accounts & journal entries",
        },
        { name: "Posting", description: "Journal entry posting workflow" },
        { name: "Settings", description: "Application & company settings" },
        { name: "Dashboard", description: "Aggregated metrics" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT token obtained from POST /api/v1/auth/login",
          },
        },
      },
    },
  });

  // ── 3. @fastify/swagger-ui — serves interactive docs ──────────────
  if (docsEnabled) {
    await fastify.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
        filter: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
      },
      staticCSP: false,
      transformStaticCSP: (header) => header,
    });

    fastify.log.info("Swagger UI available at /docs");
  }
});
