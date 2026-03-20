import type { DomainEvent } from "./DomainEvent.js";

export const SALE_EVENTS = {
  CREATED: "sale.created",
  CANCELLED: "sale.cancelled",
  REFUNDED: "sale.refunded",
  PAYMENT_ADDED: "sale.payment_added",
} as const;

export type SaleEventType = (typeof SALE_EVENTS)[keyof typeof SALE_EVENTS];

export interface SaleCreatedPayload {
  saleId: number;
  customerId: number | null;
  totalAmount: number;
  paidAmount: number;
  itemCount: number;
}

export interface SaleCancelledPayload {
  saleId: number;
  reason?: string;
}

export interface SaleRefundedPayload {
  saleId: number;
  refundedAmount: number;
  totalRefunded: number;
  newPaidAmount: number;
  newRemainingAmount: number;
  status: string;
}

export interface SalePaymentAddedPayload {
  saleId: number;
  paymentId: number;
  amount: number;
  method: string;
}

export function makeSaleCreatedEvent(
  payload: SaleCreatedPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: SALE_EVENTS.CREATED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}

export function makeSaleCancelledEvent(
  payload: SaleCancelledPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: SALE_EVENTS.CANCELLED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}

export function makeSaleRefundedEvent(
  payload: SaleRefundedPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: SALE_EVENTS.REFUNDED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}

export function makeSalePaymentAddedEvent(
  payload: SalePaymentAddedPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: SALE_EVENTS.PAYMENT_ADDED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}
