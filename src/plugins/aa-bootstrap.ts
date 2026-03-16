// NOTE: This plugin is intended to run early in the Fastify autoload sequence.
// To follow project conventions, the file should be named with an `aa-`-style
// prefix (e.g. `aa-bootstrap.ts` or `aa-db-bootstrap.ts`) rather than `a0-`.
import fp from "fastify-plugin";
import { prepareDatabase } from "../data/db/bootstrap.js";

export default fp(async (fastify) => {
  fastify.addHook("onReady", async () => {
    fastify.log.info("Preparing database bootstrap sequence");

    await prepareDatabase();

    fastify.log.info("Database bootstrap sequence completed");
  });
});
