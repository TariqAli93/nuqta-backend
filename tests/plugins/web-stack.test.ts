import Fastify from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import cachingPlugin from "../../src/plugins/ab-caching.ts";
import corsPlugin from "../../src/plugins/ab-cors.ts";
import errorHandlerPlugin from "../../src/plugins/error-handler.ts";
import helmetPlugin from "../../src/plugins/ab-helmet.ts";
import rateLimitPlugin from "../../src/plugins/ab-rate-limit.ts";
import sensiblePlugin from "../../src/plugins/sensible.ts";
import { withEnv } from "../helpers/env.ts";

describe("web stack plugins", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()?.close();
    }
  });

  test("ab-caching registers reply caching decorators", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    await app.register(cachingPlugin);

    expect(app.hasReplyDecorator("etag")).toBe(true);
    expect(app.hasReplyDecorator("expires")).toBe(true);
  });

  test("ab-cors applies configured origins to preflight requests", async () => {
    await withEnv({ CORS_ORIGIN: "https://example.com" }, async () => {
      const app = Fastify({ logger: false });
      apps.push(app);

      await app.register(corsPlugin);
      app.get("/ping", async () => ({ ok: true }));
      await app.ready();

      const response = await app.inject({
        method: "OPTIONS",
        url: "/ping",
        headers: {
          origin: "https://example.com",
          "access-control-request-method": "GET",
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://example.com",
      );
    });
  });

  test("ab-helmet adds security headers", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    await app.register(helmetPlugin);
    app.get("/ping", async () => ({ ok: true }));
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/ping",
    });

    expect(response.headers["x-frame-options"]).toBeDefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("ab-rate-limit enforces limits for non-localhost addresses", async () => {
    await withEnv(
      { RATE_LIMIT_MAX: "1", RATE_LIMIT_WINDOW_MS: "60000" },
      async () => {
        const app = Fastify({ logger: false });
        apps.push(app);

        await app.register(rateLimitPlugin);
        await app.register(errorHandlerPlugin);
        app.get("/limited", async () => ({ ok: true }));
        await app.ready();

        const first = await app.inject({
          method: "GET",
          url: "/limited",
          remoteAddress: "10.0.0.10",
        });
        const second = await app.inject({
          method: "GET",
          url: "/limited",
          remoteAddress: "10.0.0.10",
        });

        expect(first.statusCode).toBe(200);
        expect(second.statusCode).toBe(429);
        expect(JSON.parse(second.body)).toMatchObject({
          ok: false,
          error: { code: "RATE_LIMITED" },
        });
      },
    );
  });

  test("sensible decorates httpErrors helpers", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    await app.register(sensiblePlugin);
    app.get("/boom", async () => {
      throw app.httpErrors.badRequest("nope");
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/boom",
    });

    expect(app.httpErrors).toBeDefined();
    expect(response.statusCode).toBe(400);
  });
});
