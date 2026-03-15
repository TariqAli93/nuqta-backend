# Business Logic Report — Nuqta Backend

## Table of Contents

1. [General Overview](#1-general-overview)
2. [Business Logic Structure](#2-business-logic-structure)
3. [Core Operations & Use-Cases](#3-core-operations--use-cases)
4. [Business Rules & Policies](#4-business-rules--policies)
5. [Integration with Other Components](#5-integration-with-other-components)
6. [Technologies & Tools](#6-technologies--tools)
7. [Security Considerations](#7-security-considerations)
8. [Improvement Suggestions](#8-improvement-suggestions)

---

## 1. General Overview

**Business logic** is the layer of a software system that encodes real-world rules, workflows, and policies — independent of the delivery mechanism (HTTP, CLI, queues) or the data store. It answers the question *"what should the system do?"* rather than *"how should it talk to a database or browser?"*.

In **Nuqta Backend**, the business logic governs a point-of-sale / ERP system with the following core responsibilities:

| Domain | Responsibility |
|---|---|
| **Authentication & Authorization** | Secure login, role-based permissions, JWT lifecycle |
| **Sales** | Invoice creation, payment collection, refunds, cancellations |
| **Purchases** | Supplier orders, stock receipt, payable tracking |
| **Inventory** | Real-time stock levels, FIFO/FEFO batch depletion, reconciliation |
| **Accounting** | Double-entry journal entries, chart of accounts, posting batches |
| **Customers & Suppliers** | Master data, credit ledgers, payment history |
| **Products** | Catalogue management, unit conversions, barcode generation |
| **HR & Payroll** | Employee master data, payroll calculation, approval workflow |
| **Settings** | System-wide and per-module configuration (feature flags, account codes) |
| **Audit** | Immutable event log for every state-changing operation |
| **Backup** | Scheduled and on-demand database snapshots |

---

## 2. Business Logic Structure

The project follows **Clean Architecture** principles. Business logic lives exclusively in the `src/domain/` layer; nothing in that layer depends on Fastify, Drizzle ORM, or PostgreSQL.

```
src/
├── domain/                  ← 100 % framework-agnostic business logic
│   ├── entities/            ← Zod-validated data shapes (Sale, Product, …)
│   ├── interfaces/          ← Repository & service contracts (pure TypeScript interfaces)
│   ├── use-cases/           ← One class / file per business operation
│   │   ├── auth/
│   │   ├── sales/
│   │   ├── purchases/
│   │   ├── inventory/
│   │   ├── products/
│   │   ├── customers/
│   │   ├── suppliers/
│   │   ├── accounting/
│   │   ├── posting/
│   │   ├── hr/
│   │   ├── settings/
│   │   ├── backup/
│   │   ├── audit/
│   │   └── …
│   └── shared/
│       ├── errors/          ← Typed domain error hierarchy
│       ├── services/        ← Cross-cutting domain services
│       └── utils/           ← Pure helper functions
├── data/                    ← Repository implementations (Drizzle ORM)
└── (Fastify routes / plugins)  ← HTTP delivery layer
```

### Key Structural Patterns

#### 2.1 Use-Case Classes

Each business operation is encapsulated in a **dedicated class** (`{Action}{Domain}UseCase`). The class receives its repository and service dependencies through **constructor injection**, making it trivially testable in isolation.

```
// Pattern: src/domain/use-cases/{domain}/{Action}{Domain}UseCase.ts
CreateSaleUseCase
AddPaymentUseCase
CreatePurchaseUseCase
ReconcileStockUseCase
ProcessPayrollUseCase
…
```

#### 2.2 Two-Phase Execute Pattern

Complex use-cases with side-effects split their work into two phases:

```typescript
// Phase 1 – Atomic business write (runs inside a DB transaction)
async executeCommitPhase(input, userId): Promise<CommitResult>

// Phase 2 – Side-effects: audit log, notifications, event bus
async executeSideEffectsPhase(result, userId): Promise<void>

// Orchestrator – called by routes
async execute(input, userId): Promise<Entity>
```

This separation ensures that a failure in audit logging cannot roll back a completed sale.

#### 2.3 Repository Interfaces

The domain defines **23 interfaces** (e.g. `ISaleRepository`, `IProductRepository`) that describe *what* data operations are needed. The `src/data/` layer provides the concrete PostgreSQL implementations. Use-cases depend only on the interfaces, never on Drizzle tables.

#### 2.4 Domain Entities

Entities are thin **Zod schemas** that define shape, types, and basic constraints (e.g. `stock: z.number().int()`). They do not contain behaviour; behaviour lives in use-cases.

---

## 3. Core Operations & Use-Cases

### 3.1 Authentication Domain

| Use-Case | Description |
|---|---|
| `LoginUseCase` | Validates credentials, issues JWT access + refresh tokens, returns role permissions |
| `RegisterFirstUserUseCase` | Creates the first admin account (only allowed when no users exist) |
| `ChangePasswordUseCase` | Verifies current password, hashes and stores new password |
| `CheckInitialSetupUseCase` | Determines whether onboarding is still required |

### 3.2 Sales Domain

| Use-Case | Description |
|---|---|
| `CreateSaleUseCase` | Full sale lifecycle: validate items → deplete FIFO batches → create invoice → record payment → update customer ledger → post journal entries → emit audit event |
| `AddPaymentUseCase` | Receives a payment against an existing invoice; moves sale to *completed* when fully paid |
| `CancelSaleUseCase` | Cancels a pending sale; restores reserved stock |
| `RefundSaleUseCase` | Issues a refund; reverses inventory and ledger entries |
| `GetSaleReceiptUseCase` | Builds a structured receipt document for printing |
| `RecordCustomerPaymentUseCase` | Records a standalone customer ledger payment (outside a specific sale) |

### 3.3 Purchases Domain

| Use-Case | Description |
|---|---|
| `CreatePurchaseUseCase` | Receives stock from supplier: validates → creates product batches → records payable → posts accounting journal |
| `AddPurchasePaymentUseCase` | Reduces supplier payable when a payment is made |
| `RecordSupplierPaymentUseCase` | Records a standalone supplier ledger payment |

### 3.4 Inventory Domain

| Use-Case | Description |
|---|---|
| `GetInventoryMovementsUseCase` | Queries paginated movement history with optional filters |
| `GetInventoryDashboardUseCase` | Aggregates real-time stock metrics for the dashboard |
| `GetExpiryAlertsUseCase` | Lists batches whose expiry date is within the alert threshold |
| `ReconcileStockUseCase` | Accepts a physical count and generates adjustment inventory movements |

### 3.5 Product Domain (12 use-cases)

Covers create / read / update / delete for products, batch management, product units (with conversion factors), and barcode template management.

### 3.6 Accounting & Posting Domain

| Use-Case | Description |
|---|---|
| `InitializeAccountingUseCase` | Seeds the default chart of accounts on first run |
| `CreatePostingBatchUseCase` | Groups unposted journal entries into a batch |
| `PostBatchUseCase` | Marks all entries in a batch as officially posted |
| `LockPeriodUseCase` | Locks a fiscal period to prevent retroactive modifications |
| `UnlockPeriodUseCase` | Re-opens a locked period (admin only) |

### 3.7 HR & Payroll Domain

| Use-Case | Description |
|---|---|
| `CreateEmployeeUseCase` | Validates and creates an employee record |
| `UpdateEmployeeUseCase` | Updates employee master data |
| `ProcessPayrollUseCase` | Calculates gross and net pay for a pay period |
| `ApprovePayrollUseCase` | Admin/manager approval gate for payroll disbursement |

### 3.8 Settings Domain (9 use-cases)

Manages key-value system settings, accounting settings, POS settings, barcode settings, and module-level feature flags via `GetSettingsUseCase` / `UpdateSettingsUseCase` families.

---

## 4. Business Rules & Policies

### 4.1 Validation Rules

All inputs are validated at **two levels**:

- **HTTP layer**: AJV JSON Schema validation on the Fastify route schema — rejects malformed requests before they reach a use-case.
- **Domain layer**: Zod entity schemas and explicit guard clauses inside use-cases — enforce semantic constraints.

Key validation rules enforced in the domain:

| Rule | Location |
|---|---|
| All monetary amounts must be **non-negative integers** (IQD is used without decimals) | `CreateSaleUseCase`, `CreatePurchaseUseCase`, `AddPaymentUseCase` |
| `quantity > 0` for every sale item | `CreateSaleUseCase` |
| `discount ≥ 0` and `discount ≤ subtotal` | `CreateSaleUseCase` |
| Card payments **must** include a reference number | `AddPaymentUseCase` |
| Employee salary must be a non-negative integer | `CreateEmployeeUseCase` |
| Username must be at least 3 characters; password at least 6 | `RegisterFirstUserUseCase` |

### 4.2 Idempotency

All write operations that create financial records accept an optional `idempotencyKey`. If a key has been seen before, the use-case returns the existing record instead of creating a duplicate — critical for safe retries over unreliable networks.

```
CreateSaleUseCase      → checks sale.idempotencyKey
CreatePurchaseUseCase  → checks purchase.idempotencyKey
AddPaymentUseCase      → checks payment.idempotencyKey
```

### 4.3 FIFO / FEFO Inventory Depletion

When a sale depletes stock, the `IFifoDepletionService` selects batches in the following priority order:

1. Batches **with** an expiry date before batches without.
2. Among dated batches — **earliest expiry first** (FEFO — First Expiry, First Out).
3. Among same-expiry batches — **lowest batch ID first** (FIFO — First In, First Out).

A `InsufficientStockError` (HTTP 409) is thrown if total available stock across all batches is less than the requested quantity.

### 4.4 Double-Entry Accounting

Every financial event generates a balanced journal entry (debits = credits). The account codes used are resolved at runtime from settings with safe defaults:

| Event | Debit | Credit |
|---|---|---|
| Cash sale | Cash (1001) | Sales Revenue (4001) |
| Cash sale (COGS) | COGS (5001) | Inventory (1200) |
| Credit sale | Accounts Receivable (1100) | Sales Revenue (4001) |
| VAT on sale | — | VAT Output (2200) |
| Purchase (cash) | Inventory (1200) | Cash (1001) |
| Purchase (credit) | Inventory (1200) | Accounts Payable (2100) |
| Payment received | Cash (1001) | Accounts Receivable (1100) |

The `autoPosting` flag (read from `accounting_settings`) determines whether new entries are created with `isPosted = true` (auto-posted) or `isPosted = false` (manual review required before posting).

If accounting or ledgers are disabled in settings, journal entry creation is silently skipped — the system degrades gracefully.

### 4.5 Sale Status State Machine

```
[pending] ──(full payment)──▶ [completed]
[pending] ──(cancel)─────────▶ [cancelled]
[completed] ──(refund)───────▶ [refunded]

Invariants:
• Payments cannot be added to a cancelled sale  → InvalidStateError
• Payments cannot be added to a completed sale  → InvalidStateError
```

### 4.6 Role-Based Access Control (RBAC)

Four roles exist in the system with decreasing privilege levels:

| Role | Scope |
|---|---|
| **admin** | Full access to all 40+ permissions |
| **manager** | All operations except user management, backup, audit cleanup, and period locks |
| **cashier** | POS operations, sale/purchase reads, payment collection |
| **viewer** | Read-only access to sales, products, customers, inventory, ledger, and dashboard |

Permissions follow the format `{resource}:{action}` (e.g. `sales:create`, `users:delete`). The `requirePermission()` Fastify middleware checks permissions using **OR logic** — a request is authorised if the user's role satisfies *any* of the listed permissions.

### 4.7 Currency and Rounding

- **IQD (Iraqi Dinar)**: All amounts are stored as integers (no sub-dinar denominations).
- **Other currencies**: Amounts are rounded to 2 decimal places.
- Exchange rates are stored alongside the transaction for historical accuracy.

### 4.8 Audit Trail

Every state-changing operation invoked by a user generates an immutable `AuditEvent` via `AuditService`. Audit records store the actor's `userId`, the `action` name, a `targetType` / `targetId` reference, and a JSON `details` payload. Audit data is append-only; existing records cannot be modified through the API.

---

## 5. Integration with Other Components

```
┌──────────────────────────────────────────────────────────────────┐
│                       HTTP Client / POS UI                       │
└─────────────────────────────┬────────────────────────────────────┘
                              │ REST JSON (standard envelope)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Fastify HTTP Layer  (src/routes/, src/plugins/)                 │
│  • AJV schema validation                                         │
│  • JWT authentication (Bearer token)                             │
│  • RBAC middleware (requirePermission)                           │
│  • Rate limiting (100 req / min / IP)                            │
│  • Standard response envelope  { ok, data } / { ok, error }     │
└─────────────────────────────┬────────────────────────────────────┘
                              │ Dependency injection via ctx.repos.*
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Domain Layer  (src/domain/)                                     │
│  • Use-cases orchestrate business rules                          │
│  • Call repository interfaces (never concrete classes)           │
│  • Throw typed DomainErrors on rule violations                   │
└───────────┬───────────────────────────────────────┬─────────────┘
            │ implements                            │ implements
            ▼                                      ▼
┌───────────────────────────┐          ┌───────────────────────────┐
│  Data Layer (src/data/)   │          │  Shared Services           │
│  Drizzle ORM repositories │          │  JwtService               │
│  PostgreSQL transactions  │          │  FifoDepletionService     │
│  Schema migrations        │          │  AuditService             │
│  Seed data                │          │  SettingsAccessor         │
└───────────────────────────┘          └───────────────────────────┘
```

### 5.1 Routes → Use-Cases

Routes are kept **thin**: they parse the incoming request body / params, call the relevant use-case's `execute()` method, and return the result wrapped in the standard envelope. No business logic lives in route handlers.

```typescript
// src/routes/v1/sales/index.ts (simplified)
fastify.post("/", { preHandler: requirePermission("sales:create") }, async (req, reply) => {
  const useCase = new CreateSaleUseCase(ctx.repos.sale, ctx.repos.product, /* … */);
  const sale = await useCase.execute(req.body, req.user.id);
  return reply.status(201).send({ ok: true, data: sale });
});
```

### 5.2 Use-Cases → Repositories

Use-cases receive repositories as constructor arguments (injected by the route file). They call interface methods (`findById`, `create`, `update`, etc.) with no knowledge of SQL, Drizzle, or PostgreSQL.

### 5.3 Use-Cases → Settings

The `SettingsAccessor` provides typed, domain-aware access to key-value settings stored in PostgreSQL. Account codes, feature flags (accounting enabled, ledgers enabled, auto-posting), currency, and printer preferences are all read through this service, with hard-coded safe defaults for every key.

### 5.4 Use-Cases → Event Bus

The Fastify `event-bus` plugin (SSE-based) allows the domain to push real-time updates to connected clients. The side-effects phase of a use-case may emit events (e.g. `sale.created`, `inventory.low_stock`) that are broadcast over Server-Sent Events.

### 5.5 Error Handler → Domain Errors

The global Fastify error handler (`src/plugins/error-handler.ts`) maps `DomainError` subclasses to appropriate HTTP status codes and the standard error envelope. No `try/catch` scaffolding is needed in route handlers.

| Domain Error | HTTP Status |
|---|---|
| `ValidationError` | 400 |
| `UnauthorizedError` | 401 |
| `PermissionDeniedError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `InsufficientStockError` | 409 |
| `InvalidStateError` | 409 |
| Unhandled `Error` | 500 |

---

## 6. Technologies & Tools

| Technology | Role |
|---|---|
| **TypeScript (ESM)** | Strongly-typed business logic with `.js` extensions for ESM compatibility |
| **Zod** | Runtime entity validation and schema inference |
| **Fastify 5** | HTTP framework; plugin system controls load order |
| **AJV** | JSON Schema validation at the route level (fast path before domain logic) |
| **Drizzle ORM** | Type-safe SQL query builder; schema-first migrations |
| **PostgreSQL 14+** | Primary relational data store with ACID transactions |
| **bcryptjs** | Secure password hashing |
| **jsonwebtoken** | JWT issuance and verification (HS256, configurable TTL) |
| **@fastify/helmet** | HTTP security headers |
| **@fastify/rate-limit** | Request rate limiting (100 req / 15 min / IP) |
| **@fastify/swagger** | Auto-generated OpenAPI documentation |
| **Vitest** | Unit and route integration tests (~270 test cases) |
| **pnpm** | Monorepo-aware package manager |

---

## 7. Security Considerations

### 7.1 Authentication

- Passwords are hashed with **bcryptjs** before storage; plaintext passwords are never persisted.
- JWT **access tokens** expire in 15 minutes. **Refresh tokens** expire in 7 days and must be rotated on use.
- The `JWT_SECRET` is loaded from the environment; a weak default (`nuqta-secret-dev`) is used only in development — production deployments must override it.

### 7.2 Authorisation

- Every protected route declares its required permission explicitly via `requirePermission()`.
- Permission checks happen at the **Fastify preHandler** level, before any use-case logic runs.
- The RBAC matrix is defined once in `PermissionService` and reused everywhere — no scattered `if role === "admin"` checks.

### 7.3 Input Validation (Two-Layer Defence)

1. **AJV** rejects structurally invalid requests before they reach the domain.
2. **Zod** entity schemas and explicit guard clauses catch semantic violations (negative prices, invalid state transitions, etc.) inside use-cases.

### 7.4 Idempotency & Duplicate Prevention

Unique `idempotencyKey` constraints on financial tables prevent duplicate invoices, payments, and purchase records — even if a network retry causes the client to submit the same request twice.

### 7.5 Audit Logging

Every write operation is logged with the actor's `userId`, timestamp, action type, and contextual details. Audit records are append-only and cannot be modified or deleted through normal API endpoints.

### 7.6 Data Integrity

- Monetary amounts are stored as **integers** (IQD cents) to avoid floating-point rounding errors.
- The `FifoDepletionService.deplete()` **must** be called inside a database transaction to prevent race conditions on concurrent stock depletion.
- `InsufficientStockError` is thrown synchronously within the transaction, causing an automatic rollback if stock runs out mid-transaction.

### 7.7 HTTP Security Headers

The `@fastify/helmet` plugin sets `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, and related headers on every response.

### 7.8 Rate Limiting

The `@fastify/rate-limit` plugin caps requests at **100 per minute per IP** on all routes, mitigating brute-force attacks against the login endpoint and API abuse.

---

## 8. Improvement Suggestions

### 8.1 Add a Dedicated Domain Event System

Currently, side-effects (audit logging, SSE notifications) are triggered imperatively inside `executeSideEffectsPhase`. Introducing a lightweight **domain event bus** (publish-subscribe) would decouple the core use-case from its observers and make it easier to add new side-effects (e.g. email notifications, webhooks) without touching existing use-case code.

### 8.2 Formalise the Two-Phase Pattern with a Base Class

The `executeCommitPhase` / `executeSideEffectsPhase` / `execute` pattern is repeated across several use-cases but is not enforced by a base class or interface. Defining an abstract `WriteUseCase<TInput, TResult, TEntity>` would ensure consistency and reduce boilerplate.

### 8.3 Introduce a Query Object Pattern (CQRS Read-Side)

Several "Get*" use-cases are thin wrappers around repository `findAll` / `findById` calls with filtering options passed inline. Moving query parameters into dedicated **Query Objects** (or a lightweight CQRS read layer) would improve reusability and make complex filtering logic testable in isolation.

### 8.4 Settings Caching

`SettingsAccessor` performs a database read for every settings key on every request. Because settings change infrequently, wrapping the repository calls in an **in-process TTL cache** (e.g. 60-second TTL) would eliminate this hot-path overhead at near-zero complexity cost.

### 8.5 Expand Test Coverage for Business-Critical Paths

The FIFO depletion ordering and double-entry accounting balance constraints are the most financially critical code paths. Dedicated property-based tests (using a tool like `fast-check`) that verify depletion ordering invariants across randomly generated batch configurations would substantially increase confidence.

### 8.6 Strengthen JWT Security

Consider moving from HS256 (symmetric) to RS256 (asymmetric) signing so that resource servers can verify tokens without access to the signing secret. Additionally, implementing a **token revocation list** (e.g. Redis `SET` of `jti` values) would allow instant logout and compromised-token invalidation.

### 8.7 Add Optimistic Locking for Concurrent Sales

High-throughput POS deployments may have multiple cashiers creating sales simultaneously. Adding an **optimistic locking version column** to the `products` and `product_batches` tables would prevent lost-update anomalies when two transactions deplete the same batch concurrently — a more scalable alternative to database-level row locks.

### 8.8 Payroll Workflow Formalisation

The current `ProcessPayrollUseCase` → `ApprovePayrollUseCase` flow is a two-step process but lacks explicit status transitions (e.g. `draft → submitted → approved → disbursed`). Modelling payroll as a state machine — similar to the sale status machine — would make the workflow more auditable and extensible.

### 8.9 API Versioning Strategy

All routes currently live under `/api/v1/`. Documenting a formal versioning policy (when to increment to `v2`, how to maintain backwards compatibility) will reduce breaking-change risk as the system evolves.

### 8.10 Environment Configuration Validation

The application starts without validating whether required environment variables (`DATABASE_URL`, `JWT_SECRET`) are set and non-empty. Adding a startup validation step (e.g. using `zod` to parse `process.env`) would surface misconfiguration immediately rather than at first request.
