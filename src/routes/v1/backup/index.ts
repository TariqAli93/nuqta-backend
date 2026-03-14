/**
 * Backup routes — /v1/backup
 * All endpoints are admin-only
 */
import { FastifyPluginAsync } from "fastify";
import {
  CreateBackupUseCase,
  ListBackupsUseCase,
  RestoreBackupUseCase,
  DeleteBackupUseCase,
  GetBackupStatsUseCase,
  GenerateBackupTokenUseCase,
} from "@nuqta/core";
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
  SuccessNullResponse,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const BackupInfoSchema = {
  type: "object" as const,
  required: ["name", "sizeBytes", "createdAt", "path"] as const,
  properties: {
    name: { type: "string" },
    sizeBytes: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
    path: { type: "string" },
  },
} as const;

const BackupStatsSchema = {
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

const BackupTokenSchema = {
  type: "object" as const,
  required: ["token", "expiresIn"] as const,
  properties: {
    token: { type: "string" },
    expiresIn: { type: "integer", description: "Token TTL in seconds" },
  },
} as const;

const createBackupSchema = {
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

const listBackupsSchema = {
  tags: ["backup"],
  summary: "List all available backups",
  security: [{ bearerAuth: [] }],
  response: {
    200: successArrayEnvelope(BackupInfoSchema, "Backup list"),
    401: ErrorResponses[401],
    403: ErrorResponses[403],
  },
};

const generateBackupTokenSchema = {
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

const restoreBackupSchema = {
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

const deleteBackupSchema = {
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

const getBackupStatsSchema = {
  tags: ["backup"],
  summary: "Get backup statistics",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(BackupStatsSchema, "Backup statistics"),
    401: ErrorResponses[401],
    403: ErrorResponses[403],
  },
};

const backup: FastifyPluginAsync = async (fastify) => {
  // All backup endpoints require authentication
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /backup — create a new backup
  fastify.post(
    "/",
    {
      schema: createBackupSchema,
      preHandler: requirePermission("backup:create"),
      config: {
        rateLimit: { max: 5, timeWindow: 60_000 },
      },
    },
    async (request) => {
      const uc = new CreateBackupUseCase(
        fastify.repos.backup,
        fastify.repos.audit,
      );
      const data = await uc.execute(
        request.user ? (request.user?.sub as number) : 1,
      );
      return { ok: true, data };
    },
  );

  // GET /backup — list all backups
  fastify.get(
    "/",
    {
      schema: listBackupsSchema,
      preHandler: requirePermission("backup:read"),
    },
    async () => {
      const uc = new ListBackupsUseCase(fastify.repos.backup);
      const data = await uc.execute();
      return { ok: true, data };
    },
  );

  // GET /backup/stats — backup statistics
  fastify.get(
    "/stats",
    {
      schema: getBackupStatsSchema,
      preHandler: requirePermission("backup:read"),
    },
    async () => {
      const uc = new GetBackupStatsUseCase(fastify.repos.backup);
      const data = await uc.execute();
      return { ok: true, data };
    },
  );

  // POST /backup/generate-token — generate download token
  fastify.post(
    "/generate-token",
    {
      schema: generateBackupTokenSchema,
      preHandler: requirePermission("backup:create"),
    },
    async (request) => {
      const { backupName } = request.body as { backupName: string };
      const uc = new GenerateBackupTokenUseCase(fastify.jwt);
      const data = await uc.execute(
        backupName,
        request.user ? (request.user?.sub as number) : 1,
      );
      return { ok: true, data };
    },
  );

  // POST /backup/restore — restore from backup
  fastify.post(
    "/restore",
    {
      schema: restoreBackupSchema,
      preHandler: requirePermission("backup:restore"),
      bodyLimit: 50 * 1024 * 1024,
      config: {
        rateLimit: { max: 5, timeWindow: 60_000 },
      },
    },
    async (request) => {
      const { backupName } = request.body as { backupName: string };
      const uc = new RestoreBackupUseCase(
        fastify.repos.backup,
        fastify.repos.audit,
      );
      await uc.execute(
        backupName,
        request.user ? (request.user?.sub as number) : 1,
      );
      return { ok: true, data: null };
    },
  );

  // DELETE /backup/:backupName — delete a backup
  fastify.delete<{ Params: { backupName: string } }>(
    "/:backupName",
    {
      schema: deleteBackupSchema,
      preHandler: requirePermission("backup:delete"),
    },
    async (request) => {
      const uc = new DeleteBackupUseCase(
        fastify.repos.backup,
        fastify.repos.audit,
      );
      await uc.execute(
        request.params.backupName,
        request.user ? (request.user?.sub as number) : 1,
      );
      return { ok: true, data: null };
    },
  );
};

export default backup;
