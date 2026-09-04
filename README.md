# TaskFlow API

A REST API for task management, built as a portfolio piece demonstrating production-grade Node.js/TypeScript backend practices — clean architecture, input validation, authentication, automated testing, and containerized deployment.

> 🚧 Work in progress — Phase 4 (Testing & Documentation) complete, Phase 5 (Containerization & CI/CD) next.

## Live Demo

_Coming in Phase 6 — will link the deployed Render URL and `/api-docs` here._

## Tech Stack

- **Runtime/Language:** Node.js, TypeScript
- **Framework:** Express
- **Database:** MongoDB (Atlas), Mongoose
- **Validation:** Zod
- **Auth:** JWT (jsonwebtoken), bcryptjs
- **Security:** helmet, cors, express-rate-limit
- **Testing:** Jest, Supertest, mongodb-memory-server, @swc/jest
- **Docs:** Swagger/OpenAPI (swagger-jsdoc, swagger-ui-express), Postman
- _(Coming later: Docker)_

## Endpoints

| Method | Path                | Description             | Auth Required |
|--------|---------------------|--------------------------|----------------|
| GET    | `/health`           | Health check             | No             |
| POST   | `/api/auth/register`| Register a new user      | No             |
| POST   | `/api/auth/login`   | Log in, receive a JWT    | No             |
| GET    | `/api/tasks`        | List the caller's tasks  | Yes            |
| POST   | `/api/tasks`        | Create a new task        | Yes            |
| GET    | `/api/tasks/:id`    | Fetch one of the caller's tasks by ID | Yes |
| PUT    | `/api/tasks/:id`    | Update one of the caller's tasks      | Yes |
| DELETE | `/api/tasks/:id`    | Delete one of the caller's tasks      | Yes |

Task routes require `Authorization: Bearer <token>`, obtained via `/api/auth/login`. `/api/auth/*` routes are rate-limited (100 requests / 15 min per client). Full interactive documentation is available at `/api-docs` once the server is running.

## Response Shape

Every endpoint responds with one of two consistent shapes:
- Success: `{ "success": true, "data": ... }`
- Failure: `{ "success": false, "error": ..., ["details" | "message"]: ... }`

## How to Run Locally

1. Clone the repo and `cd` into it.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your own MongoDB Atlas connection string and a generated `JWT_SECRET` (`openssl rand -hex 32`).
   - If you're on Windows and hit `ECONNREFUSED` on a DNS SRV lookup despite the connection string being correct, see **Known Issues** below.
4. Run the server:
   ```
   node --env-file=.env src/server.ts
   ```
5. Confirm it's up: `curl http://localhost:5000/health`
6. Explore and test interactively at `http://localhost:5000/api-docs`, or import `TaskFlow.postman_collection.json` into Postman.

## Testing

```
npm test           # runs the full suite against an in-memory MongoDB instance
npm run typecheck  # separate type-check step — see Design Decisions below for why this is separate
```

Tests live in `src/test/`: `auth.test.ts` covers registration and login (including negative cases — duplicate email, wrong password, nonexistent email), `tasks.test.ts` covers authenticated task CRUD and rejects unauthenticated/malformed-token requests. A `globalSetup`/`globalTeardown` pair spins up a fresh `mongodb-memory-server` instance once for the entire run and tears it down after, so tests never touch the real Atlas database.

## API Documentation

- **Swagger/OpenAPI** — served at `/api-docs` when the server is running, generated from JSDoc comments above each route (see `config/swagger.ts` and the route files). Fully interactive — supports "Try it out" against a real running server, including Bearer-token auth.
- **Postman** — `TaskFlow.postman_collection.json` at the repo root. Auth requests automatically capture the returned JWT into a collection variable (`{{token}}`), and task creation automatically captures the new task's ID (`{{taskId}}`), so `Get/Update/Delete Task by ID` work immediately after `Create New Task` with no manual copy-pasting. Import into Postman and run top-to-bottom for a self-chaining demo of the full flow.

## Architecture

Request flow for task routes: **client → `app.ts` (helmet, cors, json parsing) → `protect` (JWT verification) → route-level `validateRequest` (on write operations) → `taskRoutes.ts` → `taskController.ts` → `Task.ts` (Mongoose) → MongoDB**, with any thrown error diverted at any point to `errorHandler.ts`. Auth routes follow the same shape minus `protect`, with `express-rate-limit` applied instead.

- **`app.ts`** — builds and fully configures the Express app (middleware, routes, Swagger UI, error handler) and exports it directly, with no `.listen()` call and no database connection — this is what makes the app importable and testable via Supertest with zero real network/DB side effects.
- **`server.ts`** — the actual entry point: imports the configured app from `app.ts`, connects to the database, and starts listening.
- **`config/db.ts`** — owns the entire database connection lifecycle.
- **`config/swagger.ts`** — the OpenAPI definition (metadata, servers, the shared `bearerAuth` security scheme) and the glob pattern telling `swagger-jsdoc` where to find route documentation comments.
- **`models/Task.ts`** / **`models/User.ts`** — document shapes; `User.ts` hashes passwords via a pre-save hook and excludes the hash from query results by default (`select: false`).
- **`utils/validators.ts`** — Zod schemas plus `validateRequest(schema)`, a single generic middleware-builder reused across every write endpoint.
- **`middlewares/protect.ts`** — verifies the `Authorization` header's JWT and attaches a type-checked user payload onto `req.user`.
- **`middlewares/errorHandler.ts`** — the single place every error in the app lands, turning it into a consistent, safe JSON response.
- **`controllers/authController.ts`** / **`controllers/taskController.ts`** — business logic; every task query is scoped to `{ ..., userId: req.user.id }`.
- **`routes/taskRoutes.ts`** / **`routes/authRoutes.ts`** — pure wiring, with `@openapi` JSDoc comments directly above each route definition describing its request/response shape for Swagger.
- **`test/testSetup.ts`** / **`test/testTeardown.ts`** — Jest global setup/teardown for the in-memory MongoDB instance.

## Design Decisions

- **`app.ts` and `server.ts` are deliberately separate files**, so the app can be imported by Supertest with no side effects (no real DB connection, no port binding).
- **Task ownership is enforced at the query level.** Every task lookup, update, and delete filters by `{ _id: taskId, userId: req.user.id }` in a single query. A request for another user's task returns **404**, not 403 — indistinguishable from a task that doesn't exist, from the requester's perspective.
- **Login and registration return a consistent, generic "Invalid credentials" message** for both a nonexistent email and a correct email with the wrong password, to avoid letting an attacker enumerate registered emails — covered by an automated test asserting the exact message text.
- **Tests run against an in-memory MongoDB (`mongodb-memory-server`)**, started once via Jest's `globalSetup` and stopped via `globalTeardown`, rather than a shared Atlas test database — fast, fully isolated, and reproducible without external infrastructure.
- **`@swc/jest` is used instead of `ts-jest`, with type-checking run as a separate `npm run typecheck` step**, since the project's TypeScript version outpaced `ts-jest`'s supported peer range. `@swc/jest` strips types without checking them, so `tsc --noEmit` covers what it intentionally doesn't — "fast test execution" and "type safety" kept as explicitly separate, composable steps.
- **Swagger documentation is hand-written in JSDoc comments, not auto-generated from the Zod schemas**, even though the two describe overlapping information. This does mean request/response shapes are maintained in two places (Zod for runtime validation, OpenAPI comments for documentation) — a deliberate tradeoff favoring documentation written and understood by hand over an auto-generation dependency, given documentation quality is itself part of what this phase demonstrates. Each route's documented response codes were traced against the actual controller logic rather than assumed, since documentation that describes behavior the code doesn't have is worse than no documentation at all.
- **Passwords are never handled as plaintext outside the initial request** — hashed automatically via `User.ts`'s pre-save hook, excluded from queries by default via `select: false`, explicitly re-included only in `login` via `.select('+password')`.
- **JWTs are signed with HS256 using a single shared secret, not RS256**, matching the single-secret setup this project actually has. The payload is kept minimal (just the user's ID), since a JWT is signed but not encrypted.
- **`req.user`'s type was tightened after the fact** to `AuthenticatedUser | undefined`, once it was clear `protect` is the only place it's ever assigned — moving the shape-check into `protect` itself so every controller downstream can trust `req.user.id` with a single `if (!req.user)` guard.
- **Rate limiting is scoped to `/api/auth/*`, not applied globally**, since repeated login attempts are a realistic attack pattern in a way repeated authenticated task requests generally aren't.
- **Status codes are split by failure type**: `400` for client-caused bad input, `401` for authentication failures, `404` for a well-formed ID that doesn't match (or doesn't belong to the caller), `500` for unexpected server-side failures.

## Known Issues

- **Node fails to resolve `mongodb+srv://` DNS SRV records on some Windows setups**, even when the OS itself resolves the same record correctly. **Workaround:** a non-SRV connection string (Atlas → Connect → Drivers → older driver version).
- **Mongoose 9's TypeScript types for `schema.pre('save', ...)` reject a hook mixing `async` with a manual `next` callback parameter.** Resolved with pure `async`/`await`, no `next` parameter, in the password-hashing hook.
- **`ts-jest`'s current release does not support TypeScript 7** (declared peer range `>=4.3 <7`), which this project is on. `@swc/jest` is used instead — see Design Decisions above.
- **The Postman collection's `Register a User` request uses a hardcoded email.** Re-running the collection a second time without changing it will correctly (and expectedly) return "Email already registered" rather than creating a fresh user. Not yet parameterized with a dynamic/unique value per run.

## Progress Log

- [x] Phase 1: Local setup, folder structure, database connection, core CRUD, health check
- [x] Phase 2: Zod validation on create/update, centralized error handling
- [x] Phase 3: JWT auth, password hashing, protected + ownership-scoped task routes, helmet/cors/rate-limiting
- [x] Phase 4: Jest + Supertest + mongodb-memory-server (11 passing tests), Swagger/OpenAPI docs at `/api-docs`, Postman collection with auto-chained token/task-ID variables
- [ ] Phase 5: Docker, GitHub Actions CI
- [ ] Phase 6: Deployment, uptime monitoring, seed script