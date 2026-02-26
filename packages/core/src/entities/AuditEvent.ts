/**
 * AuditEvent Entity
 * Represents an immutable record of critical business actions for compliance & forensics
 */

export interface AuditEventData {
  id?: number;
  userId: number;
  action: string; // e.g., 'sales:create', 'products:update', 'user:role-change'
  entityType: string; // e.g., 'Sale', 'Product', 'User', 'Customer'
  entityId: number;
  timestamp: string; // ISO 8601 format
  changedFields?: Record<string, { old: any; new: any }>; // Only fields that changed (can be null for create)
  changeDescription?: string; // Human-readable summary, e.g., 'Price updated from 100 to 150'
  ipAddress?: string;
  userAgent?: string; // Browser/app info if applicable
  metadata?: Record<string, any>; // Additional context (e.g., invoice number, reason)
}

export class AuditEvent {
  readonly id?: number;
  readonly userId: number;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: number;
  readonly timestamp: string;
  readonly changedFields?: Record<string, { old: any; new: any }>;
  readonly changeDescription?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly metadata?: Record<string, any>;

  constructor(data: AuditEventData) {
    this.id = data.id;
    this.userId = data.userId;
    this.action = data.action;
    this.entityType = data.entityType;
    this.entityId = data.entityId;
    this.timestamp = data.timestamp;
    this.changedFields = data.changedFields;
    this.changeDescription = data.changeDescription;
    this.ipAddress = data.ipAddress;
    this.userAgent = data.userAgent;
    this.metadata = data.metadata;
  }

  /**
   * Create audit event for entity creation
   */
  static createForCreate(
    userId: number,
    action: string,
    entityType: string,
    entityId: number,
    newData?: Record<string, any>,
    changeDescription?: string
  ): AuditEvent {
    const changedFields: Record<string, { old: any; new: any }> = {};
    if (newData) {
      Object.keys(newData).forEach((key) => {
        changedFields[key] = { old: null, new: newData[key] };
      });
    }

    return new AuditEvent({
      userId,
      action,
      entityType,
      entityId,
      timestamp: new Date().toISOString(),
      changedFields,
      changeDescription,
    });
  }

  /**
   * Create audit event for entity update
   */
  static createForUpdate(
    userId: number,
    action: string,
    entityType: string,
    entityId: number,
    changes: Record<string, { old: any; new: any }>,
    changeDescription?: string
  ): AuditEvent {
    return new AuditEvent({
      userId,
      action,
      entityType,
      entityId,
      timestamp: new Date().toISOString(),
      changedFields: changes,
      changeDescription,
    });
  }

  /**
   * Create audit event for entity deletion
   */
  static createForDelete(
    userId: number,
    action: string,
    entityType: string,
    entityId: number,
    oldData?: Record<string, any>
  ): AuditEvent {
    const changedFields: Record<string, { old: any; new: any }> = {};
    if (oldData) {
      Object.keys(oldData).forEach((key) => {
        changedFields[key] = { old: oldData[key], new: null };
      });
    }

    return new AuditEvent({
      userId,
      action,
      entityType,
      entityId,
      timestamp: new Date().toISOString(),
      changedFields,
      changeDescription: `${entityType} deleted`,
    });
  }

  /**
   * Convert to plain object for serialization (e.g., IPC, JSON)
   * Removes prototype/class information for safe transmission
   */
  toJSON(): AuditEventData {
    return {
      id: this.id,
      userId: this.userId,
      action: this.action,
      entityType: this.entityType,
      entityId: this.entityId,
      timestamp: this.timestamp,
      changedFields: this.changedFields,
      changeDescription: this.changeDescription,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      metadata: this.metadata,
    };
  }
}
