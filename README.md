# TaskFlow API

[![Code Testing and CI](https://github.com/Bomote/taskflow-api/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Bomote/taskflow-api/actions/workflows/ci.yml)

A REST API for task management, built as a portfolio piece demonstrating production-grade Node.js/TypeScript backend practices — clean architecture, input validation, authentication, automated testing, and containerized deployment.

## Live Demo

- **API:** https://taskflow-api-l7hr.onrender.com
- **Interactive docs (Swagger):** https://taskflow-api-l7hr.onrender.com/api-docs
- **Health check:** https://taskflow-api-l7hr.onrender.com/health

Hosted on Render's free tier — the instance spins down after inactivity, so the first request after a while may take 30–60 seconds to respond (a monitoring ping keeps this to a minimum, but a cold start is still possible).

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
| GET    | `/api/tasks`        | List the caller's tasks  | Yes            |
| POST   | `/api/tasks`        | Create a new task        | Yes            |
| GET    | `/api/tasks/:id`    | Fetch one of the caller's tasks by ID | Yes |
| PUT    | `/api/tasks/:id`    | Update one of the caller's tasks      | Yes |
| DELETE | `/api/tasks/:id`    | Delete one of the caller's tasks      | Yes |

Task routes require `Authorization: Bearer <token>`, obtained via `/api/auth/login`. `/api/auth/*` routes are rate-limited (100 requests / 15 min per client). `GET /api/tasks` accepts `?page=` (default 1) and `?limit=` (default 20, capped at 100), returns tasks newest-first with a `pagination` object (`page`, `limit`, `total`, `totalPages`). Full interactive documentation is available at `/api-docs`.

## Response Shape

Every endpoint responds with one of two consistent shapes:
- Success: `{ "success": true, "data": ... }` (list endpoints add a `pagination` object; registration also returns a human-readable `message`)
- Failure: `{ "success": false, "error": ... }` (validation failures add a `details` array of Zod issues)

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

Both run automatically in CI on every push/PR to `main` — see the badge above. Tests live in `src/test/`: `auth.test.ts` covers registration and login (duplicate email, weak password, wrong password, unknown email); `tasks.test.ts` covers authenticated task CRUD, cross-user isolation (another user's task reads as 404 on GET/PUT/DELETE), validation failures, pagination, expired-token rejection and the JSON 404 for unknown routes. A `globalSetup`/`globalTeardown` pair spins up a fresh `mongodb-memory-server` instance once per run, so tests never touch the real Atlas database.

## API Documentation

- **Swagger/OpenAPI** — served at `/api-docs`, generated from JSDoc comments above each route. Fully interactive, including "Try it out" with Bearer-token auth.
- **Postman** — `TaskFlow.postman_collection.json` at the repo root. Registration generates a fresh random email/password and captures them into collection variables; login captures the returned JWT; task creation captures the new task's ID — the whole collection runs top-to-bottom with no manual copy-pasting.

## CI/CD & Deployment

- **`.github/workflows/ci.yml`** runs on every push/PR to `main`: checkout → Node setup → `npm ci` → `npm run typecheck` → `npm test` → `npm run build` (verifying the exact command the Docker image uses). `JWT_SECRET` is provided via a GitHub Actions repository secret, generated separately from any local or production value.
- **Deployed on Render**, built directly from the repo's `Dockerfile`. Environment variables (`MONGODB_URI`, `JWT_SECRET`, `PORT`, `NODE_ENV=production`) are set in Render's dashboard, never committed — and the production `JWT_SECRET` is distinct from both the local development and CI values.
- **Monitored via UptimeRobot**, pinging `/health` every 5 minutes — keeps the free-tier instance from cold-starting on a visitor's first request, and alerts if the service genuinely goes down.
- **`src/utils/seed.ts`** resets the live demo to a known-clean state before recording or sharing: finds and removes a specific, hardcoded demo user (by email) and their tasks if they already exist, then recreates the user with four tasks across varied statuses. Run via `npm run seed`, which requires `CONFIRM_SEED=true` and is intended to be pointed at a separate `.env.production` file — never the default local `.env` — to avoid ever running it against the wrong database by habit.

## Architecture

Request flow for task routes: **client → `app.ts` (helmet, cors, json parsing) → `protect` (JWT verification) → route-level `validateRequest` (on write operations) → `taskRoutes.ts` → `taskController.ts` → `Task.ts` (Mongoose) → MongoDB**, with Zod validation errors forwarded to `errorHandler.ts` and unexpected errors converted to safe JSON responses in the controllers.

- **`app.ts`** — builds and fully configures the Express app (trust proxy, helmet, cors, json parsing, routes, Swagger UI, JSON 404 handler, error handler) and exports it directly, with no `.listen()` call and no database connection — this is what makes the app importable and testable via Supertest with zero real network/DB side effects.
- **`server.ts`** — the actual entry point: imports the configured app, connects to the database, and starts listening. Compiled to `dist/server.js` for both local builds and the Docker image's `CMD`.
- **`config/db.ts`** — the entire database connection lifecycle: URI validation, connection, a `ping` confirmation, and a `readyState` guard against duplicate/concurrent connections.
- **`config/swagger.ts`** — the OpenAPI definition and the glob pattern telling `swagger-jsdoc` where to find route documentation comments.
- **`models/Task.ts`** / **`models/User.ts`** — document shapes; `User.ts` hashes passwords via a pre-save hook and excludes the hash from query results by default.
- **`utils/validators.ts`** — Zod schemas plus `validateRequest(schema)`, a single generic middleware-builder reused across every write endpoint.
- **`utils/seed.ts`** — the demo-data reset script described above.
- **`middlewares/protect.ts`** — verifies the JWT and attaches a type-checked user payload onto `req.user`.
- **`middlewares/errorHandler.ts`** — catches errors forwarded from validation middleware and anything unexpected that escapes a route, turning them into consistent, safe JSON responses (no stack traces or driver messages leak to clients).
- **`controllers/`** — business logic; every task query is scoped to the requesting user. Controllers return typed errors directly (`400` for bad input, `401`/`404`/`409` as appropriate) and generic `500`s for anything unexpected.
- **`routes/`** — pure wiring, with `@openapi` JSDoc comments above each route.
- **`test/testSetup.ts`** / **`test/testTeardown.ts`** — Jest global setup/teardown for the in-memory MongoDB instance.
- **`Dockerfile`** — multi-stage build: the builder stage installs with `npm ci` and compiles TypeScript; the runner stage reinstalls production-only dependencies, runs as the non-root `node` user, and exposes a `HEALTHCHECK` against `/health`. Dependency manifests are copied before source in both stages, so an ordinary code change doesn't force a full dependency reinstall on every rebuild.

## Design Decisions

- **`app.ts` and `server.ts` are deliberately separate files**, so the app can be imported by Supertest with no side effects.
- **`app.set('trust proxy', 1)` is required for correct rate-limiting behind Render's reverse proxy.** Render sits the app behind a single proxy hop that sets `X-Forwarded-For`; without explicitly trusting exactly that one hop, Express refuses to use the header at all (since blindly trusting a client-settable header would let anyone spoof their IP and bypass rate limiting) — `1`, not a blanket `true`, bounds trust to the actual number of hops in Render's architecture.
- **Task ownership is enforced at the query level.** Every task lookup, update, and delete filters by `{ _id: taskId, userId: req.user.id }`. A request for another user's task returns **404**, not 403.
- **Login and registration return a consistent, generic "Invalid credentials" message** for both a nonexistent email and a wrong password, to avoid letting an attacker enumerate registered emails.
- **The seed script scopes every delete to a specific, hardcoded demo account rather than wiping the database unconditionally**, and requires an explicit `CONFIRM_SEED=true` flag to run at all — both specifically to bound the damage of ever running it against the wrong target by mistake, given it's meant to be run repeatedly against a live production database.
- **Tests run against an in-memory MongoDB (`mongodb-memory-server`)**, not a shared Atlas test database — fast, isolated, and reproducible without external infrastructure, including inside CI.
- **`@swc/jest` is used instead of `ts-jest`**, since the project's TypeScript version outpaced `ts-jest`'s supported peer range. `tsc --noEmit` runs as its own script (and its own CI step) to cover the type-checking `@swc/jest` intentionally skips.
- **Swagger documentation is hand-written in JSDoc comments, not auto-generated from the Zod schemas.** Each route's documented response codes were traced against the actual controller logic rather than assumed.
- **The Docker build uses `npm ci`, not `npm install`**, in both stages, so builds are reproducible from the lockfile; the runtime image and CI both run Node 24.
- **Every environment (local, CI, production) has its own distinct `JWT_SECRET`**, generated separately, since there's no reason for a CI or dev secret to share sensitivity with the one actually protecting live user sessions.
- **JWTs are signed with HS256 using a single shared secret, not RS256.** Passwords are hashed via a pre-save hook and excluded from query results by default (`select: false`).
- **Status codes are split by failure type**: `400` client-caused bad input, `401` authentication failures, `404` a well-formed ID that doesn't match (or isn't owned by the caller), `409` duplicate email on registration, `500` unexpected server-side failures.
- **`GET /api/tasks` is paginated** (`page`/`limit`, capped at 100 per page, newest first) rather than returning an unbounded array, so response size stays predictable as a user's task list grows.

## Known Issues

- **Node fails to resolve `mongodb+srv://` DNS SRV records on some Windows setups.** **Workaround:** a non-SRV connection string (Atlas → Connect → Drivers → older driver version). Not confirmed whether this is Windows-specific or would also affect other environments.
- **Mongoose 9's TypeScript types for `schema.pre('save', ...)` reject a hook mixing `async` with a manual `next` parameter.** Resolved with pure `async`/`await`, no `next` parameter.
- **`ts-jest`'s current release does not support TypeScript 7.** `@swc/jest` is used instead — see Design Decisions.
- **The Postman collection's task-creation request uses a static title.** Re-running the collection creates additional tasks with the same title rather than erroring — not a bug, just a minor tidiness gap versus the auto-generated auth fixtures.