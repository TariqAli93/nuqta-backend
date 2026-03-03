import Fastify from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import swaggerPlugin from "../../src/plugins/aa-swagger.ts";
import { withEnv } from "../helpers/env.ts";

describe("aa-swagger plugin", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()?.close();
    }
  });

  test("registers shared schemas and exposes docs outside production", async () => {
    await withEnv({ NODE_ENV: "test", ENABLE_DOCS: undefined }, async () => {
      const app = Fastify({ logger: false });
      apps.push(app);

      await app.register(swaggerPlugin);
      app.get(
        "/ping",
        {
          schema: {
            response: {
              200: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                },
              },
            },
          },
        },
        async () => ({ ok: true }),
      );

      await app.ready();

      expect(app.getSchema("IdParams")).toBeDefined();

      const spec = app.swagger();
      expect(spec.openapi).toBe("3.0.3");
      expect(spec.paths["/ping"]).toBeDefined();

      const docsResponse = await app.inject({
        method: "GET",
        url: "/docs",
      });

      expect([200, 301, 302]).toContain(docsResponse.statusCode);
    });
  });

  test("hides docs in production when ENABLE_DOCS is not true", async () => {
    await withEnv({ NODE_ENV: "production", ENABLE_DOCS: undefined }, async () => {
      const app = Fastify({ logger: false });
      apps.push(app);

      await app.register(swaggerPlugin);
      await app.ready();

      const docsResponse = await app.inject({
        method: "GET",
        url: "/docs",
      });

      expect(docsResponse.statusCode).toBe(404);
    });
  });
});
