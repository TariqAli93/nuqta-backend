# Nuqta Backend Project Guidelines

## Build And Test

- Install dependencies with `pnpm install`.
- Build workspace packages with `pnpm build`.
- Run app tests with `pnpm test`.
- Run coverage checks with `pnpm test:coverage` (targets: 90% lines/functions/statements, 70% branches).
- Run type checks with `pnpm typecheck`.
- For DB schema changes, use:
  - `pnpm --filter=@nuqta/data run db:generate`
  - `pnpm --filter=@nuqta/data run db:migrate`
  - `pnpm --filter=@nuqta/data run db:seed`

## Architecture

- This is a PNPM monorepo with three layers:
  - `packages/core`: domain entities, interfaces, use-cases, shared domain services/errors.
  - `packages/data`: Drizzle schema, repositories, DB scripts/migrations.
  - `src`: Fastify app layer (plugins, middleware, routes).
- Keep dependency flow one-directional where possible:
  - Fastify routes call core use-cases.
  - Use-cases depend on core interfaces/entities and are persistence-agnostic.
  - Data repositories implement core interfaces.

## Coding Conventions

- Use ESM-compatible imports with explicit `.js` extension in TypeScript source when importing local files.
- Prefer package barrel imports for cross-package usage:
  - `@nuqta/core`
  - `@nuqta/data`
- Keep route handlers thin: parse request input, delegate to use-cases, return envelope response.
- Throw domain errors from core use-cases and let the global error handler map them to API errors.

## API And Error Contracts

- Return API responses using the standard envelope:
  - Success: `{ ok: true, data: ... }`
  - Failure: `{ ok: false, error: { code, message, details? } }`
- Reuse shared schema helpers and common schemas for route response definitions.
- Keep Fastify route schema and runtime behavior aligned.

## Fastify Plugin And Route Conventions

- Plugin load order matters and is controlled by filename prefixes (`aa-`, `ab-`, `ac-`, `ad-`).
- Register shared plugins/decorators before routes that depend on them.
- For auth-protected endpoints, use existing RBAC middleware patterns.

## Testing Conventions

- For route tests, use `tests/helpers/buildApp.ts` to construct app instances with overrides.
- Mock core/data dependencies using the shared test helpers instead of real DB access.
- Keep tests deterministic and isolated; reset mocks between test cases when needed.
- Add or update tests alongside behavior changes (route tests for HTTP behavior, unit tests for core logic).

## Environment Notes

- Core runtime env vars include `DATABASE_URL`, `JWT_SECRET`, and `NODE_ENV`.
- Swagger docs are served in development; in production they require `ENABLE_DOCS=true`.
- If changing migration behavior, verify execution from workspace root and keep Drizzle artifacts in `packages/data/drizzle/`.

## Exemplars

- Route pattern: `src/routes/v1/users/index.ts`
- Error mapping: `src/plugins/error-handler.ts`
- Fastify decorations and repos: `src/plugins/db.ts`
- Domain error model: `packages/core/src/shared/errors/DomainErrors.ts`
- Route test setup: `tests/helpers/buildApp.ts`
- Repository implementation: `packages/data/src/repositories/users/UserRepository.ts`
