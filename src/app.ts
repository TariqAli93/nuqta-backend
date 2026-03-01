import { join } from "node:path";
import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import { FastifyPluginAsync, FastifyServerOptions } from "fastify";

export interface AppOptions
  extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}

// fastify-cli expects this named export
export const options: AppOptions = {};

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts) => {
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
