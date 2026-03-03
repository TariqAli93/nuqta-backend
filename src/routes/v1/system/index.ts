import { FastifyPluginAsync } from "fastify";

const system: FastifyPluginAsync = async (fastify) => {
  // GET /system/capabilities – mock: returns all capabilities enabled
  fastify.get("/capabilities", async (_request, _reply) => {
    return {
      ok: true,
      data: {
        status: "active",
        capabilities: [
          { key: "sales", enabled: true },
          { key: "purchases", enabled: true },
          { key: "inventory", enabled: true },
          { key: "accounting", enabled: true },
          { key: "customers", enabled: true },
          { key: "suppliers", enabled: true },
          { key: "products", enabled: true },
          { key: "dashboard", enabled: true },
          { key: "reports", enabled: true },
          { key: "settings", enabled: true },
          { key: "users", enabled: true },
          { key: "multiCurrency", enabled: true },
          { key: "barcode", enabled: true },
          { key: "importing", enabled: true },
          { key: "exporting", enabled: true },
        ],
        limits: {
          maxUsers: 999,
          maxProducts: 999999,
          maxCustomers: 999999,
          maxSuppliers: 999999,
          maxWarehouses: 100,
        },
        version: "1.0.0-dev",
        environment: "development",
      },
    };
  });

  // GET /system/health – basic health check
  fastify.get("/health", async (_request, _reply) => {
    return {
      ok: true,
      data: {
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    };
  });
};

export default system;
