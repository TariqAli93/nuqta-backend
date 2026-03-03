# Nuqta Backend — Comprehensive Test Plan

> **Generated**: 2026-03-03  
> **Framework**: Vitest 4 · v8 coverage  
> **Thresholds**: lines ≥ 90 % · branches ≥ 70 % · functions ≥ 90 % · statements ≥ 90 %

---

## Table of Contents

1. [Test Strategy Overview](#1-test-strategy-overview)
2. [Test Infrastructure](#2-test-infrastructure)
3. [Unit Tests — Core Services](#3-unit-tests--core-services)
4. [Unit Tests — Use Cases](#4-unit-tests--use-cases)
5. [Integration Tests — Routes](#5-integration-tests--routes)
6. [Contract Tests — Envelope, Pagination, Idempotency](#6-contract-tests--envelope-pagination-idempotency)
7. [Security / RBAC Tests](#7-security--rbac-tests)
8. [Coverage Gap Analysis & Branch Improvement](#8-coverage-gap-analysis--branch-improvement)
9. [Test Naming & Conventions](#9-test-naming--conventions)
10. [CI Pipeline Integration](#10-ci-pipeline-integration)

---

## 1. Test Strategy Overview

### Test Pyramid

```
          ╔═══════════╗
          ║  Contract  ║  ~20 tests   — envelope, pagination, idempotency, error shapes
          ╠═══════════╣
         ║ Integration ║  ~150 tests  — HTTP routes via fastify.inject()
        ╠═════════════╣
       ║   Unit Tests   ║  ~80 tests   — services, use cases, contract helpers, errors
      ╚═════════════════╝
```

### Guiding Principles

| Principle          | How                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Isolation**      | Routes tested via `fastify.inject()` — no real DB, no real network                                         |
| **Mocking**        | `vi.mock("@nuqta/core")` and `vi.mock("@nuqta/data")` replace all use cases & repositories with Vitest fns |
| **Determinism**    | `vi.useFakeTimers()` for anything time-dependent (JWT exp, timestamps)                                     |
| **Envelope-first** | Every response asserted through `expectOk()` / `expectError()` helpers                                     |
| **Permissions**    | Auth tests always supply explicit `permissions: [...]` in `authHeaders()`                                  |

---

## 2. Test Infrastructure

### Existing Helpers

| File                          | Purpose                                                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/helpers/buildApp.ts`   | Creates a fully wired Fastify instance with mock `db`, `repos`, `jwt`. Provides `tokenFor()` and `authHeaders()` for auth convenience.                          |
| `tests/helpers/mockCore.ts`   | `vi.mock("@nuqta/core")` — replaces all 50+ use-case classes with `vi.fn()` stubs. Exposes `mockUseCase(name, returnMap)` and `resetMockCore()`.                |
| `tests/helpers/mockData.ts`   | `vi.mock("@nuqta/data")` — replaces all 17 repository classes with constructor-tracking stubs. Exposes `resetMockData()`.                                       |
| `tests/helpers/fixtures.ts`   | Static domain objects (`user`, `customer`, `supplier`, `product`, `sale`, `purchase`, `payment`, etc.) used in assertions.                                      |
| `tests/helpers/assertions.ts` | `expectOk<T>(res, status?)` — parses JSON, asserts `{ ok: true }`, returns `data`. `expectError(res, status, code)` — asserts `{ ok: false, error: { code } }`. |
| `tests/helpers/env.ts`        | Sets `process.env` defaults for tests (JWT_SECRET, DATABASE_URL, etc.).                                                                                         |

### Helper Usage Pattern

```typescript
import { buildApp, type BuiltApp } from "../helpers/buildApp.ts";
import { mockUseCase, resetMockCore } from "../helpers/mockCore.ts";
import { resetMockData } from "../helpers/mockData.ts";
import { expectOk, expectError } from "../helpers/assertions.ts";
import * as fix from "../helpers/fixtures.ts";

describe("/api/v1/<domain>", () => {
  let ctx: BuiltApp;

  beforeEach(async () => {
    resetMockCore();
    resetMockData();
    ctx = await buildApp();
  });

  afterEach(async () => ctx?.close());

  test("GET /<resource> returns list", async () => {
    mockUseCase("Get<Resource>UseCase", {
      execute: { items: [fix.<resource>], total: 1, page: 1, limit: 20 },
    });
    const res = await ctx.app.inject({ method: "GET", url: "/api/v1/<resource>", headers: ctx.authHeaders() });
    const data = expectOk(res);
    expect(data.items).toHaveLength(1);
  });
});
```

---

## 3. Unit Tests — Core Services

### 3.1 JwtService (`tests/unit/core/jwt-service.test.ts`)

| #   | Test Case                                                 | Input                                    | Expected                                                     |
| --- | --------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| 1   | `sign()` produces valid token                             | payload `{ sub, role, permissions }`     | `verify()` returns matching payload with `iat`, `exp`, `jti` |
| 2   | Rejects tampered token                                    | Flip last char of signed token           | `verify()` → `null`                                          |
| 3   | Rejects expired token                                     | Sign with TTL=1s, advance clock 3s       | `verify()` → `null`                                          |
| 4   | `decode()` returns payload without signature verification | Any valid token                          | Returns payload object (no verification)                     |
| 5   | `decode()` returns `null` for garbage input               | `"not.a.jwt"`                            | `null`                                                       |
| 6   | `verify()` returns `null` for malformed strings           | `""`, `"abc"`, `undefined`               | `null`                                                       |
| 7   | Different secrets produce incompatible tokens             | Sign with secret A, verify with secret B | `null`                                                       |

### 3.2 PermissionService (`tests/unit/core/permission-service.test.ts`)

| #   | Test Case                                                  | Expected                                               |
| --- | ---------------------------------------------------------- | ------------------------------------------------------ |
| 1   | `getPermissionsForRole("admin")` returns admin permissions | Array includes all permission keys                     |
| 2   | `getPermissionsForRole("cashier")` returns cashier subset  | Array includes `sales:create`, excludes `users:manage` |
| 3   | `getPermissionsForRole("viewer")` returns read-only perms  | Only `*:read` and `dashboard:read` keys                |
| 4   | Unknown role returns empty array                           | `getPermissionsForRole("ghost")` → `[]`                |
| 5   | `hasPermission(perms, required)` returns `true` for match  | Direct permission match                                |
| 6   | `hasPermission()` returns `false` for missing perm         | Required perm not in array                             |

### 3.3 Contract Helpers (`tests/unit/core/contract.test.ts`)

| #   | Test Case                                      | Expected                                               |
| --- | ---------------------------------------------- | ------------------------------------------------------ |
| 1   | `ok(data)` wraps in `{ ok: true, data }`       | Exact shape                                            |
| 2   | `fail(error)` wraps in `{ ok: false, error }`  | Exact shape                                            |
| 3   | `failWith(code, message, status)`              | Full ApiError shape                                    |
| 4   | `toApiError(DomainError)` maps code + status   | `NotFoundError` → `{ code: "NOT_FOUND", status: 404 }` |
| 5   | `toApiError(Error)` maps to INTERNAL_ERROR     | Generic Error → `{ code: "INTERNAL_ERROR" }`           |
| 6   | `toApiError(string)` maps plain string         | `"msg"` → `{ code: "INTERNAL_ERROR", message: "msg" }` |
| 7   | `toApiError(Error(""))` empty message fallback | Message defaults to "An unexpected error occurred"     |
| 8   | `isOk()` / `isErr()` type guards               | Correct boolean for each variant                       |
| 9   | `mapErrorToResult()` catches unknown types     | Returns `{ ok: false }` with INTERNAL_ERROR            |

### 3.4 DomainErrors (`tests/unit/core/domain-errors.test.ts`)

| #   | Test Case                                               | Expected               |
| --- | ------------------------------------------------------- | ---------------------- |
| 1   | `ValidationError` has code VALIDATION_ERROR, status 400 | Properties match       |
| 2   | `NotFoundError` → NOT_FOUND, 404                        | Properties match       |
| 3   | `PermissionDeniedError` → PERMISSION_DENIED, 403        | Properties match       |
| 4   | `ConflictError` → CONFLICT, 409                         | Properties match       |
| 5   | `UnauthorizedError` → UNAUTHORIZED, 401                 | Properties match       |
| 6   | `InsufficientStockError` → INSUFFICIENT_STOCK, 409      | Properties match       |
| 7   | `InvalidStateError` → INVALID_STATE, 409                | Properties match       |
| 8   | All extend `DomainError`                                | `instanceof` checks    |
| 9   | `.details` field preserved when provided                | Details object present |

---

## 4. Unit Tests — Use Cases

Each use case is tested in isolation by injecting mock repositories.

### 4.1 LoginUseCase (`tests/unit/core/login-use-case.test.ts`)

| #   | Test Case                                   | Expected                        |
| --- | ------------------------------------------- | ------------------------------- |
| 1   | Valid credentials return user + permissions | `execute()` succeeds            |
| 2   | Unknown username throws `UnauthorizedError` | Repo returns null → 401         |
| 3   | Wrong password throws `UnauthorizedError`   | `comparePassword` → false → 401 |
| 4   | Inactive user throws `UnauthorizedError`    | `user.isActive === false` → 401 |

### 4.2 CheckInitialSetupUseCase (`tests/unit/core/check-initial-setup-use-case.test.ts`)

| #   | Test Case                                                               | Expected      |
| --- | ----------------------------------------------------------------------- | ------------- |
| 1   | No users exist → `{ hasUsers: false, isSetupComplete: false }`          | Correct shape |
| 2   | Users exist, no settings → `{ hasUsers: true, isSetupComplete: false }` | Correct shape |
| 3   | Fully set up → `{ hasUsers: true, isSetupComplete: true }`              | Correct shape |

### 4.3 Missing Use Case Tests (to be added)

> **New use cases that need unit tests as they are built:**

| Use Case                       | Key Test Scenarios                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `CreateSaleUseCase`            | Happy path; insufficient stock → INSUFFICIENT_STOCK; customer not found → NOT_FOUND |
| `CancelSaleUseCase`            | Already cancelled → INVALID_STATE; not found → NOT_FOUND                            |
| `RefundSaleUseCase`            | Partial refund; full refund; already fully refunded → INVALID_STATE                 |
| `CreatePurchaseUseCase`        | Happy path; supplier not found → NOT_FOUND; product not found → NOT_FOUND           |
| `RecordCustomerPaymentUseCase` | Happy path; overpayment guard; customer not found → NOT_FOUND                       |
| `RecordSupplierPaymentUseCase` | Happy path; supplier not found → NOT_FOUND                                          |
| `AdjustProductStockUseCase`    | Positive adjustment; negative below zero → INSUFFICIENT_STOCK                       |
| `PostPeriodUseCase`            | Happy path; overlapping period → CONFLICT                                           |
| `InitializeAccountingUseCase`  | Already initialized → CONFLICT; happy path creates chart of accounts                |

---

## 5. Integration Tests — Routes

Each route module has its own test file at `tests/routes/v1/<domain>/index.test.ts`.

### 5.1 Auth Routes (`/api/v1/auth`)

| #   | Endpoint                | Test Case                              | Status | Error Code       |
| --- | ----------------------- | -------------------------------------- | :----: | ---------------- |
| 1   | `POST /login`           | Valid creds → token + user             |  200   | —                |
| 2   | `POST /login`           | Missing username → validation error    |  400   | VALIDATION_ERROR |
| 3   | `POST /login`           | Wrong creds → unauthorized             |  401   | UNAUTHORIZED     |
| 4   | `POST /register`        | First user creation                    |  200   | —                |
| 5   | `POST /register`        | Missing required fields                |  400   | VALIDATION_ERROR |
| 6   | `GET /setup-status`     | Returns setup status                   |  200   | —                |
| 7   | `GET /me`               | Authenticated user info                |  200   | —                |
| 8   | `GET /me`               | No auth header → 401                   |  401   | UNAUTHORIZED     |
| 9   | `POST /change-password` | Success                                |  200   | —                |
| 10  | `POST /change-password` | No auth → 401                          |  401   | UNAUTHORIZED     |
| 11  | `POST /refresh`         | Valid refresh token → new access token |  200   | —                |
| 12  | `POST /refresh`         | Expired refresh token → 401            |  401   | UNAUTHORIZED     |
| 13  | `POST /logout`          | Invalidates token                      |  200   | —                |

### 5.2 Products Routes (`/api/v1/products`)

| #   | Endpoint                           | Test Case                 | Status | Error Code         |
| --- | ---------------------------------- | ------------------------- | :----: | ------------------ |
| 1   | `GET /`                            | List with pagination      |  200   | —                  |
| 2   | `GET /`                            | No auth → 401             |  401   | UNAUTHORIZED       |
| 3   | `GET /:id`                         | Exists → product          |  200   | —                  |
| 4   | `GET /:id`                         | Not found                 |  404   | NOT_FOUND          |
| 5   | `POST /`                           | Create product            |  200   | —                  |
| 6   | `POST /`                           | Missing required fields   |  400   | VALIDATION_ERROR   |
| 7   | `POST /`                           | No auth → 401             |  401   | UNAUTHORIZED       |
| 8   | `PUT /:id`                         | Update product            |  200   | —                  |
| 9   | `DELETE /:id`                      | Soft delete               |  200   | —                  |
| 10  | `DELETE /:id`                      | No auth → 401             |  401   | UNAUTHORIZED       |
| 11  | `POST /:id/adjust-stock`           | Adjust inventory          |  200   | —                  |
| 12  | `POST /:id/adjust-stock`           | Negative below zero → 409 |  409   | INSUFFICIENT_STOCK |
| 13  | `GET /:id/purchase-history`        | Returns list              |  200   | —                  |
| 14  | `GET /:id/sales-history`           | Returns list              |  200   | —                  |
| 15  | `GET /:id/units`                   | Returns units             |  200   | —                  |
| 16  | `POST /:id/units`                  | Create unit               |  200   | —                  |
| 17  | `PUT /units/:id`                   | Update unit               |  200   | —                  |
| 18  | `DELETE /units/:id`                | Delete unit               |  200   | —                  |
| 19  | `POST /:id/units/:uid/set-default` | Set default               |  200   | —                  |
| 20  | `GET /:id/batches`                 | Returns batches           |  200   | —                  |
| 21  | `POST /:id/batches`                | Create batch              |  200   | —                  |

### 5.3 Sales Routes (`/api/v1/sales`)

| #   | Endpoint             | Test Case                | Status | Error Code       |
| --- | -------------------- | ------------------------ | :----: | ---------------- |
| 1   | `GET /`              | List sales paginated     |  200   | —                |
| 2   | `GET /`              | No auth → 401            |  401   | UNAUTHORIZED     |
| 3   | `GET /:id`           | Single sale              |  200   | —                |
| 4   | `GET /:id`           | Not found                |  404   | NOT_FOUND        |
| 5   | `POST /`             | Create sale (happy path) |  200   | —                |
| 6   | `POST /`             | Missing items array      |  400   | VALIDATION_ERROR |
| 7   | `POST /`             | Expired token → 401      |  401   | UNAUTHORIZED     |
| 8   | `POST /:id/payments` | Record payment           |  200   | —                |
| 9   | `POST /:id/cancel`   | Cancel sale              |  200   | —                |
| 10  | `POST /:id/cancel`   | Already cancelled → 409  |  409   | INVALID_STATE    |
| 11  | `POST /:id/refund`   | Refund sale              |  200   | —                |
| 12  | `GET /:id/receipt`   | Get receipt data         |  200   | —                |

### 5.4 Purchases Routes (`/api/v1/purchases`)

| #   | Endpoint             | Test Case          | Status | Error Code       |
| --- | -------------------- | ------------------ | :----: | ---------------- |
| 1   | `GET /`              | List purchases     |  200   | —                |
| 2   | `GET /:id`           | Single purchase    |  200   | —                |
| 3   | `POST /`             | Create purchase    |  200   | —                |
| 4   | `POST /`             | Missing supplierId |  400   | VALIDATION_ERROR |
| 5   | `POST /:id/payments` | Record payment     |  200   | —                |

### 5.5 Categories Routes (`/api/v1/categories`)

| #   | Endpoint      | Test Case       | Status | Error Code       |
| --- | ------------- | --------------- | :----: | ---------------- |
| 1   | `GET /`       | List categories |  200   | —                |
| 2   | `POST /`      | Create category |  200   | —                |
| 3   | `POST /`      | Missing name    |  400   | VALIDATION_ERROR |
| 4   | `PUT /:id`    | Update category |  200   | —                |
| 5   | `DELETE /:id` | Delete category |  200   | —                |

### 5.6 Customers Routes (`/api/v1/customers`)

| #   | Endpoint      | Test Case                | Status | Error Code |
| --- | ------------- | ------------------------ | :----: | ---------- |
| 1   | `GET /`       | List customers paginated |  200   | —          |
| 2   | `GET /:id`    | Single customer          |  200   | —          |
| 3   | `POST /`      | Create customer          |  200   | —          |
| 4   | `PUT /:id`    | Update customer          |  200   | —          |
| 5   | `DELETE /:id` | Delete customer          |  200   | —          |

### 5.7 Suppliers Routes (`/api/v1/suppliers`)

| #   | Endpoint      | Test Case       | Status | Error Code |
| --- | ------------- | --------------- | :----: | ---------- |
| 1   | `GET /`       | List suppliers  |  200   | —          |
| 2   | `GET /:id`    | Single supplier |  200   | —          |
| 3   | `POST /`      | Create supplier |  200   | —          |
| 4   | `PUT /:id`    | Update supplier |  200   | —          |
| 5   | `DELETE /:id` | Delete supplier |  200   | —          |

### 5.8 Customer Ledger Routes (`/api/v1/customer-ledger`)

| #   | Endpoint                | Test Case                   | Status | Error Code |
| --- | ----------------------- | --------------------------- | :----: | ---------- |
| 1   | `GET /:customerId`      | Ledger entries for customer |  200   | —          |
| 2   | `POST /:id/payments`    | Record payment              |  200   | —          |
| 3   | `POST /:id/adjustments` | Add adjustment              |  200   | —          |
| 4   | `POST /reconcile`       | Reconcile customer debt     |  200   | —          |

### 5.9 Supplier Ledger Routes (`/api/v1/supplier-ledger`)

| #   | Endpoint             | Test Case                   | Status | Error Code |
| --- | -------------------- | --------------------------- | :----: | ---------- |
| 1   | `GET /:supplierId`   | Ledger entries for supplier |  200   | —          |
| 2   | `POST /:id/payments` | Record payment              |  200   | —          |
| 3   | `POST /reconcile`    | Reconcile supplier balance  |  200   | —          |

### 5.10 Inventory Routes (`/api/v1/inventory`)

| #   | Endpoint             | Test Case              | Status | Error Code |
| --- | -------------------- | ---------------------- | :----: | ---------- |
| 1   | `GET /dashboard`     | Inventory summary      |  200   | —          |
| 2   | `GET /movements`     | Movement log paginated |  200   | —          |
| 3   | `GET /expiry-alerts` | Expiry alerts          |  200   | —          |
| 4   | `POST /reconcile`    | Stock reconciliation   |  200   | —          |

### 5.11 Accounting Routes (`/api/v1/accounting`)

| #   | Endpoint                   | Test Case                 | Status | Error Code |
| --- | -------------------------- | ------------------------- | :----: | ---------- |
| 1   | `GET /accounts`            | Chart of accounts         |  200   | —          |
| 2   | `GET /journal-entries`     | List entries              |  200   | —          |
| 3   | `GET /journal-entries/:id` | Single entry              |  200   | —          |
| 4   | `GET /trial-balance`       | Trial balance report      |  200   | —          |
| 5   | `GET /profit-loss`         | P&L report                |  200   | —          |
| 6   | `GET /balance-sheet`       | Balance sheet             |  200   | —          |
| 7   | `GET /status`              | Accounting status         |  200   | —          |
| 8   | `POST /initialize`         | Initialize accounting     |  200   | —          |
| 9   | `POST /initialize`         | Already initialized → 409 |  409   | CONFLICT   |

### 5.12 Posting Routes (`/api/v1/posting`)

| #   | Endpoint                    | Test Case     | Status | Error Code       |
| --- | --------------------------- | ------------- | :----: | ---------------- |
| 1   | `POST /entries/:id/post`    | Post entry    |  200   | —                |
| 2   | `POST /entries/:id/unpost`  | Unpost entry  |  200   | —                |
| 3   | `POST /period`              | Post period   |  200   | —                |
| 4   | `POST /period`              | Missing dates |  400   | VALIDATION_ERROR |
| 5   | `GET /batches`              | List batches  |  200   | —                |
| 6   | `POST /batches/:id/reverse` | Reverse batch |  200   | —                |
| 7   | `POST /batches/:id/lock`    | Lock batch    |  200   | —                |
| 8   | `POST /batches/:id/unlock`  | Unlock batch  |  200   | —                |

### 5.13 Dashboard Routes (`/api/v1/dashboard`)

| #   | Endpoint     | Test Case            | Status | Error Code |
| --- | ------------ | -------------------- | :----: | ---------- |
| 1   | `GET /stats` | Dashboard statistics |  200   | —          |

### 5.14 Settings Routes (`/api/v1/settings`)

| #   | Endpoint             | Test Case                | Status | Error Code |
| --- | -------------------- | ------------------------ | :----: | ---------- |
| 1   | `GET /:key`          | Get setting              |  200   | —          |
| 2   | `PUT /:key`          | Update setting           |  200   | —          |
| 3   | `GET /typed`         | Typed settings           |  200   | —          |
| 4   | `PUT /typed`         | Update typed settings    |  200   | —          |
| 5   | `GET /currency`      | Currency config (public) |  200   | —          |
| 6   | `GET /company`       | Company info (public)    |  200   | —          |
| 7   | `PUT /company`       | Update company           |  200   | —          |
| 8   | `GET /modules`       | Module settings          |  200   | —          |
| 9   | `POST /setup-wizard` | Complete setup           |  200   | —          |

### 5.15 Users Routes (`/api/v1/users`)

| #   | Endpoint   | Test Case        | Status | Error Code       |
| --- | ---------- | ---------------- | :----: | ---------------- |
| 1   | `GET /`    | List users       |  200   | —                |
| 2   | `POST /`   | Create user      |  200   | —                |
| 3   | `POST /`   | Missing username |  400   | VALIDATION_ERROR |
| 4   | `PUT /:id` | Update user      |  200   | —                |
| 5   | `GET /`    | No auth → 401    |  401   | UNAUTHORIZED     |

### 5.16 Audit Routes (NEW — `/api/v1/audit`)

| #   | Endpoint     | Test Case         | Status | Error Code        |
| --- | ------------ | ----------------- | :----: | ----------------- |
| 1   | `GET /trail` | Returns audit log |  200   | —                 |
| 2   | `GET /trail` | Non-admin → 403   |  403   | PERMISSION_DENIED |

### 5.17 Backup Routes (NEW — `/api/v1/backup`)

| #   | Endpoint               | Test Case               | Status | Error Code        |
| --- | ---------------------- | ----------------------- | :----: | ----------------- |
| 1   | `POST /`               | Create backup           |  200   | —                 |
| 2   | `GET /`                | List backups            |  200   | —                 |
| 3   | `POST /generate-token` | Generate download token |  200   | —                 |
| 4   | `POST /restore`        | Restore from backup     |  200   | —                 |
| 5   | `DELETE /:backupName`  | Delete backup           |  200   | —                 |
| 6   | `GET /stats`           | Backup stats            |  200   | —                 |
| 7   | `POST /`               | Non-admin → 403         |  403   | PERMISSION_DENIED |

### 5.18 Barcode Routes (NEW — `/api/v1/barcode`)

| #   | Endpoint                | Test Case        | Status | Error Code |
| --- | ----------------------- | ---------------- | :----: | ---------- |
| 1   | `GET /templates`        | List templates   |  200   | —          |
| 2   | `POST /templates`       | Create template  |  200   | —          |
| 3   | `DELETE /templates/:id` | Delete template  |  200   | —          |
| 4   | `GET /print-jobs`       | List print jobs  |  200   | —          |
| 5   | `POST /print-jobs`      | Create print job |  200   | —          |

### 5.19 POS Routes (NEW — `/api/v1/pos`)

| #   | Endpoint          | Test Case                | Status | Error Code         |
| --- | ----------------- | ------------------------ | :----: | ------------------ |
| 1   | `POST /after-pay` | After-pay quick sale     |  200   | —                  |
| 2   | `POST /after-pay` | Insufficient stock → 409 |  409   | INSUFFICIENT_STOCK |

---

## 6. Contract Tests — Envelope, Pagination, Idempotency

These are **cross-cutting** tests that verify structural contracts are upheld system-wide.

### 6.1 Envelope Shape Tests

File: `tests/contract/envelope.test.ts`

| #   | Test Case                                                        | Assertion                                                  |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Every 2xx response has `{ ok: true, data: ... }`                 | Assert shape on 10+ representative endpoints               |
| 2   | Every 4xx response has `{ ok: false, error: { code, message } }` | Assert shape on validation errors, not-found, unauthorized |
| 3   | Every 5xx response has `{ ok: false, error: { code, message } }` | Simulate use case throwing `Error` → check envelope        |
| 4   | `data` is never `undefined` on success                           | Iterate over all success responses                         |
| 5   | `error.code` is always a string                                  | Iterate over all error responses                           |
| 6   | `error.status` is present when status ≠ 500                      | Domain errors carry explicit status                        |

### 6.2 Pagination Contract Tests

File: `tests/contract/pagination.test.ts`

| #   | Test Case                                                                                                   | Assertion                     |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | `GET /products?page=1&limit=20` returns `{ items[], total, page, limit }`                                   | Shape validated               |
| 2   | `page` defaults to 1, `limit` defaults to 20                                                                | Omit params → check response  |
| 3   | `page=0` is rejected or normalized                                                                          | 400 or auto-corrected to 1    |
| 4   | `limit > 100` is capped or rejected                                                                         | Guard against excessive pages |
| 5   | Empty result returns `{ items: [], total: 0, page: 1, limit: 20 }`                                          | Not null, not omitted         |
| 6   | Paginated endpoints: products, sales, purchases, customers, suppliers, journal-entries, inventory/movements | All conform to same shape     |

### 6.3 Idempotency Contract Tests

File: `tests/contract/idempotency.test.ts`

> These tests target the **Idempotency-Key** middleware once implemented.

| #   | Test Case                                                                                             | Assertion                                             |
| --- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | `POST /sales` with `Idempotency-Key: uuid1` → 200                                                     | First call succeeds                                   |
| 2   | Repeat `POST /sales` with same `Idempotency-Key: uuid1`                                               | Returns same response (replayed)                      |
| 3   | `POST /sales` with different `Idempotency-Key: uuid2`                                                 | Creates new sale (not deduplicated)                   |
| 4   | `POST /sales` without `Idempotency-Key`                                                               | Either auto-generates key or proceeds without dedup   |
| 5   | Conflicting `Idempotency-Key` in-flight → 409                                                         | Second concurrent request gets `IDEMPOTENCY_CONFLICT` |
| 6   | Idempotency applies to: `POST /sales`, `POST /purchases`, `POST /pos/after-pay`, `POST /:id/payments` | Verify middleware on all mutating endpoints           |
| 7   | `GET` and `DELETE` skip idempotency check                                                             | No key stored for idempotent-by-nature methods        |

---

## 7. Security / RBAC Tests

File: `tests/security/rbac.test.ts`

These tests iterate over role-constrained endpoints to verify permission enforcement.

### 7.1 Authentication Tests

| #   | Test Case                                    | Assertion                 |
| --- | -------------------------------------------- | ------------------------- |
| 1   | No `Authorization` header → 401              | All protected endpoints   |
| 2   | Malformed `Authorization: NotBearer x` → 401 | Reject non-Bearer schemes |
| 3   | Expired JWT → 401                            | Time-advanced token       |
| 4   | Tampered JWT → 401                           | Bitflipped signature      |
| 5   | Valid JWT → proceeds                         | Any protected endpoint    |

### 7.2 Authorization (Permission) Tests

| #   | Role      | Endpoint                      | Expected                        |
| --- | --------- | ----------------------------- | ------------------------------- |
| 1   | `cashier` | `DELETE /products/:id`        | 403 — lacks `products:delete`   |
| 2   | `cashier` | `POST /sales`                 | 200 — has `sales:create`        |
| 3   | `viewer`  | `POST /sales`                 | 403 — lacks `sales:create`      |
| 4   | `viewer`  | `GET /sales`                  | 200 — has `sales:read`          |
| 5   | `manager` | `DELETE /products/:id`        | 403 — lacks `products:delete`   |
| 6   | `manager` | `POST /products`              | 200 — has `products:create`     |
| 7   | `cashier` | `GET /users`                  | 403 — lacks `users:read`        |
| 8   | `admin`   | `GET /users`                  | 200 — has `users:read`          |
| 9   | `viewer`  | `POST /accounting/initialize` | 403 — lacks `accounting:manage` |
| 10  | `cashier` | `GET /audit/trail`            | 403 — lacks `audit:read`        |
| 11  | `admin`   | `POST /backup`                | 200 — has `backup:create`       |
| 12  | `manager` | `POST /backup`                | 403 — lacks `backup:create`     |

### 7.3 Programmatic RBAC Matrix Sweep

```typescript
// Pseudocode — iterate RBAC matrix and assert permission enforcement
const rbacMatrix = [
  {
    method: "DELETE",
    url: "/api/v1/products/1",
    perm: "products:delete",
    allowed: ["admin"],
  },
  {
    method: "POST",
    url: "/api/v1/sales",
    perm: "sales:create",
    allowed: ["admin", "manager", "cashier"],
  },
  // ... all rows from RBAC_MATRIX.md
];

for (const { method, url, perm, allowed } of rbacMatrix) {
  for (const role of ["admin", "manager", "cashier", "viewer"]) {
    test(`${role} ${method} ${url}`, async () => {
      const perms = getPermissionsForRole(role);
      const res = await ctx.app.inject({
        method,
        url,
        headers: ctx.authHeaders({ role, permissions: perms }),
      });
      if (allowed.includes(role)) {
        expect(res.statusCode).not.toBe(403);
      } else {
        expect(res.statusCode).toBe(403);
      }
    });
  }
}
```

---

## 8. Coverage Gap Analysis & Branch Improvement

### Currently Covered (existing 27 test files)

| Layer                 | Files                                                                                   | Approximate Tests |
| --------------------- | --------------------------------------------------------------------------------------- | ----------------: |
| Unit — Core           | 5 test files (contract, domain-errors, jwt-service, permission-service, login-use-case) |               ~30 |
| Integration — Plugins | 5 test files (swagger, db, error-handler, support, web-stack)                           |               ~25 |
| Integration — Routes  | 15 test files (all current v1 routes)                                                   |               ~90 |
| Integration — App     | 1 test file (app.test.ts)                                                               |                ~5 |

### Known Branch Coverage Gaps → Fixes

| #   | File                   | Line(s) | Uncovered Branch                                               | Fix                                  |
| --- | ---------------------- | ------- | -------------------------------------------------------------- | ------------------------------------ |
| 1   | `contract.ts`          | L69     | `error.message \|\| "An unexpected…"` — empty-message fallback | Add `toApiError(new Error(""))` test |
| 2   | `JwtService.ts`        | L86     | `verify()` catch block                                         | Override internal to throw           |
| 3   | `PermissionService.ts` | L100    | `allowedRoles.includes(role)` false branch                     | Test with role lacking most perms    |
| 4   | `LoginUseCase.ts`      | L27     | `isValid === false` branch                                     | Mock `comparePassword → false`       |
| 5   | `app.ts`               | L33-37  | `??` fallbacks for undefined plugins/routes                    | Register with partial overrides      |
| 6   | `error-handler.ts`     | L34-35  | Empty `instancePath` / `message` in AJV errors                 | Craft synthetic validation array     |

### New Test Files Needed

| File                                           | Purpose                        |
| ---------------------------------------------- | ------------------------------ |
| `tests/contract/envelope.test.ts`              | Structural envelope assertions |
| `tests/contract/pagination.test.ts`            | Pagination shape assertions    |
| `tests/contract/idempotency.test.ts`           | Idempotency-Key middleware     |
| `tests/security/rbac.test.ts`                  | RBAC matrix sweep              |
| `tests/routes/v1/audit/index.test.ts`          | Audit trail route              |
| `tests/routes/v1/backup/index.test.ts`         | Backup routes                  |
| `tests/routes/v1/barcode/index.test.ts`        | Barcode routes                 |
| `tests/routes/v1/pos/index.test.ts`            | POS routes                     |
| `tests/unit/core/create-sale-use-case.test.ts` | Sale creation logic            |
| `tests/unit/core/cancel-sale-use-case.test.ts` | Sale cancel logic              |
| `tests/unit/core/refund-sale-use-case.test.ts` | Sale refund logic              |

---

## 9. Test Naming & Conventions

### File Structure

```
tests/
├── helpers/            # Shared test utilities
│   ├── assertions.ts   # expectOk(), expectError()
│   ├── buildApp.ts     # Fastify test instance builder
│   ├── env.ts          # Environment variable defaults
│   ├── fixtures.ts     # Static domain objects
│   ├── mockCore.ts     # vi.mock("@nuqta/core")
│   └── mockData.ts     # vi.mock("@nuqta/data")
├── unit/
│   └── core/           # Pure unit tests (no HTTP)
│       ├── contract.test.ts
│       ├── domain-errors.test.ts
│       ├── jwt-service.test.ts
│       ├── login-use-case.test.ts
│       ├── permission-service.test.ts
│       └── ...future use-case tests
├── plugins/            # Plugin integration tests
│   ├── db.test.ts
│   ├── error-handler.test.ts
│   ├── support.test.ts
│   └── web-stack.test.ts
├── routes/
│   └── v1/             # Route integration tests (one per module)
│       ├── auth/index.test.ts
│       ├── products/index.test.ts
│       ├── sales/index.test.ts
│       └── ...
├── contract/           # Cross-cutting contract tests
│   ├── envelope.test.ts
│   ├── pagination.test.ts
│   └── idempotency.test.ts
├── security/           # Security/RBAC tests
│   └── rbac.test.ts
└── app.test.ts         # App-level boot tests
```

### Naming Conventions

```typescript
// Describe block: route prefix or class name
describe("/api/v1/products", () => { ... });
describe("JwtService", () => { ... });

// Test names: <action> → <expected outcome>
test("POST / creates a product and returns 200", ...);
test("POST / without auth returns 401", ...);
test("DELETE /:id as cashier returns 403", ...);
test("verify() with tampered token returns null", ...);
```

### Required Patterns

1. **Always** use `beforeEach(resetMockCore + resetMockData + buildApp)`
2. **Always** call `ctx.close()` in `afterEach`
3. **Always** use `expectOk()` / `expectError()` — never assert raw JSON
4. **Always** supply explicit permissions in `authHeaders({ permissions: [...] })`
5. **Never** access database directly — all data comes from mocked use cases

---

## 10. CI Pipeline Integration

### Commands

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm vitest tests/routes/v1/products/index.test.ts

# Run tests matching pattern
pnpm vitest -t "DELETE"
```

### CI Gates

| Gate               | Threshold | Blocking |
| ------------------ | --------- | :------: |
| All tests pass     | 100% pass |    ✅    |
| Line coverage      | ≥ 90%     |    ✅    |
| Branch coverage    | ≥ 70%     |    ✅    |
| Function coverage  | ≥ 90%     |    ✅    |
| Statement coverage | ≥ 90%     |    ✅    |

### CI Workflow (GitHub Actions)

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: pnpm build
    - run: pnpm test:coverage
    - uses: actions/upload-artifact@v4
      with:
        name: coverage
        path: coverage/
```

---

## Summary — Test Counts by Layer

| Layer                 | Existing | New (this plan) |  Total   |
| --------------------- | :------: | :-------------: | :------: |
| Unit — Core           |   ~30    |       ~25       |   ~55    |
| Unit — Use Cases      |    ~8    |       ~20       |   ~28    |
| Integration — Plugins |   ~25    |       ~5        |   ~30    |
| Integration — Routes  |   ~90    |       ~35       |   ~125   |
| Contract              |    0     |       ~20       |   ~20    |
| Security / RBAC       |    0     |       ~15       |   ~15    |
| **Total**             | **~153** |    **~120**     | **~273** |
