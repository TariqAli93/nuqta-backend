/**
 * Canonical shape of every domain event published on the event bus.
 *
 * All fields are readonly to guarantee immutability after publication.
 * The `payload` is a plain object so it serialises cleanly over SSE / JSON.
 */
export interface DomainEvent {
  /** Dot-namespaced event identifier, e.g. "sale.created" */
  readonly eventType: string;

  /** Wall-clock timestamp of when the event occurred in the domain. */
  readonly occurredAt: Date;

  /** Arbitrary structured data describing what happened. */
  readonly payload: Record<string, unknown>;

  /** ID of the user whose action triggered the event. */
  readonly userId: string;
}
