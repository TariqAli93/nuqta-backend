import fp from "fastify-plugin";
import type { FastifyBaseLogger } from "fastify";

/**
 * Bootstrap plugin — runs before all other plugins (alphabetical `a0-` prefix).
 *
 * Responsibilities on every startup:
 *  1. Create the target PostgreSQL database if it doesn't exist and apply any
 *     pending Drizzle migrations.
 *  2. First-run bootstrap (idempotent):
 *     a. Default accounting.enabled to "true" when the setting is absent.
 *     b. Create a default admin user when no users exist.
 *     c. Seed the full chart of accounts via InitializeAccountingUseCase.
 */
export default fp(async (fastify) => {
  const { prepareDatabase } = await import("../data/db/db.js");

  fastify.log.info("Preparing database (create if missing + migrate)…");
  await prepareDatabase();
  fastify.log.info("Database ready.");

  fastify.log.info("Running first-run bootstrap checks…");
  await runFirstRunBootstrap(fastify.log);
  fastify.log.info("First-run bootstrap complete.");
});

// ── First-run bootstrap ────────────────────────────────────────────────────

async function runFirstRunBootstrap(log: FastifyBaseLogger): Promise<void> {
  // Dynamic imports keep the plugin's cold-start footprint minimal and allow
  // each import to be replaced with a test double in integration tests.
  const [
    { db },
    { SettingsRepository },
    { UserRepository },
    { AccountingRepository },
    { InitializeAccountingUseCase, ACCOUNTING_SETTING_KEYS },
    { hashPassword },
  ] = await Promise.all([
    import("../data/db/db.js"),
    import("../data/repositories/settings/SettingsRepository.js"),
    import("../data/repositories/users/UserRepository.js"),
    import("../data/repositories/accounting/AccountingRepository.js"),
    import(
      "../domain/use-cases/accounting/InitializeAccountingUseCase.js"
    ),
    import("../domain/shared/utils/helpers.js"),
  ]);

  const settingsRepo = new SettingsRepository(db);
  const userRepo = new UserRepository(db);
  const accountingRepo = new AccountingRepository(db);

  // ── 1. Default settings: enable accounting when not explicitly configured ─
  const accountingEnabled = await settingsRepo.get(
    ACCOUNTING_SETTING_KEYS.enabled,
  );
  if (accountingEnabled === null) {
    await settingsRepo.set(ACCOUNTING_SETTING_KEYS.enabled, "true");
    log.info("[bootstrap] accounting.enabled was unset — defaulted to true.");
  }

  // ── 2. Create default admin when the database has no users yet ────────────
  const userCount = await userRepo.count();
  if (userCount === 0) {
    log.info(
      "[bootstrap] No users found — creating default admin account (username: admin).",
    );
    const hashedPassword = await hashPassword("Admin@123");
    await userRepo.create({
      username: "admin",
      password: hashedPassword,
      fullName: "Admin",
      role: "admin",
      isActive: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    log.info(
      "[bootstrap] Default admin created. Change the password after first login.",
    );
  }

  // ── 3. Seed the full chart of accounts ────────────────────────────────────
  const useCase = new InitializeAccountingUseCase(settingsRepo, accountingRepo);
  const result = await useCase.execute({}, "system");

  if (result.seeded) {
    const created = result.createdCodes.length;
    const existing = result.existingCodes.length;
    log.info(
      `[bootstrap] Chart of accounts ready — ${created} created, ${existing} already existed.`,
    );
  } else {
    for (const warning of result.warnings) {
      log.warn(`[bootstrap] COA warning: ${warning}`);
    }
  }
}
