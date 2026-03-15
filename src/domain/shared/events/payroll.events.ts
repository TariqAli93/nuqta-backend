import type { DomainEvent } from "./DomainEvent.js";

export const PAYROLL_EVENTS = {
  PROCESSED: "payroll.processed",
  APPROVED: "payroll.approved",
  DISBURSED: "payroll.disbursed",
  CANCELLED: "payroll.cancelled",
} as const;

export interface PayrollProcessedPayload {
  payrollRunId: number;
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  periodStart: string;
  periodEnd: string;
}

export interface PayrollApprovedPayload {
  payrollRunId: number;
  approvedBy: string;
}

export interface PayrollDisbursedPayload {
  payrollRunId: number;
  totalDisbursed: number;
}

export interface PayrollCancelledPayload {
  payrollRunId: number;
  reason?: string;
}

export function makePayrollProcessedEvent(
  payload: PayrollProcessedPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: PAYROLL_EVENTS.PROCESSED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}

export function makePayrollApprovedEvent(
  payload: PayrollApprovedPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: PAYROLL_EVENTS.APPROVED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}

export function makePayrollDisbursedEvent(
  payload: PayrollDisbursedPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: PAYROLL_EVENTS.DISBURSED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}

export function makePayrollCancelledEvent(
  payload: PayrollCancelledPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: PAYROLL_EVENTS.CANCELLED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}
