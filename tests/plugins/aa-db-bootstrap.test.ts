import Fastify from "fastify";
import { afterEach, describe, expect, test, vi } from "vitest";

const prepareDatabaseMock = vi.fn<() => Promise<void>>();

vi.mock("../../src/data/db/bootstrap.js", () => ({
  prepareDatabase: prepareDatabaseMock,
}));

const { default: bootstrapPlugin } = await import(
  "../../src/plugins/aa-db-bootstrap.ts"
);

describe("aa-db-bootstrap plugin", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    vi.resetAllMocks();
    while (apps.length > 0) {
      await apps.pop()?.close();
    }
  });

  test("app.ready() resolves after prepareDatabase() completes", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    prepareDatabaseMock.mockResolvedValueOnce(undefined);

    await app.register(bootstrapPlugin);
    await app.ready();

    expect(prepareDatabaseMock).toHaveBeenCalledOnce();
  });

  test("app.ready() rejects when prepareDatabase() rejects", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    prepareDatabaseMock.mockRejectedValueOnce(
      new Error("DB connection failed"),
    );

    await app.register(bootstrapPlugin);

    await expect(app.ready()).rejects.toThrow("DB connection failed");
  });
});
