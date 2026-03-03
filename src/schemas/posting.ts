/**
 * Posting domain schemas.
 */
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
} from "./common.js";

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

export const postPeriodSchema = {
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

export const reverseEntrySchema = {
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

export const postEntrySchema = {
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

export const unpostEntrySchema = {
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
    200: successArrayEnvelope(PostingBatchSchema, "Posting batches"),
    ...ErrorResponses,
  },
} as const;

export const lockBatchSchema = {
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

export const unlockBatchSchema = {
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
