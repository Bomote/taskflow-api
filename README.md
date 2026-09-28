# TaskFlow API

[![Code Testing and CI](https://github.com/Bomote/taskflow-api/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Bomote/taskflow-api/actions/workflows/ci.yml)

A REST API for task management, built as a portfolio piece demonstrating production-grade Node.js/TypeScript backend practices — clean architecture, input validation, authentication, automated testing, and containerized deployment.

> 🚧 Currently mid-hardening pass following an external code review. Steps 1–5 (error contract, pagination, test coverage) are complete; API docs, container/runtime hardening, and release verification are still in progress. See the Progress Log for exact status.

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

Task routes require `Authorization: Bearer <token>`, obtained via `/api/auth/login`. `/api/auth/*` routes are rate-limited (100 requests / 15 min per client). Task `title` must be at least 3 characters; `description` is capped at 5000 characters; `status` must be one of `pending`, `in-progress`, `completed`.

### Pagination (`GET /api/tasks`)

- `page` (default `1`) and `limit` (default `10`, max `15`) — both must be positive integers; anything else (zero, negative, decimal, non-numeric, an array/repeated value, or above the cap) returns `400`.
- Results are sorted newest-first, with a stable secondary tie-break so ordering stays deterministic even when multiple tasks share the same creation timestamp.
- Response includes a `pagination` object: `{ page, limit, total, totalPages }`, scoped strictly to the authenticated user's own tasks.
- A page beyond the last one returns an empty `data` array with accurate metadata, not an error.

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
npm run typecheck  # separate type-check step — covers test files too (see Design Decisions)
```

Both run automatically in CI on every push/PR to `main`. Tests live in `src/tests/`:

- **`auth.test.ts`** — registration and login, including the duplicate-registration path and consistent auth-failure responses (same error code for a wrong password and an unknown email).
- **`tasks.test.ts`** — organized into sections:
  - *Core CRUD happy paths* — create, list, fetch one, update (with a follow-up fetch proving persistence), delete (with a follow-up fetch proving it's gone).
  - *Auth edge cases* — no header, malformed token, expired token.
  - *Validation edge cases* — malformed ObjectId, empty update body, invalid status (with a follow-up fetch proving nothing was saved), empty-string title, over-length description, unknown fields ignored.
  - *Mass-assignment / ownership integrity* — a client-supplied `userId` and `_id` on both create and update are ignored; verified by fetching the task back as its real owner (correct ID and owner), fetching it as a different user (404), and confirming nothing was created under the injected ID.
  - *Cross-user ownership* — another user's task can't be read, updated, or deleted (all 404), and is confirmed untouched afterward.
  - *Pagination* — defaults, the maximum limit boundary, invalid input variants (zero, negative, decimal, non-numeric, unsafe integer, repeated/array values), empty and past-the-end pages, slicing with no overlap between pages, and per-user total isolation.
  - *Forced failure* — a model call is mocked to throw an error containing a distinctive string; the test asserts a generic `INTERNAL_ERROR` response and that the string appears nowhere in the response body.

A `globalSetup`/`globalTeardown` pair spins up a fresh `mongodb-memory-server` instance once per run, so tests never touch the real Atlas database.

## API Documentation

- **Swagger/OpenAPI** — served at `/api-docs`, generated from JSDoc comments above each route. Fully interactive, including "Try it out" with Bearer-token auth. **Currently out of date** relative to the error contract and pagination changes above (see Known Issues).
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
- **`utils/errorCodes.ts`** — the single source of truth for every error response: a typed map of error keys to `{ status, message }`, plus `sendError(res, key, details?)`, which every controller and middleware uses to build failure responses.
- **`utils/validators.ts`** — Zod schemas (including `paginationQuerySchema`) plus `validateRequest`/`validateQuery`, generic middleware-builders for validating request bodies and query strings respectively.
- **`utils/seed.ts`** — the demo-data reset script.
- **`middlewares/protect.ts`** — verifies the JWT (pinned to `HS256` at verify time) and attaches a type-checked user payload onto `req.user`.
- **`middlewares/errorHandler.ts`** — the terminal error handler: converts Zod validation errors into `VALIDATION_ERROR` responses with per-field `details`, and everything else into a generic, logged-server-side-only `INTERNAL_ERROR`.
- **`controllers/`** — business logic; every task query is scoped to the requesting user; every failure response goes through `sendError`, never a raw caught error.
- **`routes/`** — pure wiring, with `@openapi` JSDoc comments above each route.
- **`tests/`** — `testSetup.ts`/`testTeardown.ts` for the in-memory MongoDB instance; `auth.test.ts`, `tasks.test.ts`.

## Design Decisions

- **A single, structured error shape (`{ code, message, details? }`) replaced an earlier, inconsistent mix of flat `error`/`message` strings across different endpoints.** Every failure response is built through one function, `sendError`, referencing one central map of error definitions — a typo in a status code or message is a compile-time error (via a `keyof` type constraint), not a silent inconsistency.
- **Login failures return 401, not 400; duplicate email on registration returns 409, not 400.** The original codes contradicted the app's own conventions (401 for authentication failures elsewhere) and collapsed different failure types into one generic code.
- **The register race condition is handled explicitly.** Two concurrent registrations for the same email can both pass the initial existence check before either write completes; the `catch` block detects MongoDB's numeric duplicate-key error (`11000`) and returns the same `EMAIL_ALREADY_REGISTERED` response as the normal path.
- **No controller returns a caught exception's raw message to the client.** Every generic `catch` block logs the real error server-side and returns a generic `INTERNAL_ERROR`. This is verified by a test that forces a failure and checks the secret text never appears in the response.
- **Mass assignment is defended in two layers.** Zod object schemas strip unrecognized keys at the route boundary (so a client-sent `userId` or `_id` never reaches a controller), and controllers write from explicitly named fields with the owner taken from the verified token — so the protection doesn't depend on schema configuration alone. Tests cover both create and update, and check the result by fetching the task back as its owner and as another user rather than only asserting the injected value is absent.
- **Input size is bounded where it's cheap to do so** — `description` is capped at 5000 characters and `limit` at 15 — so oversized payloads and unbounded page sizes are rejected at validation instead of reaching the database.
- **`jwt.verify` explicitly pins `algorithms: ['HS256']`.** Without this, the library would accept a token claiming any algorithm it supports, not just the one used to sign tokens.
- **`PUT` requests with an empty body are rejected (400), rather than silently succeeding as a no-op.** Found by writing the failing test first: `findOneAndUpdate` with an empty update doesn't error, it returns the document unchanged with a 200, which is misleading for a client that meant to change something.
- **Pagination's query-parsing middleware (`validateQuery`) is typed narrowly to its one real use case**, rather than generically like `validateRequest`. Parsed values are attached to a purpose-built `req.pagination` property (mirroring how `req.user` is attached by `protect`) because Express's `req.query` type only permits strings.
- **`getTasks` runs its data query and its count query concurrently (`Promise.all`)**, since neither depends on the other's result.
- **Task sorting uses `{ createdAt: -1, _id: -1 }`, not `createdAt` alone.** A `createdAt`-only sort has no defined tiebreaker when documents share a timestamp — this surfaced as a real, reproducible test failure (overlapping results between two pages) before being understood and fixed.
- **Each test that mutates data creates its own fixture.** Early versions shared a task across several tests and broke whenever tests were reordered or added (one test consumed a task another still needed; a hand-counted pagination expectation went stale). Tests now derive expected values from what they observe at runtime and don't depend on file order.
- **Task ownership is enforced at the query level.** Every task lookup, update, and delete filters by `{ _id: taskId, userId: req.user.id }`. A request for another user's task returns **404**, not 403 — indistinguishable from a task that doesn't exist.
- **Tests run against an in-memory MongoDB (`mongodb-memory-server`)**, not a shared Atlas test database.
- **`@swc/jest` is used instead of `ts-jest`**, since the project's TypeScript version outpaced `ts-jest`'s supported peer range. Because `@swc/jest` strips types without checking them, `tsc --noEmit` runs as its own script and its own CI step — which also type-checks the test files.
- **JWTs are signed with HS256 using a single shared secret, not RS256.** Every environment (local, CI, production) has its own distinct secret.

## Known Issues

- **Swagger/OpenAPI docs and the Postman collection are out of date.** They still describe the earlier flat error shape and 400 responses for login and duplicate-email registration, and don't yet document pagination parameters or the `pagination` response object. Being updated as the next step of the hardening pass; treat the tests and this README as the source of truth until then.
- **Node fails to resolve `mongodb+srv://` DNS SRV records on some Windows setups.** **Workaround:** a non-SRV connection string.
- **Mongoose 9's TypeScript types for `schema.pre('save', ...)` reject a hook mixing `async` with a manual `next` parameter.** Resolved with pure `async`/`await`.
- **`ts-jest`'s current release does not support TypeScript 7.** `@swc/jest` is used instead.
- **Planned but not yet implemented:** a liveness/readiness health-check split, correlation IDs and structured logging, graceful shutdown, and Docker hardening (multi-stage build, non-root user, container health check).

## Progress Log

- [x] Original build, phases 1–6: core CRUD, validation, auth, testing/docs infrastructure, Docker/CI, deployment (see the `v1.0-portfolio` tag for that state)
- [x] Hardening step 1: unified error shape, corrected status codes (401 login, 409 duplicate email)
- [x] Hardening step 2: register race condition handled, no controller leaks raw error text
- [x] Hardening step 3: JWT algorithm pinning, empty-update-body rejection
- [x] Hardening step 4: `GET /api/tasks` pagination with full edge-case coverage
- [x] Hardening step 5: CRUD, ownership, mass-assignment, validation, auth-edge-case, and forced-failure test coverage
- [ ] Hardening step 6: Swagger/OpenAPI and Postman brought in line with current behavior
- [ ] Hardening step 7: Docker multi-stage/non-root/health check, correlation IDs + structured logging, graceful shutdown, `/health/live` + `/health/ready`, Docker Compose
- [ ] Hardening step 8: build/test isolation fix
- [ ] Hardening step 9: full README accuracy pass
- [ ] Hardening step 10: clean-clone release rehearsal, tagged release