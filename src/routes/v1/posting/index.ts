import { FastifyPluginAsync } from "fastify";
import {
  PostPeriodUseCase,
  ReverseEntryUseCase,
  PostIndividualEntryUseCase,
  UnpostIndividualEntryUseCase,
  GetPostingBatchesUseCase,
  LockPostingBatchUseCase,
  UnlockPostingBatchUseCase,
} from "@nuqta/core";
import {
  postPeriodSchema,
  reverseEntrySchema,
  postEntrySchema,
  unpostEntrySchema,
  getPostingBatchesSchema,
  lockBatchSchema,
  unlockBatchSchema,
} from "../../../schemas/posting.js";
import { requirePermission } from "../../../middleware/rbac.js";

const posting: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /posting/period
  fastify.post(
    "/period",
    {
      schema: postPeriodSchema,
      preHandler: requirePermission("posting:create"),
    },
    async (request) => {
      const body = request.body as {
        periodType: "day" | "month" | "year";
        periodStart: string;
        periodEnd: string;
        notes?: string;
      };
      const userId = request.user?.sub || 1;
      const uc = new PostPeriodUseCase(
        fastify.repos.posting,
        fastify.repos.settings,
      );
      const data = await uc.execute(body, userId);
      return { ok: true, data };
    },
  );

  // POST /posting/entries/:id/reverse
  fastify.post<{ Params: { id: string } }>(
    "/entries/:id/reverse",
    {
      schema: reverseEntrySchema,
      preHandler: requirePermission("posting:update"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const userId = request.user?.sub || 1;
      const uc = new ReverseEntryUseCase(
        fastify.repos.posting,
        fastify.repos.accounting,
      );
      const data = await uc.execute(id, userId);
      return { ok: true, data };
    },
  );

  // POST /posting/entries/:id/post
  fastify.post<{ Params: { id: string } }>(
    "/entries/:id/post",
    {
      schema: postEntrySchema,
      preHandler: requirePermission("posting:update"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const userId = request.user?.sub || 1;
      const uc = new PostIndividualEntryUseCase(
        fastify.repos.posting,
        fastify.repos.accounting,
      );
      const data = await uc.execute(id, userId);
      return { ok: true, data };
    },
  );

  // POST /posting/entries/:id/unpost
  fastify.post<{ Params: { id: string } }>(
    "/entries/:id/unpost",
    {
      schema: unpostEntrySchema,
      preHandler: requirePermission("posting:update"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const userId = request.user?.sub || 1;
      const uc = new UnpostIndividualEntryUseCase(
        fastify.repos.posting,
        fastify.repos.accounting,
      );
      const data = await uc.execute(id, userId);
      return { ok: true, data };
    },
  );

  // ── Batches ──────────────────────────────────────────────────────

  // GET /posting/batches
  fastify.get(
    "/batches",
    {
      schema: getPostingBatchesSchema,
      preHandler: requirePermission("posting:read"),
    },
    async (request) => {
      const query = request.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };
      const uc = new GetPostingBatchesUseCase(fastify.repos.posting);
      const data = await uc.execute({
        status: query.status,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return { ok: true, data };
    },
  );

  // POST /posting/batches/:id/lock
  fastify.post<{ Params: { id: string } }>(
    "/batches/:id/lock",
    { schema: lockBatchSchema, preHandler: requirePermission("posting:lock") },
    async (request) => {
      const batchId = parseInt(request.params.id, 10);
      const userId = request.user?.sub || 1;
      const uc = new LockPostingBatchUseCase(fastify.repos.posting);
      const data = await uc.execute(batchId, userId);
      return { ok: true, data };
    },
  );

  // POST /posting/batches/:id/unlock
  fastify.post<{ Params: { id: string } }>(
    "/batches/:id/unlock",
    {
      schema: unlockBatchSchema,
      preHandler: requirePermission("posting:unlock"),
    },
    async (request) => {
      const batchId = parseInt(request.params.id, 10);
      const userId = request.user?.sub || 1;
      const uc = new UnlockPostingBatchUseCase(fastify.repos.posting);
      const data = await uc.execute(batchId, userId);
      return { ok: true, data };
    },
  );
};

export default posting;
