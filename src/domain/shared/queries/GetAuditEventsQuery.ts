import type { Query } from "./Query.js";
import type { PaginatedResult } from "./PaginatedResult.js";
import type { AuditEvent } from "../../entities/AuditEvent.js";

export class GetAuditEventsQuery implements Query<PaginatedResult<AuditEvent>> {
  constructor(
    readonly entityType?: string,
    readonly entityId?: number,
    readonly userId?: string,
    readonly action?: string,
    readonly dateFrom?: string,
    readonly dateTo?: string,
    readonly page: number = 1,
    readonly pageSize: number = 20,
  ) {}
}
