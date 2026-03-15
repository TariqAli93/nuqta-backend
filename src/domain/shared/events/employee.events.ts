import type { DomainEvent } from "./DomainEvent.js";

export const EMPLOYEE_EVENTS = {
  CREATED: "employee.created",
  UPDATED: "employee.updated",
} as const;

export interface EmployeeCreatedPayload {
  employeeId: number;
  name: string;
  position: string;
  department: string;
}

export interface EmployeeUpdatedPayload {
  employeeId: number;
  changes: Record<string, unknown>;
}

export function makeEmployeeCreatedEvent(
  payload: EmployeeCreatedPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: EMPLOYEE_EVENTS.CREATED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}

export function makeEmployeeUpdatedEvent(
  payload: EmployeeUpdatedPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: EMPLOYEE_EVENTS.UPDATED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}
