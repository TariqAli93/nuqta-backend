import type { DomainEvent } from "./DomainEvent.js";
import type {
  DomainEventHandler,
  IDomainEventBus,
} from "./DomainEventBus.js";

/**
 * In-process, synchronous event bus.
 *
 * Events are dispatched to all matching handlers sequentially within the
 * same process.  Each handler's error is caught individually so that a
 * failure in one handler cannot prevent other handlers from running.
 *
 * This implementation is intentionally simple — if the system grows to
 * require cross-process delivery, swap this with a Redis Pub/Sub or an
 * AMQP-backed implementation behind the same IDomainEventBus interface.
 */
export class InProcessEventBus implements IDomainEventBus {
  private readonly handlers = new Map<string, Set<DomainEventHandler>>();

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers || handlers.size === 0) return;

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        // A handler failure must never abort the publish loop.
        console.error(
          `[InProcessEventBus] Handler error for "${event.eventType}":`,
          error,
        );
      }
    });

    await Promise.all(promises);
  }

  subscribe(eventType: string, handler: DomainEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  unsubscribe(eventType: string, handler: DomainEventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }
}
