# Architecture Audit — Nuqta Backend

**Date**: March 2026  
**Scope**: Solo developer, pragmatic maintainability over "best practices" dogma  
**Summary**: The project is a well-built ERP backend, but several architectural layers add complexity without proportional value for a single-developer project.

---

## 1. Architecture Audit

### Is the current architecture justified?

**Verdict: Partially.** The 3-package PNPM monorepo (`core`, `data`, app) is Clean Architecture applied to a project that has one developer, one database, and one deployment target. It adds meaningful friction:

- Every model change touches 3+ files across packages (`entity` → `interface` → `repository` → `route`).
- Workspace builds add ~10s per cycle via `pnpm build`.
- The `@nuqta/core` barrel export compiles 200+ lines of `export *` just to cross a package boundary.

**Is it justified?** If you ever plan to ship an Electron desktop app alongside this API (reusing core use-cases), the separation earns its keep. If this is API-only, a flat single-package structure with `src/domain/`, `src/data/`, `src/routes/` achieves the same testability at half the overhead.

### Unnecessary layers?

| Layer | What it does | What the layer above could do instead | Verdict |
|---|---|---|---|
| `packages/core/src/interfaces/` | TypeScript interfaces for 24 repositories | Concrete classes already provide the same type surface; tests use plain objects anyway | **Debatable — keep only if you swap implementations** |
| `packages/core/src/use-cases/` | ~100 use-case classes | Most are 3–5 line pass-throughs; route handlers can call repos directly for trivial CRUDs | **Eliminate trivially thin ones** |
| `packages/core/src/shared/services/AuditService` | Wraps `IAuditRepository` with convenience methods | `AuditEvent` already has `createForCreate/Update/Delete` factory methods; calling `auditRepo.create(event)` directly is 2 lines | **Keep** — it provides real convenience and consistent audit patterns |
| `packages/core/src/shared/services/SettingsAccessor` | Typed getter wrapper over a key-value settings store | Bare `repo.get("key")` calls with defaults would be just as readable | **Keep** — prevents magic strings scattering across use-cases |

### Services that could be merged

- **`SettingsRepository` + `AccountingSettingsRepository` + `PosSettingsRepository` + `BarcodeSettingsRepository` + `SystemSettingsRepository`**: Five separate settings repos for what is conceptually one settings domain. The KV-based `SettingsRepository` already holds most of these as string pairs. Consider consolidating into a single typed settings table or a single `SettingsRepository` with typed access.

### Infrastructure complexity

No message queues, service mesh, or external caching. The SSE event bus (`EventEmitter`-backed) is appropriate. **No unnecessary infrastructure.**

---

## 2. Design Patterns Audit

### Repository Pattern

- **Where**: 24 `IXxxRepository` interfaces, each with exactly one implementation in `packages/data`.
- **Justified?** Partially. The interface layer enables DI and unit testing. However, tests already mock repos as plain objects (`{}`), bypassing the interface contract entirely. TypeScript structural typing means the concrete class already satisfies the interface shape.
- **Simpler alternative**: Drop the interfaces and type-hint use-case constructors directly with the concrete repository class. This removes 24 files and 24 `export *` lines.
- **Risk**: If you ever add a second database adapter or in-memory implementation, you'd need to re-introduce interfaces. For a solo dev with one DB, this is unlikely.

### Use-Case Pattern (Command Object)

- **Where**: ~100 classes in `packages/core/src/use-cases/`.
- **Justified?** For use-cases with real business logic (FIFO depletion, journal creation, payroll calculation, sale validation): **yes, absolutely**. For use-cases that are literally `return this.repo.findAll()`: **no**.
- **Simpler alternative**: Inline trivially thin use-cases into route handlers. Route handlers calling `fastify.repos.user.findAll()` directly are more readable than constructing a wrapper class.
- **Examples already eliminated**: `GetUsersUseCase`, `GetUserByIdUseCase`, `GetCategoriesUseCase`, `DeleteCategoryUseCase` — these were 3–5 line pass-through classes with zero business logic.
- **Remaining candidates**: `GetCustomersUseCase`, `GetSuppliersUseCase`, `GetProductsUseCase`, and several other read-only pass-throughs.

### Interfaces With One Implementation

- **Where**: All 24 repository interfaces.
- **Verdict**: Over-engineered. Each interface file adds a file to navigate, an export to maintain, and an `import` in every use-case. TypeScript structural typing makes them optional.

### Static Class Used as a Namespace (`PermissionService`)

- **Where**: `packages/core/src/shared/services/PermissionService.ts`.
- **Pattern**: A class with only `static` methods — no state, no instantiation.
- **Simpler alternative**: Export plain functions from the file (`export function hasPermission(...)`) and a plain `PERMISSION_MATRIX` object. Identical behaviour, removes the class wrapper.

### Event Bus (Observer)

- **Where**: `src/plugins/event-bus.ts`, consumed only by `src/routes/v1/events/index.ts` (SSE stream).
- **Subscribers**: 1 (the SSE endpoint).
- **Justified?** Yes — the SSE endpoint is a real feature and the `DomainEventBus` wrapper adds SSE-specific handling (max listeners). Keep it.

---

## 3. Technology Audit

| Technology | Necessary? | Simpler alternative | Rating |
|---|---|---|---|
| **Fastify** | Yes — performant, schema-validated, good DX | Express (less boilerplate for small APIs) | **KEEP** |
| **Drizzle ORM** | Yes — type-safe SQL, good Postgres support | Kysely or raw `pg` queries | **KEEP** |
| **Zod** | Partial — used in `AuditEvent` entity but Fastify's JSON Schema handles route validation | JSON Schema alone | **CONSIDER REMOVING** from `core`; route layer already validates |
| **bcryptjs** | Yes — password hashing | Node.js `crypto.scrypt` (built-in, but more boilerplate) | **KEEP** |
| **jsonwebtoken** | Yes | `jose` (more modern, supports ESM natively) | **KEEP** (works fine) |
| **@fastify/swagger + @fastify/swagger-ui** | Yes — useful API docs | Hand-written OpenAPI YAML | **KEEP** |
| **@fastify/rate-limit** | Yes | Custom middleware (~30 lines) | **KEEP** |
| **@fastify/helmet** | Yes — security headers | Custom middleware (~15 lines) | **KEEP** |
| **@fastify/cors** | Yes | Custom middleware (~10 lines) | **KEEP** |
| **@fastify/compress** | Yes — response compression | Custom middleware | **KEEP** |
| **commander** | Used only in `packages/data` for DB migration scripts | `process.argv` parsing (~5 lines) | **CONSIDER REMOVING** — limited use |
| **dotenv** | Used only in `packages/data/src/db/db.ts` | Same | **KEEP** (correctly scoped to data package) |
| **fastify-plugin** | Yes — required Fastify pattern | N/A | **KEEP** |
| **concurrently** | Dev-only — runs TS watch + server | `npm-run-all` or shell `&` operator | **KEEP** |
| **knip** | Dev-only — dead code detection | N/A | **KEEP** |

---

## 4. Dependency Audit

### `packages/core` dependencies

| Package | Could it be replaced? | Verdict |
|---|---|---|
| `bcryptjs` | `crypto.scrypt` (built-in, ~20 lines) | Replace if minimising deps is a goal; bcryptjs is battle-tested |
| `jsonwebtoken` | `jose` or `crypto` (built-in, ~50 lines for HS256) | Keep — well-tested |
| `zod` | JSON Schema (already used in routes) | **Consider removing** — Zod pulls ~50KB and is only used for `AuditEvent` validation in `core`. Route validation via Fastify's JSON Schema covers the boundary. |

### `packages/data` dependencies

| Package | Could it be replaced? | Verdict |
|---|---|---|
| `drizzle-orm` | Raw `pg` queries (~100s of lines) | Keep — type safety is worth the dep |
| `pg` | Required by Drizzle/Postgres | Keep |
| `dotenv` | Built-in if using Node ≥20.6 `--env-file` flag | Keep for now (broad compatibility) |
| `commander` | `process.argv` (~5 lines) for the single migration CLI | **Consider removing** |

### Root / app dependencies

| Package | Notes | Verdict |
|---|---|---|
| All `@fastify/*` | Each solves a real problem | Keep |
| `fastify-cli` | Used for `fastify start` dev command | Keep |

---

## 5. Complexity Score

**Score: 6 / 10** — Right on the boundary between "right-sized" and "over-engineered."

**What pushes it toward 6:**
- The 3-package monorepo is manageable but adds overhead.
- ~100 use-case classes, of which ~30–40 are trivial pass-throughs.
- 24 interfaces with a single implementation each.
- 5 separate settings repositories for one conceptual domain.

**What keeps it from 7+:**
- No message queues, caches, or service mesh.
- No microservices.
- Sensible error hierarchy.
- Fastify with standard middleware stack.
- Real business logic (FIFO, payroll, journal entries) is well-isolated.

---

## 6. Simplification Roadmap

### P1 — Already Done

- **Remove `import "dotenv/config"` from `src/plugins/aa-swagger.ts` and `BackupRepository.ts`**  
  **Why**: `dotenv` is a dependency of `packages/data`, not the app layer. Loading env vars in a Swagger plugin is wrong and caused all route tests to fail.  
  **Risk**: None.  **Effort**: Low ✅

- **Remove mock licensing route (`src/routes/v1/licensing/index.ts`)**  
  **Why**: Route returned hardcoded `{ status: "active", plan: "premium" }` — fake data in production code.  
  **Risk**: If any client currently calls `/api/v1/licensing/status`, it will 404. Check before deploying.  
  **Effort**: Low ✅

- **Eliminate 4 trivial pass-through use-cases** (`GetUsersUseCase`, `GetUserByIdUseCase`, `GetCategoriesUseCase`, `DeleteCategoryUseCase`)  
  **Why**: 3–5 line classes that only call `repo.findAll()` or `repo.delete()`. Routes now call repos directly, removing a layer of indirection.  
  **Risk**: Low — tests updated to match.  
  **Effort**: Low ✅

---

### P2 — High Impact, Low Effort

- **What to change**: Eliminate remaining trivial GET pass-through use-cases (`GetCustomersUseCase`, `GetSuppliersUseCase`, `GetEmployeesUseCase`, `GetProductsUseCase`, `GetPurchasesUseCase`, and similar read-only wrappers with zero validation logic).  
  **Why**: Each class is 5 lines, adds a file, and trains devs to always add a use-case even when logic is absent.  
  **How**: Inline `fastify.repos.xxx.findAll(params)` directly in the route handler. Update route tests to mock the repo method.  
  **Risk**: Tests need updating per use-case.  
  **Effort**: Low (~15 min per use-case)

- **What to change**: Convert `PermissionService` static class to exported plain functions.  
  **Why**: A class with only static methods is a namespace, not a class. Plain functions are simpler and more idiomatic.  
  **How**: Replace `export class PermissionService { static hasPermission(...) }` with `export function hasPermission(...)`. Update all call-sites (`PermissionService.hasPermission(...)` → `hasPermission(...)`).  
  **Risk**: Low — find-and-replace refactor.  
  **Effort**: Low

---

### P3 — High Impact, Medium Effort

- **What to change**: Remove the 24 `IXxxRepository` interfaces from `packages/core/src/interfaces/`.  
  **Why**: Every interface has exactly one implementation. TypeScript structural typing means the concrete class already satisfies the contract. 24 extra files with no swap value.  
  **How**: Replace interface types in use-case constructors with the concrete repository class type (imported from `packages/data`). Or introduce a simple type alias in `packages/data` and re-export.  
  **Risk**: Medium — if you ever want an in-memory implementation for testing, you'll need to re-add. Consider keeping interfaces only for the 3–4 repositories that have complex domain logic (e.g., `ISaleRepository`, `IProductRepository`).  
  **Effort**: Medium (~2–3 hours)

- **What to change**: Consolidate the 5 settings repositories into 1 or 2.  
  **Why**: `SettingsRepository` (KV), `AccountingSettingsRepository`, `PosSettingsRepository`, `BarcodeSettingsRepository`, and `SystemSettingsRepository` are all settings. 5 repos, 5 interfaces, 5 Drizzle tables. The structured-table repos (`AccountingSettings`, `PosSettings`, `BarcodeSettings`) could become typed sections of a single `app_settings` table.  
  **How**: Consolidate into `SettingsRepository` (KV for misc) + `StructuredSettingsRepository` (typed rows for accounting/POS/barcode). Or use a single JSONB column per domain.  
  **Risk**: Requires a DB migration.  
  **Effort**: Medium (~4 hours)

---

### P4 — Medium Impact, High Effort

- **What to change**: Collapse the 3-package monorepo into a single package with well-organized directories.  
  **Why**: Build step adds friction, cross-package imports require `pnpm build` between changes, and the separation provides no benefit unless you share `core` with an Electron app or another service.  
  **How**: Move `packages/core/src` → `src/domain/`, move `packages/data/src` → `src/data/`. Update all imports. Keep the same folder structure — just drop the package boundary.  
  **Risk**: High — large refactor, all imports change, build setup changes.  
  **Effort**: High (~1 day)  
  **When to do it**: Only if the Electron/desktop use-case is definitively not planned.

- **What to change**: Remove `zod` from `packages/core`.  
  **Why**: Route-layer validation via Fastify's JSON Schema is already comprehensive. `zod` in `core` is used only in `AuditEvent` for some field validation. Removing it reduces bundle size and dependency surface.  
  **How**: Replace Zod validators in `AuditEvent` with plain TypeScript type guards or remove them entirely (the data is already validated at the route layer).  
  **Risk**: Low if done carefully.  
  **Effort**: Medium (~2 hours)
