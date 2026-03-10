import { EventEmitter } from "node:events";
import fp from "fastify-plugin";

export interface DomainEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export type DomainEventHandler = (event: DomainEvent) => void;

class DomainEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Allow many SSE clients to subscribe without warning
    this.emitter.setMaxListeners(200);
  }

  emit(type: string, payload: Record<string, unknown> = {}): void {
    const event: DomainEvent = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.emitter.emit("domain-event", event);
  }

  subscribe(handler: DomainEventHandler): () => void {
    this.emitter.on("domain-event", handler);
    return () => {
      this.emitter.off("domain-event", handler);
    };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    eventBus: DomainEventBus;
  }
}

export default fp(async (fastify) => {
  const eventBus = new DomainEventBus();
  fastify.decorate("eventBus", eventBus);
});
