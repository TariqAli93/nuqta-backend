import { FastifyPluginAsync } from "fastify";
import {
  PostPeriodUseCase,
  ReverseEntryUseCase,
  PostIndividualEntryUseCase,
  UnpostIndividualEntryUseCase,
  LockPostingBatchUseCase,
  UnlockPostingBatchUseCase,
} from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
  successPaginatedEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const PostingBatchSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    periodType: { type: "string", enum: ["day", "month", "year"] },
    periodStart: { type: "string", format: "date-time" },
    periodEnd: { type: "string", format: "date-time" },
    entriesCount: { type: "integer" },
    totalAmount: { type: "integer" },
    status: { type: "string", enum: ["draft", "posted", "locked"] },
    postedAt: { type: "string", nullable: true, format: "date-time" },
    postedBy: { type: "integer", nullable: true },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const PostPeriodBodySchema = {
  type: "object" as const,
  required: ["periodType", "periodStart", "periodEnd"],
  properties: {
    periodType: { type: "string", enum: ["day", "month", "year"] },
    periodStart: {
      type: "string",
      format: "date",
      minLength: 1,
      description: "Start date (YYYY-MM-DD)",
    },
    periodEnd: {
      type: "string",
      format: "date",
      minLength: 1,
      description: "End date (YYYY-MM-DD)",
    },
    notes: { type: "string" },
  },
  additionalProperties: false,
} as const;

const postPeriodSchema = {
  tags: ["Posting"],
  summary: "Post entries for a period",
  description: "Batch-post all unposted journal entries within a date range.",
  security: [{ bearerAuth: [] }],
  body: PostPeriodBodySchema,
  response: {
    200: successEnvelope(PostingBatchSchema, "Posting batch result"),
    ...ErrorResponses,
  },
} as const;

const reverseEntrySchema = {
  tags: ["Posting"],
  summary: "Reverse a journal entry",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Reversal result",
    ),
    ...ErrorResponses,
  },
} as const;

const postEntrySchema = {
  tags: ["Posting"],
  summary: "Post an individual entry",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Posted entry",
    ),
    ...ErrorResponses,
  },
} as const;

const unpostEntrySchema = {
  tags: ["Posting"],
  summary: "Unpost an individual entry",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Unposted entry",
    ),
    ...ErrorResponses,
  },
} as const;

// ─── Batches ───────────────────────────────────────────────────────

const BatchListQuerySchema = {
  type: "object" as const,
  properties: {
    status: { type: "string", enum: ["draft", "posted", "locked"] },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

export const getPostingBatchesSchema = {
  tags: ["Posting"],
  summary: "List posting batches",
  security: [{ bearerAuth: [] }],
  querystring: BatchListQuerySchema,
  response: {
    200: successPaginatedEnvelope(PostingBatchSchema, "Posting batches"),
    ...ErrorResponses,
  },
} as const;

const lockBatchSchema = {
  tags: ["Posting"],
  summary: "Lock a posting batch",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          batchId: { type: "integer" },
          status: { type: "string" },
        },
      },
      "Batch locked",
    ),
    ...ErrorResponses,
  },
} as const;

const unlockBatchSchema = {
  tags: ["Posting"],
  summary: "Unlock a posting batch",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          batchId: { type: "integer" },
          status: { type: "string" },
        },
      },
      "Batch unlocked",
    ),
    ...ErrorResponses,
  },
} as const;

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
      const data = await fastify.repos.posting.getBatches({
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
