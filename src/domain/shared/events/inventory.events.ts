import type { DomainEvent } from "./DomainEvent.js";

export const INVENTORY_EVENTS = {
  DEPLETED: "inventory.depleted",
  RECONCILED: "inventory.reconciled",
  LOW_STOCK: "inventory.low_stock",
} as const;

export interface InventoryDepletedPayload {
  productId: number;
  productName: string;
  quantityDepleted: number;
  remainingStock: number;
}

export interface InventoryReconciledPayload {
  productId: number;
  previousStock: number;
  reconciledStock: number;
  drift: number;
}

export interface InventoryLowStockPayload {
  productId: number;
  productName: string;
  currentStock: number;
  minimumStockLevel: number;
}

export function makeInventoryDepletedEvent(
  payload: InventoryDepletedPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: INVENTORY_EVENTS.DEPLETED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}

export function makeInventoryReconciledEvent(
  payload: InventoryReconciledPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: INVENTORY_EVENTS.RECONCILED,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}

export function makeInventoryLowStockEvent(
  payload: InventoryLowStockPayload,
  userId: string,
): DomainEvent {
  return {
    eventType: INVENTORY_EVENTS.LOW_STOCK,
    occurredAt: new Date(),
    payload: payload as unknown as Record<string, unknown>,
    userId,
  };
}
