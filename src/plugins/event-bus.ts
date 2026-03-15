/**
 * Fastify plugin — Domain Event Bus
 *
 * Wires the in-process IDomainEventBus into Fastify's DI container and
 * provides backward-compatible helpers for SSE-style event emission.
 *
 * The plugin exposes TWO complementary APIs:
 *
 *  1. fastify.eventBus  — the full IDomainEventBus (publish / subscribe /
 *     unsubscribe), used by routes and plugins.
 *
 *  2. fastify.emitDomainEvent(type, payload)  — legacy SSE helper that
 *     wraps the bus, forwarded to all SSE clients via the SSE subscriber
 *     registered below.
 *
 * SSE forwarding: any domain event published through the bus is relayed
 * to connected SSE clients through the legacy DomainEventHandler interface
 * so that the /events route requires no changes.
 */

import { EventEmitter } from "node:events";
import fp from "fastify-plugin";
import { InProcessEventBus } from "../domain/shared/events/InProcessEventBus.js";
import type { IDomainEventBus } from "../domain/shared/events/DomainEventBus.js";
import type { DomainEvent } from "../domain/shared/events/DomainEvent.js";

// ── Legacy SSE event shape (kept for /events route compatibility) ───────────
export interface LegacyDomainEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export type LegacyDomainEventHandler = (event: LegacyDomainEvent) => void;

// ── SSE fan-out emitter ─────────────────────────────────────────────────────
class SseFanOut {
  private emitter = new EventEmitter();

  constructor() {
    // Allow up to 200 simultaneous SSE client subscriptions.
    this.emitter.setMaxListeners(200);
  }

  forward(event: DomainEvent): void {
    const legacy: LegacyDomainEvent = {
      type: event.eventType,
      payload: event.payload,
      timestamp: event.occurredAt.toISOString(),
    };
    this.emitter.emit("domain-event", legacy);
  }

  subscribe(handler: LegacyDomainEventHandler): () => void {
    this.emitter.on("domain-event", handler);
    return () => this.emitter.off("domain-event", handler);
  }
}

// ── Fastify type augmentation ───────────────────────────────────────────────
declare module "fastify" {
  interface FastifyInstance {
    /** Full domain event bus — use this for publish/subscribe in use-cases. */
    eventBus: IDomainEventBus;
    /** Subscribe to SSE-formatted events (used by the /events route). */
    subscribeToSse(handler: LegacyDomainEventHandler): () => void;
    /** Publish a legacy SSE event directly (bypasses the domain bus). */
    emitDomainEvent(type: string, payload?: Record<string, unknown>): void;
  }
}

export default fp(async (fastify) => {
  const bus = new InProcessEventBus();
  const sse = new SseFanOut();

  // Bridge: every domain event published on the bus is forwarded to SSE.
  bus.subscribe("*" as never, async (event: DomainEvent) => {
    sse.forward(event);
  });

  // Because InProcessEventBus uses Map<eventType, Set<handler>>, wildcard "*"
  // won't match concrete event types.  Instead we monkey-patch publish to
  // always forward to SSE after running domain handlers.
  const originalPublish = bus.publish.bind(bus);
  // @ts-expect-error — we are augmenting the concrete instance, not the interface
  bus.publish = async (event: DomainEvent) => {
    await originalPublish(event);
    sse.forward(event);
  };

  fastify.decorate("eventBus", bus);

  fastify.decorate(
    "subscribeToSse",
    (handler: LegacyDomainEventHandler) => sse.subscribe(handler),
  );

  fastify.decorate(
    "emitDomainEvent",
    (type: string, payload: Record<string, unknown> = {}) => {
      sse.forward({ eventType: type, payload, occurredAt: new Date(), userId: "system" });
    },
  );
});
