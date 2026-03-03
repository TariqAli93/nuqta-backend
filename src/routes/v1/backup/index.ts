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
  createBackupSchema,
  listBackupsSchema,
  restoreBackupSchema,
  deleteBackupSchema,
  getBackupStatsSchema,
  generateBackupTokenSchema,
} from "../../../schemas/backup.js";
import { requirePermission } from "../../../middleware/rbac.js";

const backup: FastifyPluginAsync = async (fastify) => {
  // All backup endpoints require authentication
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /backup — create a new backup
  fastify.post(
    "/",
    {
      schema: createBackupSchema,
      preHandler: requirePermission("backup:create"),
    },
    async (request) => {
      const uc = new CreateBackupUseCase(
        fastify.repos.backup,
        fastify.repos.audit,
      );
      const data = await uc.execute((request.user as any).id);
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
      const data = await uc.execute(backupName, (request.user as any).id);
      return { ok: true, data };
    },
  );

  // POST /backup/restore — restore from backup
  fastify.post(
    "/restore",
    {
      schema: restoreBackupSchema,
      preHandler: requirePermission("backup:restore"),
    },
    async (request) => {
      const { backupName } = request.body as { backupName: string };
      const uc = new RestoreBackupUseCase(
        fastify.repos.backup,
        fastify.repos.audit,
      );
      await uc.execute(backupName, (request.user as any).id);
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
      await uc.execute(request.params.backupName, (request.user as any).id);
      return { ok: true, data: null };
    },
  );
};

export default backup;
