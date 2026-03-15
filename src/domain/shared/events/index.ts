export type { DomainEvent } from "./DomainEvent.js";
export type { DomainEventHandler, IDomainEventBus } from "./DomainEventBus.js";
export { InProcessEventBus } from "./InProcessEventBus.js";

// Sale events
export {
  SALE_EVENTS,
  makeSaleCreatedEvent,
  makeSaleCancelledEvent,
  makeSaleRefundedEvent,
  makeSalePaymentAddedEvent,
} from "./sale.events.js";
export type {
  SaleCreatedPayload,
  SaleCancelledPayload,
  SaleRefundedPayload,
  SalePaymentAddedPayload,
} from "./sale.events.js";

// Purchase events
export {
  PURCHASE_EVENTS,
  makePurchaseCreatedEvent,
  makePurchasePaymentAddedEvent,
} from "./purchase.events.js";
export type {
  PurchaseCreatedPayload,
  PurchasePaymentAddedPayload,
} from "./purchase.events.js";

// Inventory events
export {
  INVENTORY_EVENTS,
  makeInventoryDepletedEvent,
  makeInventoryReconciledEvent,
  makeInventoryLowStockEvent,
} from "./inventory.events.js";
export type {
  InventoryDepletedPayload,
  InventoryReconciledPayload,
  InventoryLowStockPayload,
} from "./inventory.events.js";

// Payroll events
export {
  PAYROLL_EVENTS,
  makePayrollProcessedEvent,
  makePayrollApprovedEvent,
  makePayrollDisbursedEvent,
  makePayrollCancelledEvent,
} from "./payroll.events.js";
export type {
  PayrollProcessedPayload,
  PayrollApprovedPayload,
  PayrollDisbursedPayload,
  PayrollCancelledPayload,
} from "./payroll.events.js";

// Employee events
export {
  EMPLOYEE_EVENTS,
  makeEmployeeCreatedEvent,
  makeEmployeeUpdatedEvent,
} from "./employee.events.js";
export type {
  EmployeeCreatedPayload,
  EmployeeUpdatedPayload,
} from "./employee.events.js";
