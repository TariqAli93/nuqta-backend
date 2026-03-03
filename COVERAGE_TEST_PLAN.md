# Branch Coverage Improvement Plan

**Goal**: Raise overall branch coverage from 76.36% → ≥ 85%.

## Uncovered Lines & Fix Strategy

| #   | File                                              | Line(s) | Uncovered branch                                                                                              | Test                                                                                                        |
| --- | ------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `packages/core/src/contract.ts`                   | 69      | `error.message \|\| 'An unexpected error occurred'` — empty-message fallback                                  | `contract.test.ts` — `toApiError(new Error(""))`                                                            |
| 2   | `packages/core/src/services/JwtService.ts`        | 86      | `verify()` catch block (`return null`) — requires an internal throw                                           | `jwt-service.test.ts` — override private `hmacSha256` to throw                                              |
| 3   | `packages/core/src/services/PermissionService.ts` | 100     | `if (allowedRoles.includes(role))` false branch inside `getPermissionsForRole` loop                           | Already covered by existing test but V8 may need explicit iteration with a role that lacks most permissions |
| 4   | `packages/core/src/use-cases/LoginUseCase.ts`     | 27      | `isValid === false` → `throw UnauthorizedError` (wrong password)                                              | `login-use-case.test.ts` — mock `comparePassword → false`                                                   |
| 5   | `src/app.ts`                                      | 33-37   | `??` fallbacks when `testOverrides.plugins` or `.routes` is undefined                                         | `app.test.ts` — register with only `plugins` (no `routes`) and vice-versa                                   |
| 6   | `src/plugins/error-handler.ts`                    | 34-35   | `v.instancePath \|\| v.params?.missingProperty \|\| "unknown"` and `v.message \|\| "Invalid value"` fallbacks | `error-handler.test.ts` — craft a synthetic `error.validation` array with empty fields                      |

## High-Impact Route Negative-Path Tests (C)

These target 401/403/400 branches that aren't fully exercised by existing tests.

| Route                                      | Test                                                         | Target                           |
| ------------------------------------------ | ------------------------------------------------------------ | -------------------------------- |
| `POST /api/v1/sales`                       | No auth header → 401                                         | `support.ts` authenticate guard  |
| `POST /api/v1/sales`                       | Expired token → 401                                          | jwt.verify null branch           |
| `POST /api/v1/products`                    | Missing required `name` + `costPrice` + `sellingPrice` → 400 | Validation `instancePath` branch |
| `DELETE /api/v1/products/:id`              | No auth → 401                                                | authenticate guard               |
| `POST /api/v1/posting/period`              | Incomplete body (missing `periodStart`, `periodEnd`) → 400   | Validation details               |
| `POST /api/v1/posting/entries/:id/reverse` | Invalid token → 401                                          | jwt.verify invalid sig           |

## Files to Modify

1. `tests/unit/core/contract.test.ts` — +1 test
2. `tests/unit/core/jwt-service.test.ts` — +1 test
3. `tests/unit/core/permission-service.test.ts` — +1 test
4. `tests/unit/core/login-use-case.test.ts` — +1 test
5. `tests/app.test.ts` — +2 tests
6. `tests/plugins/error-handler.test.ts` — +1 test
7. `tests/routes/v1/sales/index.test.ts` — +2 negative-path tests
8. `tests/routes/v1/products/index.test.ts` — +2 negative-path tests
9. `tests/routes/v1/posting/index.test.ts` — +2 negative-path tests

## Run

```bash
pnpm test              # all tests pass
pnpm test:coverage     # verify branch >= 85%
```
