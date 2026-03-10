# Nuqta Integration Strategies: Frontend ↔ Backend

> **Version**: 1.0
> **Date**: 2026-03-10
> **Status**: Active

## Overview

This document defines six integration strategies to improve how the Nuqta frontend (Vue 3) communicates with the backend (Fastify). Each strategy addresses a specific gap in the current request/response REST architecture, prioritized for a multi-terminal POS environment.

```
┌─────────────────────────────────────────────────────────┐
│                     NUQTA UI (Vue 3)                     │
│                                                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐ │
│  │ Query    │  │ Event     │  │Optimistic│  │Offline │ │
│  │ Cache    │  │ Stream    │  │ Mutation │  │ Queue  │ │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └───┬────┘ │
│       │              │              │             │      │
│  ┌────┴──────────────┴──────────────┴─────────────┴────┐ │
│  │          HTTP Client (Axios + Dedup + Retry)         │ │
│  └────────────────────────┬────────────────────────────┘ │
└───────────────────────────┼──────────────────────────────┘
                            │  REST + SSE
┌───────────────────────────┼──────────────────────────────┐
│                    NUQTA BACKEND (Fastify)                │
│  ┌────────────────────────┴────────────────────────────┐ │
│  │              Route Handlers (85+ endpoints)          │ │
│  └────┬───────────────┬─────────────────┬──────────────┘ │
│       │               │                 │                │
│  ┌────┴─────┐  ┌──────┴──────┐  ┌──────┴──────┐        │
│  │ Cache    │  │  Event Bus  │  │   SSE       │        │
│  │ Headers  │  │  (EventEmitter)│  │  Endpoint  │        │
│  └──────────┘  └─────────────┘  └─────────────┘        │
└──────────────────────────────────────────────────────────┘
```

---

## Strategy 1: Smart API Caching (P0)

**Problem**: Every page navigation triggers fresh API calls, even for stable data.

**Solution**: TTL-based client-side cache with stale-while-revalidate pattern.

### How It Works

```
Component mounts
    │
    ▼
useQueryCache('products', fetcher, { ttl: 60s })
    │
    ├─ Cache HIT + fresh? → Return cached data immediately
    │
    ├─ Cache HIT + stale? → Return cached data, refetch in background
    │
    └─ Cache MISS? → Show loading, fetch from API, cache result
```

### Cacheable Resources

| Resource | TTL | Invalidation Trigger |
|----------|-----|---------------------|
| Settings (company, POS, etc.) | 5 min | `settings:changed` SSE event |
| Categories | 2 min | `category:changed` SSE event |
| Products list | 1 min | `product:updated` SSE event |
| Dashboard stats | 30 sec | `sale:created` SSE event |

### Backend: Cache-Control Headers

The `cache-headers` plugin adds `ETag` and `Cache-Control` headers to cacheable GET responses, enabling conditional requests (`If-None-Match`) for bandwidth savings.

### Frontend: `useQueryCache` Composable

```typescript
const { data, loading, error, refresh, invalidate } = useQueryCache<Product[]>(
  'products-list',
  () => productsClient.getAll(params),
  { ttl: 60_000, staleWhileRevalidate: true }
);
```

---

## Strategy 2: Real-time Updates via SSE (P0)

**Problem**: Multi-terminal POS — one terminal's sale doesn't notify others. Inventory goes stale.

**Solution**: Server-Sent Events (SSE) push domain events to all connected clients.

### Event Flow

```
Terminal A creates sale
    │
    ▼
Backend: CreateSaleUseCase.execute()
    │
    ├─ Return response to Terminal A
    │
    └─ eventBus.emit('sale:created', { saleId, items, total })
           │
           ▼
    SSE endpoint broadcasts to all connected clients
           │
           ├─ Terminal B: salesStore.refresh()
           ├─ Terminal B: productsStore.invalidateStock()
           └─ Terminal C: dashboardStore.refresh()
```

### Event Types

| Event | Payload | Triggered By |
|-------|---------|-------------|
| `sale:created` | `{ id, total, itemCount }` | POST /sales |
| `sale:cancelled` | `{ id }` | POST /sales/:id/cancel |
| `product:updated` | `{ id, name }` | PUT /products/:id |
| `product:created` | `{ id, name }` | POST /products |
| `product:deleted` | `{ id }` | DELETE /products/:id |
| `inventory:adjusted` | `{ productId, newStock }` | POST /products/:id/adjust-stock |
| `settings:changed` | `{ key }` | PUT /settings/* |

### SSE Endpoint

```
GET /api/v1/events/stream
Authorization: Bearer <token>
Accept: text/event-stream

← event: sale:created
← data: {"id":42,"total":15000,"itemCount":3,"timestamp":"2026-..."}
←
← :heartbeat
←
```

### Frontend: `useEventStream` + Event Bridge

The event bridge maps SSE events to Pinia store invalidation automatically.

---

## Strategy 3: Optimistic Updates (P1)

**Problem**: Mutations feel slow — the UI waits for server round-trip.

**Solution**: Apply changes locally first, reconcile with server response, rollback on failure.

```
User clicks "Add Item"
    │
    ├─ 1. Save snapshot of current state
    ├─ 2. Apply change to local state (instant UI update)
    ├─ 3. Send API request
    │
    ├─ Success? → Replace local state with server response
    └─ Failure? → Rollback to snapshot, show error toast
```

### Best Candidates for Optimistic Updates
- Adding items to POS cart
- Stock adjustments
- Customer/supplier payment recording

---

## Strategy 4: Offline Queue & Resilience (P1)

**Problem**: POS terminals may lose connectivity briefly. All operations fail.

**Solution**: Queue write operations when offline, replay when back online.

```
┌─────────────────────────────────────┐
│           Online?                    │
│  YES → Execute API call normally     │
│  NO  → Queue to IndexedDB           │
│         │                            │
│         └─ Connection restored?      │
│             └─ Replay queue in FIFO  │
│                order with conflict   │
│                detection             │
└─────────────────────────────────────┘
```

### Connection Status Component
A persistent chip in the app bar shows:
- 🟢 **Online** — all systems go
- 🟡 **Syncing** — replaying queued operations
- 🔴 **Offline** — operations are being queued

---

## Strategy 5: Request Deduplication (P2)

**Problem**: Multiple components mounting simultaneously trigger identical API calls.

**Solution**: Track in-flight GET requests. If an identical request is already pending, return the same Promise.

```
Component A: GET /products → [new request, store in flight map]
Component B: GET /products → [same key in flight, return existing Promise]
Both resolve with the same response.
```

---

## Strategy 6: Retry & Circuit Breaker (P2)

**Problem**: Transient failures show errors immediately instead of recovering gracefully.

**Solution**: Auto-retry GET requests with exponential backoff. Circuit breaker prevents retry storms.

```
Request fails (5xx / network error)
    │
    ├─ Attempt 1: wait 1s, retry
    ├─ Attempt 2: wait 2s, retry
    └─ Attempt 3: wait 4s, retry → fail permanently

Circuit breaker:
    After 5 consecutive failures within 60s → OPEN circuit
    All requests fail-fast for 30s cooldown
    After cooldown → HALF-OPEN, allow 1 probe request
    Probe succeeds → CLOSE circuit (normal operation)
```

---

## Implementation Checklist

### Phase 1 (Current)
- [x] Strategy document
- [x] Backend: Event bus plugin
- [x] Backend: SSE endpoint (`GET /events/stream`)
- [x] Backend: Cache-control headers plugin
- [x] Backend: Emit events from sales/products/inventory routes
- [x] Frontend: `useQueryCache` composable
- [x] Frontend: `useEventStream` composable
- [x] Frontend: Event bridge (SSE → Pinia stores)
- [x] Frontend: Request deduplication in HTTP client
- [x] Frontend: Retry logic in HTTP client
- [x] Frontend: `useOptimisticMutation` composable
- [x] Frontend: `useOfflineQueue` composable
- [x] Frontend: `useConnectionStatus` composable
- [x] Frontend: `ConnectionStatus.vue` component

### Phase 2 (Future)
- [ ] Apply caching to all Pinia stores
- [ ] Apply optimistic updates to sales/inventory flows
- [ ] IndexedDB persistence for offline queue
- [ ] Idempotency key support on backend
- [ ] E2E tests for SSE event flow
- [ ] Load testing for SSE connections

---

## Testing

1. **Caching**: Navigate away and back — second load should be instant
2. **SSE**: Open two tabs, create a sale in one — other tab should auto-refresh
3. **Dedup**: Check network tab — simultaneous component mounts should produce 1 request
4. **Retry**: Stop backend, trigger a GET — console should show retry attempts
5. **Offline**: Disconnect network, perform actions, reconnect — queued ops should sync
