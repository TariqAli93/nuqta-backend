/**
 * Backup schemas — JSON Schema definitions for backup endpoints
 */
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
  SuccessNullResponse,
} from "./common.js";

// ─── Shared shapes ─────────────────────────────────────────────────
export const BackupInfoSchema = {
  type: "object" as const,
  required: ["name", "sizeBytes", "createdAt", "path"] as const,
  properties: {
    name: { type: "string" },
    sizeBytes: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
    path: { type: "string" },
  },
} as const;

export const BackupStatsSchema = {
  type: "object" as const,
  required: [
    "totalBackups",
    "totalSizeBytes",
    "latestBackup",
    "oldestBackup",
    "backupPath",
  ] as const,
  properties: {
    totalBackups: { type: "integer" },
    totalSizeBytes: { type: "integer" },
    latestBackup: { ...BackupInfoSchema, nullable: true },
    oldestBackup: { ...BackupInfoSchema, nullable: true },
    backupPath: { type: "string" },
  },
} as const;

export const BackupTokenSchema = {
  type: "object" as const,
  required: ["token", "expiresIn"] as const,
  properties: {
    token: { type: "string" },
    expiresIn: { type: "integer", description: "Token TTL in seconds" },
  },
} as const;

// ─── POST /backup — create backup ─────────────────────────────────
export const createBackupSchema = {
  tags: ["backup"],
  summary: "Create a new database backup",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(BackupInfoSchema, "Backup created"),
    401: ErrorResponses[401],
    403: ErrorResponses[403],
    500: ErrorResponses[500],
  },
};

// ─── GET /backup — list backups ───────────────────────────────────
export const listBackupsSchema = {
  tags: ["backup"],
  summary: "List all available backups",
  security: [{ bearerAuth: [] }],
  response: {
    200: successArrayEnvelope(BackupInfoSchema, "Backup list"),
    401: ErrorResponses[401],
    403: ErrorResponses[403],
  },
};

// ─── POST /backup/generate-token — generate download token ───────
export const generateBackupTokenSchema = {
  tags: ["backup"],
  summary: "Generate a one-time download token for a backup",
  security: [{ bearerAuth: [] }],
  body: {
    type: "object" as const,
    required: ["backupName"] as const,
    properties: {
      backupName: { type: "string", description: "Name of the backup file" },
    },
  },
  response: {
    200: successEnvelope(BackupTokenSchema, "Backup download token"),
    401: ErrorResponses[401],
    403: ErrorResponses[403],
    404: ErrorResponses[404],
  },
};

// ─── POST /backup/restore — restore from backup ──────────────────
export const restoreBackupSchema = {
  tags: ["backup"],
  summary: "Restore database from a named backup",
  security: [{ bearerAuth: [] }],
  body: {
    type: "object" as const,
    required: ["backupName"] as const,
    properties: {
      backupName: {
        type: "string",
        description: "Name of the backup to restore",
      },
    },
  },
  response: {
    200: SuccessNullResponse,
    401: ErrorResponses[401],
    403: ErrorResponses[403],
    404: ErrorResponses[404],
    500: ErrorResponses[500],
  },
};

// ─── DELETE /backup/:backupName — delete backup ──────────────────
export const deleteBackupSchema = {
  tags: ["backup"],
  summary: "Delete a backup file",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object" as const,
    required: ["backupName"] as const,
    properties: {
      backupName: {
        type: "string",
        description: "Name of the backup file to delete",
      },
    },
  },
  response: {
    200: SuccessNullResponse,
    401: ErrorResponses[401],
    403: ErrorResponses[403],
    404: ErrorResponses[404],
  },
};

// ─── GET /backup/stats — backup statistics ───────────────────────
export const getBackupStatsSchema = {
  tags: ["backup"],
  summary: "Get backup statistics",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(BackupStatsSchema, "Backup statistics"),
    401: ErrorResponses[401],
    403: ErrorResponses[403],
  },
};
