import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildApp, type BuiltApp } from "../../../helpers/buildApp.ts";

describe("/api/v1/health", () => {
  let ctx: BuiltApp | undefined;

  afterEach(async () => {
    if (ctx) {
      await ctx.close();
    }
  });

  beforeEach(() => {
    ctx = undefined;
  });

  test("returns health details when the database check passes", async () => {
    const query = vi.fn(async () => ({ rows: [{ "?column?": 1 }] }));

    ctx = await buildApp({
      db: {
        $client: {
          query,
          end: vi.fn(async () => undefined),
        },
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    expect(query).toHaveBeenCalledWith("SELECT 1");

    const payload = JSON.parse(response.body) as {
      ok: boolean;
      status: string;
      checks: {
        database: { status: string; latencyMs: number };
        uptime: { seconds: number };
        memory: {
          heapUsedBytes: number;
          heapTotalBytes: number;
          rssBytes: number;
          externalBytes: number;
        };
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("healthy");
    expect(payload.checks.database.status).toBe("up");
    expect(payload.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(payload.checks.uptime.seconds).toBeGreaterThanOrEqual(0);
    expect(payload.checks.memory.heapUsedBytes).toBeGreaterThan(0);
    expect(payload.checks.memory.heapTotalBytes).toBeGreaterThan(0);
    expect(payload.checks.memory.rssBytes).toBeGreaterThan(0);
    expect(payload.checks.memory.externalBytes).toBeGreaterThanOrEqual(0);
  });

  test("returns 503 when the database check fails", async () => {
    const query = vi.fn(async () => {
      throw new Error("db unavailable");
    });

    ctx = await buildApp({
      db: {
        $client: {
          query,
          end: vi.fn(async () => undefined),
        },
      },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(503);
    expect(query).toHaveBeenCalledWith("SELECT 1");

    const payload = JSON.parse(response.body) as {
      ok: boolean;
      status: string;
      checks: {
        database: { status: string; latencyMs: number };
      };
    };

    expect(payload.ok).toBe(false);
    expect(payload.status).toBe("unhealthy");
    expect(payload.checks.database.status).toBe("down");
    expect(payload.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
