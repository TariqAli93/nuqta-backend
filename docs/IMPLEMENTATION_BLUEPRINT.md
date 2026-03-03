# Nuqta Backend — Implementation Blueprint

> **Generated**: 2026-03-03  
> **Status**: Spec + Gap Analysis against UI Full API Endpoint Map  
> **Architecture**: Clean Architecture (Fastify → Core → Data)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Folder Structure](#2-folder-structure)
3. [Middleware Stack](#3-middleware-stack)
4. [Security & Auth Model](#4-security--auth-model)
5. [Idempotency Engine](#5-idempotency-engine)
6. [Validation & Error Model](#6-validation--error-model)
7. [Observability](#7-observability)
8. [Gap Analysis — Missing Endpoints](#8-gap-analysis--missing-endpoints)
9. [Implementation Checklist](#9-implementation-checklist)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Fastify HTTP Layer (src/)                                      │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ Plugins  │  │ Schemas  │  │ Routes/v1/* │  │ Middleware │  │
│  │ (auth,   │  │ (JSON    │  │ (Controllers)│  │ (auth,     │  │
│  │  db,     │  │  Schema) │  │              │  │  rbac,     │  │
│  │  errors) │  │          │  │              │  │  idempt.)  │  │
│  └──────────┘  └──────────┘  └──────┬──────┘  └────────────┘  │
│                                     │                           │
├─────────────────────────────────────┼───────────────────────────┤
│  @nuqta/core (packages/core/)       │                           │
│  ┌──────────┐  ┌────────────┐  ┌───┴──────┐  ┌────────────┐   │
│  │ Entities │  │ Use Cases  │  │ Services │  │ Interfaces │   │
│  │          │  │ (business  │  │ (JWT,    │  │ (IRepo)    │   │
│  │          │  │  logic)    │  │  RBAC,   │  │            │   │
│  │          │  │            │  │  Audit)  │  │            │   │
│  └──────────┘  └────────────┘  └──────────┘  └─────┬──────┘   │
│                                                     │           │
├─────────────────────────────────────────────────────┼───────────┤
│  @nuqta/data (packages/data/)                       │           │
│  ┌─────────────────┐  ┌──────────┐  ┌──────────────┘          │
│  │ Repositories    │  │ Schema   │  │ (implements interfaces)  │
│  │ (Drizzle ORM)   │  │ (PG DDL) │  │                          │
│  └─────────────────┘  └──────────┘  └──────────────────────────┘
│                                                                  │
│  PostgreSQL                                                      │
└──────────────────────────────────────────────────────────────────┘
```

**Key Principles:**

- Routes (thin controllers) → Use Cases → Repository Interfaces ← Repository Implementations
- All responses use `{ ok: true, data: T }` / `{ ok: false, error: { code, message, details?, status? } }`
- Monetary values: integer minor units (IQD — no sub-unit)
- Stateless JWT auth (HS256) with access + refresh tokens

---

## 2. Folder Structure

### Current Structure (with planned additions marked with `+`)

```
nuqta-backend/
├── docs/                              # + NEW
│   ├── openapi.yaml                   # + OpenAPI 3.0 spec
│   ├── IMPLEMENTATION_BLUEPRINT.md    # + This file
│   ├── RBAC_MATRIX.md                 # + RBAC permissions matrix
│   └── TEST_PLAN.md                   # + Test plan
├── packages/
│   ├── core/src/
│   │   ├── entities/                  # Domain entities (18 files)
│   │   ├── errors/
│   │   │   └── DomainErrors.ts        # DomainError base + subtypes
│   │   ├── interfaces/               # Repository interfaces (16 files)
│   │   ├── services/
│   │   │   ├── JwtService.ts          # JWT sign/verify (jsonwebtoken)
│   │   │   ├── PermissionService.ts   # RBAC permission checks
│   │   │   ├── AuditService.ts        # Audit event creation
│   │   │   ├── FifoDepletionService.ts# FIFO COGS calculation
│   │   │   ├── SettingsAccessor.ts    # Settings helper
│   │   │   └── IdempotencyService.ts  # + NEW — idempotency logic
│   │   ├── use-cases/                 # ~50+ use cases (by domain)
│   │   │   ├── auth/
│   │   │   │   ├── LoginUseCase.ts
│   │   │   │   ├── RegisterFirstUserUseCase.ts
│   │   │   │   ├── CheckInitialSetupUseCase.ts
│   │   │   │   ├── ChangePasswordUseCase.ts     # + NEW
│   │   │   │   └── RefreshTokenUseCase.ts       # + NEW
│   │   │   ├── sales/
│   │   │   │   ├── CreateSaleUseCase.ts
│   │   │   │   ├── GetSaleByIdUseCase.ts
│   │   │   │   ├── AddPaymentUseCase.ts
│   │   │   │   ├── CancelSaleUseCase.ts         # + NEW
│   │   │   │   ├── RefundSaleUseCase.ts          # + NEW
│   │   │   │   └── GetSaleReceiptUseCase.ts      # + NEW
│   │   │   ├── products/
│   │   │   │   ├── ...existing...
│   │   │   │   ├── GetProductByIdUseCase.ts      # + NEW
│   │   │   │   ├── GetProductPurchaseHistoryUseCase.ts  # + NEW
│   │   │   │   ├── GetProductSalesHistoryUseCase.ts     # + NEW
│   │   │   │   ├── GetProductUnitsUseCase.ts            # + NEW
│   │   │   │   ├── CreateProductUnitUseCase.ts          # + NEW
│   │   │   │   ├── UpdateProductUnitUseCase.ts          # + NEW
│   │   │   │   ├── DeleteProductUnitUseCase.ts          # + NEW
│   │   │   │   ├── SetDefaultUnitUseCase.ts             # + NEW
│   │   │   │   ├── GetProductBatchesUseCase.ts          # + NEW
│   │   │   │   └── CreateProductBatchUseCase.ts         # + NEW
│   │   │   ├── posting/
│   │   │   │   ├── ...existing...
│   │   │   │   ├── GetPostingBatchesUseCase.ts          # + NEW
│   │   │   │   ├── ReversePostingBatchUseCase.ts        # + NEW
│   │   │   │   ├── LockPostingBatchUseCase.ts           # + NEW
│   │   │   │   └── UnlockPostingBatchUseCase.ts         # + NEW
│   │   │   ├── inventory/
│   │   │   │   ├── ...existing...
│   │   │   │   └── ReconcileInventoryUseCase.ts         # + NEW
│   │   │   ├── audit/
│   │   │   │   └── GetAuditTrailUseCase.ts              # + NEW
│   │   │   ├── backup/                                   # + NEW module
│   │   │   │   ├── CreateBackupUseCase.ts
│   │   │   │   ├── ListBackupsUseCase.ts
│   │   │   │   ├── RestoreBackupUseCase.ts
│   │   │   │   ├── DeleteBackupUseCase.ts
│   │   │   │   ├── GetBackupStatsUseCase.ts
│   │   │   │   └── GenerateBackupTokenUseCase.ts
│   │   │   └── barcode/                                  # + NEW module
│   │   │       ├── GetBarcodeTemplatesUseCase.ts
│   │   │       ├── CreateBarcodeTemplateUseCase.ts
│   │   │       ├── DeleteBarcodeTemplateUseCase.ts
│   │   │       ├── GetBarcodePrintJobsUseCase.ts
│   │   │       └── CreateBarcodePrintJobUseCase.ts
│   │   ├── contract.ts               # ApiResult<T>, ok(), fail()
│   │   └── index.ts                  # Barrel export
│   └── data/src/
│       ├── schema/schema.ts           # Drizzle PG schema (+ idempotency_keys table)
│       ├── repositories/              # 17 repo implementations
│       │   ├── ...existing...
│       │   ├── IdempotencyRepository.ts  # + NEW
│       │   └── BackupRepository.ts       # + NEW
│       └── index.ts
├── src/
│   ├── app.ts                         # Fastify app factory
│   ├── plugins/                       # Loaded alphabetically
│   │   ├── aa-swagger.ts              # OpenAPI + Swagger UI
│   │   ├── ab-caching.ts             # ETag + Cache-Control
│   │   ├── ab-cors.ts                # CORS
│   │   ├── ab-helmet.ts              # Security headers
│   │   ├── ab-rate-limit.ts          # 100 req/min/IP
│   │   ├── ac-request-context.ts     # + NEW — requestId, duration, observability
│   │   ├── ad-idempotency.ts         # + NEW — idempotency middleware
│   │   ├── db.ts                      # DB + repos + JWT decorator
│   │   ├── error-handler.ts          # Custom error handler (envelope)
│   │   ├── sensible.ts               # @fastify/sensible
│   │   └── support.ts                # authenticate decorator
│   ├── schemas/                       # JSON Schema for route validation
│   │   ├── common.ts                  # Shared schemas
│   │   ├── auth.ts | categories.ts | customers.ts | ...
│   │   ├── audit.ts                   # + NEW
│   │   ├── backup.ts                  # + NEW
│   │   └── barcode.ts                 # + UPDATE (currently exists but might need more)
│   └── routes/v1/
│       ├── auth/index.ts              # UPDATE: add /refresh, /me, /change-password, /logout
│       ├── categories/index.ts
│       ├── customers/index.ts         # UPDATE: add GET /:id
│       ├── products/index.ts          # UPDATE: add GET /:id, units, batches, history
│       ├── sales/index.ts             # UPDATE: add cancel, refund, receipt
│       ├── purchases/index.ts
│       ├── inventory/index.ts         # UPDATE: add POST /reconcile
│       ├── accounting/index.ts        # UPDATE: enable auth
│       ├── posting/index.ts           # UPDATE: add batches CRUD
│       ├── customer-ledger/index.ts
│       ├── supplier-ledger/index.ts
│       ├── settings/index.ts          # UPDATE: add typed settings
│       ├── users/index.ts
│       ├── dashboard/index.ts
│       ├── system/index.ts
│       ├── pos/index.ts               # + NEW
│       ├── audit/index.ts             # + NEW
│       ├── backup/index.ts            # + NEW
│       └── barcode/index.ts           # + NEW (or update existing if present)
└── tests/
    ├── routes/v1/
    │   ├── ...existing tests...
    │   ├── audit.test.ts              # + NEW
    │   ├── backup.test.ts             # + NEW
    │   ├── barcode.test.ts            # + NEW
    │   └── pos.test.ts                # + NEW
    └── unit/core/
        ├── ...existing...
        ├── idempotency-service.test.ts  # + NEW
        └── refresh-token.test.ts        # + NEW
```

---

## 3. Middleware Stack

Middleware loads alphabetically via `@fastify/autoload`. Execution order:

```
Request
  │
  ├─ 1. ab-helmet.ts        → Security headers
  ├─ 2. ab-cors.ts          → CORS
  ├─ 3. ab-rate-limit.ts    → 100 req/min/IP
  ├─ 4. ac-request-context   → + requestId generation, start timer
  ├─ 5. db.ts                → Repos + JWT decorator
  ├─ 6. support.ts           → authenticate decorator
  ├─ 7. ad-idempotency       → + Idempotency engine (on POST/PUT/DELETE)
  │
  ├─ Route Handler
  │    └─ onRequest: fastify.authenticate (if protected)
  │    └─ preHandler: rbac check (via PermissionService)
  │    └─ handler: Use Case execution
  │
  ├─ 8. error-handler.ts    → Envelope error responses
  ├─ 9. onResponse hook     → + Log requestId, duration, status, userId
  │
Response (envelope)
```

### 3.1 Request Context Plugin (NEW)

```typescript
// src/plugins/ac-request-context.ts
fp(async (fastify) => {
  fastify.addHook("onRequest", (request, reply, done) => {
    request.requestId = request.headers["x-request-id"] || crypto.randomUUID();
    request.startTime = process.hrtime.bigint();
    reply.header("X-Request-ID", request.requestId);
    done();
  });

  fastify.addHook("onResponse", (request, reply, done) => {
    const duration = Number(process.hrtime.bigint() - request.startTime) / 1e6;
    fastify.log.info({
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration.toFixed(1)}ms`,
      userId: request.user?.sub,
    });
    done();
  });
});
```

### 3.2 RBAC Middleware

The `PermissionService` already exists in `@nuqta/core`. Add a `preHandler` factory:

```typescript
// src/middleware/rbac.ts
export function requirePermission(...perms: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      });
    }
    const hasAll = perms.every((p) => user.permissions.includes(p));
    if (!hasAll) {
      return reply.status(403).send({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: `Missing permissions: ${perms.join(", ")}`,
        },
      });
    }
  };
}
```

Usage in routes:

```typescript
fastify.post(
  "/",
  {
    schema: createSaleSchema,
    preHandler: [fastify.authenticate, requirePermission("sales:create")],
  },
  handler,
);
```

---

## 4. Security & Auth Model

### 4.1 Token Architecture

| Token         | TTL              | Storage                 | Purpose            |
| ------------- | ---------------- | ----------------------- | ------------------ |
| Access Token  | 15 min (900s)    | Client memory           | API authentication |
| Refresh Token | 7 days (604800s) | HttpOnly cookie or body | Token renewal      |

### 4.2 JWT Payload (Access Token)

```typescript
interface AccessTokenPayload {
  sub: number; // userId
  role: string; // "admin" | "cashier" | "manager" | "viewer"
  permissions: string[]; // ["sales:create", "products:read", ...]
  username: string;
  fullName: string;
  phone?: string;
  iat: number;
  exp: number;
  jti: string; // unique token ID
  type: "access"; // token type discriminator
}
```

### 4.3 Refresh Token Payload

```typescript
interface RefreshTokenPayload {
  sub: number;
  jti: string;
  type: "refresh";
  iat: number;
  exp: number;
  family: string; // for refresh token rotation detection
}
```

### 4.4 Refresh Flow

```
POST /auth/refresh { refreshToken: "..." }

1. Decode refreshToken
2. Check type === 'refresh'
3. Verify signature + not expired
4. Check jti not in blacklist (revoked tokens)
5. Look up user (fresh permissions)
6. Issue new accessToken + new refreshToken
7. Blacklist old refreshToken jti
8. Return { accessToken, refreshToken }

On failure → 401 → client re-login
```

**Anti-loop protection:**

- Refresh endpoint does NOT require `Authorization` header
- If refresh fails → clear 401, no recursive retry
- Token family rotation: if old refresh jti is already used → revoke entire family

### 4.5 Logout

```
POST /auth/logout (with Authorization header)

1. Extract jti from access token
2. Add jti + refresh jti to blacklist (TTL = token remaining life)
3. Return { ok: true, data: null }
```

### 4.6 JwtService Updates Required

Current `JwtService` needs minimal changes:

- Add `type` field to payload ('access' | 'refresh')
- Create separate `signRefresh()` method with longer TTL
- Add refresh token family tracking

```typescript
class JwtService {
  private accessTTL: number; // 900 (15 min)
  private refreshTTL: number; // 604800 (7 days)

  signAccess(payload): string {
    /* type: 'access', exp: accessTTL */
  }
  signRefresh(userId: number, family?: string): string {
    /* type: 'refresh', exp: refreshTTL */
  }
  verifyAccess(token: string): AccessPayload | null {
    /* check type === 'access' */
  }
  verifyRefresh(token: string): RefreshPayload | null {
    /* check type === 'refresh' */
  }
}
```

---

## 5. Idempotency Engine

### 5.1 Scope

Required for these financial write endpoints:

- `POST /sales` — create sale
- `POST /sales/:id/payments` — sale payment
- `POST /sales/:id/cancel` — sale cancel
- `POST /sales/:id/refund` — sale refund
- `POST /purchases` — create purchase
- `POST /purchases/:id/payments` — purchase payment
- `POST /products/:productId/adjust-stock` — inventory adjustment
- `POST /customer-ledger/:id/payments` — customer payment
- `POST /supplier-ledger/:id/payments` — supplier payment

### 5.2 Database Table

```sql
CREATE TABLE idempotency_keys (
  id            SERIAL PRIMARY KEY,
  key           TEXT NOT NULL,              -- X-Idempotency-Key header value
  user_id       INTEGER NOT NULL,
  route         TEXT NOT NULL,              -- "POST /api/v1/sales"
  body_hash     TEXT NOT NULL,              -- SHA-256 of request body
  status_code   INTEGER NOT NULL,
  response_body JSONB NOT NULL,             -- exact response to replay
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,       -- created_at + 24h

  UNIQUE(key, user_id, route)
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

### 5.3 Middleware Flow

```
POST /api/v1/sales
Headers: X-Idempotency-Key: <uuid>

1. Extract key from header
2. Compute bodyHash = SHA-256(JSON.stringify(body))
3. Look up (key, userId, route) in idempotency_keys
4. IF found:
   a. IF bodyHash matches → replay (return stored response, status code)
   b. IF bodyHash differs → 409 CONFLICT "Idempotency key reused with different body"
5. IF not found:
   a. Execute handler
   b. Store (key, userId, route, bodyHash, statusCode, responseBody, expires_at)
   c. Return response
```

### 5.4 Cleanup

Cron job or database scheduled function to purge expired keys:

```sql
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

Run every hour via `node-cron` or PostgreSQL `pg_cron`.

### 5.5 Plugin Implementation

```typescript
// src/plugins/ad-idempotency.ts
const IDEMPOTENT_ROUTES = new Set([
  "POST:/api/v1/sales",
  "POST:/api/v1/sales/*/payments",
  "POST:/api/v1/purchases",
  "POST:/api/v1/purchases/*/payments",
  "POST:/api/v1/products/*/adjust-stock",
  "POST:/api/v1/customer-ledger/*/payments",
  "POST:/api/v1/supplier-ledger/*/payments",
]);

fastify.addHook("preHandler", async (request, reply) => {
  if (!isIdempotentRoute(request)) return;

  const key = request.headers["x-idempotency-key"];
  if (!key) return; // optional — or enforce with 400

  const existing = await idempotencyRepo.findByKey(key, userId, route);
  if (existing) {
    if (existing.bodyHash !== computeHash(request.body)) {
      return reply.status(409).send({
        ok: false,
        error: {
          code: "IDEMPOTENCY_CONFLICT",
          message: "Key reused with different body",
        },
      });
    }
    return reply.status(existing.statusCode).send(existing.responseBody);
  }

  // Store after response
  request.idempotencyKey = key;
});

fastify.addHook("onSend", async (request, reply, payload) => {
  if (request.idempotencyKey) {
    await idempotencyRepo.store({
      key: request.idempotencyKey,
      userId: request.user.sub,
      route: `${request.method}:${request.routeOptions.url}`,
      bodyHash: computeHash(request.body),
      statusCode: reply.statusCode,
      responseBody: JSON.parse(payload),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  }
});
```

---

## 6. Validation & Error Model

### 6.1 Validation Layers

| Layer          | Tech                      | Purpose                            |
| -------------- | ------------------------- | ---------------------------------- |
| HTTP Input     | Fastify AJV (JSON Schema) | body, querystring, params, headers |
| Business Logic | Zod (in use cases)        | Domain-level validation            |
| Database       | Drizzle + PG constraints  | Data integrity                     |

### 6.2 Error Codes

| Code                   | HTTP | When                                          |
| ---------------------- | ---- | --------------------------------------------- |
| `VALIDATION_ERROR`     | 400  | AJV schema invalid, Zod parse fail            |
| `UNAUTHORIZED`         | 401  | Missing/invalid/expired token                 |
| `FORBIDDEN`            | 403  | Valid token but missing permissions           |
| `NOT_FOUND`            | 404  | Resource doesn't exist                        |
| `CONFLICT`             | 409  | Duplicate, state mismatch, insufficient stock |
| `INSUFFICIENT_STOCK`   | 409  | Product stock < requested quantity            |
| `INVALID_STATE`        | 409  | Invalid operation for current state           |
| `IDEMPOTENCY_REPLAY`   | 200  | Replay of previous idempotent response        |
| `IDEMPOTENCY_CONFLICT` | 409  | Same key, different body                      |
| `RATE_LIMITED`         | 429  | Too many requests                             |
| `INTERNAL_ERROR`       | 500  | Unexpected server error                       |

### 6.3 Error Envelope

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "/items/0/quantity",
        "message": "must be >= 1",
        "keyword": "minimum"
      }
    ],
    "status": 400
  }
}
```

---

## 7. Observability

### 7.1 Request Logging (via ac-request-context)

Every request logs:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "url": "/api/v1/sales",
  "statusCode": 200,
  "duration": "45.2ms",
  "userId": 1
}
```

### 7.2 Audit Events (Financial Operations)

Financial operations auto-create audit events via `AuditService`:

| Action                 | Entity Type | Details                       |
| ---------------------- | ----------- | ----------------------------- |
| `sale.created`         | `sale`      | { saleId, total, items }      |
| `sale.cancelled`       | `sale`      | { saleId, reason }            |
| `sale.refunded`        | `sale`      | { saleId, refundAmount }      |
| `payment.recorded`     | `payment`   | { paymentId, amount, method } |
| `purchase.created`     | `purchase`  | { purchaseId, total }         |
| `stock.adjusted`       | `product`   | { productId, change, reason } |
| `customer.payment`     | `ledger`    | { customerId, amount }        |
| `supplier.payment`     | `ledger`    | { supplierId, amount }        |
| `posting.batch_posted` | `posting`   | { batchId, entriesCount }     |
| `user.created`         | `user`      | { userId, role }              |
| `backup.created`       | `backup`    | { backupName }                |

### 7.3 Health Check

`GET /api/v1/system/health` — returns uptime, timestamp, db connectivity.

---

## 8. Gap Analysis — Missing Endpoints

### Currently Implemented vs. UI Required

| Endpoint                                              | Status     | Gap                                                          |
| ----------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| **Auth**                                              |            |                                                              |
| `POST /auth/login`                                    | ✅ Done    | Update: return accessToken + refreshToken (not just "token") |
| `GET /auth/setup-status`                              | ✅ Done    | —                                                            |
| `POST /auth/register`                                 | ✅ Done    | —                                                            |
| `GET /auth/me`                                        | ✅ Done    | Remove console.log                                           |
| `POST /auth/change-password`                          | ❌ Missing | Need ChangePasswordUseCase                                   |
| `POST /auth/refresh`                                  | ⚠️ Partial | Rewrite: use proper refresh token, not re-sign access        |
| `POST /auth/logout`                                   | ⚠️ Stub    | Add refresh token invalidation                               |
| **Products**                                          |            |                                                              |
| `GET /products`                                       | ✅ Done    | —                                                            |
| `GET /products/:id`                                   | ❌ Missing | Need route + use case                                        |
| `POST /products`                                      | ✅ Done    | —                                                            |
| `PUT /products/:id`                                   | ✅ Done    | —                                                            |
| `DELETE /products/:id`                                | ✅ Done    | —                                                            |
| `GET /products/:productId/purchase-history`           | ❌ Missing | Need route + use case                                        |
| `GET /products/:productId/sales-history`              | ❌ Missing | Need route + use case                                        |
| `GET /products/:productId/units`                      | ❌ Missing | Need route + use case                                        |
| `POST /products/:productId/units`                     | ❌ Missing | Need route + use case                                        |
| `PUT /products/units/:id`                             | ❌ Missing | Need route + use case                                        |
| `DELETE /products/units/:id`                          | ❌ Missing | Need route + use case                                        |
| `POST /products/:productId/units/:unitId/set-default` | ❌ Missing | Need route + use case                                        |
| `GET /products/:productId/batches`                    | ❌ Missing | Need route + use case                                        |
| `POST /products/:productId/batches`                   | ❌ Missing | Need route + use case                                        |
| `POST /products/:productId/adjust-stock`              | ✅ Done    | Add idempotency                                              |
| **Sales**                                             |            |                                                              |
| `GET /sales`                                          | ✅ Done    | —                                                            |
| `POST /sales`                                         | ✅ Done    | Add idempotency middleware                                   |
| `GET /sales/:id`                                      | ✅ Done    | —                                                            |
| `POST /sales/:saleId/payments`                        | ✅ Done    | Add idempotency                                              |
| `POST /sales/:id/cancel`                              | ❌ Missing | Need CancelSaleUseCase                                       |
| `POST /sales/:id/refund`                              | ❌ Missing | Need RefundSaleUseCase                                       |
| `GET /sales/:id/receipt`                              | ❌ Missing | Need GetSaleReceiptUseCase                                   |
| **POS**                                               |            |                                                              |
| `POST /pos/after-pay`                                 | ❌ Missing | Need route module + POS logic                                |
| **Categories**                                        |            |                                                              |
| All endpoints                                         | ✅ Done    | —                                                            |
| **Customers**                                         |            |                                                              |
| `GET /customers`                                      | ✅ Done    | —                                                            |
| `GET /customers/:id`                                  | ❌ Missing | Need route (GetCustomerByIdUseCase may exist)                |
| `POST /customers`                                     | ✅ Done    | —                                                            |
| `PUT /customers/:id`                                  | ✅ Done    | —                                                            |
| `DELETE /customers/:id`                               | ✅ Done    | —                                                            |
| **Customer Ledger**                                   |            |                                                              |
| All endpoints                                         | ✅ Done    | Add idempotency to payments                                  |
| **Suppliers**                                         |            |                                                              |
| All endpoints                                         | ✅ Done    | —                                                            |
| **Supplier Ledger**                                   |            |                                                              |
| All endpoints                                         | ✅ Done    | Add idempotency to payments                                  |
| **Purchases**                                         |            |                                                              |
| All endpoints                                         | ✅ Done    | Add idempotency to create + payments                         |
| **Inventory**                                         |            |                                                              |
| `GET /inventory/dashboard`                            | ✅ Done    | —                                                            |
| `GET /inventory/movements`                            | ✅ Done    | —                                                            |
| `GET /inventory/expiry-alerts`                        | ✅ Done    | —                                                            |
| `POST /inventory/reconcile`                           | ❌ Missing | Need route + ReconcileInventoryUseCase                       |
| **Accounting**                                        |            |                                                              |
| All GET endpoints                                     | ✅ Done    | Enable auth (currently commented out)                        |
| `GET /accounting/status`                              | ✅ Done    | —                                                            |
| `POST /accounting/initialize`                         | ✅ Done    | —                                                            |
| **Posting**                                           |            |                                                              |
| `POST /posting/entries/:id/post`                      | ✅ Done    | —                                                            |
| `POST /posting/entries/:id/unpost`                    | ✅ Done    | —                                                            |
| `POST /posting/period`                                | ✅ Done    | —                                                            |
| `GET /posting/batches`                                | ❌ Missing | Need route + use case                                        |
| `POST /posting/batches/:batchId/reverse`              | ❌ Missing | Need route + use case                                        |
| `POST /posting/batches/:batchId/lock`                 | ❌ Missing | Need route + use case                                        |
| `POST /posting/batches/:batchId/unlock`               | ❌ Missing | Need route + use case                                        |
| **Audit**                                             |            |                                                              |
| `GET /audit/trail`                                    | ❌ Missing | Need route module + use case                                 |
| **Backup**                                            |            |                                                              |
| All endpoints                                         | ❌ Missing | Need full module (route + use cases + repo)                  |
| **Barcode**                                           |            |                                                              |
| All endpoints                                         | ❌ Missing | Need route module (repo already exists)                      |
| **Dashboard**                                         |            |                                                              |
| `GET /dashboard/stats`                                | ✅ Done    | —                                                            |
| **Settings**                                          |            |                                                              |
| `GET /settings/:key`                                  | ✅ Done    | —                                                            |
| `PUT /settings/:key`                                  | ✅ Done    | —                                                            |
| `GET /settings/typed`                                 | ❌ Missing | Need route                                                   |
| `PUT /settings/typed`                                 | ❌ Missing | Need route                                                   |
| `GET /settings/currency`                              | ✅ Done    | —                                                            |
| `GET /settings/company`                               | ✅ Done    | —                                                            |
| `PUT /settings/company`                               | ✅ Done    | —                                                            |
| `GET /system/capabilities`                            | ✅ Done    | —                                                            |
| `GET /settings/modules`                               | ✅ Done    | —                                                            |
| `POST /settings/setup-wizard`                         | ✅ Done    | —                                                            |
| **Users**                                             |            |                                                              |
| `GET /users`                                          | ✅ Done    | —                                                            |
| `POST /users`                                         | ✅ Done    | —                                                            |
| `PUT /users/:id`                                      | ✅ Done    | —                                                            |

### Summary

| Category        | Done   | Missing/Partial  | Total    |
| --------------- | ------ | ---------------- | -------- |
| Auth            | 4      | 3                | 7        |
| Products        | 5      | 10               | 15       |
| Sales           | 3      | 3 (+idempotency) | 7        |
| POS             | 0      | 1                | 1        |
| Categories      | 4      | 0                | 4        |
| Customers       | 3      | 1                | 5        |
| Customer Ledger | 4      | 0 (+idempotency) | 4        |
| Suppliers       | 5      | 0                | 5        |
| Supplier Ledger | 3      | 0 (+idempotency) | 3        |
| Purchases       | 4      | 0 (+idempotency) | 4        |
| Inventory       | 3      | 1                | 4        |
| Accounting      | 8      | 0 (enable auth)  | 8        |
| Posting         | 3      | 4                | 7        |
| Audit           | 0      | 1                | 1        |
| Backup          | 0      | 6                | 6        |
| Barcode         | 0      | 5                | 5        |
| Dashboard       | 1      | 0                | 1        |
| Settings        | 7      | 2                | 9        |
| System          | 2      | 0                | 2        |
| Users           | 3      | 0                | 3        |
| **Total**       | **62** | **37**           | **~100** |

---

## 9. Implementation Checklist

### Phase 1: Infrastructure (Priority: Critical)

- [ ] Implement request-context plugin (ac-request-context.ts)
- [ ] Refactor JwtService for access/refresh token pair
- [ ] Implement RefreshTokenUseCase with family rotation
- [ ] Create idempotency_keys table migration
- [ ] Implement IdempotencyRepository
- [ ] Implement idempotency plugin (ad-idempotency.ts)
- [ ] Create RBAC middleware factory (requirePermission)
- [ ] Fix auth/login to return accessToken + refreshToken
- [ ] Fix auth/refresh to use proper refresh flow
- [ ] Add auth/logout with token invalidation
- [ ] Add auth/change-password
- [ ] Remove console.log from auth/me

### Phase 2: Missing CRUD Endpoints (Priority: High)

- [ ] `GET /products/:id`
- [ ] `GET /customers/:id`
- [ ] Product units CRUD (GET, POST, PUT, DELETE, set-default)
- [ ] Product batches (GET, POST)
- [ ] Product history (purchase-history, sales-history)
- [ ] Posting batches (GET, reverse, lock, unlock)
- [ ] `POST /inventory/reconcile`
- [ ] Settings typed (GET, PUT)

### Phase 3: Financial Operations (Priority: High)

- [ ] `POST /sales/:id/cancel` + CancelSaleUseCase
- [ ] `POST /sales/:id/refund` + RefundSaleUseCase
- [ ] `GET /sales/:id/receipt` + GetSaleReceiptUseCase
- [ ] `POST /pos/after-pay` + POS route module
- [ ] Wire up idempotency to all financial write endpoints

### Phase 4: New Modules (Priority: Medium)

- [ ] Audit trail module (GET /audit/trail)
- [ ] Backup module (all 6 endpoints)
- [ ] Barcode module (all 5 endpoints)

### Phase 5: Hardening (Priority: Medium)

- [ ] Enable auth on accounting routes
- [ ] Wire up RBAC permissions to all protected endpoints
- [ ] Add idempotency cleanup job
- [ ] Add comprehensive Swagger schema annotations
- [ ] Review all `as any` casts and replace with proper types

### Phase 6: Testing (Priority: High — Parallel)

- [ ] Unit tests for new use cases
- [ ] Route integration tests for new endpoints
- [ ] Idempotency integration tests
- [ ] RBAC permission tests
- [ ] Refresh token flow tests
