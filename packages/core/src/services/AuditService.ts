/**
 * AuditService
 * Centralized service for audit log management
 * Provides convenient methods to log critical business actions
 */
import { AuditEvent } from '../entities/AuditEvent.js';
import { IAuditRepository } from '../interfaces/IAuditRepository.js';

export class AuditService {
  constructor(private auditRepo: IAuditRepository) {}

  /**
   * Log entity creation
   */
  async logCreate(
    userId: number,
    entityType: string,
    entityId: number,
    newData?: Record<string, any>,
    changeDescription?: string
  ): Promise<AuditEvent> {
    const event = AuditEvent.createForCreate(
      userId,
      `${entityType.toLowerCase()}:create`,
      entityType,
      entityId,
      newData,
      changeDescription
    );
    return this.auditRepo.create(event);
  }

  /**
   * Log entity update
   */
  async logUpdate(
    userId: number,
    entityType: string,
    entityId: number,
    changes: Record<string, { old: any; new: any }>,
    changeDescription?: string
  ): Promise<AuditEvent> {
    const event = AuditEvent.createForUpdate(
      userId,
      `${entityType.toLowerCase()}:update`,
      entityType,
      entityId,
      changes,
      changeDescription
    );
    return this.auditRepo.create(event);
  }

  /**
   * Log entity deletion
   */
  async logDelete(
    userId: number,
    entityType: string,
    entityId: number,
    oldData?: Record<string, any>
  ): Promise<AuditEvent> {
    const event = AuditEvent.createForDelete(
      userId,
      `${entityType.toLowerCase()}:delete`,
      entityType,
      entityId,
      oldData
    );
    return this.auditRepo.create(event);
  }

  /**
   * Log generic action (e.g., role change, login, export)
   */
  async logAction(
    userId: number,
    action: string,
    entityType: string,
    entityId: number,
    changeDescription?: string,
    metadata?: Record<string, any>
  ): Promise<AuditEvent> {
    const event = new AuditEvent({
      userId,
      action,
      entityType,
      entityId,
      timestamp: new Date().toISOString(),
      changeDescription,
      metadata,
    });
    return this.auditRepo.create(event);
  }

  /**
   * Retrieve audit trail for an entity
   */
  async getAuditTrail(
    entityType: string,
    entityId: number,
    limit: number = 50
  ): Promise<AuditEvent[]> {
    return this.auditRepo.getAuditTrail(entityType, entityId, limit);
  }

  /**
   * Retrieve audit events by user
   */
  async getByUser(userId: number, limit: number = 100): Promise<AuditEvent[]> {
    return this.auditRepo.getByFilters({
      userId,
      limit,
    });
  }

  /**
   * Retrieve audit events by date range
   */
  async getByDateRange(startDate: string, endDate: string, limit?: number): Promise<AuditEvent[]> {
    return this.auditRepo.getByFilters({
      startDate,
      endDate,
      limit,
    });
  }

  /**
   * Search audit events by action
   */
  async getByAction(action: string, limit: number = 100): Promise<AuditEvent[]> {
    return this.auditRepo.getByFilters({
      action,
      limit,
    });
  }

  /**
   * Delete old audit records (retention policy, e.g., keep 90 days)
   */
  async cleanupOldRecords(olderThanDays: number = 90): Promise<number> {
    return this.auditRepo.deleteOlderThan(olderThanDays);
  }

  /**
   * Get audit statistics
   */
  async getStatistics(filters: { userId?: number; startDate?: string; endDate?: string }): Promise<{
    totalEvents: number;
    eventsByAction: Record<string, number>;
    eventsByEntityType: Record<string, number>;
  }> {
    const events = await this.auditRepo.getByFilters(filters);

    const eventsByAction: Record<string, number> = {};
    const eventsByEntityType: Record<string, number> = {};

    events.forEach((event) => {
      eventsByAction[event.action] = (eventsByAction[event.action] || 0) + 1;
      eventsByEntityType[event.entityType] = (eventsByEntityType[event.entityType] || 0) + 1;
    });

    return {
      totalEvents: events.length,
      eventsByAction,
      eventsByEntityType,
    };
  }
}
