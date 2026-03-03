import Fastify from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import { JwtService } from "@nuqta/core";
import supportPlugin from "../../src/plugins/support.ts";

describe("support plugin", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()?.close();
    }
  });

  test("authenticates valid bearer tokens and decorates request.user", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    const jwt = new JwtService("support-secret", 3600);
    app.decorate("jwt", jwt);

    await app.register(supportPlugin);
    app.get(
      "/protected",
      {
        onRequest: app.authenticate,
      },
      async (request) => ({ sub: request.user?.sub }),
    );
    await app.ready();

    const token = jwt.sign({
      sub: 7,
      role: "admin",
      permissions: ["users:read"],
    });

    const response = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ sub: 7 });
  });

  test("returns 401 when the authorization header is missing", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    app.decorate("jwt", new JwtService("support-secret", 3600));
    await app.register(supportPlugin);
    app.get("/protected", { onRequest: app.authenticate }, async () => ({
      ok: true,
    }));
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/protected",
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  test("returns 401 for invalid bearer tokens", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    app.decorate("jwt", new JwtService("support-secret", 3600));
    await app.register(supportPlugin);
    app.get("/protected", { onRequest: app.authenticate }, async () => ({
      ok: true,
    }));
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        authorization: "Bearer bad-token",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  // ── Covers L13-14: testOverrides.authenticate branch ──
  test("uses custom authenticate override when provided", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    // No jwt needed — the override completely replaces authenticate
    const customAuth = async (request: any, _reply: any) => {
      request.user = { sub: 42, role: "admin", permissions: ["*"] };
    };

    await app.register(supportPlugin, {
      testOverrides: { authenticate: customAuth },
    } as any);

    app.get("/protected", { onRequest: app.authenticate }, async (request) => ({
      sub: request.user?.sub,
    }));
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/protected",
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ sub: 42 });
  });
});
