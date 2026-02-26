import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { auditLogs } from "../schema/schema.js";
import type { IAuditRepository } from "@nuqta/core";
import { AuditEvent } from "@nuqta/core";

export class AuditRepository implements IAuditRepository {
  constructor(private db: DbConnection) {}

  async create(auditEvent: AuditEvent): Promise<AuditEvent> {
    const data = auditEvent.toJSON();
    const [created] = await this.db
      .insert(auditLogs)
      .values({
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        timestamp: new Date(data.timestamp),
        changedFields: data.changedFields
          ? JSON.stringify(data.changedFields)
          : null,
        changeDescription: data.changeDescription ?? null,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      } as any)
      .returning();
    return this.mapRow(created);
  }

  async getByFilters(filters: {
    userId?: number;
    entityType?: string;
    entityId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    const conditions = this.buildConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let query = this.db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.timestamp))
      .$dynamic();
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.offset(filters.offset);

    const rows = await query;
    return rows.map((r) => this.mapRow(r));
  }

  async getById(id: number): Promise<AuditEvent | null> {
    const [row] = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id));
    return row ? this.mapRow(row) : null;
  }

  async count(filters: {
    userId?: number;
    entityType?: string;
    entityId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<number> {
    const conditions = this.buildConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(where);
    return Number(result?.count ?? 0);
  }

  async getAuditTrail(
    entityType: string,
    entityId: number,
    limit?: number,
  ): Promise<AuditEvent[]> {
    let query = this.db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, entityId),
        ),
      )
      .orderBy(desc(auditLogs.timestamp))
      .$dynamic();

    if (limit) query = query.limit(limit);

    const rows = await query;
    return rows.map((r) => this.mapRow(r));
  }

  async deleteOlderThan(olderThanDays: number): Promise<number> {
    const deleted = await this.db
      .delete(auditLogs)
      .where(
        sql`${auditLogs.timestamp} < NOW() - INTERVAL '${sql.raw(String(olderThanDays))} days'`,
      )
      .returning({ id: auditLogs.id });
    return deleted.length;
  }

  // ── Helpers ───────────────────────────────────────────────────

  private buildConditions(filters: {
    userId?: number;
    entityType?: string;
    entityId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const conditions: any[] = [];
    if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters.entityType)
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.entityId)
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.startDate)
      conditions.push(gte(auditLogs.timestamp, new Date(filters.startDate)));
    if (filters.endDate)
      conditions.push(lte(auditLogs.timestamp, new Date(filters.endDate)));
    return conditions;
  }

  private mapRow(row: any): AuditEvent {
    return new AuditEvent({
      id: row.id,
      userId: row.userId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      timestamp:
        row.timestamp instanceof Date
          ? row.timestamp.toISOString()
          : row.timestamp,
      changedFields: row.changedFields
        ? JSON.parse(row.changedFields)
        : undefined,
      changeDescription: row.changeDescription ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      userAgent: row.userAgent ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    });
  }
}
