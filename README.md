# TaskFlow API

[![Code Testing and CI](https://github.com/Bomote/taskflow-api/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Bomote/taskflow-api/actions/workflows/ci.yml)

A REST API for task management, built as a portfolio piece demonstrating production-grade Node.js/TypeScript backend practices — clean architecture, input validation, authentication, automated testing, and containerized deployment.

> 🚧 Currently mid-hardening pass following an external code review: consistent error taxonomy, pagination, expanded test coverage, and production-readiness fixes. See Progress Log for exact status.

## Live Demo

- **API:** https://taskflow-api-l7hr.onrender.com
- **Interactive docs (Swagger):** https://taskflow-api-l7hr.onrender.com/api-docs
- **Health check:** https://taskflow-api-l7hr.onrender.com/health

Hosted on Render's free tier — the instance spins down after inactivity, so the first request after a while may take 30–60 seconds to respond.

## Tech Stack

- **Runtime/Language:** Node.js, TypeScript
- **Framework:** Express
- **Database:** MongoDB (Atlas), Mongoose
- **Validation:** Zod
- **Auth:** JWT (jsonwebtoken), bcryptjs
- **Security:** helmet, cors, express-rate-limit
- **Testing:** Jest, Supertest, mongodb-memory-server, @swc/jest
- **Docs:** Swagger/OpenAPI (swagger-jsdoc, swagger-ui-express), Postman
- **DevOps:** Docker, GitHub Actions CI, Render, UptimeRobot

## Endpoints

| Method | Path                | Description             | Auth Required |
|--------|---------------------|--------------------------|----------------|
| GET    | `/health`           | Health check             | No             |
| POST   | `/api/auth/register`| Register a new user      | No             |
| POST   | `/api/auth/login`   | Log in, receive a JWT    | No             |
| GET    | `/api/tasks`        | List the caller's tasks, paginated (`?page=&limit=`) | Yes |
| POST   | `/api/tasks`        | Create a new task        | Yes            |
| GET    | `/api/tasks/:id`    | Fetch one of the caller's tasks by ID | Yes |
| PUT    | `/api/tasks/:id`    | Update one of the caller's tasks (rejects an empty body) | Yes |
| DELETE | `/api/tasks/:id`    | Delete one of the caller's tasks      | Yes |

Task routes require `Authorization: Bearer <token>`, obtained via `/api/auth/login`. `/api/auth/*` routes are rate-limited (100 requests / 15 min per client). Full interactive documentation is available at `/api-docs`.

### Pagination (`GET /api/tasks`)

- `page` (default `1`) and `limit` (default `10`, max `15`) — both must be positive integers; anything else (zero, negative, decimal, non-numeric, an array/repeated value, or above the cap) returns `400`.
- Results are sorted newest-first, with a stable secondary tie-break so ordering stays deterministic even when multiple tasks share the same creation timestamp.
- Response includes a `pagination` object: `{ page, limit, total, totalPages }`, scoped strictly to the authenticated user's own tasks.
- A page beyond the last one returns an empty `data` array with accurate (non-fabricated) metadata, not an error.

## Response Shape

Every endpoint responds with one of two consistent shapes:
- Success: `{ "success": true, "data": ... }`
- Failure: `{ "success": false, "error": { "code": "SOME_ERROR_CODE", "message": "...", "details"?: [{ "field": "...", "message": "..." }] } }`

`code` is a stable, machine-checkable identifier (defined once in `utils/errorCodes.ts`); `message` is a human-readable string; `details` is present only on validation failures, giving a per-field breakdown.

## How to Run Locally

**Without Docker:**
1. Clone the repo and `cd` into it.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your own MongoDB Atlas connection string and a generated `JWT_SECRET` (`openssl rand -hex 32`).
   - If you're on Windows and hit `ECONNREFUSED` on a DNS SRV lookup despite the connection string being correct, see **Known Issues** below.
4. Run the server: `node --env-file=.env src/server.ts`
5. Confirm it's up: `curl http://localhost:5000/health`

**With Docker:**
1. Steps 1–3 above.
2. `docker build -t taskflow-api .`
3. `docker run -p 5000:5000 --env-file .env taskflow-api`

Either way, explore and test interactively at `http://localhost:5000/api-docs`, or import `TaskFlow.postman_collection.json` into Postman.

## Testing

```
npm test           # runs the full suite against an in-memory MongoDB instance
npm run typecheck  # separate type-check step — see Design Decisions below for why this is separate
```

Both run automatically in CI on every push/PR to `main`. Tests live in `src/tests/`: `auth.test.ts` covers registration and login (including the duplicate-registration race and consistent auth-failure responses), `tasks.test.ts` covers authenticated task CRUD, ownership scoping, and pagination — including boundary values, invalid-input variants (zero, negative, decimal, non-numeric, repeated/array query values), empty and past-the-end pages, and cross-user total isolation. A `globalSetup`/`globalTeardown` pair spins up a fresh `mongodb-memory-server` instance once per run, so tests never touch the real Atlas database.

## API Documentation

- **Swagger/OpenAPI** — served at `/api-docs`, generated from JSDoc comments above each route. Fully interactive, including "Try it out" with Bearer-token auth. Currently being brought back in line with the updated status codes, error shape, and pagination parameters (Step 6 of the ongoing hardening pass — see Progress Log).
- **Postman** — `TaskFlow.postman_collection.json` at the repo root. Registration generates a fresh random email/password and captures them into collection variables; login captures the returned JWT; task creation captures the new task's ID.

## CI/CD & Deployment

- **`.github/workflows/ci.yml`** runs on every push/PR to `main`: checkout → Node setup → `npm ci` → `npm run typecheck` → `npm test`. `JWT_SECRET` is provided via a GitHub Actions repository secret, generated separately from any local or production value.
- **Deployed on Render**, built directly from the repo's `Dockerfile`. Environment variables are set in Render's dashboard, never committed — production's `JWT_SECRET` is distinct from both the local development and CI values.
- **Monitored via UptimeRobot**, pinging `/health` every 5 minutes.
- **`src/utils/seed.ts`** resets the live demo to a known-clean state: finds and removes a specific, hardcoded demo user and their tasks if they already exist, then recreates the user with four tasks across varied statuses. Run via `npm run seed`, which requires `CONFIRM_SEED=true` and is intended to be pointed at a separate `.env.production` file.

## Architecture

Request flow for task routes: **client → `app.ts` (helmet, cors, json parsing) → `protect` (JWT verification) → route-level `validateRequest`/`validateQuery` → `taskRoutes.ts` → `taskController.ts` → `Task.ts` (Mongoose) → MongoDB**, with any thrown error diverted at any point to `errorHandler.ts`. Auth routes follow the same shape minus `protect`, with `express-rate-limit` applied instead.

- **`app.ts`** — builds and fully configures the Express app (trust proxy, helmet, cors, json parsing, routes, Swagger UI, a JSON 404 catch-all, error handler) and exports it directly, with no `.listen()` call and no database connection.
- **`server.ts`** — the actual entry point: imports the configured app, connects to the database, and starts listening.
- **`config/db.ts`** — the database connection lifecycle: URI validation, connection, a `ping` confirmation, and a `readyState` guard against duplicate connections.
- **`config/swagger.ts`** — the OpenAPI definition, servers (local + live), and the shared `bearerAuth` security scheme.
- **`models/Task.ts`** / **`models/User.ts`** — document shapes; `User.ts` hashes passwords via a pre-save hook and excludes the hash from query results by default.
- **`utils/errorCodes.ts`** — the single source of truth for every error response: a typed map of error keys to `{ status, message }`, plus `sendError(res, key, details?)`, which every controller and middleware uses to build failure responses. This is what guarantees the error shape is identical everywhere in the app.
- **`utils/validators.ts`** — Zod schemas (including `paginationQuerySchema`) plus `validateRequest`/`validateQuery`, generic middleware-builders for validating request bodies and query strings respectively.
- **`utils/seed.ts`** — the demo-data reset script.
- **`middlewares/protect.ts`** — verifies the JWT (pinned to `HS256` at verify time) and attaches a type-checked user payload onto `req.user`.
- **`middlewares/errorHandler.ts`** — the terminal error handler: converts Zod validation errors into `VALIDATION_ERROR` responses with per-field `details`, and everything else into a generic, logged-server-side-only `INTERNAL_ERROR`.
- **`controllers/`** — business logic; every task query is scoped to the requesting user; every failure response goes through `sendError`, never a raw caught error.
- **`routes/`** — pure wiring, with `@openapi` JSDoc comments above each route.
- **`tests/`** — `testSetup.ts`/`testTeardown.ts` for the in-memory MongoDB instance; `auth.test.ts`, `tasks.test.ts`.

## Design Decisions

- **A single, structured error shape (`{ code, message, details? }`) replaced an earlier, inconsistent mix of flat `error`/`message` strings across different endpoints.** Every failure response is now built through one function, `sendError`, referencing one central map of error definitions (`errorCodes.ts`) — a typo in a status code or message is now a compile-time error (via a `keyof` type constraint), not a silent inconsistency a reviewer has to find by hand.
- **Login failures return 401, not 400; duplicate email on registration returns 409, not 400.** The original codes contradicted the app's own documented conventions (401 for authentication failures elsewhere, e.g. `protect.ts`) and collapsed genuinely different failure types into one generic code.
- **The register race condition is handled explicitly.** Two concurrent registrations for the same email can both pass the initial existence check before either write completes; the `catch` block specifically detects MongoDB's numeric duplicate-key error (`11000`) and returns the same `EMAIL_ALREADY_REGISTERED` response as the normal path, rather than leaking a raw database error.
- **No controller returns a caught exception's raw message to the client.** Every generic `catch` block logs the real error server-side and returns a generic `INTERNAL_ERROR` — closing a real information-disclosure gap where internal error text was previously exposed directly in API responses.
- **`jwt.verify` explicitly pins `algorithms: ['HS256']`.** Without this, the library would accept a token claiming any algorithm it supports, not just the one actually used to sign tokens — a known class of JWT vulnerability.
- **`PUT` requests with an empty body are rejected (400), rather than silently succeeding as a no-op.** Discovered via a deliberately-written failing test before the fix existed — `findOneAndUpdate({}, ...)` doesn't error on an empty update, it just returns the document unchanged with a 200, which is misleading for a client that intended to change something.
- **Pagination's query-parsing middleware (`validateQuery`) is typed narrowly to its one real use case**, rather than generically like `validateRequest`. Query-string values arrive as strings and need coercion to numbers; rather than fighting Express's strict `req.query` type, parsed pagination values are attached to a new, purpose-built `req.pagination` property (mirroring how `req.user` is attached by `protect`), typed generically enough to infer the correct output shape from whatever schema is passed in, but constrained to schemas producing exactly `{ page, limit }` — there's no current second use case to design broader reusability for.
- **`getTasks` runs its data query and its count query concurrently (`Promise.all`), not sequentially**, since neither depends on the other's result.
- **Task sorting uses `{ createdAt: -1, _id: -1 }`, not `createdAt` alone.** A `createdAt`-only sort has no defined tiebreaker when multiple documents share the same timestamp (a real possibility with bulk inserts, or high-throughput creation) — this surfaced as a genuine, reproducible test failure (a pagination test showed overlapping results between two pages) before being understood and fixed, not a decision made in the abstract.
- **Task ownership is enforced at the query level.** Every task lookup, update, and delete filters by `{ _id: taskId, userId: req.user.id }`. A request for another user's task returns **404**, not 403.
- **Tests run against an in-memory MongoDB (`mongodb-memory-server`)**, not a shared Atlas test database.
- **`@swc/jest` is used instead of `ts-jest`**, with `tsc --noEmit` as its own script and CI step covering the type-checking `@swc/jest` intentionally skips.
- **JWTs are signed with HS256 using a single shared secret, not RS256.** Every environment (local, CI, production) has its own distinct secret.

## Known Issues

- **Node fails to resolve `mongodb+srv://` DNS SRV records on some Windows setups.** **Workaround:** a non-SRV connection string.
- **Mongoose 9's TypeScript types for `schema.pre('save', ...)` reject a hook mixing `async` with a manual `next` parameter.** Resolved with pure `async`/`await`.
- **`ts-jest`'s current release does not support TypeScript 7.** `@swc/jest` is used instead.
- **Swagger/OpenAPI docs, the Postman collection, and this README's own claims are being brought back in line with recent changes** (structured error shape, new status codes, pagination) as part of an ongoing hardening pass — treat any example response elsewhere that still shows a flat `error` string or a 400 for login/duplicate-email as stale until that pass is complete.
- **Liveness/readiness health-check split, correlation IDs, graceful shutdown, and Docker multi-stage/non-root hardening are planned but not yet implemented.**

## Progress Log

- [x] Phases 1–6: core CRUD, validation, auth, testing/docs infrastructure, Docker/CI, deployment (see git history / `v1.0-portfolio` tag for that state)
- [x] Post-review hardening — Step 1: unified error shape, corrected status codes (401 login, 409 duplicate email)
- [x] Step 2: register race condition handled, no controller leaks raw error text
- [x] Step 3: JWT algorithm pinning, empty-update-body rejection, both with tests
- [x] Step 4: `GET /api/tasks` pagination — defaults, cap, invalid-input rejection (including array/repeated values), deterministic newest-first ordering, accurate metadata, cross-user isolation, empty/past-the-end pages — all covered by tests
- [ ] Step 5: remaining CRUD/ownership/auth-edge-case test coverage (get-one, update, delete happy paths; expired token; mass-assignment/oversized-body/unknown-field checks)
- [ ] Step 6: Swagger truth pass
- [ ] Step 7: Docker multi-stage/non-root/healthcheck, correlation IDs + structured logging, graceful shutdown, `/health/live` + `/health/ready`, Docker Compose
- [ ] Step 8: build/test isolation fix
- [ ] Step 9: full README accuracy pass
- [ ] Step 10: clean-clone release rehearsal, tagged release