/**
 * IAuditRepository Interface
 * Defines audit log persistence contract
 */
import { AuditEvent } from "../entities/AuditEvent.js";

export interface IAuditRepository {
  /**
   * Create audit event record
   */
  create(auditEvent: AuditEvent): Promise<AuditEvent>;

  /**
   * Retrieve audit events by filters
   */
  getByFilters(filters: {
    userId?: number;
    entityType?: string;
    entityId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]>;

  /**
   * Retrieve single audit event by ID
   */
  getById(id: number): Promise<AuditEvent | null>;

  /**
   * Count audit events matching filters
   */
  count(filters: {
    userId?: number;
    entityType?: string;
    entityId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<number>;

  /**
   * Get audit trail for specific entity (all events for entityType + entityId)
   */
  getAuditTrail(
    entityType: string,
    entityId: number,
    limit?: number,
  ): Promise<AuditEvent[]>;

  /**
   * Delete old audit records (retention policy)
   * @param olderThanDays Delete records older than N days
   */
  deleteOlderThan(olderThanDays: number): Promise<number>;
}
