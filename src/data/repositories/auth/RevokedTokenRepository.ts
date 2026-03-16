import { eq, lt } from "drizzle-orm";
import type { DbConnection } from "../../db/db.js";
import { revokedTokens } from "../../schema/schema.js";
import type { IRevokedTokenRepository } from "../../../domain/interfaces/IRevokedTokenRepository.js";

export class RevokedTokenRepository implements IRevokedTokenRepository {
  constructor(private db: DbConnection) {}

  async revoke(jti: string, expiresAt: Date): Promise<void> {
    await this.db
      .insert(revokedTokens)
      .values({ jti, expiresAt })
      .onConflictDoNothing(); // idempotent — revoking twice is harmless
  }

  async isRevoked(jti: string): Promise<boolean> {
    const [row] = await this.db
      .select({ jti: revokedTokens.jti })
      .from(revokedTokens)
      .where(eq(revokedTokens.jti, jti))
      .limit(1);
    return !!row;
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(revokedTokens)
      .where(lt(revokedTokens.expiresAt, now));
    // Drizzle returns rowCount for DELETE
    return (result as unknown as { rowCount: number })?.rowCount ?? 0;
  }
}
