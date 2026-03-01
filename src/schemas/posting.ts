/**
 * Posting domain schemas.
 */
import { ErrorResponses, successEnvelope } from "./common.js";

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
    200: successEnvelope({ type: "object" as const }, "Reversal result"),
    ...ErrorResponses,
  },
} as const;

export const postEntrySchema = {
  tags: ["Posting"],
  summary: "Post an individual entry",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope({ type: "object" as const }, "Posted entry"),
    ...ErrorResponses,
  },
} as const;

export const unpostEntrySchema = {
  tags: ["Posting"],
  summary: "Unpost an individual entry",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope({ type: "object" as const }, "Unposted entry"),
    ...ErrorResponses,
  },
} as const;
