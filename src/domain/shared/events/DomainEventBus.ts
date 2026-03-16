import type { DomainEvent } from "./DomainEvent.js";

/**
 * Handler function signature.  Handlers are async so they can perform I/O
 * (database writes, HTTP calls, etc.) without blocking the publisher.
 */
export type DomainEventHandler = (event: DomainEvent) => Promise<void>;

/**
 * Pub/sub interface for domain events.
 *
 * Concrete implementations:
 *  - InProcessEventBus  (in-process, synchronous fan-out — used in production)
 *  - In tests, inject a spy implementation or use vi.spyOn on the bus.
 */
export interface IDomainEventBus {
  /**
   * Publish a domain event to all registered handlers.
   * Implementations MUST catch handler errors individually so that one
   * failing handler does not prevent others from running.
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Register a handler for a specific event type.
   * The same handler instance may be registered for multiple types.
   */
  subscribe(eventType: string, handler: DomainEventHandler): void;

  /**
   * Remove a previously registered handler.
   */
  unsubscribe(eventType: string, handler: DomainEventHandler): void;
}
