import Fastify from "fastify";
import { NotFoundError } from "@nuqta/core";
import { afterEach, describe, expect, test } from "vitest";
import errorHandlerPlugin from "../../src/plugins/error-handler.ts";

describe("error-handler plugin", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()?.close();
    }
  });

  test("formats request validation errors into the API envelope", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    await app.register(errorHandlerPlugin);
    app.post(
      "/validate",
      {
        schema: {
          body: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
            },
          },
        },
      },
      async () => ({ ok: true }),
    );
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/validate",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  test("maps domain errors to their HTTP status", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    await app.register(errorHandlerPlugin);
    app.get("/missing", async () => {
      throw new NotFoundError("missing");
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/missing",
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND", message: "missing" },
    });
  });

  test("maps generic errors to 500 responses", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    await app.register(errorHandlerPlugin);
    app.get("/boom", async () => {
      throw new Error("boom");
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/boom",
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "boom" },
    });
  });

  test("applies response serialization from the declared schema", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    await app.register(errorHandlerPlugin);
    app.get(
      "/bad-response",
      {
        schema: {
          response: {
            200: {
              type: "object",
              required: ["value"],
              properties: {
                value: { type: "string" },
              },
            },
          },
        },
      },
      async () => ({ value: 42 }),
    );
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/bad-response",
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ value: "42" });
  });

  test("formats unknown routes via the not-found handler", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    await app.register(errorHandlerPlugin);
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/missing-route",
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  // ── Covers L34-35: validation error with missing instancePath, missingProperty, and message ──
  test("falls back to 'unknown' field and 'Invalid value' message when validation entry is empty", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    await app.register(errorHandlerPlugin);

    // Throw a synthetic error with a `validation` array whose entries lack typical AJV fields
    app.get("/synthetic-validation", async () => {
      const err = new Error("validation") as Error & {
        validation: Array<Record<string, unknown>>;
        statusCode: number;
      };
      err.statusCode = 400;
      err.validation = [
        { instancePath: "", params: {}, message: "" }, // all falsy
        { instancePath: "/body/name" }, // instancePath is truthy
      ];
      throw err;
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/synthetic-validation",
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    // First entry: all fallbacks hit
    expect(body.error.details[0].field).toBe("unknown");
    expect(body.error.details[0].message).toBe("Invalid value");
    // Second entry: instancePath is used
    expect(body.error.details[1].field).toBe("/body/name");
  });

  // ── Covers error-handler statusCode branch: error with non-domain statusCode (e.g. 422) ──
  test("maps a non-domain error with a custom statusCode to that status", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    await app.register(errorHandlerPlugin);
    app.get("/custom-status", async () => {
      const err = new Error("custom") as Error & { statusCode: number };
      err.statusCode = 422;
      throw err;
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/custom-status",
    });

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "custom" },
    });
  });
});
