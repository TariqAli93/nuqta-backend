import { join } from "node:path";
import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import type {
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
  FastifyServerOptions,
} from "fastify";
import { fileURLToPath } from "url";
import { dirname } from "path";

type TestPlugin = FastifyPluginAsync | FastifyPluginCallback;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AppTestOverrides {
  db?: unknown;
  repos?: Record<string, unknown>;
  jwt?: {
    sign(payload: Record<string, unknown>): string;
    verify(token: string): unknown;
  };
  settings?: unknown;
  plugins?: TestPlugin[];
  routes?: Array<{
    prefix: string;
    plugin: TestPlugin;
  }>;
  authenticate?: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<void> | void;
}

export interface AppOptions
  extends FastifyServerOptions, Partial<AutoloadPluginOptions> {
  testOverrides?: AppTestOverrides;
}

// fastify-cli expects this named export
export const options: AppOptions = {};

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts) => {
  if (opts.testOverrides?.plugins || opts.testOverrides?.routes) {
    for (const plugin of opts.testOverrides.plugins ?? []) {
      await fastify.register(plugin, opts);
    }

    for (const route of opts.testOverrides.routes ?? []) {
      await fastify.register(route.plugin, {
        ...opts,
        prefix: `/api/v1${route.prefix}`,
      });
    }

    return;
  }

  void fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    options: opts,
  });

  void fastify.register(AutoLoad, {
    dir: join(__dirname, "routes/v1"),
    options: { ...opts, prefix: "/api/v1" },
  });
};

export default app;
