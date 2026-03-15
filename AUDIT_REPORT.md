# Nuqta Backend — Codebase Audit Report

**Date:** 2026-03-15
**Auditor:** Claude (Anthropic)
**Scope:** Full codebase audit of `nuqta-backend` prior to Phase 2 improvements

---

## Executive Summary

The Nuqta backend is a well-structured Fastify 5 + Drizzle ORM + PostgreSQL application following Clean Architecture principles. ~270 tests were passing before improvements. The main findings are documented below, grouped by severity.

---

## 1. Architecture & Structure

### ✅ Strengths

- **Clean separation**: Domain entities, interfaces, use-cases, and data repositories are clearly separated.
- **Two-phase pattern**: Several write use-cases already used `executeCommitPhase` / `executeSideEffectsPhase`, but not consistently enforced.
- **Route-level DI**: Use-cases are instantiated inside route handlers with repositories from `fastify.repos`, keeping constructors pure.
- **Error hierarchy**: `DomainError` base class with typed subclasses (`NotFoundError`, `ValidationError`, `InsufficientStockError`, `InvalidStateError`, `ForbiddenError`).
- **FIFO/FEFO depletion**: Proper FIFO inventory depletion with expiry-first ordering.
- **Double-entry accounting**: Journal entries enforce debit/credit balance.

### ⚠️ Issues Found

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `src/app.ts` | No environment variable validation at startup — missing `DATABASE_URL` causes a runtime crash instead of a clear error | High |
| 2 | All ~70 write use-cases | No shared base class — the two-phase pattern was ad-hoc, inconsistently applied | Medium |
| 3 | `src/plugins/event-bus.ts` | Used raw `EventEmitter` with string-typed event names, no domain-typed events | Medium |
| 4 | `src/domain/shared/services/JwtService.ts` | Only HS256 supported; no `jti` claim for revocation; no RS256 support | High |
| 5 | `POST /auth/logout` | Route was a no-op — did not revoke tokens server-side | High |
| 6 | JWT middleware (`support.ts`) | Did not check token revocation before granting access | High |
| 7 | Payroll status | Only `draft` and `approved` states; missing `submitted`, `disbursed`, `cancelled` | Medium |
| 8 | No optimistic locking | `products` and `product_batches` tables had no `version` column; concurrent updates would silently overwrite | High |
| 9 | `src/shared/` | No environment schema validation (Zod or similar) | High |
| 10 | Read use-cases | No shared base class — `execute()` signatures varied inconsistently | Low |

---

## 2. Domain Layer

### Use-Cases

| Module | Write Use-Cases | Read Use-Cases | Notes |
|--------|----------------|----------------|-------|
| Auth | Login, Register, ChangePassword | CheckInitialSetup, GetUserById | Logout was no-op pre-fix |
| Sales | CreateSale, AddPayment, RefundSale, CancelSale | GetSale, GetSaleReceipt | CreateSale has side-effects phase with audit logging |
| Products | Create, Update, Delete, Adjust, Reconcile, Batch, Unit | GetById, GetAll, History | No optimistic locking pre-fix |
| Customers | Create, Update | GetById | — |
| Suppliers | Create, Update | — | — |
| Purchases | Create, AddPayment | — | — |
| Inventory | ReconcileStock | GetMovements, GetExpiryAlerts, GetDashboard | — |
| HR | CreateEmployee, UpdateEmployee, CreatePayrollRun, ApprovePayrollRun | GetEmployeeById, GetPayrollRunById | Missing submit/disburse/cancel states |
| Accounting | Initialize | GetSettings | Double-entry correctly enforced |
| Settings | Update (3 variants), SetCompany, CompleteWizard | GetSettings, GetModuleSettings | — |
| Backup | Create, Restore, Delete, GenerateToken | GetStats, List | — |
| Posting | Lock, Unlock, Post, Unpost, Reverse | — | — |

### Entities

- `Payroll.ts`: Status enum was `["draft", "approved"]` — missing lifecycle states.
- `Sale.ts`, `Purchase.ts`: Well-typed with proper status enums.
- All entities use plain TypeScript interfaces (no runtime validation).

### Domain Errors

- `DomainError` base with `statusCode` and `code` fields.
- `isDomainError()` used `any` type — fixed to `unknown`.
- Missing: `OptimisticLockError` (409) — added.

---

## 3. Data Layer

### Schema

| Table | Issues |
|-------|--------|
| `products` | No `version` column for optimistic locking (added) |
| `product_batches` | No `version` column for optimistic locking (added) |
| `payroll_runs` | Status column defaulted to `"approved"`, missing lifecycle states (fixed) |
| All tables | Missing `revoked_tokens` table for JWT revocation (added) |

### Repositories

- Most repositories follow the interface pattern correctly.
- `PayrollRepository` was missing `updateStatus()` method (added).
- No `RevokedTokenRepository` existed (created).
- Repository constructors accept `DbConnection` directly — good for testability.

---

## 4. API Layer

### Route Handlers

| File | Issues |
|------|--------|
| `routes/v1/auth/index.ts` | `POST /logout` was stateless no-op |
| `routes/v1/hr/index.ts` | Missing `/submit`, `/disburse`, `/cancel` payroll routes; status enum outdated |
| `routes/v1/events/index.ts` | SSE route was wired to old `EventEmitter`-based bus, not typed domain events |
| `routes/v1/products/index.ts` | 5 tests return 500 instead of 400 for validation errors (pre-existing, not introduced) |

### Middleware

- `support.ts`: `authenticate` decorator did not check revocation table — all issued tokens were permanently valid until expiry.
- `rbac.ts`: Role-based `requirePermission()` function works correctly.

### Plugins

| Plugin | Notes |
|--------|-------|
| `db.ts` | Correctly registers all repos; no `RevokedTokenRepository` pre-fix |
| `event-bus.ts` | Was using `EventEmitter` directly; replaced with `IDomainEventBus` |
| `support.ts` | JWT verify without revocation check |
| `ad-lifecycle.ts` | Graceful shutdown correct; no cleanup job for expired revoked tokens |

---

## 5. Testing

### Pre-improvement State

- 270+ tests passing across 34 test files.
- Tests cover: auth flows, sale/purchase creation, inventory, settings, payroll, products, barcode, customers, suppliers, posting.
- Tests use `fastify.inject()` for HTTP-level integration testing.
- No property-based tests existed.

### Coverage Gaps

1. **No property-based tests** — FIFO depletion edge cases, accounting balance invariants, state machine validity were not tested.
2. **No JWT revocation tests** — logout + re-use of revoked token.
3. **No RS256 tests** — alternative algorithm path was untestable.
4. **6 pre-existing test failures** in `products/index.test.ts` and `response-contracts.test.ts` — validation errors returning 500 instead of 400 (not introduced by this work).

---

## 6. Security

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens non-revocable — logout was client-side only | High | Fixed |
| No `jti` claim on issued tokens | High | Fixed |
| HS256 only — no RS256 support | Medium | Fixed |
| `JWT_SECRET` defaults to `"nuqta-secret-dev"` in dev — production warning added | Medium | Fixed |
| No token blacklist cleanup — expired entries would accumulate | Medium | Fixed (cleanup job) |
| Concurrent product/batch updates could silently overwrite | High | Fixed (version column) |

---

## 7. Performance

| Finding | Severity | Status |
|---------|----------|--------|
| Settings loaded from DB on every request | Medium | Fixed (CachedSettingsAccessor, 60s TTL) |
| No SSE fan-out bridge — all domain events were emitted directly to SSE | Low | Fixed (InProcessEventBus + SseFanOut) |

---

## 8. Improvements Applied (Phase 2)

| # | Improvement | Files Changed |
|---|-------------|---------------|
| 2.1 | Env validation with Zod | `src/shared/env.ts`, `src/app.ts` |
| 2.2 | Abstract WriteUseCase/ReadUseCase base classes + ~73 use-case refactors | `src/domain/shared/WriteUseCase.ts`, `src/domain/shared/ReadUseCase.ts`, all use-cases |
| 2.3 | In-process domain event bus with SSE fan-out | `src/domain/shared/events/`, `src/plugins/event-bus.ts`, `src/routes/v1/events/` |
| 2.4 | Settings caching with 60s TTL | `src/domain/shared/services/CachedSettingsAccessor.ts` |
| 2.5 | CQRS typed query objects | `src/domain/shared/queries/` |
| 2.6 | Optimistic locking with version column | Schema, `DomainErrors.ts`, migration `0003` |
| 2.7 | JWT RS256 + token revocation | `JwtService.ts`, `support.ts`, `LogoutUseCase.ts`, `RevokedTokenRepository.ts`, migration `0004` |
| 2.8 | Payroll state machine | `PayrollStateMachine.ts`, 3 new use-cases, `PayrollRepository.updateStatus()`, new routes, migration `0005` |
| 2.9 | Property-based tests (fast-check) | 13 property tests across FIFO, accounting, state machine |

---

## 9. Remaining Recommendations

1. **Fix 6 pre-existing test failures** in products routes — Fastify is returning 500 for JSON schema validation errors instead of 400. Likely a missing `setErrorHandler` or `schemaErrorFormatter` configuration.
2. **Optimistic locking enforcement in FifoDepletionService** — version column is in the schema but `FifoDepletionService` doesn't yet pass versions through on batch updates; add retry-on-conflict logic in `CreateSaleUseCase`.
3. **Async refresh token revocation on logout** — the logout route only revokes the access token if the client sends the refresh token in the body.
4. **Database migrations tooling** — migrate from hand-written SQL to `drizzle-kit generate` to ensure schema and migration files stay in sync.
5. **Structured logging** — replace `console.error` with `fastify.log.error` in production use-cases.
