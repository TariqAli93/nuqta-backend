import type { DomainEvent } from "./DomainEvent.js";

export const PURCHASE_EVENTS = {
  CREATED: "purchase.created",
  PAYMENT_ADDED: "purchase.payment_added",
} as const;

export interface PurchaseCreatedPayload {
  purchaseId: number;
  supplierId: number | null;
  totalAmount: number;
  itemCount: number;
}

export interface PurchasePaymentAddedPayload {
  purchaseId: number;
  paymentId: number;
  amount: number;
  method: string;
}

export function makePurchaseCreatedEvent(
  payload: PurchaseCreatedPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: PURCHASE_EVENTS.CREATED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}

export function makePurchasePaymentAddedEvent(
  payload: PurchasePaymentAddedPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: PURCHASE_EVENTS.PAYMENT_ADDED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}
