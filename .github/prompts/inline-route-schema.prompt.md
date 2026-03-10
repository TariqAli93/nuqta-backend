---
description: "Inline route schemas — remove a separate schema.ts file and merge its contents directly into the route index.ts. Use when consolidating Fastify route schemas into a single file per route module."
agent: "agent"
argument-hint: "Route directory path, e.g. src/routes/v1/accounting"
---

## Task

Given a Fastify route module under `src/routes/v1/<domain>/`:

1. **Read** `schema.ts` — collect every export and its internal (non-exported) dependencies (helper schemas, shared types, imports from `schema-helpers`, etc.).
2. **Read** `index.ts` — identify where the schema exports are used (the `schema` option in `fastify.get/post/put/patch/delete` calls). If no schema is referenced yet, wire each schema into the matching route's options object.
3. **Merge** — paste all schema definitions (private helpers first, then exported schemas) into `index.ts`:
   - Place them **after** the existing imports and **before** the route plugin function.
   - Preserve the original import of shared helpers (e.g. `ErrorResponses`, `successEnvelope`, `successArrayEnvelope` from `schema-helpers`).
   - Remove the `import … from "./schema.js"` line.
4. **Delete** `schema.ts`.
5. **Verify** — ensure no remaining `import` references `./schema` anywhere in the codebase for that domain.

### Rules

- Keep schema objects as module-level `const` declarations (not inside the route function).
- Do **not** change runtime behaviour, route paths, or response shapes.
- Preserve `as const` assertions exactly as they appear.
- If a schema object is only used once, you may keep it named or inline it — prefer named for readability.
